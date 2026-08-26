import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { motion } from "motion/react";
import { UsersTableSkeleton } from "@/components/admin/Skeletons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Inbox,
  UserCheck,
  UserPlus,
  Users2,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getTeamDeckTeamList,
  getTeamDeckDebtors,
  getTeamDeckAssignUserList,
  teamDeckAssignUser,
  assignedMemberName,
  deckDebtorName,
  memberName,
  formatBalance,
  type TeamDeckTeam,
  type TeamDeckDebtor,
  type AssignableMember,
  type DeckStatus,
} from "@/lib/team-deck-api";

export const Route = createFileRoute("/tenant/team-deck")({
  head: () => ({ meta: [{ title: "Team Deck · Tenant Admin" }] }),
  component: TeamDeckPage,
});

const PAGE_SIZE = 10;

function TeamDeckPage() {
  const [teams, setTeams] = useState<TeamDeckTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamId, setTeamId] = useState<number | null>(null);

  const [tab, setTab] = useState<DeckStatus>("inDeck");
  const [debtors, setDebtors] = useState<TeamDeckDebtor[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [searchText, setSearchText] = useState("");
  const [creditor, setCreditor] = useState("all");

  // Counts shown on the two tabs — refreshed on team change and after an assign.
  const [counts, setCounts] = useState<{ inDeck: number; assigned: number }>({
    inDeck: 0,
    assigned: 0,
  });

  // Row selection (In Deck tab) for bulk assignment.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // The assign modal targets either the bulk selection or a single row.
  const [assignTargets, setAssignTargets] = useState<TeamDeckDebtor[] | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ─── Load the caller's teams once; default to the first. ───
  useEffect(() => {
    getTeamDeckTeamList()
      .then((res) => {
        const list = res.teamList ?? [];
        setTeams(list);
        setTeamId((cur) => cur ?? list[0]?.teamId ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load teams."))
      .finally(() => setTeamsLoading(false));
  }, []);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setSearchText(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  // Reset paging / selection when the scope changes.
  useEffect(() => {
    setPage(0);
    setSelected(new Set());
  }, [teamId, tab, searchText]);

  const fetchDebtors = useCallback(async () => {
    if (teamId == null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getTeamDeckDebtors({
        teamId,
        status: tab,
        searchText,
        page,
        size: PAGE_SIZE,
      });
      setDebtors(res.debtorList ?? []);
      setTotalCount(res.totalCount ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load deck.");
      setDebtors([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [teamId, tab, searchText, page]);

  useEffect(() => {
    fetchDebtors();
  }, [fetchDebtors]);

  // Tab counts (independent of the active tab / search) — one light call each.
  const fetchCounts = useCallback(async () => {
    if (teamId == null) return;
    try {
      const [inDeck, assigned] = await Promise.all([
        getTeamDeckDebtors({ teamId, status: "inDeck", page: 0, size: 1 }),
        getTeamDeckDebtors({ teamId, status: "assigned", page: 0, size: 1 }),
      ]);
      setCounts({ inDeck: inDeck.totalCount ?? 0, assigned: assigned.totalCount ?? 0 });
    } catch {
      /* counts are best-effort */
    }
  }, [teamId]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Creditor options are derived from the loaded page and applied client-side —
  // the deck endpoint has no creditor param, so this narrows the current view.
  const creditorOptions = useMemo(() => {
    const s = new Set<string>();
    for (const d of debtors) if (d.creditorName) s.add(d.creditorName);
    return [...s].sort();
  }, [debtors]);

  useEffect(() => {
    if (creditor !== "all" && !creditorOptions.includes(creditor)) setCreditor("all");
  }, [creditorOptions, creditor]);

  const shown = useMemo(
    () => (creditor === "all" ? debtors : debtors.filter((d) => d.creditorName === creditor)),
    [debtors, creditor],
  );

  const selectableIds = useMemo(() => shown.map((d) => d.uploadedDebtorId), [shown]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectableIds));
  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedDebtors = useMemo(
    () => shown.filter((d) => selected.has(d.uploadedDebtorId)),
    [shown, selected],
  );

  const team = teams.find((t) => t.teamId === teamId) ?? null;
  const isDeckTab = tab === "inDeck";

  const onAssigned = async () => {
    setAssignTargets(null);
    setSelected(new Set());
    await Promise.all([fetchDebtors(), fetchCounts()]);
  };

  return (
    <Shell>
      <Topbar
        title="Team Deck"
        subtitle="Files handed to each team, awaiting a member"
        action={
          <div className="hidden sm:flex items-center gap-2">
            <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Team
            </label>
            <select
              value={teamId ?? ""}
              onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : null)}
              disabled={teamsLoading || teams.length === 0}
              className="px-3 py-2 rounded-lg bg-muted border border-border text-sm min-w-40 disabled:opacity-50"
            >
              {teamsLoading ? (
                <option>Loading…</option>
              ) : teams.length === 0 ? (
                <option>No teams</option>
              ) : (
                teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>
                    {t.teamName}
                  </option>
                ))
              )}
            </select>
          </div>
        }
      />

      <section className="px-6 lg:px-10 py-6 space-y-4">
        {/* Mobile team picker */}
        <div className="sm:hidden">
          <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Team
          </label>
          <select
            value={teamId ?? ""}
            onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : null)}
            disabled={teamsLoading || teams.length === 0}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm disabled:opacity-50"
          >
            {teams.map((t) => (
              <option key={t.teamId} value={t.teamId}>
                {t.teamName}
              </option>
            ))}
          </select>
        </div>

        {teamsLoading ? (
          <PageCard>
            <div className="py-1">
              <UsersTableSkeleton />
            </div>
          </PageCard>
        ) : teams.length === 0 ? (
          <PageCard>
            <div className="px-6 py-16 text-center">
              <Users2 className="h-10 w-10 mx-auto mb-3 text-tenant" />
              <h3 className="font-display text-lg font-bold">No teams with a deck</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                Once customer files are assigned to a team, that team appears here so its leader can
                hand files to members.
              </p>
            </div>
          </PageCard>
        ) : (
          <PageCard>
            <CardHead
              title={team?.teamName ?? "Team Deck"}
              subtitle={
                isDeckTab
                  ? `${counts.inDeck} ${counts.inDeck === 1 ? "file" : "files"} awaiting a member · assign each to a team member`
                  : `${counts.assigned} ${counts.assigned === 1 ? "file" : "files"} currently being worked by members`
              }
              icon={<Inbox className="h-5 w-5" />}
            />

            {/* Tabs */}
            <div className="px-6 pt-4 flex items-center gap-2">
              <TabButton
                active={isDeckTab}
                onClick={() => setTab("inDeck")}
                icon={<Inbox className="h-4 w-4" />}
                label="In deck"
                count={counts.inDeck}
              />
              <TabButton
                active={!isDeckTab}
                onClick={() => setTab("assigned")}
                icon={<UserCheck className="h-4 w-4" />}
                label="Assigned to members"
                count={counts.assigned}
              />
            </div>

            {/* Filters */}
            <div className="px-6 py-4 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border flex-1 min-w-52">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, file no or creditor…"
                  className="bg-transparent text-sm flex-1 outline-none"
                />
                {q && (
                  <button
                    onClick={() => setQ("")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <select
                value={creditor}
                onChange={(e) => setCreditor(e.target.value)}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-sm"
              >
                <option value="all">All creditors</option>
                {creditorOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  fetchDebtors();
                  fetchCounts();
                }}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <span className="text-xs text-muted-foreground ml-auto">
                {shown.length} of {totalCount} shown
              </span>
            </div>

            {/* Bulk action bar (In Deck) */}
            {isDeckTab && selectedDebtors.length > 0 && (
              <div className="mx-6 mb-2 flex items-center justify-between gap-3 rounded-lg border border-tenant/30 bg-tenant-soft px-4 py-2.5 text-sm">
                <span className="font-medium text-tenant">{selectedDebtors.length} selected</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelected(new Set())}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-background/60"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setAssignTargets(selectedDebtors)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-tenant text-white text-xs font-semibold shadow-tenant"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Assign to member
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            {loading ? (
              <div className="py-1">
                <UsersTableSkeleton />
              </div>
            ) : error ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-destructive font-medium">{error}</p>
                <button
                  onClick={fetchDebtors}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
                >
                  <RefreshCw className="h-4 w-4" /> Try again
                </button>
              </div>
            ) : shown.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-muted-foreground">
                {isDeckTab ? (
                  <>
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-success" />
                    {searchText || creditor !== "all"
                      ? "No in-deck files match your filters."
                      : "Nothing waiting — every file has been handed to a member."}
                  </>
                ) : (
                  <>
                    <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    {searchText || creditor !== "all"
                      ? "No assigned files match your filters."
                      : "No files have been assigned to members yet."}
                  </>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      {isDeckTab && (
                        <th className="px-6 py-3 w-10">
                          <input
                            type="checkbox"
                            className="accent-tenant"
                            checked={allSelected}
                            onChange={toggleAll}
                            aria-label="Select all"
                          />
                        </th>
                      )}
                      <th className={`${isDeckTab ? "px-4" : "px-6"} py-3 font-semibold`}>
                        Customer
                      </th>
                      <th className="px-4 py-3 font-semibold">Creditor</th>
                      <th className="px-4 py-3 font-semibold">Balance</th>
                      {!isDeckTab && <th className="px-4 py-3 font-semibold">Assigned to</th>}
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shown.map((d, i) => {
                      const checked = selected.has(d.uploadedDebtorId);
                      const fileNo = d.ourFileNo || `#${d.uploadedDebtorId}`;
                      const name = deckDebtorName(d);
                      const assignee = assignedMemberName(d);
                      return (
                        <motion.tr
                          key={d.uploadedDebtorId}
                          className={`hover:bg-muted/30 ${checked ? "bg-tenant-soft/40" : ""}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                        >
                          {isDeckTab && (
                            <td className="px-6 py-3">
                              <input
                                type="checkbox"
                                className="accent-tenant"
                                checked={checked}
                                onChange={() => toggleOne(d.uploadedDebtorId)}
                                aria-label={`Select ${name || fileNo}`}
                              />
                            </td>
                          )}
                          <td className={`${isDeckTab ? "px-4" : "px-6"} py-3`}>
                            <div className="font-semibold">{name || "—"}</div>
                            <div className="text-xs text-muted-foreground">{fileNo}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              {d.creditorName || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {formatBalance(d.currentOutstandingBalance, d.currency)}
                          </td>
                          {!isDeckTab && (
                            <td className="px-4 py-3">
                              {assignee ? (
                                <Pill tone="tenant">{assignee}</Pill>
                              ) : (
                                <Pill tone="muted">Unassigned</Pill>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <div className="flex justify-end">
                              <button
                                onClick={() => setAssignTargets([d])}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-[var(--tenant)] hover:text-white hover:border-[var(--tenant)] transition"
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                                {isDeckTab ? "Assign" : "Reassign"}
                              </button>
                            </div>
                          </td>
                        </motion.tr>
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
          </PageCard>
        )}
      </section>

      {assignTargets && teamId != null && (
        <AssignMemberModal
          teamId={teamId}
          targets={assignTargets}
          onClose={() => setAssignTargets(null)}
          onAssigned={onAssigned}
        />
      )}
    </Shell>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition ${
        active
          ? "bg-gradient-tenant text-white shadow-tenant"
          : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {icon}
      {label}
      <span
        className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold ${
          active ? "bg-white/20 text-white" : "bg-muted-foreground/15 text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assign-to-member modal
// ─────────────────────────────────────────────────────────────────────────────

function AssignMemberModal({
  teamId,
  targets,
  onClose,
  onAssigned,
}: {
  teamId: number;
  targets: TeamDeckDebtor[];
  onClose: () => void;
  onAssigned: () => void | Promise<void>;
}) {
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Pre-select the current assignee when reassigning a single debtor.
  const currentAssignee = targets.length === 1 ? targets[0].assignedTo : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTeamDeckAssignUserList(teamId)
      .then((res) => {
        if (cancelled) return;
        setMembers(res.assignUserList ?? []);
        if (currentAssignee != null) setSelectedUserId(currentAssignee);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load team members.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, currentAssignee]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return members;
    return members.filter(
      (m) => memberName(m).toLowerCase().includes(s) || m.emailId.toLowerCase().includes(s),
    );
  }, [members, q]);

  const submit = async () => {
    if (selectedUserId == null) return;
    setSaving(true);
    try {
      await teamDeckAssignUser(
        selectedUserId,
        targets.map((t) => t.uploadedDebtorId),
      );
      const who = memberName(
        members.find((m) => m.userId === selectedUserId) ?? { firstName: "member" },
      );
      toast.success(
        targets.length === 1
          ? `${deckDebtorName(targets[0]) || `#${targets[0].uploadedDebtorId}`} assigned to ${who}`
          : `${targets.length} files assigned to ${who}`,
      );
      await onAssigned();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-tenant overflow-hidden flex flex-col max-h-[90vh]"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-display font-bold text-lg">Assign to a member</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {targets.length === 1
                ? `Hand ${deckDebtorName(targets[0]) || `#${targets[0].uploadedDebtorId}`} to a team member`
                : `Hand ${targets.length} files to a single team member`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search members…"
              className="bg-transparent text-sm flex-1 outline-none"
            />
          </div>
        </div>

        {/* Fixed-height scroll area: the modal keeps the same size no matter how
            many members match the search — the list scrolls inside this box. */}
        <div className="h-72 sm:h-80 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading members…
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-destructive">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
              {q ? "No members match your search." : "This team has no members to assign to."}
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((m) => {
                const active = selectedUserId === m.userId;
                const isCurrent = currentAssignee === m.userId;
                return (
                  <li key={m.userId}>
                    <button
                      onClick={() => setSelectedUserId(m.userId)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition ${
                        active
                          ? "border-tenant bg-tenant-soft"
                          : "border-transparent hover:bg-muted"
                      }`}
                    >
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-tenant/10 text-tenant text-xs font-bold shrink-0">
                        {(m.firstName || "?").slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-semibold truncate">{memberName(m) || "—"}</span>
                          {isCurrent && <Pill tone="muted">Current</Pill>}
                        </span>
                        <span className="block text-xs text-muted-foreground truncate">
                          {m.emailId} · {m.role}
                        </span>
                      </span>
                      {active && <CheckCircle2 className="h-5 w-5 text-tenant shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={selectedUserId == null || saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Assign {targets.length > 1 ? `${targets.length} files` : ""}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
