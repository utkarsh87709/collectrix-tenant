import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Info,
  Loader2,
  Moon,
  Phone,
  PhoneCall,
  PhoneIncoming,
  RefreshCw,
  RotateCcw,
  Save,
  Sun,
  User,
  Users,
} from "lucide-react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { NativeSelect, PageCard } from "@/components/tenant/ui";
import { Switch } from "@/components/ui/switch";
import { FieldLabel } from "@/components/tenant/statuses/automation-fields";
import {
  AnsweringDevicePanel,
  AssignedFilesPanel,
  ChoiceCard,
  NoAnswerPanel,
  PatchTabBar,
  UnassignedFilesPanel,
  type PatchTab,
} from "@/components/tenant/calls/CallPatchingPanels";
import { usePermissions } from "@/lib/permissions/store";
import { getTeamDeckAssignUserList, type AssignableMember } from "@/lib/team-deck-api";
import {
  formatPhoneNo,
  fullName,
  getTeamList,
  type TeamListItem,
  type TeamPhoneNumber,
} from "@/lib/teams-api";
import { getClientTemplate, getTemplateClients } from "@/lib/template-library-api";
import { getTeamPhoneNumber, getUsers, phoneNoIdsOf } from "@/lib/users-api";
import {
  SETTING_TYPES,
  emptyIncomingConfig,
  getIncomingCallSettings,
  incomingConfigFromWire,
  incomingPayload,
  reachesPeople,
  updateIncomingCallSetting,
  validateIncomingConfig,
  type IncomingCallConfig,
  type SettingType,
} from "@/lib/call-configuration-api";

export const Route = createFileRoute("/tenant/settings/call-configuration")({
  head: () => ({ meta: [{ title: "Call Configuration · Tenant Admin" }] }),
  component: CallConfigurationPage,
});

const HOURS_LABEL: Record<SettingType, string> = {
  insideBusinessHr: "Inside business hours",
  outsideBusinessHr: "Outside business hours",
};

/** The AI voice agents of one client (its `call` templates). */
type AgentGroup = { clientId: number; clientName: string; agents: { id: number; name: string }[] };

/** Everything loaded for one team, plus its edits. */
type TeamState = {
  members: AssignableMember[];
  numbers: TeamPhoneNumber[];
  configs: Record<SettingType, IncomingCallConfig>;
  /** Last saved (or never-saved default) — for dirty-checking and "Discard". */
  baseline: Record<SettingType, IncomingCallConfig>;
};

const isDirty = (s: TeamState | undefined, st: SettingType) =>
  !!s && JSON.stringify(s.configs[st]) !== JSON.stringify(s.baseline[st]);

function CallConfigurationPage() {
  // ── Page-wide lookups ───────────────────────────────────────────────────
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [agentGroups, setAgentGroups] = useState<AgentGroup[]>([]);
  /** phoneNoId → the members it is allotted to. */
  const [holders, setHolders] = useState<Record<number, string[]>>({});
  const [pickersLoading, setPickersLoading] = useState(true);
  const [pickersError, setPickersError] = useState<string | null>(null);

  // ── Selection ───────────────────────────────────────────────────────────
  const [teamId, setTeamId] = useState<number | null>(null);
  const [hours, setHours] = useState<SettingType>("insideBusinessHr");
  const [tab, setTab] = useState<PatchTab>("assigned");

  // ── Per-team data, kept for every team visited so edits survive a switch ─
  const [teamData, setTeamData] = useState<Record<number, TeamState>>({});
  const [teamErrors, setTeamErrors] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  /* --------------------------- lookups (once) --------------------------- */

  const loadPickers = useCallback(async () => {
    setPickersLoading(true);
    setPickersError(null);
    try {
      const [teamRes, templateClients] = await Promise.all([getTeamList(), getTemplateClients()]);
      // The setting belongs to a team, not a client, so every client's agents
      // are offered, grouped by client.
      const callClients = templateClients?.callClientList ?? [];
      const groups = await Promise.all(
        callClients.map(async (c) => ({
          clientId: c.clientId,
          clientName: c.clientName,
          agents: (await getClientTemplate({ clientId: c.clientId, templateType: "call" })).map(
            (t) => ({ id: t.templateId, name: t.templateName }),
          ),
        })),
      );
      const teamList = teamRes?.teamList ?? [];
      setTeams(teamList);
      setAgentGroups(groups.filter((g) => g.agents.length > 0));
      setTeamId((prev) => prev ?? teamList[0]?.teamId ?? null);
    } catch (e) {
      setPickersError(e instanceof Error ? e.message : "Failed to load teams.");
    } finally {
      setPickersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPickers();
    // Who holds each number is decoration on the number chips — the page
    // works without it, so a failure is ignored.
    getUsers({ page: 1, size: 1000, status: null, searchText: "" })
      .then((res) => {
        const map: Record<number, string[]> = {};
        for (const u of res?.users ?? []) {
          for (const id of phoneNoIdsOf(u)) (map[id] ??= []).push(fullName(u));
        }
        setHolders(map);
      })
      .catch(() => {});
  }, [loadPickers]);

  /* ---------------------------- per-team load --------------------------- */

  /** Teams with a load in flight, so a re-render doesn't fetch one twice. */
  const inFlight = useRef(new Set<number>());

  /** (Re)reads a team, replacing any unsaved edits to it. */
  const loadTeam = useCallback(async (tId: number) => {
    inFlight.current.add(tId);
    setTeamErrors((prev) => {
      const next = { ...prev };
      delete next[tId];
      return next;
    });
    try {
      const [membersRes, numbersRes, settings] = await Promise.all([
        getTeamDeckAssignUserList(tId),
        getTeamPhoneNumber(tId),
        getIncomingCallSettings(tId),
      ]);
      const members = membersRes?.assignUserList ?? [];
      const memberIds = members.map((m) => m.userId);
      const configs = Object.fromEntries(
        SETTING_TYPES.map((st) => {
          const row = settings.find((s) => s.settingType === st);
          return [st, row ? incomingConfigFromWire(row) : emptyIncomingConfig(memberIds)];
        }),
      ) as Record<SettingType, IncomingCallConfig>;
      setTeamData((prev) => ({
        ...prev,
        [tId]: {
          members,
          numbers: numbersRes?.phoneNoList ?? [],
          configs,
          baseline: structuredClone(configs),
        },
      }));
    } catch (e) {
      setTeamErrors((prev) => ({
        ...prev,
        [tId]: e instanceof Error ? e.message : "Failed to load this team's call settings.",
      }));
    } finally {
      inFlight.current.delete(tId);
    }
  }, []);

  useEffect(() => {
    if (teamId == null || teamData[teamId] || teamErrors[teamId]) return;
    if (!inFlight.current.has(teamId)) loadTeam(teamId);
  }, [teamId, teamData, teamErrors, loadTeam]);

  /* ------------------------------ editing ------------------------------- */

  const team = teams.find((t) => t.teamId === teamId) ?? null;
  const state = teamId != null ? teamData[teamId] : undefined;
  const cfg = state?.configs[hours];

  const patch = (p: Partial<IncomingCallConfig>) => {
    if (teamId == null) return;
    setTeamData((prev) => {
      const s = prev[teamId];
      if (!s) return prev;
      return {
        ...prev,
        [teamId]: { ...s, configs: { ...s.configs, [hours]: { ...s.configs[hours], ...p } } },
      };
    });
  };

  /** Every edited (team, hours) setting, in team order. */
  const dirty = useMemo(
    () =>
      teams.flatMap((t) =>
        SETTING_TYPES.filter((st) => isDirty(teamData[t.teamId], st)).map((st) => ({
          teamId: t.teamId,
          settingType: st,
        })),
      ),
    [teams, teamData],
  );

  const handleReset = () => {
    setTeamData((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, s]) => [id, { ...s, configs: structuredClone(s.baseline) }]),
      ),
    );
    toast.info("Reverted to the last saved configuration");
  };

  const handleSave = async () => {
    if (dirty.length === 0) {
      toast.info("Nothing to save");
      return;
    }
    // Validate everything before writing anything, and take the user to the
    // first setting that needs attention.
    for (const d of dirty) {
      const err = validateIncomingConfig(teamData[d.teamId].configs[d.settingType]);
      if (err) {
        const name = teams.find((t) => t.teamId === d.teamId)?.teamName ?? "Team";
        toast.error(`${name} · ${HOURS_LABEL[d.settingType]}: ${err}`);
        setTeamId(d.teamId);
        setHours(d.settingType);
        return;
      }
    }

    setSaving(true);
    let saved = 0;
    try {
      for (const d of dirty) {
        // One call per setting: the backend upserts a single (team, hours) row.
        await updateIncomingCallSetting(
          incomingPayload(d.teamId, d.settingType, teamData[d.teamId].configs[d.settingType]),
        );
        saved += 1;
      }
      toast.success(`Saved ${saved} call setting${saved === 1 ? "" : "s"}`);
      // Read the saved teams back rather than trusting the local copy.
      await Promise.all([...new Set(dirty.map((d) => d.teamId))].map((id) => loadTeam(id)));
    } catch (e) {
      const failed = dirty[saved];
      const name = teams.find((t) => t.teamId === failed.teamId)?.teamName ?? "Team";
      toast.error(
        `${name} · ${HOURS_LABEL[failed.settingType]}: ${
          e instanceof Error ? e.message : "could not save"
        }${saved ? ` (${saved} saved before this)` : ""}`,
      );
      // Keep the unsaved edits on screen; only what went through stops
      // counting as dirty.
      setTeamData((prev) => {
        const next = { ...prev };
        for (const d of dirty.slice(0, saved)) {
          const s = next[d.teamId];
          next[d.teamId] = {
            ...s,
            baseline: { ...s.baseline, [d.settingType]: structuredClone(s.configs[d.settingType]) },
          };
        }
        return next;
      });
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------- render ------------------------------- */

  const canEdit = usePermissions().can("callConfiguration.edit");
  const teamError = teamId != null ? teamErrors[teamId] : undefined;
  const agentKnown = (id: number | null) =>
    id == null || agentGroups.some((g) => g.agents.some((a) => a.id === id));
  const radio = `incoming-${teamId}-${hours}`;

  return (
    <Shell>
      <Topbar
        title="Call Configuration"
        subtitle="How inbound calls to a team's numbers are answered"
        action={
          canEdit ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                disabled={dirty.length === 0 || saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" /> Discard changes
              </button>
              <button
                onClick={handleSave}
                disabled={dirty.length === 0 || saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save changes{dirty.length > 0 ? ` (${dirty.length})` : ""}
              </button>
            </div>
          ) : undefined
        }
      />

      <section className="px-6 lg:px-10 pt-6 pb-12 space-y-5">
        {/* ── Intro ─────────────────────────────────────────────────────── */}
        <PageCard>
          <div className="px-6 py-5 flex items-start gap-3">
            <span className="shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-tenant-soft text-tenant flex items-center justify-center">
              <PhoneCall className="h-4 w-4" />
            </span>
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold">Call handling per team</h2>
              <p className="text-sm text-muted-foreground max-w-3xl">
                Phone numbers belong to teams, so every call resolves to one team and that
                team&apos;s rules decide what happens next. Set who answers inbound calls and how
                they reach the right person.
              </p>
            </div>
          </div>
        </PageCard>

        {pickersLoading ? (
          <PageCard>
            <div className="px-6 py-10 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading teams…
            </div>
          </PageCard>
        ) : pickersError ? (
          <PageCard>
            <ErrorState message={pickersError} onRetry={loadPickers} />
          </PageCard>
        ) : teams.length === 0 ? (
          <PageCard>
            <p className="px-6 py-16 text-center text-sm text-muted-foreground">
              No teams yet. Create a team and give it numbers, then decide here how its calls are
              answered.
            </p>
          </PageCard>
        ) : (
          <>
            {/* ── Team + its numbers ──────────────────────────────────── */}
            <PageCard>
              <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Team
                  </span>
                  <div role="tablist" className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
                    {teams.map((t) => {
                      const on = t.teamId === teamId;
                      const edited = SETTING_TYPES.some((st) => isDirty(teamData[t.teamId], st));
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
                          {edited && <UnsavedDot />}
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
                      This team has no numbers yet, so nobody can call it — assign one under Teams.
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

            {/* ── Inside / outside business hours ─────────────────────── */}
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">
              {SETTING_TYPES.map((st) => {
                const on = st === hours;
                const inside = st === "insideBusinessHr";
                const Icon = inside ? Sun : Moon;
                return (
                  <button
                    key={st}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setHours(st)}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm ${
                      on
                        ? `${inside ? "bg-gradient-tenant" : "bg-indigo-600"} text-white font-semibold shadow-sm`
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {HOURS_LABEL[st]}
                    {isDirty(state, st) && <UnsavedDot />}
                  </button>
                );
              })}
            </div>

            {/* ── Inbound call settings ───────────────────────────────── */}
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
                  onRetry={() => teamId != null && loadTeam(teamId)}
                />
              ) : !state || !cfg || !team ? (
                <div className="px-6 py-16 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading call settings…
                </div>
              ) : (
                <div className="px-6 py-5 space-y-5">
                  {/* A native fieldset disables every control inside it in
                      read-only mode; the tab bar stays outside so it can
                      still be browsed. */}
                  <fieldset disabled={!canEdit} className="min-w-0 space-y-5">
                    <div>
                      <div className="text-sm font-medium mb-2">Calls are answered by</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ChoiceCard
                          name={`${radio}-mode`}
                          checked={cfg.mode === "ai"}
                          onSelect={() => patch({ mode: "ai" })}
                          icon={<Bot className="h-4 w-4" />}
                          title="AI"
                          hint="The voice agent answers, identifies the caller against a customer file, and follows your inbound script."
                        />
                        <ChoiceCard
                          name={`${radio}-mode`}
                          checked={cfg.mode === "directPatch"}
                          onSelect={() => patch({ mode: "directPatch" })}
                          icon={<User className="h-4 w-4" />}
                          title="A human"
                          hint="The call rings your people. How it finds the right person depends on whether the file is assigned."
                        />
                      </div>
                      {cfg.mode === null && (
                        <p className="mt-3 flex items-center gap-2 rounded-lg bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          Pick who answers inbound calls for this team. The configuration can&apos;t
                          be saved until you do.
                        </p>
                      )}
                    </div>

                    {cfg.mode === "ai" && (
                      <>
                        <div>
                          <FieldLabel>AI agent that answers</FieldLabel>
                          <NativeSelect
                            value={cfg.agentId ?? ""}
                            onChange={(e) =>
                              patch({ agentId: e.target.value ? Number(e.target.value) : null })
                            }
                            aria-label="AI agent that answers"
                          >
                            <option value="">
                              {agentGroups.length === 0
                                ? "No AI voice agents yet"
                                : "Select an AI agent…"}
                            </option>
                            {/* Keep a saved id visible even if it has left the library. */}
                            {!agentKnown(cfg.agentId) && (
                              <option value={cfg.agentId ?? ""}>
                                #{cfg.agentId} (not in the Template Library)
                              </option>
                            )}
                            {agentGroups.map((g) => (
                              <optgroup key={g.clientId} label={g.clientName}>
                                {g.agents.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </NativeSelect>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            <Link
                              to="/tenant/engagement/template-library"
                              className="text-tenant underline"
                            >
                              Create an agent
                            </Link>{" "}
                            · Built in the Template Library. It answers the call, works through
                            Right Party Verification and follows its own prompt.
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-lg border border-tenant/20 bg-tenant-soft px-4 py-3">
                          <div>
                            <div className="text-sm font-semibold">
                              Allow live call transfer to a human
                            </div>
                            <p className="text-xs text-muted-foreground">
                              When the caller wants to negotiate, the AI hands the call over.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-semibold">
                              {cfg.transferToHuman ? "ON" : "OFF"}
                            </span>
                            <Switch
                              checked={cfg.transferToHuman}
                              onCheckedChange={(transferToHuman) => patch({ transferToHuman })}
                              disabled={!canEdit}
                              aria-label="Allow live call transfer to a human"
                            />
                          </div>
                        </div>

                        {!cfg.transferToHuman && (
                          <p className="text-xs text-muted-foreground">
                            The AI handles every call on its own — nobody on the team is rung.
                          </p>
                        )}
                      </>
                    )}
                  </fieldset>

                  {reachesPeople(cfg) && (
                    <div className="space-y-3">
                      <PatchTabBar
                        tabs={["assigned", "unassigned", "device", "noAnswer"]}
                        active={tab}
                        onSelect={setTab}
                      />
                      <fieldset disabled={!canEdit} className="min-w-0">
                        {tab === "assigned" && (
                          <AssignedFilesPanel
                            name={`${radio}-assigned`}
                            value={cfg.assigned}
                            onChange={(assigned) => patch({ assigned })}
                            members={state.members}
                            description="The caller's number matched a customer file that already sits with a team and a member."
                          />
                        )}
                        {tab === "unassigned" && (
                          <UnassignedFilesPanel
                            name={`${radio}-unassigned`}
                            value={cfg.unassigned}
                            onChange={(unassigned) => patch({ unassigned })}
                            members={state.members}
                            description="Covers intake not yet distributed, files sitting in Moved Files after a cross-team transfer, and parked files — none of these have a member to match, so the call goes to the team or down a forwarding chain you build."
                          />
                        )}
                        {tab === "device" && (
                          <AnsweringDevicePanel
                            name={`${radio}-device`}
                            value={cfg.answeringDevice}
                            onChange={(answeringDevice) => patch({ answeringDevice })}
                          />
                        )}
                        {tab === "noAnswer" && (
                          <NoAnswerPanel
                            value={cfg.noAnswerMessage}
                            onChange={(noAnswerMessage) => patch({ noAnswerMessage })}
                          />
                        )}
                      </fieldset>
                    </div>
                  )}
                </div>
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
      </section>
    </Shell>
  );
}

/* -------------------------------- fragments ------------------------------- */

function UnsavedDot() {
  return (
    <span className="h-1.5 w-1.5 rounded-full bg-warning" title="Unsaved changes" aria-hidden />
  );
}

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
