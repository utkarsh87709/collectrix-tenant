import { useMemo, useState } from "react";
import { Filter, Inbox, Loader2, Mail, MessageSquare, RefreshCw, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NativeSelect } from "@/components/tenant/ui";
import { customerDisplayName, normalizeTags } from "@/lib/customers-api";
import type { InboxCustomer } from "@/lib/inbox-api";
import type { Status } from "@/lib/statuses-api";
import type { TeamListItem } from "@/lib/teams-api";
import type { MassUpdateClient } from "@/lib/mass-update-api";
import { Avatar, MiniStatus } from "./InboxBits";
import {
  EMPTY_INBOX_FILTERS,
  activeInboxFilterCount,
  formatListTime,
  plainText,
  type InboxFilters,
} from "./inbox-utils";
import { resolveInboxRow } from "./inbox-placeholders";

export function ConversationList({
  rows,
  totalCount,
  loading,
  loadingMore,
  refreshing,
  error,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  clients,
  teams,
  statuses,
  unreadOnly,
  onUnreadOnlyChange,
  locallyRead,
  hasMore,
  onLoadMore,
  onRefresh,
  onRetry,
}: {
  rows: InboxCustomer[];
  totalCount: number;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
  selectedId: number | null;
  onSelect: (row: InboxCustomer) => void;
  search: string;
  onSearchChange: (v: string) => void;
  filters: InboxFilters;
  onFiltersChange: (f: InboxFilters) => void;
  clients: MassUpdateClient[];
  teams: TeamListItem[];
  statuses: Status[];
  unreadOnly: boolean;
  onUnreadOnlyChange: (v: boolean) => void;
  /** Conversations opened this session — their unread badge is cleared locally. */
  locallyRead: Set<number>;
  hasMore: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
  onRetry: () => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const activeFilters = activeInboxFilterCount(filters);

  // Colour lookup so a row whose payload lacks statusColorCode still gets the
  // tenant's pill colour by matching the status name/code it does carry.
  const statusByName = useMemo(() => {
    const m = new Map<string, Status>();
    for (const s of statuses) {
      m.set(s.status.toLowerCase(), s);
      m.set(s.statusCode.toLowerCase(), s);
    }
    return m;
  }, [statuses]);

  // Conversation summary per row: real fields, with samples filling the gaps
  // until the backend adds them (see inbox-placeholders.ts).
  const resolved = useMemo(() => {
    const m = new Map<number, ReturnType<typeof resolveInboxRow>>();
    for (const r of rows) m.set(r.uploadedDebtorId, resolveInboxRow(r));
    return m;
  }, [rows]);
  const unreadOf = (r: InboxCustomer) =>
    locallyRead.has(r.uploadedDebtorId) ? 0 : (resolved.get(r.uploadedDebtorId)?.unread ?? 0);

  const visible = useMemo(
    () => (unreadOnly ? rows.filter((r) => unreadOf(r) > 0) : rows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, unreadOnly, locallyRead, resolved],
  );
  const unreadTotal = rows.reduce((n, r) => n + unreadOf(r), 0);

  const subtitle = loading
    ? "Loading…"
    : `${totalCount} conversation${totalCount === 1 ? "" : "s"} · ${unreadTotal} unread`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ------------------------------ Header ------------------------------ */}
      <div className="relative border-b border-border px-4 pb-3 pt-4">
        <span
          className="absolute left-0 top-4 h-9 w-1 rounded-r-full bg-gradient-tenant"
          aria-hidden
        />
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold tracking-tight">Conversations</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={onRefresh}
              disabled={refreshing}
              title="Refresh"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <button
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold ${
                    activeFilters > 0
                      ? "border-tenant bg-tenant-soft text-tenant"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" /> Filter
                  {activeFilters > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-tenant px-1 text-[10px] text-white">
                      {activeFilters}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-0">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Filter conversations
                  </span>
                  {activeFilters > 0 && (
                    <button
                      onClick={() => onFiltersChange(EMPTY_INBOX_FILTERS)}
                      className="text-[11px] font-semibold text-tenant hover:underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="space-y-3 px-4 py-3">
                  <FilterField label="Client">
                    <NativeSelect
                      size="sm"
                      value={filters.client === "all" ? "all" : String(filters.client)}
                      onChange={(e) =>
                        onFiltersChange({
                          ...filters,
                          client: e.target.value === "all" ? "all" : Number(e.target.value),
                        })
                      }
                    >
                      <option value="all">All clients</option>
                      {clients.map((c) => (
                        <option key={c.clientId} value={c.clientId}>
                          {c.clientName}
                          {c.clientNumber ? ` · ${c.clientNumber}` : ""}
                        </option>
                      ))}
                    </NativeSelect>
                  </FilterField>
                  <FilterField label="Team">
                    <NativeSelect
                      size="sm"
                      value={filters.team === "all" ? "all" : String(filters.team)}
                      onChange={(e) =>
                        onFiltersChange({
                          ...filters,
                          team: e.target.value === "all" ? "all" : Number(e.target.value),
                        })
                      }
                    >
                      <option value="all">All teams</option>
                      {teams.map((t) => (
                        <option key={t.teamId} value={t.teamId}>
                          {t.teamName}
                        </option>
                      ))}
                    </NativeSelect>
                  </FilterField>
                  <FilterField label="Status">
                    <NativeSelect
                      size="sm"
                      value={filters.status === "all" ? "all" : String(filters.status)}
                      onChange={(e) =>
                        onFiltersChange({
                          ...filters,
                          status: e.target.value === "all" ? "all" : Number(e.target.value),
                        })
                      }
                    >
                      <option value="all">All statuses</option>
                      {statuses.map((s) => (
                        <option key={s.statusId} value={s.statusId}>
                          {s.statusCode} · {s.status}
                        </option>
                      ))}
                    </NativeSelect>
                  </FilterField>
                </div>
                <div className="border-t border-border px-4 py-2.5">
                  <button
                    onClick={() => setFilterOpen(false)}
                    className="w-full rounded-lg bg-gradient-tenant py-1.5 text-xs font-semibold text-white"
                  >
                    Done
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name, file no, phone…"
            className="h-9 w-full rounded-xl border border-border bg-muted/40 pl-9 pr-8 text-sm outline-none transition-colors focus:border-tenant focus:bg-background"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-2.5 inline-flex rounded-lg bg-muted p-0.5 text-xs font-semibold">
          <SegButton active={!unreadOnly} onClick={() => onUnreadOnlyChange(false)}>
            All
          </SegButton>
          <SegButton active={unreadOnly} onClick={() => onUnreadOnlyChange(true)}>
            Unread
            {unreadTotal > 0 && (
              <span
                className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] ${
                  unreadOnly ? "bg-tenant text-white" : "bg-tenant/15 text-tenant"
                }`}
              >
                {unreadTotal}
              </span>
            )}
          </SegButton>
        </div>
      </div>

      {/* ------------------------------- Rows ------------------------------- */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && rows.length === 0 ? (
          <RowSkeletons />
        ) : error ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-destructive">{error}</p>
            <button
              onClick={onRetry}
              className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Try again
            </button>
          </div>
        ) : visible.length === 0 ? (
          <EmptyRows unreadOnly={unreadOnly} filtered={activeFilters > 0 || !!search.trim()} />
        ) : (
          <ul className="divide-y divide-border/60">
            {visible.map((r) => {
              const id = r.uploadedDebtorId;
              const name = customerDisplayName(r);
              const { preview } = resolved.get(id) ?? resolveInboxRow(r);
              const unread = unreadOf(r);
              const selected = id === selectedId;
              const tags = normalizeTags(r.customerTags);
              const known =
                statusByName.get((r.statusCode ?? "").toLowerCase()) ??
                statusByName.get((r.status ?? "").toLowerCase());
              const secondary = [r.creditorName, r.ourFileNo].filter(Boolean).join(" · ");
              return (
                <li key={id}>
                  <button
                    onClick={() => onSelect(r)}
                    className={`group relative w-full px-4 py-3 text-left transition-colors ${
                      selected ? "bg-tenant-soft/70" : "hover:bg-muted/50"
                    }`}
                  >
                    {selected && (
                      <span
                        className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-gradient-tenant"
                        aria-hidden
                      />
                    )}
                    <div className="flex items-start gap-3">
                      <span className="relative shrink-0">
                        <Avatar name={name} seed={id} />
                        {unread > 0 && (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-tenant ring-2 ring-card"
                            aria-hidden
                          />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`truncate text-sm ${unread > 0 ? "font-bold" : "font-semibold"}`}
                          >
                            {name}
                          </span>
                          <span
                            className={`ml-auto shrink-0 text-[11px] tabular-nums ${
                              unread > 0 ? "font-semibold text-tenant" : "text-muted-foreground"
                            }`}
                          >
                            {formatListTime(preview.at)}
                          </span>
                        </div>
                        {secondary && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {secondary}
                          </div>
                        )}
                        <div
                          className={`mt-1 flex items-center gap-1.5 text-xs ${
                            unread > 0 ? "font-medium text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {preview.channel === "email" ? (
                            <Mail className="h-3 w-3 shrink-0 opacity-60" />
                          ) : (
                            <MessageSquare className="h-3 w-3 shrink-0 opacity-60" />
                          )}
                          <span className="line-clamp-1 italic">
                            {preview.body ? `“${plainText(preview.body)}”` : "No messages yet"}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <MiniStatus
                            code={r.statusCode ?? known?.statusCode ?? null}
                            name={r.status ?? known?.status ?? null}
                            color={r.statusColorCode ?? known?.statusColorCode ?? null}
                          />
                          {tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="truncate rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground"
                            >
                              {t}
                            </span>
                          ))}
                          {tags.length > 2 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{tags.length - 2}
                            </span>
                          )}
                          {unread > 0 && (
                            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-tenant px-1.5 text-[10px] font-bold text-white shadow-sm">
                              {unread > 99 ? "99+" : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && !error && !unreadOnly && (
          <div className="border-t border-border/60 px-4 py-3">
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-xs font-semibold hover:bg-muted disabled:opacity-60"
            >
              {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Load more · {rows.length} of {totalCount}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Bits ------------------------------- */

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center rounded-md px-3 py-1 transition-colors ${
        active ? "bg-card text-tenant shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function RowSkeletons() {
  return (
    <ul className="divide-y divide-border/60">
      {Array.from({ length: 7 }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyRows({ unreadOnly, filtered }: { unreadOnly: boolean; filtered: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-tenant/10 text-tenant">
        <Inbox className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold">
        {unreadOnly
          ? "You're all caught up"
          : filtered
            ? "No conversations match"
            : "No conversations yet"}
      </p>
      <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
        {unreadOnly
          ? "Every reply has been read. New messages will show up here."
          : filtered
            ? "Try a different search or clear the filters."
            : "Customer replies by SMS and email will appear here as they arrive."}
      </p>
    </div>
  );
}
