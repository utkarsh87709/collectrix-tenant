import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill, NativeSelect } from "@/components/tenant/ui";
import { StatusPill } from "@/components/tenant/statuses/StatusPill";
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
  ArrowRightLeft,
  CheckCircle2,
  Building2,
  Users2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMovedTeamList,
  getMovedCustomers,
  assignMovedFileStatusAndUser,
  movedDebtorName,
  movedInfo,
  type MovedTeam,
  type MovedDebtor,
} from "@/lib/moved-files-api";
import { getAllStatus, type Status } from "@/lib/statuses-api";
import { getTeamDeckAssignUserList, formatBalance, memberName } from "@/lib/team-deck-api";
import type { AssignableMember } from "@/lib/team-deck-api";

export const Route = createFileRoute("/tenant/moved-files")({
  head: () => ({ meta: [{ title: "Moved Files · Tenant Admin" }] }),
  component: MovedFilesPage,
});

const PAGE_SIZE = 10;

function MovedFilesPage() {
  const [teams, setTeams] = useState<MovedTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamId, setTeamId] = useState<number | null>(null);

  const [statuses, setStatuses] = useState<Status[]>([]);

  const [debtors, setDebtors] = useState<MovedDebtor[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [searchText, setSearchText] = useState("");

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [takeOnTargets, setTakeOnTargets] = useState<MovedDebtor[] | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const statusById = useMemo(() => {
    const m = new Map<number, Status>();
    for (const s of statuses) m.set(s.statusId, s);
    return m;
  }, [statuses]);

  // Load the caller's teams once; default to the first.
  useEffect(() => {
    getMovedTeamList()
      .then((res) => {
        const list = res.teamList ?? [];
        setTeams(list);
        setTeamId((cur) => cur ?? list[0]?.teamId ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load teams."))
      .finally(() => setTeamsLoading(false));
  }, []);

  // Load the tenant's status list once, for the pills and the take-on dropdown.
  useEffect(() => {
    getAllStatus()
      .then(setStatuses)
      .catch(() => {
        /* pills fall back to a plain badge on failure */
      });
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
  }, [teamId, searchText]);

  const fetchDebtors = useCallback(async () => {
    if (teamId == null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getMovedCustomers({ teamId, searchText, page, size: PAGE_SIZE });
      setDebtors(res.debtorList ?? []);
      setTotalCount(res.totalCount ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load moved files.");
      setDebtors([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [teamId, searchText, page]);

  useEffect(() => {
    fetchDebtors();
  }, [fetchDebtors]);

  const selectableIds = useMemo(() => debtors.map((d) => d.uploadedDebtorId), [debtors]);
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
    () => debtors.filter((d) => selected.has(d.uploadedDebtorId)),
    [debtors, selected],
  );

  const team = teams.find((t) => t.teamId === teamId) ?? null;

  const onTaken = async () => {
    setTakeOnTargets(null);
    setSelected(new Set());
    await fetchDebtors();
  };

  return (
    <Shell>
      <Topbar
        title="Moved Files"
        subtitle="Files transferred from another team, waiting to be taken on"
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
              <h3 className="font-display text-lg font-bold">No teams with moved files</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                Once a file is moved onto a team, that team appears here so its leader can review
                and take it on.
              </p>
            </div>
          </PageCard>
        ) : (
          <PageCard>
            <CardHead
              title={team?.teamName ?? "Moved Files"}
              subtitle={`${totalCount} ${totalCount === 1 ? "file" : "files"} on this team's moved-files list`}
              icon={<ArrowRightLeft className="h-5 w-5" />}
            />

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
              <button
                onClick={fetchDebtors}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <span className="text-xs text-muted-foreground ml-auto">
                {debtors.length} of {totalCount} shown
              </span>
            </div>

            {/* Bulk action bar */}
            {selectedDebtors.length > 0 && (
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
                    onClick={() => setTakeOnTargets(selectedDebtors)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-tenant text-white text-xs font-semibold shadow-tenant"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Take on
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
            ) : debtors.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-muted-foreground">
                <ArrowRightLeft className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                {searchText
                  ? "No moved files match your search."
                  : "Nothing here — no files have been moved onto this team."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 w-10">
                        <input
                          type="checkbox"
                          className="accent-tenant"
                          checked={allSelected}
                          onChange={toggleAll}
                          aria-label="Select all"
                        />
                      </th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Creditor</th>
                      <th className="px-4 py-3 font-semibold">Balance</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Moved</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {debtors.map((d, i) => {
                      const checked = selected.has(d.uploadedDebtorId);
                      const fileNo = d.ourFileNo || `#${d.uploadedDebtorId}`;
                      const name = movedDebtorName(d);
                      const st = d.statusId != null ? statusById.get(d.statusId) : undefined;
                      const moved = movedInfo(d);
                      return (
                        <motion.tr
                          key={d.uploadedDebtorId}
                          className={`hover:bg-muted/30 ${checked ? "bg-tenant-soft/40" : ""}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                        >
                          <td className="px-6 py-3">
                            <input
                              type="checkbox"
                              className="accent-tenant"
                              checked={checked}
                              onChange={() => toggleOne(d.uploadedDebtorId)}
                              aria-label={`Select ${name || fileNo}`}
                            />
                          </td>
                          <td className="px-4 py-3">
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
                          <td className="px-4 py-3">
                            {st ? (
                              <StatusPill
                                code={st.statusCode}
                                name={st.status}
                                color={st.statusColorCode}
                                className="text-xs px-2 py-0.5"
                              />
                            ) : (
                              <Pill tone="muted">No status</Pill>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {moved ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end">
                              <button
                                onClick={() => setTakeOnTargets([d])}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-[var(--tenant)] hover:text-white hover:border-[var(--tenant)] transition"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Take on
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

      {takeOnTargets && teamId != null && (
        <TakeOnModal
          teamId={teamId}
          targets={takeOnTargets}
          statuses={statuses}
          onClose={() => setTakeOnTargets(null)}
          onTaken={onTaken}
        />
      )}
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Take-on modal — set a status and, optionally, hand the file(s) to a member.
// ─────────────────────────────────────────────────────────────────────────────

function TakeOnModal({
  teamId,
  targets,
  statuses,
  onClose,
  onTaken,
}: {
  teamId: number;
  targets: MovedDebtor[];
  statuses: Status[];
  onClose: () => void;
  onTaken: () => void | Promise<void>;
}) {
  const [statusId, setStatusId] = useState<number | "">("");
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTeamDeckAssignUserList(teamId)
      .then((res) => {
        if (!cancelled) setMembers(res.assignUserList ?? []);
      })
      .catch((e) => {
        if (!cancelled)
          setMembersError(e instanceof Error ? e.message : "Failed to load team members.");
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const submit = async () => {
    if (statusId === "") return;
    setSaving(true);
    try {
      await assignMovedFileStatusAndUser({
        uploadedDebtorIdList: targets.map((t) => t.uploadedDebtorId),
        newStatusId: Number(statusId),
        assignUserId: userId === "" ? null : Number(userId),
      });
      const statusName = statuses.find((s) => s.statusId === Number(statusId))?.status ?? "";
      const who =
        userId === ""
          ? null
          : memberName(members.find((m) => m.userId === Number(userId)) ?? { firstName: "" });
      const label =
        targets.length === 1
          ? movedDebtorName(targets[0]) || `#${targets[0].uploadedDebtorId}`
          : `${targets.length} files`;
      toast.success(
        who
          ? `${label} taken on as ${statusName} and assigned to ${who}`
          : `${label} taken on as ${statusName}`,
      );
      await onTaken();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to take on file(s).");
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
        className="w-full max-w-md rounded-2xl bg-card border border-border shadow-tenant overflow-hidden flex flex-col max-h-[90vh]"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-display font-bold text-lg">Take on</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {targets.length === 1
                ? `Set a status for ${movedDebtorName(targets[0]) || `#${targets[0].uploadedDebtorId}`}`
                : `Set a status for ${targets.length} files`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Status
            </label>
            <NativeSelect
              className="mt-1.5"
              value={statusId}
              onChange={(e) => setStatusId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Select a status…</option>
              {statuses.map((s) => (
                <option key={s.statusId} value={s.statusId}>
                  {s.status}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Assign to member (optional)
            </label>
            <NativeSelect
              className="mt-1.5"
              value={userId}
              disabled={statusId === "" || membersLoading || members.length === 0}
              onChange={(e) => setUserId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">
                {membersLoading
                  ? "Loading members…"
                  : membersError
                    ? "Couldn't load members"
                    : "Leave unassigned"}
              </option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {memberName(m)} · {m.emailId}
                </option>
              ))}
            </NativeSelect>
            {statusId === "" && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Pick a status first — a file needs one before it can have an owner.
              </p>
            )}
          </div>
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
            disabled={statusId === "" || saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Take on {targets.length > 1 ? `${targets.length} files` : ""}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
