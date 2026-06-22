import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import {
  Plus,
  UsersRound,
  Crown,
  X,
  LayoutGrid,
  Network,
  RefreshCw,
  Loader2,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getTeamsCardView,
  getTeamsOrgView,
  getAllLeaderList,
  getUnassignedTeamMembers,
  getTeamDetails,
  createTeam,
  updateTeam,
  deleteTeam,
  fullName,
  type TeamCard,
  type LeaderGroup,
  type SelectableUser,
} from "@/lib/teams-api";

export const Route = createFileRoute("/tenant/teams")({
  head: () => ({ meta: [{ title: "Teams · Tenant Admin" }] }),
  component: TeamsPage,
});

type ViewMode = "cards" | "org";

function utilizationOf(members: number, capacity: number) {
  if (!capacity) return 0;
  return (members / capacity) * 100;
}

function TeamsPage() {
  const [view, setView] = useState<ViewMode>("cards");
  const [cards, setCards] = useState<TeamCard[]>([]);
  const [leaderGroups, setLeaderGroups] = useState<LeaderGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<TeamCard | null>(null);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [card, org] = await Promise.all([getTeamsCardView(), getTeamsOrgView()]);
      setCards(card.teamList ?? []);
      setLeaderGroups(org.leaderList ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load teams.");
      setCards([]);
      setLeaderGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const openCreate = () => {
    setEditingTeamId(null);
    setShowForm(true);
  };
  const openEdit = (teamId: number) => {
    setEditingTeamId(teamId);
    setShowForm(true);
  };

  const totalTeams = cards.length;

  return (
    <Shell>
      <Topbar
        title="Teams"
        subtitle="Hierarchical organization with team-scoped permissions on top of roles"
        action={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
              <button
                onClick={() => setView("cards")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  view === "cards"
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Cards
              </button>
              <button
                onClick={() => setView("org")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  view === "org"
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Network className="h-3.5 w-3.5" /> Org chart
              </button>
            </div>
            <button
              onClick={fetchTeams}
              disabled={loading}
              aria-label="Refresh"
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={openCreate}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
            >
              <Plus className="h-4 w-4" /> New team
            </button>
          </div>
        }
      />

      {loading ? (
        <section className="px-6 lg:px-10 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card h-52 animate-pulse"
              />
            ))}
          </div>
        </section>
      ) : error ? (
        <section className="px-6 lg:px-10 py-16 text-center">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <button
            onClick={fetchTeams}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </section>
      ) : totalTeams === 0 ? (
        <section className="px-6 lg:px-10 py-16">
          <div className="max-w-md mx-auto text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-tenant-soft text-tenant flex items-center justify-center">
              <UsersRound className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium">No teams yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first team to organize members under a leader.
            </p>
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
            >
              <Plus className="h-4 w-4" /> New team
            </button>
          </div>
        </section>
      ) : view === "cards" ? (
        <section className="px-6 lg:px-10 py-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cards.map((t) => {
            const members = t.teamMembers ?? [];
            const utilization = utilizationOf(members.length, t.capacity);
            const leader = fullName({ firstName: t.leaderFirstName, lastName: t.leaderLastName });
            return (
              <PageCard key={t.teamId}>
                <CardHead
                  title={t.teamName}
                  subtitle={`Created ${new Date(t.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}`}
                  action={
                    <div className="flex items-center gap-2">
                      <Pill tone="tenant">
                        <UsersRound className="h-3 w-3" /> {members.length}{" "}
                        {members.length === 1 ? "member" : "members"}
                      </Pill>
                      <button
                        onClick={() => openEdit(t.teamId)}
                        aria-label="Edit team"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleting(t)}
                        aria-label="Delete team"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border text-destructive hover:bg-destructive/10 hover:border-destructive/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  }
                />
                <div className="px-6 py-5 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Leader
                    </div>
                    <div className="mt-1 font-semibold inline-flex items-center gap-1.5">
                      <Crown className="h-3.5 w-3.5 text-warning" /> {leader || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Capacity
                    </div>
                    <div className="mt-1 font-semibold">
                      {members.length} / {t.capacity}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Utilization
                    </div>
                    <div className="mt-1 font-semibold">{utilization.toFixed(0)}%</div>
                  </div>
                </div>
                <div className="px-6 pb-5">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full ${utilization > 90 ? "bg-destructive" : utilization > 75 ? "bg-warning" : "bg-gradient-tenant"}`}
                      style={{ width: `${Math.min(utilization, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="px-6 pb-5 flex flex-wrap gap-1.5">
                  {members.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No members assigned</span>
                  ) : (
                    members.map((u) => (
                      <span
                        key={u.userId}
                        className="px-2 py-0.5 rounded-md bg-muted text-xs"
                        title={u.emailId}
                      >
                        {fullName(u) || u.emailId}
                      </span>
                    ))
                  )}
                </div>
              </PageCard>
            );
          })}
        </section>
      ) : (
        <OrgChartView leaderGroups={leaderGroups} />
      )}

      {showForm && (
        <TeamFormModal
          teamId={editingTeamId}
          onClose={() => setShowForm(false)}
          onSaved={async (label) => {
            setShowForm(false);
            toast.success(label);
            await fetchTeams();
          }}
        />
      )}

      {deleting && (
        <DeleteTeamDialog
          team={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={async () => {
            setDeleting(null);
            await fetchTeams();
          }}
        />
      )}
    </Shell>
  );
}

function OrgChartView({ leaderGroups }: { leaderGroups: LeaderGroup[] }) {
  const leaders = [...leaderGroups].sort((a, b) => b.teamList.length - a.teamList.length);

  return (
    <section className="px-6 lg:px-10 py-6">
      <div className="rounded-2xl border border-border bg-card shadow-elegant p-6 overflow-x-auto">
        <div className="flex flex-col items-center gap-8 min-w-max">
          {/* Org root */}
          <div className="px-5 py-3 rounded-xl bg-gradient-tenant text-white shadow-tenant font-display font-bold">
            Organization
          </div>
          <div className="w-px h-6 bg-border" />

          {/* Leaders row */}
          <div className="flex items-start gap-10">
            {leaders.map((lg) => {
              const leader = fullName({
                firstName: lg.leaderFirstName,
                lastName: lg.leaderLastName,
              });
              return (
                <div key={lg.leaderId} className="flex flex-col items-center gap-4">
                  {/* Leader node */}
                  <div className="px-4 py-3 rounded-xl border-2 border-tenant bg-tenant-soft text-center min-w-[180px]">
                    <div className="inline-flex items-center gap-1.5 text-sm font-bold">
                      <Crown className="h-3.5 w-3.5 text-warning" /> {leader || "—"}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                      {lg.teamList.length > 1 ? `Leads ${lg.teamList.length} teams` : "Team leader"}
                    </div>
                  </div>

                  {lg.teamList.length > 0 && <div className="w-px h-5 bg-border" />}

                  {/* Teams under this leader */}
                  <div className="flex items-start gap-4">
                    {lg.teamList.map((t) => {
                      const members = t.teamMembers ?? [];
                      return (
                        <div key={t.teamId} className="flex flex-col items-center gap-3">
                          <div className="px-3 py-2.5 rounded-lg border border-border bg-card text-center min-w-[160px] shadow-sm">
                            <div className="text-sm font-semibold">{t.teamName}</div>
                            <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <UsersRound className="h-3 w-3" /> {members.length}{" "}
                              {members.length === 1 ? "member" : "members"}
                            </div>
                          </div>
                          {members.length > 0 && <div className="w-px h-4 bg-border" />}
                          <div className="flex flex-col gap-1 items-center">
                            {members.slice(0, 4).map((u) => (
                              <div
                                key={u.userId}
                                className="px-2.5 py-1 rounded-md bg-muted text-[11px] font-medium"
                                title={u.emailId}
                              >
                                {fullName(u) || u.emailId}
                              </div>
                            ))}
                            {members.length > 4 && (
                              <div className="text-[10px] text-muted-foreground">
                                +{members.length - 4} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        A user can lead multiple teams — they appear once as a leader node with all their teams
        branching beneath.
      </p>
    </section>
  );
}

function TeamFormModal({
  teamId,
  onClose,
  onSaved,
}: {
  teamId: number | null;
  onClose: () => void;
  onSaved: (label: string) => void | Promise<void>;
}) {
  const isEdit = teamId !== null;

  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState<number | "">("");
  const [capacity, setCapacity] = useState<number | "">("");
  const [members, setMembers] = useState<number[]>([]);
  const [memberQuery, setMemberQuery] = useState("");

  const [leaders, setLeaders] = useState<SelectableUser[]>([]);
  // Full pool of selectable members (create: unassigned; edit: assigned + unassigned).
  const [memberPool, setMemberPool] = useState<SelectableUser[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setOptionsLoading(true);
    const load = async () => {
      try {
        const leaderRes = await getAllLeaderList();
        if (isEdit) {
          const details = await getTeamDetails(teamId);
          if (cancelled) return;
          const td = details.teamDetails;
          setLeaders(leaderRes.userList ?? []);
          setMemberPool([
            ...(details.assignedTeamMembers ?? []),
            ...(details.unassignedTeamMembers ?? []),
          ]);
          setName(td.teamName);
          setCapacity(td.capacity);
          setLeaderId(td.leaderId);
          setMembers((details.assignedTeamMembers ?? []).map((m) => m.userId));
        } else {
          const unassignedRes = await getUnassignedTeamMembers();
          if (cancelled) return;
          setLeaders(leaderRes.userList ?? []);
          setMemberPool(unassignedRes.userList ?? []);
          setLeaderId(leaderRes.userList?.[0]?.userId ?? "");
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load team options");
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [teamId, isEdit]);

  // The leader can't also be a member — drop them from selection when chosen.
  const onLeaderChange = (value: number | "") => {
    setLeaderId(value);
    if (value !== "") setMembers((prev) => prev.filter((id) => id !== value));
  };

  // Member options exclude whoever is the leader.
  const selectablePool = useMemo(
    () => memberPool.filter((u) => u.userId !== leaderId),
    [memberPool, leaderId],
  );

  const filteredPool = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return selectablePool;
    return selectablePool.filter(
      (u) =>
        fullName(u).toLowerCase().includes(q) ||
        u.emailId.toLowerCase().includes(q) ||
        (u.role ?? "").toLowerCase().includes(q),
    );
  }, [selectablePool, memberQuery]);

  const toggle = (id: number) =>
    setMembers((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // Submitted members never include the leader.
  const effectiveMembers = useMemo(
    () => members.filter((id) => id !== leaderId),
    [members, leaderId],
  );

  // Members must never exceed the entered capacity.
  const capacityNum = capacity === "" ? 0 : Number(capacity);
  const overCapacity = capacityNum > 0 && effectiveMembers.length > capacityNum;
  const capacityReached = capacityNum > 0 && effectiveMembers.length >= capacityNum;

  const canSave =
    !!name.trim() &&
    leaderId !== "" &&
    capacity !== "" &&
    Number(capacity) > 0 &&
    effectiveMembers.length > 0 &&
    !overCapacity &&
    !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        teamName: name.trim(),
        leaderId: Number(leaderId),
        userList: effectiveMembers,
        capacity: Number(capacity),
      };
      if (isEdit) {
        await updateTeam({ teamId, ...payload });
        await onSaved(`Team "${payload.teamName}" updated`);
      } else {
        await createTeam(payload);
        await onSaved(`Team "${payload.teamName}" created`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save team");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-card border border-border shadow-tenant overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-display font-bold text-lg">{isEdit ? "Edit team" : "New team"}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pick a leader and assign members. The leader can't also be a member.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-sm">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Team name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="BMO Recovery Team"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-muted border border-border outline-none focus:ring-2 ring-tenant"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Leader
              </label>
              <select
                value={leaderId}
                onChange={(e) =>
                  onLeaderChange(e.target.value === "" ? "" : Number(e.target.value))
                }
                disabled={optionsLoading}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-muted border border-border outline-none disabled:opacity-50"
              >
                {optionsLoading ? (
                  <option>Loading…</option>
                ) : (
                  leaders.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {fullName(u) || u.emailId}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Capacity
              </label>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 50"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-muted border border-border outline-none focus:ring-2 ring-tenant"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Members{" "}
                {effectiveMembers.length > 0 && (
                  <span className="text-tenant">({effectiveMembers.length} selected)</span>
                )}
              </label>
              {selectablePool.length > 0 && (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-muted border border-border w-48">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder="Filter…"
                    className="bg-transparent text-xs flex-1 outline-none"
                  />
                </div>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-1 max-h-56 overflow-y-auto rounded-lg border border-border p-2">
              {optionsLoading ? (
                <div className="col-span-full py-6 text-center text-xs text-muted-foreground inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading members…
                </div>
              ) : selectablePool.length === 0 ? (
                <div className="col-span-full py-6 text-center text-xs text-muted-foreground">
                  No members available to assign.
                </div>
              ) : filteredPool.length === 0 ? (
                <div className="col-span-full py-6 text-center text-xs text-muted-foreground">
                  No members match “{memberQuery}”.
                </div>
              ) : (
                filteredPool.map((u) => {
                  const isChecked = members.includes(u.userId);
                  // Block selecting beyond capacity — already-checked members stay toggleable.
                  const disabled = capacityReached && !isChecked;
                  return (
                    <label
                      key={u.userId}
                      title={disabled ? "Team capacity reached" : undefined}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded ${
                        disabled
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-muted cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-tenant"
                        checked={isChecked}
                        disabled={disabled}
                        onChange={() => toggle(u.userId)}
                      />
                      <span className="text-sm flex-1 truncate">{fullName(u) || u.emailId}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[40%]">
                        {u.role}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            {!optionsLoading && effectiveMembers.length === 0 && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Select at least one member — a team can't be saved empty.
              </p>
            )}
            {overCapacity && (
              <p className="mt-1.5 text-[11px] font-medium text-red-500">
                {effectiveMembers.length} members selected exceeds the capacity of {capacityNum}.
                Remove members or increase capacity before saving.
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
            disabled={!canSave}
            onClick={save}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create team"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteTeamDialog({
  team,
  onClose,
  onDeleted,
}: {
  team: TeamCard;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const memberCount = team.teamMembers?.length ?? 0;

  const confirm = async () => {
    setDeleting(true);
    try {
      await deleteTeam(team.teamId);
      toast.success(`Team "${team.teamName}" deleted`, {
        description:
          memberCount > 0
            ? `${memberCount} ${memberCount === 1 ? "member" : "members"} released back to the unassigned pool.`
            : undefined,
      });
      await onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete team");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-tenant overflow-hidden">
        <div className="px-6 py-5 flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base">Delete team?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">{team.teamName}</span>
              {memberCount > 0 ? (
                <>
                  {" "}
                  and release its {memberCount} {memberCount === 1 ? "member" : "members"} back to
                  the unassigned pool.
                </>
              ) : (
                "."
              )}{" "}
              This can't be undone.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-white text-sm font-semibold disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete team
          </button>
        </div>
      </div>
    </div>
  );
}
