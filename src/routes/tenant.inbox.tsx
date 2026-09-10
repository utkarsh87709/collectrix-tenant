import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, PauseCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard } from "@/components/tenant/ui";
import { InitiateCallDialog } from "@/components/tenant/customers/InitiateCallDialog";
import { ConversationList } from "@/components/tenant/inbox/ConversationList";
import { EMPTY_INBOX_FILTERS, type InboxFilters } from "@/components/tenant/inbox/inbox-utils";
import { ConversationThread } from "@/components/tenant/inbox/ConversationThread";
import { DetailsPanel } from "@/components/tenant/inbox/DetailsPanel";
import { useCustomerPermissions } from "@/lib/customer-permissions";
import {
  customerDisplayName,
  getCustomerDetails,
  startEngagement,
  stopEngagement,
  type CustomerDetails,
} from "@/lib/customers-api";
import {
  getInboxCustomers,
  inboxPreview,
  type InboxChannel,
  type InboxCustomer,
} from "@/lib/inbox-api";
import { getAllStatus, type Status } from "@/lib/statuses-api";
import { getTeamList, type TeamListItem } from "@/lib/teams-api";
import { getClientList, type MassUpdateClient } from "@/lib/mass-update-api";

export const Route = createFileRoute("/tenant/inbox")({
  head: () => ({ meta: [{ title: "Inbound Inbox · Tenant Admin" }] }),
  component: InboxPage,
});

const PAGE_SIZE = 25;
// Silent background refresh of the list while the tab is visible. There's no
// push channel from the backend, so this is what keeps new replies appearing.
const POLL_MS = 60_000;
// The details pane is a slide-over on every screen size (chosen over a third
// column: it keeps the thread full-width and reads better in review).

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function InboxPage() {
  const perms = useCustomerPermissions();

  /* --------------------------- Reference data --------------------------- */
  const [clients, setClients] = useState<MassUpdateClient[]>([]);
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getClientList(), getTeamList(), getAllStatus()]).then(([c, t, s]) => {
      if (cancelled) return;
      if (c.status === "fulfilled") setClients(c.value.clientList);
      if (t.status === "fulfilled") setTeams(t.value.teamList);
      if (s.status === "fulfilled") setStatuses(s.value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------- Filters ------------------------------ */
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search.trim(), 300);
  const [filters, setFilters] = useState<InboxFilters>(EMPTY_INBOX_FILTERS);
  const [unreadOnly, setUnreadOnly] = useState(false);

  /* -------------------------------- List -------------------------------- */
  const [rows, setRows] = useState<InboxCustomer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const pageRef = useRef(0);

  const serverFilters = useMemo(
    () => ({
      searchText: debouncedSearch,
      clientId: filters.client === "all" ? null : filters.client,
      teamId: filters.team === "all" ? null : filters.team,
      statusId: filters.status === "all" ? null : filters.status,
    }),
    [debouncedSearch, filters],
  );

  /** "reset" replaces the list from page 0; "more" appends the next page;
   *  "silent" re-reads every page loaded so far without touching the UI state. */
  const fetchList = useCallback(
    async (mode: "reset" | "more" | "silent") => {
      const seq = ++requestSeq.current;
      const current = pageRef.current;
      const p = mode === "more" ? current + 1 : 0;
      const size = mode === "silent" ? (current + 1) * PAGE_SIZE : PAGE_SIZE;
      if (mode === "reset") {
        setLoading(true);
        setListError(null);
      } else if (mode === "more") setLoadingMore(true);
      else setRefreshing(true);
      try {
        const r = await getInboxCustomers({ ...serverFilters, page: p, size });
        if (seq !== requestSeq.current) return;
        setTotalCount(r.totalCount);
        if (mode === "more") {
          setRows((prev) => {
            const seen = new Set(prev.map((x) => x.uploadedDebtorId));
            return [...prev, ...r.debtorList.filter((x) => !seen.has(x.uploadedDebtorId))];
          });
          pageRef.current = p;
          setPage(p);
        } else {
          setRows(r.debtorList);
          if (mode === "reset") {
            pageRef.current = 0;
            setPage(0);
          }
        }
        setListError(null);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        if (mode !== "silent")
          setListError(err instanceof Error ? err.message : "Couldn't load the inbox.");
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [serverFilters],
  );

  useEffect(() => {
    fetchList("reset");
  }, [fetchList]);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") fetchList("silent");
    }, POLL_MS);
    return () => clearInterval(t);
  }, [fetchList]);

  // Newest activity first when the rows carry a last-message time; otherwise
  // trust the server's order.
  const orderedRows = useMemo(() => {
    const stamped = rows.map((r) => ({ r, at: inboxPreview(r).at }));
    if (!stamped.some((x) => x.at)) return rows;
    return stamped
      .sort((a, b) => {
        const ta = a.at ? new Date(a.at).getTime() : 0;
        const tb = b.at ? new Date(b.at).getTime() : 0;
        return tb - ta;
      })
      .map((x) => x.r);
  }, [rows]);

  /* ------------------------------ Selection ----------------------------- */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [locallyRead, setLocallyRead] = useState<Set<number>>(() => new Set());
  const [channel, setChannel] = useState<InboxChannel>("sms");

  const select = useCallback((row: InboxCustomer) => {
    setSelectedId(row.uploadedDebtorId);
    // Opening a conversation reads it. The backend has no mark-as-read call yet,
    // so the badge is cleared locally for this session.
    setLocallyRead((s) => {
      if (s.has(row.uploadedDebtorId)) return s;
      const next = new Set(s);
      next.add(row.uploadedDebtorId);
      return next;
    });
    const ch = inboxPreview(row).channel;
    if (ch) setChannel(ch);
  }, []);

  // Land on the first conversation once the list arrives, like a mail client.
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current || selectedId !== null || orderedRows.length === 0) return;
    autoSelected.current = true;
    select(orderedRows[0]);
  }, [orderedRows, selectedId, select]);

  /* ------------------------------- Details ------------------------------ */
  const [details, setDetails] = useState<CustomerDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsKey, setDetailsKey] = useState(0);

  useEffect(() => {
    if (selectedId === null) {
      setDetails(null);
      return;
    }
    let cancelled = false;
    setDetailsLoading(true);
    setDetailsError(null);
    // Swap in a skeleton only when moving to a different file; a refresh of the
    // same file keeps the current details on screen until the new ones land.
    setDetails((d) => (d?.uploadedDebtorId === selectedId ? d : null));
    getCustomerDetails(selectedId)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch((err) => {
        if (!cancelled)
          setDetailsError(err instanceof Error ? err.message : "Couldn't load this customer.");
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, detailsKey]);

  const refreshDetails = () => setDetailsKey((k) => k + 1);
  /** A mutation touched the file (status, tags, assignment) — refresh both panes. */
  const onFileChanged = () => {
    refreshDetails();
    fetchList("silent");
  };

  /* --------------------------- Details visibility ------------------------ */
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    if (!detailsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detailsOpen]);

  /* ------------------------------ Engagement ---------------------------- */
  const [engagementBusy, setEngagementBusy] = useState(false);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);

  const resume = async () => {
    if (!details) return;
    setEngagementBusy(true);
    try {
      await startEngagement(details.uploadedDebtorId);
      toast.success("Engagement resumed.");
      onFileChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't resume engagement.");
    } finally {
      setEngagementBusy(false);
    }
  };

  const stop = async () => {
    if (!details) return;
    setEngagementBusy(true);
    try {
      await stopEngagement(details.uploadedDebtorId);
      toast.success("Engagement stopped.");
      setStopConfirmOpen(false);
      onFileChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't stop engagement.");
    } finally {
      setEngagementBusy(false);
    }
  };

  const toggleEngagement = () => {
    if (!details) return;
    if (details.engagementStatus === 1) setStopConfirmOpen(true);
    else resume();
  };

  /* --------------------------------- Call -------------------------------- */
  const [callOpen, setCallOpen] = useState(false);

  /* -------------------------------- Render ------------------------------- */
  const hasMore = rows.length < totalCount;

  return (
    <Shell>
      <Topbar
        title="Inbound Inbox"
        subtitle="Customer replies by SMS and email, with the file beside the conversation"
      />

      <section className="px-4 py-4 sm:px-5 lg:px-6">
        <div className="grid gap-4 lg:h-[calc(100dvh-8rem)] lg:min-h-[600px] lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
          <PageCard className="h-[60dvh] min-h-[420px] lg:h-full">
            <ConversationList
              rows={orderedRows}
              totalCount={totalCount}
              loading={loading}
              loadingMore={loadingMore}
              refreshing={refreshing}
              error={listError}
              selectedId={selectedId}
              onSelect={select}
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFiltersChange={setFilters}
              clients={clients}
              teams={teams}
              statuses={statuses}
              unreadOnly={unreadOnly}
              onUnreadOnlyChange={setUnreadOnly}
              locallyRead={locallyRead}
              hasMore={hasMore}
              onLoadMore={() => fetchList("more")}
              onRefresh={() => fetchList("silent")}
              onRetry={() => fetchList("reset")}
            />
          </PageCard>

          <PageCard className="h-[75dvh] min-h-[520px] lg:h-full">
            <ConversationThread
              details={details}
              loading={detailsLoading}
              error={detailsError}
              onRetry={refreshDetails}
              channel={channel}
              onChannelChange={setChannel}
              perms={perms}
              onCall={() => setCallOpen(true)}
              onToggleEngagement={toggleEngagement}
              engagementBusy={engagementBusy}
              detailsOpen={detailsOpen}
              onToggleDetails={() => setDetailsOpen((o) => !o)}
              onStatusChanged={onFileChanged}
              onSent={() => fetchList("silent")}
            />
          </PageCard>
        </div>
      </section>

      {detailsOpen && (
        <div className="fixed inset-0 z-40">
          <button
            className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
            onClick={() => setDetailsOpen(false)}
            aria-label="Close details"
          />
          <div className="absolute inset-y-0 right-0 flex w-[400px] max-w-[92vw] flex-col overflow-hidden rounded-l-2xl border-l border-border bg-card shadow-2xl animate-in slide-in-from-right duration-300 ease-out">
            <DetailsPanel
              details={details}
              loading={detailsLoading}
              perms={perms}
              onClose={() => setDetailsOpen(false)}
              onChanged={onFileChanged}
              onToggleEngagement={toggleEngagement}
              engagementBusy={engagementBusy}
            />
          </div>
        </div>
      )}

      {callOpen && details && (
        <InitiateCallDialog
          uploadedDebtorId={details.uploadedDebtorId}
          defaultTo={details.cellNo1}
          customerName={customerDisplayName(details)}
          onClose={() => setCallOpen(false)}
        />
      )}

      {stopConfirmOpen && details && (
        <StopEngagementConfirm
          name={customerDisplayName(details)}
          busy={engagementBusy}
          onClose={() => setStopConfirmOpen(false)}
          onConfirm={stop}
        />
      )}
    </Shell>
  );
}

/* --------------------------- Stop engagement --------------------------- */

function StopEngagementConfirm({
  name,
  busy,
  onClose,
  onConfirm,
}: {
  name: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-elegant">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-warning/15 text-warning-foreground">
              <PauseCircle className="h-4 w-4" />
            </span>
            <div className="font-display text-base font-bold">Stop engagement</div>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 text-sm">
          <p>
            All automated outreach to <span className="font-semibold">{name}</span> will pause — AI
            calls, scheduled SMS and email. You can still reply manually from the inbox, and resume
            engagement at any time.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-warning px-3 py-1.5 text-sm font-semibold text-warning-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Stop engagement
          </button>
        </div>
      </div>
    </div>
  );
}
