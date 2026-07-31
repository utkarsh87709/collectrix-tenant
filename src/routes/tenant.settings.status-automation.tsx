import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { NativeSelect, PageCard } from "@/components/tenant/ui";
import { StatusPill } from "@/components/tenant/statuses/StatusPill";
import { InitialStatusCard } from "@/components/tenant/statuses/InitialStatusCard";
import {
  StatusAutomationCard,
  type MemberOption,
  type TemplateOption,
} from "@/components/tenant/statuses/StatusAutomationCard";
import { getTeamList, type TeamListItem } from "@/lib/teams-api";
import { getTeamDeckAssignUserList, memberName } from "@/lib/team-deck-api";
import { getClientTemplate, type LibraryType } from "@/lib/template-library-api";
import {
  CHANNEL_LABEL,
  CHANNEL_ORDER,
  allowedChannels,
  configFromDetails,
  emptyAutomationConfig,
  formatDuration,
  getClientList,
  getClientTeamStatusList,
  getStatusAutomationDetails,
  getStatusAutomationList,
  payloadFromConfig,
  templateTypeFor,
  toMinutes,
  updateAutomation,
  validateAutomation,
  type AutomationClient,
  type ChannelKey,
  type ClientTeamStatus,
  type MessageSource,
  type StatusAutomationConfig,
  type StatusAutomationRow,
} from "@/lib/status-automation-api";

export const Route = createFileRoute("/tenant/settings/status-automation")({
  head: () => ({ meta: [{ title: "Status Automation · Tenant Admin" }] }),
  component: StatusAutomationPage,
});

/** Every Template Library list the editor can offer, keyed by template type. */
type TemplateSets = Record<LibraryType, TemplateOption[]>;

const EMPTY_TEMPLATE_SETS: TemplateSets = { email: [], sms: [], call: [], aiPrompt: [] };

function StatusAutomationPage() {
  // ── Selection ───────────────────────────────────────────────────────────
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [clients, setClients] = useState<AutomationClient[]>([]);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);
  const [pickersLoading, setPickersLoading] = useState(true);
  const [pickersError, setPickersError] = useState<string | null>(null);

  // ── Per-pair data ───────────────────────────────────────────────────────
  const [statusList, setStatusList] = useState<ClientTeamStatus[]>([]);
  const [rows, setRows] = useState<StatusAutomationRow[]>([]);
  const [configs, setConfigs] = useState<Record<number, StatusAutomationConfig>>({});
  const [templates, setTemplates] = useState<TemplateSets>(EMPTY_TEMPLATE_SETS);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(false);
  /** Statuses whose getStatusAutomationDetails call is still in flight. */
  const [detailsLoading, setDetailsLoading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [previewing, setPreviewing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  /** Baseline for dirty-checking and "Discard changes". */
  const [baseline, setBaseline] = useState<Record<number, StatusAutomationConfig>>({});

  const team = useMemo(() => teams.find((t) => t.teamId === teamId) ?? null, [teams, teamId]);
  const client = useMemo(
    () => clients.find((c) => c.clientId === clientId) ?? null,
    [clients, clientId],
  );
  const allowed = useMemo(() => allowedChannels(client), [client]);

  /* --------------------------- pickers (once) --------------------------- */

  const loadPickers = useCallback(async () => {
    setPickersLoading(true);
    setPickersError(null);
    try {
      const [teamRes, clientRes] = await Promise.all([getTeamList(), getClientList()]);
      const teamList = teamRes?.teamList ?? [];
      setTeams(teamList);
      setClients(clientRes);
      // Teams and clients are independent — default to the first of each so the
      // page lands on real data instead of an empty state.
      setTeamId((prev) => prev ?? teamList[0]?.teamId ?? null);
      setClientId((prev) => prev ?? clientRes[0]?.clientId ?? null);
    } catch (e) {
      setPickersError(e instanceof Error ? e.message : "Failed to load teams and clients.");
    } finally {
      setPickersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPickers();
  }, [loadPickers]);

  /* ------------------------- per-pair data load ------------------------- */

  // Guards against a slow response for a previous team+client landing after the
  // user has already switched selection.
  const reqId = useRef(0);

  const loadPair = useCallback(async (cId: number, tId: number) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    // Superseded detail fetches never reach their finally, so clear the flags
    // here rather than leaving Save disabled on the new pair.
    setDetailsLoading({});
    try {
      const [statuses, automationRows, assignUsers, email, sms, call, aiPrompt] = await Promise.all(
        [
          getClientTeamStatusList({ clientId: cId, teamId: tId }),
          getStatusAutomationList({ clientId: cId, teamId: tId }),
          getTeamDeckAssignUserList(tId),
          getClientTemplate({ clientId: cId, templateType: "email" }),
          getClientTemplate({ clientId: cId, templateType: "sms" }),
          // AI voice agents are `call` entries; AI-written email/SMS use aiPrompt.
          getClientTemplate({ clientId: cId, templateType: "call" }),
          getClientTemplate({ clientId: cId, templateType: "aiPrompt" }),
        ],
      );
      if (reqId.current !== id) return;

      setStatusList(statuses);
      setRows(automationRows);
      setTemplates({
        email: email.map((t) => ({ id: t.templateId, name: t.templateName })),
        sms: sms.map((t) => ({ id: t.templateId, name: t.templateName })),
        call: call.map((t) => ({ id: t.templateId, name: t.templateName })),
        aiPrompt: aiPrompt.map((t) => ({ id: t.templateId, name: t.templateName })),
      });
      setMembers(
        (assignUsers.assignUserList ?? []).map((m) => ({ userId: m.userId, name: memberName(m) })),
      );

      // Seed from the list, then fill in saved settings for the statuses that
      // have them. A null automationId means this status has never been saved
      // for the pair, so there is nothing to fetch.
      const seeded: Record<number, StatusAutomationConfig> = {};
      for (const row of automationRows) {
        seeded[row.statusId] = {
          ...emptyAutomationConfig(row.statusId),
          automationId: row.automationId,
          enabled: row.enabledFlag === 1,
        };
      }
      setConfigs(seeded);
      setBaseline(structuredClone(seeded));
      setLoading(false);

      const configured = automationRows.filter((r) => r.automationId != null);
      if (configured.length === 0) return;
      setDetailsLoading(Object.fromEntries(configured.map((r) => [r.statusId, true])));

      // Details are loaded up front rather than on expand: the toggle in each
      // collapsed header can save the status, and saving is a full replace, so
      // an unloaded card would silently wipe what the backend holds.
      await Promise.all(
        configured.map(async (row) => {
          try {
            const details = await getStatusAutomationDetails(row.automationId as number);
            if (reqId.current !== id) return;
            const cfg = configFromDetails(details);
            setConfigs((prev) => ({ ...prev, [row.statusId]: cfg }));
            setBaseline((prev) => ({ ...prev, [row.statusId]: structuredClone(cfg) }));
          } catch (e) {
            if (reqId.current !== id) return;
            toast.error(
              `${row.status}: ${e instanceof Error ? e.message : "could not load saved settings"}`,
            );
          } finally {
            if (reqId.current === id) {
              setDetailsLoading((prev) => ({ ...prev, [row.statusId]: false }));
            }
          }
        }),
      );
    } catch (e) {
      if (reqId.current !== id) return;
      setError(e instanceof Error ? e.message : "Failed to load status automation.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!clientId || !teamId) return;
    // Collapse on a pair switch only — a reload after saving keeps cards open.
    setExpanded({});
    loadPair(clientId, teamId);
  }, [clientId, teamId, loadPair]);

  /* ----------------------------- editing -------------------------------- */

  const patchConfig = (statusId: number, patch: Partial<StatusAutomationConfig>) =>
    setConfigs((prev) => ({ ...prev, [statusId]: { ...prev[statusId], ...patch } }));

  const dirtyIds = useMemo(
    () =>
      Object.keys(configs)
        .map(Number)
        .filter((id) => JSON.stringify(configs[id]) !== JSON.stringify(baseline[id])),
    [configs, baseline],
  );

  const anyDetailsLoading = useMemo(
    () => Object.values(detailsLoading).some(Boolean),
    [detailsLoading],
  );

  const templatesFor = useCallback(
    (channel: ChannelKey, source: MessageSource): TemplateOption[] =>
      templates[templateTypeFor(channel, source)] ?? [],
    [templates],
  );

  const templateName = useCallback(
    (id: number | null): string => {
      if (id == null) return "—";
      for (const list of Object.values(templates)) {
        const hit = list.find((t) => t.id === id);
        if (hit) return hit.name;
      }
      // The backend does not check that a template belongs to the client, so a
      // saved id can point outside this client's library.
      return `#${id} (not in this client's library)`;
    },
    [templates],
  );

  const handleReset = () => {
    setConfigs(structuredClone(baseline));
    toast.info("Reverted to the last saved configuration");
  };

  const handleSave = async () => {
    if (!clientId || !teamId || !client) return;
    // Validate everything before writing anything — a partial save would leave
    // the pair half-configured.
    for (const row of rows) {
      const cfg = configs[row.statusId];
      if (!cfg) continue;
      const err = validateAutomation(cfg, allowed);
      if (err) {
        toast.error(`${row.status}: ${err}`);
        setExpanded((p) => ({ ...p, [row.statusId]: true }));
        return;
      }
    }
    if (dirtyIds.length === 0) {
      toast.info("Nothing to save");
      return;
    }

    setSaving(true);
    const saved: number[] = [];
    try {
      for (const statusId of dirtyIds) {
        // One call per status: updateAutomation upserts a single
        // (client, team, status) row and replaces its follow-ups wholesale.
        await updateAutomation(
          payloadFromConfig(configs[statusId], {
            clientId,
            teamId,
            allowed,
            documentsAllowed: !!client.documentEnabled,
          }),
        );
        saved.push(statusId);
      }
      toast.success(`Saved automation for ${saved.length} status${saved.length === 1 ? "" : "es"}`);
      setSaving(false);
      // A first save mints the automationId the details endpoint needs, so read
      // the pair back rather than trusting the local copy.
      loadPair(clientId, teamId);
    } catch (e) {
      const failed = rows.find((r) => r.statusId === dirtyIds[saved.length])?.status ?? "a status";
      toast.error(
        `${failed}: ${e instanceof Error ? e.message : "could not save"}${
          saved.length ? ` (${saved.length} saved before this)` : ""
        }`,
      );
      // Keep the unsaved edits on screen so they can be fixed and retried; only
      // the statuses that did go through stop counting as dirty.
      setBaseline((prev) => {
        const next = { ...prev };
        for (const statusId of saved) next[statusId] = structuredClone(configs[statusId]);
        return next;
      });
      setSaving(false);
    }
  };

  /* -------------------------------- render ------------------------------ */

  const ready = !!client && !!team && !loading && !error;

  return (
    <Shell>
      <Topbar
        title="Status Automation"
        subtitle="Automated behaviour per status, for each team and client"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={dirtyIds.length === 0 || saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" /> Discard changes
            </button>
            <button
              onClick={handleSave}
              disabled={!ready || dirtyIds.length === 0 || saving || anyDetailsLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes{dirtyIds.length > 0 ? ` (${dirtyIds.length})` : ""}
            </button>
          </div>
        }
      />

      <section className="px-6 lg:px-10 pt-6 pb-12 space-y-5">
        {/* ── Intro ─────────────────────────────────────────────────────── */}
        <PageCard>
          <div className="px-6 py-5 flex items-start gap-3">
            <span className="shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-tenant-soft text-tenant flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </span>
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold">Automated behaviour rules</h2>
              <p className="text-sm text-muted-foreground max-w-3xl">
                Automation follows a hierarchy: <strong>Team → Client → status</strong>. Pick a
                team, then a client, then configure each status — the status new files land in,
                outreach and follow-ups, who the file is assigned to, documents to generate,
                auto-archive and inactivity transitions. Rules bind to your own statuses from the
                Status Builder, so renames carry over automatically. Every change is audit-logged.
              </p>
            </div>
          </div>
        </PageCard>

        {/* ── Team + client pickers ─────────────────────────────────────── */}
        <PageCard>
          {pickersLoading ? (
            <div className="px-6 py-10 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading teams and clients…
            </div>
          ) : pickersError ? (
            <ErrorState message={pickersError} onRetry={loadPickers} />
          ) : (
            <div className="px-6 py-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
                <PickerField
                  icon={<Users className="h-4 w-4 text-muted-foreground" />}
                  label="Team"
                >
                  <NativeSelect
                    value={teamId ?? ""}
                    onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Select team…</option>
                    {teams.map((t) => (
                      <option key={t.teamId} value={t.teamId}>
                        {t.teamName}
                      </option>
                    ))}
                  </NativeSelect>
                </PickerField>

                <PickerField
                  icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
                  label="Client"
                >
                  <NativeSelect
                    value={clientId ?? ""}
                    onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Select client…</option>
                    {clients.map((c) => (
                      <option key={c.clientId} value={c.clientId}>
                        {c.clientName} · {c.clientNumber}
                      </option>
                    ))}
                  </NativeSelect>
                </PickerField>
              </div>

              {/* What this client permits, as chips — a sentence listing four
                  on/off flags reads as noise. */}
              {client && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {CHANNEL_ORDER.map((c) => (
                    <Capability key={c} label={CHANNEL_LABEL[c]} on={allowed.includes(c)} />
                  ))}
                  <Capability label="Documents" on={!!client.documentEnabled} />
                  <span className="text-xs text-muted-foreground">
                    Set on the client record — anything off here can&apos;t be automated.
                  </span>
                </div>
              )}
            </div>
          )}
        </PageCard>

        {/* ── Per-pair configuration ────────────────────────────────────── */}
        {!pickersLoading && !pickersError && (!clientId || !teamId) && (
          <PageCard>
            <p className="px-6 py-16 text-center text-sm text-muted-foreground">
              Pick a team and a client to configure their statuses.
            </p>
          </PageCard>
        )}

        {loading && (
          <PageCard>
            <div className="px-6 py-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading configuration…
            </div>
          </PageCard>
        )}

        {error && !loading && (
          <PageCard>
            <ErrorState
              message={error}
              onRetry={() => clientId && teamId && loadPair(clientId, teamId)}
            />
          </PageCard>
        )}

        {ready && (
          <>
            <InitialStatusCard
              statuses={statusList}
              teamName={team.teamName}
              clientName={client.clientName}
              clientId={client.clientId}
              teamId={team.teamId}
              onChanged={() => loadPair(client.clientId, team.teamId)}
            />

            {rows.length === 0 ? (
              <PageCard>
                <p className="px-6 py-16 text-center text-sm text-muted-foreground">
                  No statuses defined yet. Create statuses first, then automate them here.
                </p>
              </PageCard>
            ) : (
              rows.map((row) => {
                const cfg = configs[row.statusId];
                if (!cfg) return null;
                return (
                  <StatusAutomationCard
                    key={row.statusId}
                    row={row}
                    config={cfg}
                    allowed={allowed}
                    open={expanded[row.statusId] ?? false}
                    onToggleOpen={() =>
                      setExpanded((p) => ({ ...p, [row.statusId]: !p[row.statusId] }))
                    }
                    onChange={(patch) => patchConfig(row.statusId, patch)}
                    onPreview={() => setPreviewing(row.statusId)}
                    templatesFor={templatesFor}
                    templateName={templateName}
                    members={members}
                    documentsAllowed={!!client.documentEnabled}
                    otherStatuses={rows.filter((r) => r.statusId !== row.statusId)}
                    loadingDetails={!!detailsLoading[row.statusId]}
                  />
                );
              })
            )}
          </>
        )}
      </section>

      {previewing != null && configs[previewing] && (
        <PreviewModal
          row={rows.find((r) => r.statusId === previewing)!}
          config={configs[previewing]}
          allowed={allowed}
          templateName={templateName}
          statusName={(id) => rows.find((r) => r.statusId === id)?.status ?? "—"}
          memberLabel={(id) => members.find((m) => m.userId === id)?.name ?? "—"}
          onClose={() => setPreviewing(null)}
        />
      )}
    </Shell>
  );
}

/* -------------------------------- fragments ------------------------------- */

/** Label stacked above its control. The label must be block-level, or an
 *  inline-block <select> sibling flows onto the same line as the text. */
function PickerField({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-sm font-medium mb-2">
        {icon} {label}
      </span>
      {children}
    </label>
  );
}

/** One on/off client permission. */
function Capability({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
        on
          ? "border-tenant/30 bg-tenant-soft text-tenant font-medium"
          : "border-border text-muted-foreground"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-tenant" : "bg-muted-foreground/40"}`} />
      {label}
    </span>
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

/** Ordered walk-through of what a status will do, for sanity-checking. Every
 *  step is offset from the moment the file enters the status. */
function PreviewModal({
  row,
  config,
  allowed,
  templateName,
  statusName,
  memberLabel,
  onClose,
}: {
  row: StatusAutomationRow;
  config: StatusAutomationConfig;
  allowed: ChannelKey[];
  templateName: (id: number | null) => string;
  statusName: (id: number | null) => string;
  memberLabel: (id: number | null) => string;
  onClose: () => void;
}) {
  const steps = useMemo(() => {
    const out: { minutes: number; when: string; kind: string; detail: string }[] = [];
    const push = (minutes: number, when: string, kind: string, detail: string) =>
      out.push({ minutes, when, kind, detail });

    if (config.assignMember.enabled) {
      push(0, "On entry", "Assignment", `Assign to ${memberLabel(config.assignMember.userId)}`);
    }
    if (config.generateDocuments) {
      push(0, "On entry", "Documents", "Generate this status' documents");
    }

    for (const ch of allowed) {
      const c = config.channels[ch];
      if (!c.enabled) continue;
      push(
        toMinutes(c.startAfter),
        formatDuration(c.startAfter),
        "First outreach",
        `${CHANNEL_LABEL[ch]} · ${c.messageSource === "ai" ? "AI" : "Template"} · ${templateName(c.templateId)}`,
      );
    }

    if (config.followUpsEnabled) {
      config.followUps.forEach((fu, i) => {
        push(
          toMinutes(fu.after),
          formatDuration(fu.after),
          `Follow-up #${i + 1}`,
          `${CHANNEL_LABEL[fu.channel]} · ${fu.messageSource === "ai" ? "AI" : "Template"} · ${templateName(fu.templateId)}`,
        );
      });
    }

    if (config.autoArchive.enabled) {
      push(
        toMinutes(config.autoArchive.after),
        formatDuration(config.autoArchive.after),
        "Auto-archive",
        "File leaves active workload (recoverable)",
      );
    }
    if (config.inactivity.enabled) {
      push(
        toMinutes(config.inactivity.after),
        `${formatDuration(config.inactivity.after)} idle`,
        "Inactivity",
        `Move to ${statusName(config.inactivity.toStatusId)}`,
      );
    }

    return out.sort((a, b) => a.minutes - b.minutes);
  }, [config, allowed, templateName, statusName, memberLabel]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <StatusPill code={row.statusCode} name="" color={row.statusColorCode} />
            <h3 className="font-display text-lg font-bold truncate">
              {row.status} — automation preview
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-3">
          {!config.enabled && (
            <p className="text-sm text-warning-foreground bg-warning/15 rounded-lg px-3 py-2">
              Automation is switched off for this status — nothing below will run.
            </p>
          )}
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No behaviours configured.</p>
          ) : (
            steps.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background"
              >
                <span className="shrink-0 min-w-20 px-2 py-1 rounded-full bg-tenant-soft text-tenant flex items-center justify-center text-[11px] font-bold text-center">
                  {s.when}
                </span>
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    {s.kind}
                  </div>
                  <div className="text-sm">{s.detail}</div>
                </div>
              </div>
            ))
          )}
          <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
            Timings are measured from when a file enters this status.
          </p>
        </div>
      </div>
    </div>
  );
}
