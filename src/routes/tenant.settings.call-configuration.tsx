import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Info,
  Loader2,
  Phone,
  PhoneCall,
  PhoneIncoming,
  RefreshCw,
  RotateCcw,
  Save,
  Users,
} from "lucide-react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard } from "@/components/tenant/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HoursWindowTabs, UnsavedDot } from "@/components/tenant/calls/InboundCallFields";
import { MatchedWindowEditor } from "@/components/tenant/calls/MatchedWindowEditor";
import { UnmatchedCallersPanel } from "@/components/tenant/calls/UnmatchedCallersPanel";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions/store";
import type { HoursWindow } from "@/lib/status-automation-api";
import { getTeamDeckAssignUserList, type AssignableMember } from "@/lib/team-deck-api";
import {
  formatPhoneNo,
  fullName,
  getTeamList,
  getTeamsOrgView,
  type TeamListItem,
  type TeamPhoneNumber,
} from "@/lib/teams-api";
import { getClientTemplate, getTemplateClients } from "@/lib/template-library-api";
import { getTeamPhoneNumber, getUsers, phoneNoIdsOf, type TenantUser } from "@/lib/users-api";
import {
  HOURS_LABEL,
  HOURS_WINDOWS,
  INBOUND_MATCHING_HELP,
  answeringDeviceFromSaved,
  getInboundCallSetting,
  matchedWindowFromSaved,
  unmatchedConfigFromSaved,
  unmatchedProblem,
  updateInboundCallSetting,
  validateMatchedWindow,
  type AgentGroup,
  type AnsweringDeviceConfig,
  type MatchedWindow,
  type SavedInboundCallSetting,
  type UnmatchedConfig,
} from "@/lib/call-configuration-api";

export const Route = createFileRoute("/tenant/settings/call-configuration")({
  head: () => ({ meta: [{ title: "Call Configuration · Tenant Admin" }] }),
  component: CallConfigurationPage,
});

type CallerScope = "unmatched" | "matched";

const SCOPE_LABEL: Record<CallerScope, string> = {
  unmatched: "Call Configuration for Unmatched Callers",
  matched: "Call Configuration for Matched Callers",
};

/** One team, kept for every team visited so edits survive a switch. */
type TeamState = {
  numbers: TeamPhoneNumber[];
  configs: Record<HoursWindow, MatchedWindow>;
  /** Last saved (or never-saved default) — for dirty-checking and "Discard". */
  baseline: Record<HoursWindow, MatchedWindow>;
};

/** A section's edits next to what was last saved. */
type Edited<T> = { value: T; baseline: T };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isDirty = <T,>(e: Edited<T> | null) => !!e && !same(e.value, e.baseline);
const edited = <T,>(value: T): Edited<T> => ({ value, baseline: structuredClone(value) });

const teamWindowDirty = (s: TeamState | undefined, w: HoursWindow) =>
  !!s && !same(s.configs[w], s.baseline[w]);

function CallConfigurationPage() {
  const perms = usePermissions();
  const { user } = useAuth();
  const canEdit = perms.can("callConfiguration.edit");
  // Unmatched callers and the answering device are one setup for the whole
  // business, so only a tenant admin changes them.
  const canEditBusinessWide = canEdit && perms.isTenantAdmin;

  // ── Page-wide data ──────────────────────────────────────────────────────
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [ledTeamIds, setLedTeamIds] = useState<number[]>([]);
  const [agentGroups, setAgentGroups] = useState<AgentGroup[]>([]);
  const [allUsers, setAllUsers] = useState<TenantUser[]>([]);
  const [saved, setSaved] = useState<SavedInboundCallSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Selection ───────────────────────────────────────────────────────────
  const [scope, setScope] = useState<CallerScope>("unmatched");
  const [teamId, setTeamId] = useState<number | null>(null);
  const [hours, setHours] = useState<HoursWindow>("during");
  const [unmatchedHours, setUnmatchedHours] = useState<HoursWindow>("during");

  // ── Edits ───────────────────────────────────────────────────────────────
  const [unmatched, setUnmatched] = useState<Edited<UnmatchedConfig> | null>(null);
  const [device, setDevice] = useState<Edited<AnsweringDeviceConfig> | null>(null);
  const [teamData, setTeamData] = useState<Record<number, TeamState>>({});
  const [teamErrors, setTeamErrors] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  /* ------------------------------ team members ----------------------------- */

  const [membersByTeam, setMembersByTeam] = useState<Record<number, AssignableMember[]>>({});
  const memberLoads = useRef(new Map<number, Promise<AssignableMember[]>>());

  const loadMembers = useCallback((id: number) => {
    const known = memberLoads.current.get(id);
    if (known) return known;
    const load = getTeamDeckAssignUserList(id)
      .then((res) => {
        const list = res?.assignUserList ?? [];
        setMembersByTeam((prev) => ({ ...prev, [id]: list }));
        return list;
      })
      .catch((e) => {
        memberLoads.current.delete(id);
        throw e;
      });
    memberLoads.current.set(id, load);
    return load;
  }, []);

  /* --------------------------------- load --------------------------------- */

  /** Puts a saved document on screen, replacing any edits. */
  const showSaved = useCallback(
    async (doc: SavedInboundCallSetting) => {
      const config = unmatchedConfigFromSaved(doc);
      // A setup saved before round robin order existed starts with the whole team.
      await Promise.all(
        [config.during.direct, config.during.ai, config.after.ai].map(async (destination) => {
          if (destination.teamId == null) return;
          const members = await loadMembers(destination.teamId).catch(() => []);
          if (destination.roundRobin.userIds.length === 0) {
            destination.roundRobin.userIds = members.map((m) => m.userId);
          }
        }),
      );
      setSaved(doc);
      setUnmatched(edited(config));
      setDevice(edited(answeringDeviceFromSaved(doc)));
      setTeamData({});
    },
    [loadMembers],
  );

  const loadPage = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [teamRes, templateClients, usersRes, orgView, doc] = await Promise.all([
        getTeamList(),
        getTemplateClients(),
        getUsers({ page: 0, size: 1000, status: null, searchText: "" }),
        // Only narrows a team leader's view, so the page works without it.
        getTeamsOrgView().catch(() => null),
        getInboundCallSetting(),
      ]);
      const groups = await Promise.all(
        (templateClients?.callClientList ?? []).map(async (c) => ({
          clientId: c.clientId,
          clientName: c.clientName,
          agents: (await getClientTemplate({ clientId: c.clientId, templateType: "call" })).map(
            (t) => ({ id: t.templateId, name: t.templateName }),
          ),
        })),
      );
      setTeams(teamRes?.teamList ?? []);
      setAgentGroups(groups.filter((g) => g.agents.length > 0));
      setAllUsers(usersRes?.users ?? []);
      setLedTeamIds(
        (orgView?.leaderList ?? [])
          .filter((l) => l.leaderId === user?.userId)
          .flatMap((l) => l.teamList.map((t) => t.teamId)),
      );
      await showSaved(doc);
    } catch (e) {
      // Without the saved document nothing can be edited: a save would replace it.
      setLoadError(e instanceof Error ? e.message : "Failed to load call settings.");
    } finally {
      setLoading(false);
    }
  }, [showSaved, user?.userId]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  // A team leader configures only the teams they lead; everyone else sees them all.
  const visibleTeams = useMemo(
    () =>
      perms.isTenantAdmin || ledTeamIds.length === 0
        ? teams
        : teams.filter((t) => ledTeamIds.includes(t.teamId)),
    [teams, ledTeamIds, perms.isTenantAdmin],
  );

  useEffect(() => {
    if (visibleTeams.length && !visibleTeams.some((t) => t.teamId === teamId)) {
      setTeamId(visibleTeams[0].teamId);
    }
  }, [visibleTeams, teamId]);

  /** Teams with a load in flight, so a re-render doesn't fetch one twice. */
  const inFlight = useRef(new Set<number>());

  const loadTeam = useCallback(
    async (id: number, doc: SavedInboundCallSetting) => {
      inFlight.current.add(id);
      setTeamErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      try {
        const [members, numbersRes] = await Promise.all([loadMembers(id), getTeamPhoneNumber(id)]);
        const memberIds = members.map((m) => m.userId);
        const configs = {
          during: matchedWindowFromSaved(doc, id, "during", memberIds),
          after: matchedWindowFromSaved(doc, id, "after", memberIds),
        };
        setTeamData((prev) => ({
          ...prev,
          [id]: {
            numbers: numbersRes?.phoneNoList ?? [],
            configs,
            baseline: structuredClone(configs),
          },
        }));
      } catch (e) {
        setTeamErrors((prev) => ({
          ...prev,
          [id]: e instanceof Error ? e.message : "Failed to load this team's call settings.",
        }));
      } finally {
        inFlight.current.delete(id);
      }
    },
    [loadMembers],
  );

  useEffect(() => {
    if (!saved || teamId == null || teamData[teamId] || teamErrors[teamId]) return;
    if (!inFlight.current.has(teamId)) loadTeam(teamId, saved);
  }, [saved, teamId, teamData, teamErrors, loadTeam]);

  /* ------------------------------ editing ------------------------------- */

  const state = teamId != null ? teamData[teamId] : undefined;

  const patchTeamWindow = (value: MatchedWindow) => {
    if (teamId == null) return;
    setTeamData((prev) => {
      const s = prev[teamId];
      return s ? { ...prev, [teamId]: { ...s, configs: { ...s.configs, [hours]: value } } } : prev;
    });
  };

  const unmatchedDirty = canEditBusinessWide && isDirty(unmatched);
  const deviceDirty = canEditBusinessWide && isDirty(device);
  const dirtyTeams = useMemo(
    () =>
      visibleTeams.flatMap((t) =>
        HOURS_WINDOWS.filter((w) => teamWindowDirty(teamData[t.teamId], w)).map((window) => ({
          teamId: t.teamId,
          window,
        })),
      ),
    [visibleTeams, teamData],
  );
  const dirtyCount = dirtyTeams.length + (unmatchedDirty ? 1 : 0) + (deviceDirty ? 1 : 0);

  const blocker = useBlocker({
    shouldBlockFn: () => dirtyCount > 0,
    enableBeforeUnload: () => dirtyCount > 0,
    withResolver: true,
  });

  const handleReset = () => {
    setUnmatched((prev) => prev && { ...prev, value: structuredClone(prev.baseline) });
    setDevice((prev) => prev && { ...prev, value: structuredClone(prev.baseline) });
    setTeamData((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, s]) => [id, { ...s, configs: structuredClone(s.baseline) }]),
      ),
    );
    toast.info("Reverted to the last saved configuration");
  };

  const handleSave = async () => {
    if (dirtyCount === 0) return;
    // Validate everything before writing anything, and take the user to the
    // first setting that needs attention.
    if (unmatchedDirty && unmatched) {
      const problem = unmatchedProblem(unmatched.value, {
        teamIds: teams.map((t) => t.teamId),
        activeUserIds: allUsers.filter((u) => u.status === "active").map((u) => u.userId),
        agentIds: agentGroups.flatMap((g) => g.agents.map((a) => a.id)),
        membersByTeam: Object.fromEntries(
          Object.entries(membersByTeam).map(([id, list]) => [id, list.map((m) => m.userId)]),
        ),
      });
      if (problem) {
        setScope("unmatched");
        setUnmatchedHours(problem.window);
        toast.error(`${HOURS_LABEL[problem.window]} · ${problem.message}`);
        return;
      }
    }
    for (const d of dirtyTeams) {
      const err = validateMatchedWindow(teamData[d.teamId].configs[d.window]);
      if (err) {
        const name = teams.find((t) => t.teamId === d.teamId)?.teamName ?? "Team";
        setScope("matched");
        setTeamId(d.teamId);
        setHours(d.window);
        toast.error(`${name} · ${HOURS_LABEL[d.window]}: ${err}`);
        return;
      }
    }

    setSaving(true);
    try {
      await updateInboundCallSetting({
        unmatched: unmatchedDirty ? unmatched?.value : undefined,
        device: deviceDirty ? device?.value : undefined,
        teams: dirtyTeams.map((d) => ({ ...d, value: teamData[d.teamId].configs[d.window] })),
      });
      toast.success("Call configuration saved");
      // Read it back rather than trusting the local copy.
      try {
        await showSaved(await getInboundCallSetting());
      } catch {
        setUnmatched((prev) => prev && edited(prev.value));
        setDevice((prev) => prev && edited(prev.value));
        setTeamData((prev) =>
          Object.fromEntries(
            Object.entries(prev).map(([id, s]) => [
              id,
              { ...s, baseline: structuredClone(s.configs) },
            ]),
          ),
        );
      }
    } catch (e) {
      // Nothing was written: the edits stay on screen.
      toast.error(e instanceof Error ? e.message : "Could not save the call configuration.");
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------- render ------------------------------- */

  const team = teams.find((t) => t.teamId === teamId) ?? null;
  const teamError = teamId != null ? teamErrors[teamId] : undefined;
  const cfg = state?.configs[hours];
  const leaderScoped = !perms.isTenantAdmin && ledTeamIds.length > 0;

  const userOptions = useMemo(
    () =>
      allUsers
        .filter((u) => u.status === "active")
        .map((u) => ({ id: u.userId, name: `${fullName(u)} — ${u.role}` })),
    [allUsers],
  );

  /** phoneNoId → the members it is allotted to. */
  const holders = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (const u of allUsers) {
      for (const id of phoneNoIdsOf(u)) (map[id] ??= []).push(fullName(u));
    }
    return map;
  }, [allUsers]);

  return (
    <Shell>
      <Topbar
        title="Call Configuration"
        subtitle="How inbound calls are answered"
        action={
          canEdit ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                disabled={dirtyCount === 0 || saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" /> Discard changes
              </button>
              <button
                onClick={handleSave}
                disabled={dirtyCount === 0 || saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save changes{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
              </button>
            </div>
          ) : undefined
        }
      />

      <section className="px-6 lg:px-10 pt-6 pb-12 space-y-5">
        {loading ? (
          <PageCard>
            <div className="px-6 py-10 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading call settings…
            </div>
          </PageCard>
        ) : loadError || !unmatched || !device ? (
          <PageCard>
            <ErrorState message={loadError ?? "Failed to load call settings."} onRetry={loadPage} />
          </PageCard>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{INBOUND_MATCHING_HELP}</p>

            <PageCard>
              <fieldset className="flex flex-col gap-3 px-5 py-4 md:flex-row md:gap-6">
                <legend className="sr-only">Caller configuration</legend>
                {(["unmatched", "matched"] as const).map((s) => (
                  <label
                    key={s}
                    className="flex cursor-pointer items-center gap-2 text-sm font-semibold"
                  >
                    <input
                      type="radio"
                      name="caller-configuration"
                      checked={scope === s}
                      onChange={() => setScope(s)}
                      className="h-4 w-4 accent-tenant"
                    />
                    {SCOPE_LABEL[s]}
                    {(s === "unmatched"
                      ? unmatchedDirty
                      : dirtyTeams.length > 0 || deviceDirty) && <UnsavedDot />}
                  </label>
                ))}
              </fieldset>
            </PageCard>

            {scope === "unmatched" ? (
              <UnmatchedCallersPanel
                value={unmatched.value}
                onChange={(update) =>
                  setUnmatched((prev) => prev && { ...prev, value: update(prev.value) })
                }
                window={unmatchedHours}
                onWindowChange={setUnmatchedHours}
                isDirty={(w) => !same(unmatched.value[w], unmatched.baseline[w])}
                canEdit={canEditBusinessWide}
                agentGroups={agentGroups}
                users={userOptions}
                teams={teams}
                membersByTeam={membersByTeam}
                loadMembers={loadMembers}
              />
            ) : visibleTeams.length === 0 ? (
              <PageCard>
                <p className="px-6 py-16 text-center text-sm text-muted-foreground">
                  No teams yet. Create a team and give it numbers, then decide here how its calls
                  are answered.
                </p>
              </PageCard>
            ) : (
              <>
                <PageCard>
                  <div className="px-6 py-5 flex items-start gap-3">
                    <span className="shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-tenant-soft text-tenant flex items-center justify-center">
                      <PhoneCall className="h-4 w-4" />
                    </span>
                    <div className="space-y-1">
                      <h2 className="font-display text-lg font-bold">Call handling per team</h2>
                      <p className="text-sm text-muted-foreground max-w-3xl">
                        Phone numbers belong to teams, so every call resolves to one team and that
                        team&apos;s rules decide what happens next. Set who answers inbound calls
                        and how they reach the right person.
                        {leaderScoped && " As a team leader you configure your own team."}
                      </p>
                    </div>
                  </div>
                </PageCard>

                {/* ── Team + its numbers ──────────────────────────────── */}
                <PageCard>
                  <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <Users className="h-3.5 w-3.5" /> Team
                      </span>
                      <div
                        role="tablist"
                        className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1"
                      >
                        {visibleTeams.map((t) => {
                          const on = t.teamId === teamId;
                          const dirty = HOURS_WINDOWS.some((w) =>
                            teamWindowDirty(teamData[t.teamId], w),
                          );
                          return (
                            <button
                              key={t.teamId}
                              type="button"
                              role="tab"
                              aria-selected={on}
                              onClick={() => setTeamId(t.teamId)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
                                on
                                  ? "bg-gradient-tenant text-white font-semibold shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {t.teamName}
                              {dirty && <UnsavedDot />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {state && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-tenant-soft text-tenant px-2.5 py-1 text-xs font-semibold">
                        <Phone className="h-3.5 w-3.5" /> {state.numbers.length} number
                        {state.numbers.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  {state && (
                    <div className="px-6 py-4 border-t border-border">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Numbers
                      </div>
                      {state.numbers.length === 0 ? (
                        <p className="text-xs text-warning-foreground">
                          This team has no numbers yet, so nobody can call it — assign one under
                          Teams.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {state.numbers.map((n) => {
                            const live = n.status === "active" && n.callEnabled === 1;
                            return (
                              <span
                                key={n.phoneNoId}
                                title={live ? undefined : "Calling is off for this number"}
                                className={`inline-flex items-center gap-2 rounded-lg border border-border px-2 py-1 ${
                                  live ? "" : "opacity-50"
                                }`}
                              >
                                <span className="rounded bg-tenant-soft text-tenant text-[10px] font-bold uppercase px-1.5 py-0.5">
                                  {n.numberType === "tollFree" ? "Toll-free" : "Local"}
                                </span>
                                <span className="font-mono text-sm font-semibold">
                                  {formatPhoneNo(n.phoneNo)}
                                </span>
                                {holders[n.phoneNoId] && (
                                  <span className="text-xs text-muted-foreground">
                                    {holders[n.phoneNoId].join(", ")}
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </PageCard>

                <HoursWindowTabs
                  value={hours}
                  onChange={setHours}
                  isDirty={(w) => teamWindowDirty(state, w)}
                />

                {/* ── Inbound call settings ───────────────────────────── */}
                <PageCard>
                  <div className="px-6 py-4 flex items-start gap-3 border-b border-border">
                    <span className="shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-tenant-soft text-tenant flex items-center justify-center">
                      <PhoneIncoming className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="font-display text-lg font-bold">Inbound call settings</h2>
                      <p className="text-sm text-muted-foreground">
                        What happens when someone calls one of this team&apos;s numbers
                      </p>
                    </div>
                  </div>

                  {teamError ? (
                    <ErrorState
                      message={teamError}
                      onRetry={() => teamId != null && saved && loadTeam(teamId, saved)}
                    />
                  ) : !state || !cfg || !team ? (
                    <div className="px-6 py-16 flex items-center justify-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading call settings…
                    </div>
                  ) : (
                    <MatchedWindowEditor
                      name={`incoming-${team.teamId}-${hours}`}
                      value={cfg}
                      onChange={patchTeamWindow}
                      members={membersByTeam[team.teamId] ?? []}
                      agentGroups={agentGroups}
                      canEdit={canEdit}
                      device={device.value[hours]}
                      onDeviceChange={(d) =>
                        setDevice(
                          (prev) => prev && { ...prev, value: { ...prev.value, [hours]: d } },
                        )
                      }
                      canEditDevice={canEditBusinessWide}
                    />
                  )}
                </PageCard>

                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Outbound calls are configured per status, step by step, in{" "}
                    <Link to="/tenant/settings/status-automation" className="text-tenant underline">
                      Status Automation → Outbound Calls
                    </Link>
                    .
                  </span>
                </p>
              </>
            )}
          </>
        )}
      </section>

      <AlertDialog open={blocker.status === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              Call settings have been changed but not saved. Leaving this page discards the changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              Stay on this page
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}

/* -------------------------------- fragments ------------------------------- */

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="px-6 py-16 text-center">
      <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
      >
        <RefreshCw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}
