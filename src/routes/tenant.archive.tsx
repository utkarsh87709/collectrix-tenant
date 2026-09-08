import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Search,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, NativeSelect, Pill } from "@/components/tenant/ui";
import { StatusPill } from "@/components/tenant/statuses/StatusPill";
import { UsersTableSkeleton } from "@/components/admin/Skeletons";
import { RestoreFileDialog } from "@/components/tenant/customers/RestoreFileDialog";
import { useCustomerPermissions } from "@/lib/customer-permissions";
import {
  getArchivedCustomers,
  archivedDebtorName,
  archivedAgo,
  archiveSource,
  type ArchivedDebtor,
} from "@/lib/archive-api";
import {
  getClientList,
  getStatusList,
  type MassUpdateClient,
  type MassUpdateStatus,
} from "@/lib/mass-update-api";
import { getMovedTeamList, type MovedTeam } from "@/lib/moved-files-api";
import { getAllStatus, type Status } from "@/lib/statuses-api";
import { formatMoney } from "@/lib/customers-api";
import { downloadCsv, toCsv } from "@/lib/csv";

export const Route = createFileRoute("/tenant/archive")({
  head: () => ({ meta: [{ title: "Archive · Tenant Admin" }] }),
  component: ArchivePage,
});

const PAGE_SIZE = 10;

/* -------------------------------- Filters ---------------------------------- */
// Every filter here is a real server-side param on getArchivedCustomers. The
// design's "All sources" (auto vs manual) dropdown and sortable column headers
// have no backend param yet, so they're deliberately not offered rather than
// faked client-side against just the current page (same call as Customers).

type Filters = {
  client: number | "all";
  team: number | "all";
  status: number | "all";
  /** yyyy-mm-dd, straight from the native date inputs. */
  archivedFrom: string;
  archivedTo: string;
};

const EMPTY_FILTERS: Filters = {
  client: "all",
  team: "all",
  status: "all",
  archivedFrom: "",
  archivedTo: "",
};

function activeFilterCount(f: Filters, search: string): number {
  let n = 0;
  if (search.trim()) n++;
  if (f.client !== "all") n++;
  if (f.team !== "all") n++;
  if (f.status !== "all") n++;
  if (f.archivedFrom || f.archivedTo) n++;
  return n;
}

function ArchivePage() {
  const perms = useCustomerPermissions();

  // Dropdown reference data — the real master lists, fetched once. getStatusList
  // feeds the dropdown (per backend); getAllStatus adds the code + colour for
  // the pills in the table and the Restore dialog.
  const [clients, setClients] = useState<MassUpdateClient[]>([]);
  const [teams, setTeams] = useState<MovedTeam[]>([]);
  const [statusOptions, setStatusOptions] = useState<MassUpdateStatus[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  useEffect(() => {
    Promise.all([getClientList(), getMovedTeamList(), getStatusList()])
      .then(([cl, tm, st]) => {
        setClients(cl.clientList ?? []);
        setTeams(tm.teamList ?? []);
        setStatusOptions(st.statusList ?? []);
      })
      .catch(() => toast.error("Failed to load filter options."));
    getAllStatus()
      .then(setStatuses)
      .catch(() => {
        /* pills fall back to a plain badge on failure */
      });
  }, []);
  const statusById = useMemo(() => {
    const m = new Map<number, Status>();
    for (const s of statuses) m.set(s.statusId, s);
    return m;
  }, [statuses]);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  // Debounce the search box so every keystroke doesn't fire a request.
  const [q, setQ] = useState("");
  const [searchText, setSearchText] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearchText(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const [page, setPage] = useState(0);
  const [debtors, setDebtors] = useState<ArchivedDebtor[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset to page 1 whenever the scope changes.
  useEffect(() => {
    setPage(0);
  }, [searchText, filters]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getArchivedCustomers({
        page,
        size: PAGE_SIZE,
        searchText,
        clientId: filters.client === "all" ? null : filters.client,
        teamId: filters.team === "all" ? null : filters.team,
        statusId: filters.status === "all" ? null : filters.status,
        archivedFromDate: filters.archivedFrom || null,
        archivedToDate: filters.archivedTo || null,
      });
      setDebtors(res.debtorList);
      setTotalCount(res.totalCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load archived files.");
      setDebtors([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchText, filters]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const activeCount = activeFilterCount(filters, q);
  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setQ("");
  };

  const [restoreTarget, setRestoreTarget] = useState<ArchivedDebtor | null>(null);
  const showRestore = !perms.loading && perms.canArchive;

  const statusFor = (d: ArchivedDebtor) =>
    d.statusId != null ? statusById.get(d.statusId) : undefined;

  const exportCsv = () => {
    if (debtors.length === 0) return;
    const rows = debtors.map((d) => {
      const st = statusFor(d);
      const source = archiveSource(d);
      return [
        d.ourFileNo || `#${d.uploadedDebtorId}`,
        archivedDebtorName(d),
        d.clientName ?? "",
        d.clientNumber ?? "",
        d.teamName ?? "",
        st ? `${st.statusCode} · ${st.status}` : (d.status ?? ""),
        d.currentOutstandingBalance ?? "",
        d.currency ?? "",
        d.archivedAt ? new Date(d.archivedAt).toISOString() : "",
        source === "auto" ? "Auto" : source === "manual" ? "Manual" : "",
      ];
    });
    const csv = toCsv(
      [
        "File ref",
        "Debtor",
        "Client",
        "Client number",
        "Team",
        "Status when archived",
        "Balance",
        "Currency",
        "Archived at",
        "Source",
      ],
      rows,
    );
    downloadCsv(`archived-files-page-${page + 1}.csv`, csv);
    toast.success(
      `Exported ${debtors.length} archived ${debtors.length === 1 ? "file" : "files"} (this page).`,
    );
  };

  const restoreStatus = restoreTarget ? statusFor(restoreTarget) : undefined;

  return (
    <Shell>
      <Topbar
        title="Archive"
        subtitle="Parked files removed from the active workload"
        action={
          <button
            onClick={exportCsv}
            disabled={loading || debtors.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      <section className="px-6 lg:px-10 py-6 space-y-4">
        {/* Filters */}
        <PageCard>
          <div className="px-6 py-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 h-11 px-3 rounded-lg bg-background border border-border flex-1 min-w-56">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search debtor or file ref…"
                  className="bg-transparent text-sm flex-1 outline-none min-w-0"
                />
                {q && (
                  <button
                    onClick={() => setQ("")}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <NativeSelect
                className="w-full sm:w-48"
                value={filters.client}
                onChange={(e) =>
                  setFilter("client", e.target.value === "all" ? "all" : Number(e.target.value))
                }
                aria-label="Client"
              >
                <option value="all">All clients</option>
                {clients.map((c) => (
                  <option key={c.clientId} value={c.clientId}>
                    {c.clientName}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                className="w-full sm:w-48"
                value={filters.team}
                onChange={(e) =>
                  setFilter("team", e.target.value === "all" ? "all" : Number(e.target.value))
                }
                aria-label="Team"
              >
                <option value="all">All teams</option>
                {teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>
                    {t.teamName}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                className="w-full sm:w-48"
                value={filters.status}
                onChange={(e) =>
                  setFilter("status", e.target.value === "all" ? "all" : Number(e.target.value))
                }
                aria-label="Status when archived"
              >
                <option value="all">All statuses</option>
                {statusOptions.map((s) => (
                  <option key={s.statusId} value={s.statusId}>
                    {s.status}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Archived</span>
              <input
                type="date"
                value={filters.archivedFrom}
                max={filters.archivedTo || undefined}
                onChange={(e) => setFilter("archivedFrom", e.target.value)}
                aria-label="Archived from"
                className="h-11 px-3 rounded-lg border border-border bg-background text-sm"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <input
                type="date"
                value={filters.archivedTo}
                min={filters.archivedFrom || undefined}
                onChange={(e) => setFilter("archivedTo", e.target.value)}
                aria-label="Archived to"
                className="h-11 px-3 rounded-lg border border-border bg-background text-sm"
              />
              <div className="ml-auto flex items-center gap-2">
                {activeCount > 0 && (
                  <button
                    onClick={clearAll}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" /> Clear filters ({activeCount})
                  </button>
                )}
                <button
                  onClick={fetchRows}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
                  aria-label="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </div>
        </PageCard>

        {/* Table */}
        <PageCard>
          <CardHead
            title="Archived files"
            subtitle={`${totalCount} archived ${totalCount === 1 ? "file" : "files"} · Nothing is deleted — restore a file to return it to the active queue.`}
            icon={<Archive className="h-5 w-5" />}
          />

          {loading ? (
            <div className="py-1">
              <UsersTableSkeleton />
            </div>
          ) : error ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-destructive font-medium">{error}</p>
              <button
                onClick={fetchRows}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : debtors.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Archive className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-display text-lg font-bold">
                {activeCount > 0
                  ? "No archived files match your filters"
                  : "Nothing in the archive"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                {activeCount > 0
                  ? "Try widening the date range or clearing a filter."
                  : "Files archived by hand from a customer's Manage menu, or by a status's auto-archive rule, are parked here until they're restored."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-semibold">File ref</th>
                    <th className="px-4 py-3 font-semibold">Debtor</th>
                    <th className="px-4 py-3 font-semibold">Client</th>
                    <th className="px-4 py-3 font-semibold">Team</th>
                    <th className="px-4 py-3 font-semibold">Status when archived</th>
                    <th className="px-4 py-3 font-semibold text-right">Balance</th>
                    <th className="px-4 py-3 font-semibold">Archived</th>
                    <th className="px-4 py-3 font-semibold">Source</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {debtors.map((d) => {
                    const fileRef = d.ourFileNo || `#${d.uploadedDebtorId}`;
                    const name = archivedDebtorName(d);
                    const st = statusFor(d);
                    const ago = archivedAgo(d.archivedAt);
                    const source = archiveSource(d);
                    return (
                      <tr key={d.uploadedDebtorId} className="hover:bg-muted/30">
                        <td className="px-6 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {fileRef}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to="/tenant/debtors/$debtorId"
                            params={{ debtorId: String(d.uploadedDebtorId) }}
                            className="font-semibold hover:text-tenant hover:underline"
                          >
                            {name || "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{d.clientName || "—"}</div>
                          {d.clientNumber && (
                            <div className="text-xs text-muted-foreground">{d.clientNumber}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{d.teamName || "—"}</td>
                        <td className="px-4 py-3">
                          {st ? (
                            <StatusPill
                              code={st.statusCode}
                              name={st.status}
                              color={st.statusColorCode}
                              className="text-xs px-2 py-0.5"
                            />
                          ) : d.status ? (
                            <Pill tone="muted">{d.status}</Pill>
                          ) : (
                            <Pill tone="muted">No status</Pill>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {formatMoney(d.currentOutstandingBalance)}
                        </td>
                        <td
                          className="px-4 py-3 text-muted-foreground whitespace-nowrap"
                          title={d.archivedAt ? new Date(d.archivedAt).toLocaleString() : undefined}
                        >
                          {ago ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {source === "auto" ? (
                            <Pill tone="success">Auto</Pill>
                          ) : source === "manual" ? (
                            <Pill tone="muted">Manual</Pill>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex justify-end gap-2">
                            <Link
                              to="/tenant/debtors/$debtorId"
                              params={{ debtorId: String(d.uploadedDebtorId) }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-muted transition"
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </Link>
                            {showRestore && (
                              <button
                                onClick={() => setRestoreTarget(d)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-gradient-tenant text-white shadow-tenant"
                              >
                                <RotateCcw className="h-3.5 w-3.5" /> Restore
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && totalCount > 0 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border text-xs text-muted-foreground">
              <span>
                Page {page + 1} of {totalPages} · {totalCount} total
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {!loading && !error && !showRestore && !perms.loading && (
            <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground">
              Restoring is read-only for your role — it needs the "Archive debtor files" permission.
            </div>
          )}
        </PageCard>
      </section>

      {restoreTarget && (
        <RestoreFileDialog
          uploadedDebtorId={restoreTarget.uploadedDebtorId}
          name={archivedDebtorName(restoreTarget)}
          fileRef={restoreTarget.ourFileNo || `#${restoreTarget.uploadedDebtorId}`}
          clientName={restoreTarget.clientName}
          teamName={restoreTarget.teamName}
          status={
            restoreStatus
              ? {
                  code: restoreStatus.statusCode,
                  name: restoreStatus.status,
                  color: restoreStatus.statusColorCode,
                }
              : restoreTarget.status
                ? {
                    code: restoreTarget.statusCode ?? restoreTarget.status,
                    name: restoreTarget.status,
                    color: restoreTarget.statusColorCode ?? "#64748b",
                  }
                : null
          }
          onClose={() => setRestoreTarget(null)}
          onRestored={() => {
            setRestoreTarget(null);
            fetchRows();
          }}
        />
      )}
    </Shell>
  );
}
