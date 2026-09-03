import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  SlidersHorizontal,
  PanelLeftClose,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  UsersRound,
  Tag,
  CalendarClock,
  Wallet,
  ArrowLeftRight,
  Download,
  Plus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, NativeSelect, Pill } from "@/components/tenant/ui";
import { StatusPill } from "@/components/tenant/statuses/StatusPill";
import { useCustomerPermissions } from "@/lib/customer-permissions";
import {
  getCustomerList,
  getAssignableTeams,
  changeCustomerTeam,
  customerDisplayName,
  formatMoney,
  toMoney,
  type CustomerListItem,
  type CustomerListFilters,
  type AssignableTeam,
} from "@/lib/customers-api";
import { getAllStatus, type Status } from "@/lib/statuses-api";
import { getTeamList, type TeamListItem } from "@/lib/teams-api";
import { getClientList, type MassUpdateClient } from "@/lib/mass-update-api";

export const Route = createFileRoute("/tenant/debtors/")({
  head: () => ({ meta: [{ title: "Customers · Tenant Admin" }] }),
  component: DebtorsPage,
});

const PAGE_SIZE = 20;

/* -------------------------------- Row shape --------------------------------- */
// getCustomerList's row has no clientId/teamId/statusId of its own (name strings
// only), but that's no longer a filtering problem: the filter rail's option lists
// come from the real master-data endpoints (getTeamList, getClientList,
// getAllStatus), and the chosen id is passed straight through to getCustomerList's
// own clientId/teamId/statusId params — verified live to do real server-side
// filtering. No client-side name matching involved.
// There's deliberately no "Unassigned team" / "No status" option here — the
// backend's filter only does equality-to-a-real-id, with no value meaning "is
// empty" (see customers-api.ts's header note). Add those back once the backend
// exposes a way to ask for it.

type DisplayRow = CustomerListItem & {
  balanceNum: number;
  displayName: string;
};

function toDisplayRows(rows: CustomerListItem[]): DisplayRow[] {
  return rows.map((r) => ({
    ...r,
    balanceNum: toMoney(r.currentOutstandingBalance),
    displayName: customerDisplayName(r),
  }));
}

/* -------------------------------- Filters ---------------------------------- */

type Filters = {
  search: string;
  client: number | "all";
  team: number | "all";
  status: number | "all";
  delinquencyFrom: string;
  delinquencyTo: string;
  lastPaymentFrom: string;
  lastPaymentTo: string;
  balanceMin: string;
  balanceMax: string;
};

const EMPTY_FILTERS: Filters = {
  search: "",
  client: "all",
  team: "all",
  status: "all",
  delinquencyFrom: "",
  delinquencyTo: "",
  lastPaymentFrom: "",
  lastPaymentTo: "",
  balanceMin: "",
  balanceMax: "",
};

function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.search.trim()) n++;
  if (f.client !== "all") n++;
  if (f.team !== "all") n++;
  if (f.status !== "all") n++;
  if (f.delinquencyFrom || f.delinquencyTo) n++;
  if (f.lastPaymentFrom || f.lastPaymentTo) n++;
  if (f.balanceMin || f.balanceMax) n++;
  return n;
}

function DebtorsPage() {
  const perms = useCustomerPermissions();

  // Filter-rail reference data — the real master lists, fetched once.
  const [clients, setClients] = useState<MassUpdateClient[]>([]);
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  useEffect(() => {
    Promise.all([getClientList(), getTeamList(), getAllStatus()])
      .then(([cl, tm, st]) => {
        setClients(cl.clientList ?? []);
        setTeams(tm.teamList ?? []);
        setStatuses(st);
      })
      .catch(() => toast.error("Failed to load filter options."));
  }, []);
  const statusByName = useMemo(() => {
    const m = new Map<string, Status>();
    for (const s of statuses) m.set(s.status, s);
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
  const [rowsRaw, setRowsRaw] = useState<CustomerListItem[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reset to page 1 whenever the scope changes.
  useEffect(() => {
    setPage(0);
  }, [
    searchText,
    filters.client,
    filters.team,
    filters.status,
    filters.delinquencyFrom,
    filters.delinquencyTo,
    filters.lastPaymentFrom,
    filters.lastPaymentTo,
    filters.balanceMin,
    filters.balanceMax,
  ]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const balanceMin = filters.balanceMin.trim() === "" ? null : Number(filters.balanceMin);
    const balanceMax = filters.balanceMax.trim() === "" ? null : Number(filters.balanceMax);
    const params: CustomerListFilters = {
      page,
      size: PAGE_SIZE,
      searchText,
      clientId: filters.client === "all" ? null : filters.client,
      teamId: filters.team === "all" ? null : filters.team,
      statusId: filters.status === "all" ? null : filters.status,
      currentOutstandingBalanceMin:
        balanceMin !== null && Number.isNaN(balanceMin) ? null : balanceMin,
      currentOutstandingBalanceMax:
        balanceMax !== null && Number.isNaN(balanceMax) ? null : balanceMax,
      delinquencyStartDate: filters.delinquencyFrom || null,
      delinquencyEndDate: filters.delinquencyTo || null,
      dateOfLastPaymentStart: filters.lastPaymentFrom || null,
      dateOfLastPaymentEnd: filters.lastPaymentTo || null,
    };
    try {
      const res = await getCustomerList(params);
      setRowsRaw(res.debtorList ?? []);
      setTotalCount(res.totalCount ?? 0);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load customers.");
      setRowsRaw([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchText, filters]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const displayed = useMemo(() => toDisplayRows(rowsRaw ?? []), [rowsRaw]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const activeCount = activeFilterCount(filters);
  const [railOpen, setRailOpen] = useState(true);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const effectiveSelected = useMemo(
    () => displayed.filter((r) => selected.has(r.uploadedDebtorId)),
    [displayed, selected],
  );
  const toggleRow = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allDisplayedSelected =
    displayed.length > 0 && displayed.every((r) => selected.has(r.uploadedDebtorId));
  const toggleAllDisplayed = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (allDisplayedSelected) displayed.forEach((r) => next.delete(r.uploadedDebtorId));
      else displayed.forEach((r) => next.add(r.uploadedDebtorId));
      return next;
    });

  const [assignStatusId, setAssignStatusId] = useState<number | "">("");
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  const reload = () => {
    setSelected(new Set());
    fetchRows();
  };

  const showCheckboxes = !perms.loading && perms.canBulkManage;

  return (
    <Shell>
      <Topbar
        title="Customers"
        subtitle="The customer files assigned to you"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => toast.message("CSV exported")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              <Download className="h-4 w-4" /> Export
            </button>
            <button
              onClick={() => toast.message("Manual entry coming")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
            >
              <Plus className="h-4 w-4" /> Add customer
            </button>
          </div>
        }
      />

      <section className="px-6 lg:px-10 py-6">
        {loadError ? (
          <PageCard className="p-8 text-center">
            <p className="text-sm text-destructive font-medium">{loadError}</p>
            <button
              onClick={reload}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
            >
              Try again
            </button>
          </PageCard>
        ) : (
          <div className="flex items-start gap-6">
            {railOpen && (
              <FilterRail
                filters={filters}
                setFilter={setFilter}
                search={q}
                setSearch={setQ}
                onClearAll={() => {
                  setFilters(EMPTY_FILTERS);
                  setQ("");
                }}
                activeCount={activeCount}
                onCollapse={() => setRailOpen(false)}
                clients={clients}
                teams={teams}
                statuses={statuses}
              />
            )}

            <div className="flex-1 min-w-0">
              <PageCard>
                <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border">
                  {!railOpen && (
                    <button
                      onClick={() => setRailOpen(true)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${
                        activeCount > 0
                          ? "border-tenant bg-tenant-soft text-tenant"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <SlidersHorizontal className="h-4 w-4" /> Filters
                      {activeCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-tenant text-white text-[10px] font-bold">
                          {activeCount}
                        </span>
                      )}
                    </button>
                  )}

                  {effectiveSelected.length > 0 ? (
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">
                        {effectiveSelected.length} selected
                      </span>
                      <NativeSelect
                        size="sm"
                        className="w-44"
                        value={assignStatusId}
                        onChange={(e) =>
                          setAssignStatusId(e.target.value ? Number(e.target.value) : "")
                        }
                      >
                        <option value="">Assign status…</option>
                        {statuses.map((s) => (
                          <option key={s.statusId} value={s.statusId}>
                            {s.statusCode} · {s.status}
                          </option>
                        ))}
                      </NativeSelect>
                      <button
                        disabled={assignStatusId === ""}
                        onClick={() =>
                          toast.error(
                            "Bulk status assignment isn't available yet — the backend has no endpoint for it.",
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-tenant text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Assign {effectiveSelected.length}
                      </button>
                      <button
                        onClick={() => setMoveDialogOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
                      >
                        <ArrowLeftRight className="h-4 w-4" /> Move to team
                      </button>
                      <button
                        onClick={() => setSelected(new Set())}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
                      >
                        <X className="h-4 w-4" /> Clear
                      </button>
                    </div>
                  ) : (
                    <h2 className="font-display text-lg font-bold tracking-tight">
                      Customers ({totalCount})
                    </h2>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                      <tr>
                        {showCheckboxes && (
                          <th className="px-6 py-3 w-10">
                            <input
                              type="checkbox"
                              checked={allDisplayedSelected}
                              onChange={toggleAllDisplayed}
                              disabled={displayed.length === 0}
                              className="h-4 w-4 rounded border-border"
                            />
                          </th>
                        )}
                        <th
                          className={`text-left py-3 font-semibold ${showCheckboxes ? "px-3" : "px-6"}`}
                        >
                          Customer
                        </th>
                        <th className="text-left px-3 py-3 font-semibold">File No.</th>
                        <th className="text-left px-3 py-3 font-semibold">Creditor client</th>
                        <th className="text-left px-3 py-3 font-semibold">Status</th>
                        <th className="text-right px-3 py-3 font-semibold">Balance</th>
                        <th className="text-left px-6 py-3 font-semibold">Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading &&
                        Array.from({ length: 4 }).map((_, i) => (
                          <tr key={i} className="border-b border-border/60">
                            <td colSpan={showCheckboxes ? 7 : 6} className="px-6 py-4">
                              <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                            </td>
                          </tr>
                        ))}

                      {!loading &&
                        displayed.map((row) => {
                          const st = row.status ? statusByName.get(row.status) : undefined;
                          return (
                            <tr
                              key={row.uploadedDebtorId}
                              className="border-b border-border/60 hover:bg-muted/30"
                            >
                              {showCheckboxes && (
                                <td className="px-6 py-3">
                                  <input
                                    type="checkbox"
                                    checked={selected.has(row.uploadedDebtorId)}
                                    onChange={() => toggleRow(row.uploadedDebtorId)}
                                    className="h-4 w-4 rounded border-border"
                                  />
                                </td>
                              )}
                              <td className={`py-3 ${showCheckboxes ? "px-3" : "px-6"}`}>
                                <Link
                                  to="/tenant/debtors/$debtorId"
                                  params={{ debtorId: String(row.uploadedDebtorId) }}
                                  className="font-semibold hover:text-tenant hover:underline"
                                >
                                  {row.displayName}
                                </Link>
                              </td>
                              <td className="px-3 py-3 font-mono text-xs">{row.ourFileNo}</td>
                              <td className="px-3 py-3">
                                <div className="font-medium">{row.clientName}</div>
                                {row.creditorName && (
                                  <div className="text-xs text-muted-foreground">
                                    {row.creditorName}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                {st ? (
                                  <StatusPill
                                    code={st.statusCode}
                                    name={st.status}
                                    color={st.statusColorCode}
                                    className="text-xs px-2 py-0.5"
                                  />
                                ) : row.status ? (
                                  <Pill tone="muted">{row.status}</Pill>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-right font-mono">
                                {formatMoney(row.currentOutstandingBalance)}
                              </td>
                              {/* Flags aren't in getCustomerList/getCustomerDetails yet — left blank
                                  rather than fabricated; see the customers-api.ts header note. */}
                              <td className="px-6 py-3" />
                            </tr>
                          );
                        })}

                      {!loading && displayed.length === 0 && (
                        <tr>
                          <td
                            colSpan={showCheckboxes ? 7 : 6}
                            className="text-center py-12 text-muted-foreground text-sm"
                          >
                            {activeCount === 0
                              ? "You have no customer files assigned to you yet."
                              : "No customers match your filters."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {!loading && totalCount > 0 && (
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

                <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
                  {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                  {showCheckboxes
                    ? "Select customers to bulk-assign a status or move them to another team. Open a customer to reassign agent, manager, team, creditor or AI agent. This is your own book — only the files assigned to you. Parked files, files moved to another team and imported files still waiting for a team are listed on their own screens."
                    : "Assignment is read-only here."}
                </div>
              </PageCard>
            </div>
          </div>
        )}
      </section>

      {moveDialogOpen && (
        <MoveToTeamDialog
          count={effectiveSelected.length}
          onClose={() => setMoveDialogOpen(false)}
          onMoved={() => {
            setMoveDialogOpen(false);
            reload();
          }}
          uploadedDebtorIdList={effectiveSelected.map((r) => r.uploadedDebtorId)}
        />
      )}
    </Shell>
  );
}

/* ------------------------------- Filter rail -------------------------------- */

function FilterRail({
  filters,
  setFilter,
  search,
  setSearch,
  onClearAll,
  activeCount,
  onCollapse,
  clients,
  teams,
  statuses,
}: {
  filters: Filters;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  search: string;
  setSearch: (v: string) => void;
  onClearAll: () => void;
  activeCount: number;
  onCollapse: () => void;
  clients: MassUpdateClient[];
  teams: TeamListItem[];
  statuses: Status[];
}) {
  return (
    <aside className="w-80 shrink-0">
      <PageCard>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-tenant" />
            <span className="font-display font-bold text-sm">Filters</span>
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-tenant text-white text-[10px] font-bold">
                {activeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClearAll}
              disabled={activeCount === 0}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear all
            </button>
            <button
              onClick={onCollapse}
              className="p-1 rounded hover:bg-muted"
              aria-label="Collapse filters"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or file number"
              className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-border bg-background text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        <div className="px-4 pb-2">
          <FilterSection
            title="Creditor client"
            icon={<Building2 className="h-4 w-4" />}
            defaultOpen
          >
            <NativeSelect
              size="sm"
              value={filters.client}
              onChange={(e) =>
                setFilter("client", e.target.value === "all" ? "all" : Number(e.target.value))
              }
            >
              <option value="all">All clients</option>
              {clients.map((c) => (
                <option key={c.clientId} value={c.clientId}>
                  {c.clientName}
                </option>
              ))}
            </NativeSelect>
          </FilterSection>

          <FilterSection title="Team" icon={<UsersRound className="h-4 w-4" />} defaultOpen>
            <NativeSelect
              size="sm"
              value={filters.team}
              onChange={(e) =>
                setFilter("team", e.target.value === "all" ? "all" : Number(e.target.value))
              }
            >
              <option value="all">All teams</option>
              {teams.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.teamName}
                </option>
              ))}
            </NativeSelect>
          </FilterSection>

          <FilterSection title="Status" icon={<Tag className="h-4 w-4" />} defaultOpen>
            <NativeSelect
              size="sm"
              value={filters.status}
              onChange={(e) =>
                setFilter("status", e.target.value === "all" ? "all" : Number(e.target.value))
              }
            >
              <option value="all">All statuses</option>
              {statuses.map((s) => (
                <option key={s.statusId} value={s.statusId}>
                  {s.status}
                </option>
              ))}
            </NativeSelect>
          </FilterSection>

          <FilterSection
            title="Delinquency date"
            icon={<CalendarClock className="h-4 w-4" />}
            defaultOpen={false}
          >
            <div className="grid grid-cols-2 gap-2">
              <DateField
                label="From"
                value={filters.delinquencyFrom}
                onChange={(v) => setFilter("delinquencyFrom", v)}
              />
              <DateField
                label="To"
                value={filters.delinquencyTo}
                onChange={(v) => setFilter("delinquencyTo", v)}
              />
            </div>
          </FilterSection>

          <FilterSection
            title="Last payment date"
            icon={<CalendarClock className="h-4 w-4" />}
            defaultOpen={false}
          >
            <div className="grid grid-cols-2 gap-2">
              <DateField
                label="From"
                value={filters.lastPaymentFrom}
                onChange={(v) => setFilter("lastPaymentFrom", v)}
              />
              <DateField
                label="To"
                value={filters.lastPaymentTo}
                onChange={(v) => setFilter("lastPaymentTo", v)}
              />
            </div>
          </FilterSection>

          <FilterSection
            title="Balance"
            icon={<Wallet className="h-4 w-4" />}
            defaultOpen={false}
            last
          >
            <div className="grid grid-cols-2 gap-2">
              <NumField
                label="Min"
                value={filters.balanceMin}
                onChange={(v) => setFilter("balanceMin", v)}
              />
              <NumField
                label="Max"
                value={filters.balanceMax}
                onChange={(v) => setFilter("balanceMax", v)}
              />
            </div>
          </FilterSection>
        </div>
      </PageCard>
    </aside>
  );
}

function FilterSection({
  title,
  icon,
  defaultOpen,
  last = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen: boolean;
  last?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`py-3 ${last ? "" : "border-b border-border/60"}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-sm font-semibold"
      >
        <span className="flex items-center gap-2 text-tenant">
          {icon}
          <span className="text-foreground">{title}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground font-semibold">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2.5 py-2 rounded-lg border border-border bg-background text-sm"
      />
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground font-semibold">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label === "Min" ? "0" : "No limit"}
        className="px-2.5 py-2 rounded-lg border border-border bg-background text-sm w-full"
      />
    </label>
  );
}

/* ----------------------------- Move to team dialog --------------------------- */

function MoveToTeamDialog({
  count,
  uploadedDebtorIdList,
  onClose,
  onMoved,
}: {
  count: number;
  uploadedDebtorIdList: number[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const [teams, setTeams] = useState<AssignableTeam[]>([]);
  const [teamId, setTeamId] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getAssignableTeams()
      .then((r) => setTeams(r.teamList))
      .catch(() => toast.error("Couldn't load teams."));
  }, []);

  const submit = async () => {
    if (teamId === "") return;
    setSubmitting(true);
    try {
      await changeCustomerTeam({ uploadedDebtorIdList, teamId, remark: reason.trim() });
      toast.success(count > 1 ? `${count} files moved.` : "File moved.");
      onMoved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't move to that team.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-tenant" />
            <div className="font-display font-bold text-base">Move to team</div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            This file will move to the chosen team with the status cleared and the current member
            unassigned. The destination team gives it a new status and member on their Moved Files
            page.
          </p>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Destination team
            </span>
            <NativeSelect
              className="mt-1"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Choose a team…</option>
              {teams.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.teamName}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Reason / note (optional)
            </span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Better creditor fit for that desk"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={teamId === "" || submitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tenant text-white text-sm font-semibold disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <ArrowLeftRight className="h-4 w-4" /> Move
          </button>
        </div>
      </div>
    </div>
  );
}
