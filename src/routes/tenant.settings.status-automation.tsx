import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { findStatus } from "@/lib/status-mock";
import { templates as allTemplates } from "@/lib/comms-mock";
import {
  ChevronLeft,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  Zap,
  Save,
  RotateCcw,
  X,
  AlertCircle,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/settings/status-automation")({
  head: () => ({ meta: [{ title: "Status Automation · Tenant Admin" }] }),
  component: StatusAutomationPage,
});

// ─── Types ──────────────────────────────────────────────────────────────────
type ChannelKey = "email" | "sms" | "voice";

type ChannelConfig = {
  enabled: boolean;
  startAfterDays: number;
  templateId: string;
};

type FollowUp = {
  id: string;
  channel: ChannelKey;
  afterDays: number;
  templateId: string;
};

type StatusRule = {
  statusCode: string;
  enabled: boolean;
  channels: Record<ChannelKey, ChannelConfig>;
  followUpsEnabled: boolean;
  followUps: FollowUp[];
  // Broken Promise only
  escalateToLegal?: boolean;
};

const CHANNEL_META: Record<ChannelKey, { label: string; icon: typeof Mail }> = {
  email: { label: "Email", icon: Mail },
  sms: { label: "SMS", icon: MessageSquare },
  voice: { label: "AI Voice Call", icon: Phone },
};

const STATUS_CODES = ["ACT", "PPD", "BRP", "PPA", "PTP"] as const;

const DEFAULT_RULES: Record<string, StatusRule> = {
  ACT: {
    statusCode: "ACT",
    enabled: true,
    followUpsEnabled: true,
    channels: {
      email: { enabled: true, startAfterDays: 5, templateId: "tpl-001" },
      sms: { enabled: true, startAfterDays: 15, templateId: "tpl-005" },
      voice: { enabled: true, startAfterDays: 10, templateId: "tpl-006" },
    },
    followUps: [
      { id: "fu1", channel: "sms", afterDays: 3, templateId: "tpl-005" },
      { id: "fu2", channel: "email", afterDays: 5, templateId: "tpl-002" },
      { id: "fu3", channel: "voice", afterDays: 7, templateId: "tpl-006" },
    ],
  },
  PPD: {
    statusCode: "PPD",
    enabled: true,
    followUpsEnabled: true,
    channels: {
      email: { enabled: true, startAfterDays: 1, templateId: "tpl-002" },
      sms: { enabled: true, startAfterDays: 1, templateId: "tpl-004" },
      voice: { enabled: false, startAfterDays: 3, templateId: "tpl-006" },
    },
    followUps: [
      { id: "fu1", channel: "sms", afterDays: 2, templateId: "tpl-004" },
      { id: "fu2", channel: "voice", afterDays: 4, templateId: "tpl-006" },
    ],
  },
  BRP: {
    statusCode: "BRP",
    enabled: true,
    followUpsEnabled: true,
    escalateToLegal: true,
    channels: {
      email: { enabled: true, startAfterDays: 1, templateId: "tpl-002" },
      sms: { enabled: true, startAfterDays: 1, templateId: "tpl-004" },
      voice: { enabled: true, startAfterDays: 2, templateId: "tpl-006" },
    },
    followUps: [
      { id: "fu1", channel: "voice", afterDays: 3, templateId: "tpl-006" },
      { id: "fu2", channel: "email", afterDays: 5, templateId: "tpl-003" },
    ],
  },
  PPA: {
    statusCode: "PPA",
    enabled: true,
    followUpsEnabled: true,
    channels: {
      email: { enabled: true, startAfterDays: 2, templateId: "tpl-002" },
      sms: { enabled: true, startAfterDays: 1, templateId: "tpl-004" },
      voice: { enabled: false, startAfterDays: 3, templateId: "tpl-006" },
    },
    followUps: [
      { id: "fu1", channel: "sms", afterDays: 7, templateId: "tpl-004" },
      { id: "fu2", channel: "email", afterDays: 14, templateId: "tpl-002" },
    ],
  },
  PTP: {
    statusCode: "PTP",
    enabled: true,
    followUpsEnabled: true,
    channels: {
      email: { enabled: true, startAfterDays: 1, templateId: "tpl-002" },
      sms: { enabled: true, startAfterDays: 1, templateId: "tpl-004" },
      voice: { enabled: false, startAfterDays: 2, templateId: "tpl-006" },
    },
    followUps: [
      { id: "fu1", channel: "sms", afterDays: 1, templateId: "tpl-004" },
      { id: "fu2", channel: "email", afterDays: 3, templateId: "tpl-002" },
    ],
  },
};

function cloneDefaults(): Record<string, StatusRule> {
  return JSON.parse(JSON.stringify(DEFAULT_RULES));
}

function templatesForChannel(ch: ChannelKey) {
  const channelFilter = ch === "voice" ? "voice" : ch;
  return allTemplates.filter((t) => t.channel === channelFilter);
}

function validateRule(r: StatusRule): string | null {
  if (!r.enabled) return null;
  const enabledChannels = (Object.keys(r.channels) as ChannelKey[]).filter(
    (c) => r.channels[c].enabled,
  );
  if (enabledChannels.length === 0) return "Enable at least one channel.";
  for (const c of enabledChannels) {
    if (!r.channels[c].templateId) return `Select a template for ${CHANNEL_META[c].label}.`;
  }
  if (r.followUpsEnabled) {
    for (const fu of r.followUps) {
      if (!fu.templateId) return "All follow-ups must have a template.";
    }
  }
  return null;
}

// ─── Page ───────────────────────────────────────────────────────────────────
function StatusAutomationPage() {
  const [rules, setRules] = useState<Record<string, StatusRule>>(cloneDefaults());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ ACT: true });
  const [previewing, setPreviewing] = useState<string | null>(null);

  const update = (code: string, patch: Partial<StatusRule>) =>
    setRules((p) => ({ ...p, [code]: { ...p[code], ...patch } }));

  const updateChannel = (code: string, ch: ChannelKey, patch: Partial<ChannelConfig>) =>
    setRules((p) => ({
      ...p,
      [code]: {
        ...p[code],
        channels: { ...p[code].channels, [ch]: { ...p[code].channels[ch], ...patch } },
      },
    }));

  const updateFollowUp = (code: string, id: string, patch: Partial<FollowUp>) =>
    setRules((p) => ({
      ...p,
      [code]: {
        ...p[code],
        followUps: p[code].followUps.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      },
    }));

  const addFollowUp = (code: string) =>
    setRules((p) => ({
      ...p,
      [code]: {
        ...p[code],
        followUps: [
          ...p[code].followUps,
          {
            id: `fu${Date.now()}`,
            channel: "sms",
            afterDays: 3,
            templateId: templatesForChannel("sms")[0]?.id ?? "",
          },
        ],
      },
    }));

  const removeFollowUp = (code: string, id: string) =>
    setRules((p) => ({
      ...p,
      [code]: { ...p[code], followUps: p[code].followUps.filter((f) => f.id !== id) },
    }));

  const handleSave = () => {
    for (const code of STATUS_CODES) {
      const err = validateRule(rules[code]);
      if (err) {
        const s = findStatus(code);
        toast.error(`${s?.displayName ?? code}: ${err}`);
        setExpanded((p) => ({ ...p, [code]: true }));
        return;
      }
    }
    toast.success("Status automation rules saved");
  };

  const handleReset = () => {
    setRules(cloneDefaults());
    toast.info("Reset to defaults");
  };

  return (
    <Shell>
      <Topbar
        title="Status Automation"
        subtitle="Configure outreach and follow-up rules per debtor status"
        action={
          <div className="flex items-center gap-2">
            <Link
              to="/tenant/settings"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Link>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              <RotateCcw className="h-4 w-4" /> Reset to default
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
            >
              <Save className="h-4 w-4" /> Save changes
            </button>
          </div>
        }
      />

      <section className="px-6 lg:px-10 pt-6 pb-12 space-y-5">
        <PageCard>
          <div className="px-6 py-5 flex items-start gap-3">
            <div className="shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-tenant-soft text-tenant flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold">Automated outreach rules</h2>
              <p className="text-sm text-muted-foreground max-w-3xl">
                These rules drive automated multi-channel outreach when a debtor's status changes.
                Each status is independently configurable — pick channels, define when the first
                message goes out, choose a template from your library, and schedule any follow-ups.
                Configurations are tenant-specific and audit-logged.
              </p>
            </div>
          </div>
        </PageCard>

        {STATUS_CODES.map((code) => {
          const status = findStatus(code);
          if (!status) return null;
          const rule = rules[code];
          const isOpen = expanded[code] ?? false;
          const validationError = validateRule(rule);
          const isReminderStatus = code === "PPA" || code === "PTP";

          return (
            <PageCard key={code}>
              <div className="px-6 py-4 flex items-center gap-4 border-b border-border">
                <button
                  onClick={() => setExpanded((p) => ({ ...p, [code]: !p[code] }))}
                  className="flex items-center gap-3 flex-1 text-left min-w-0"
                >
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Pill tone={status.tone}>
                    {status.icon} {status.code}
                  </Pill>
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {status.displayName}
                      {isReminderStatus && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-tenant border border-tenant/30 rounded px-1.5 py-0.5">
                          Reminder mode
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {status.description}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-3 shrink-0">
                  {validationError && rule.enabled && (
                    <span className="inline-flex items-center gap-1 text-xs text-warning-foreground bg-warning/15 rounded px-2 py-1">
                      <AlertCircle className="h-3 w-3" /> {validationError}
                    </span>
                  )}
                  <button
                    onClick={() => setPreviewing(code)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs hover:bg-muted"
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </button>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-muted-foreground">
                      {rule.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={rule.enabled}
                      onChange={(e) => update(code, { enabled: e.target.checked })}
                    />
                    <span
                      className={`relative w-10 h-5 ${rule.enabled ? "bg-tenant" : "bg-muted"} rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-5`}
                    />
                  </label>
                </div>
              </div>

              {isOpen && (
                <div
                  className={`px-6 py-5 space-y-6 ${!rule.enabled ? "opacity-50 pointer-events-none" : ""}`}
                >
                  {/* Channels */}
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                      {isReminderStatus ? "Reminder channels" : "Outreach channels"}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      {(Object.keys(CHANNEL_META) as ChannelKey[]).map((ch) => {
                        const meta = CHANNEL_META[ch];
                        const cfg = rule.channels[ch];
                        const Icon = meta.icon;
                        const tmpls = templatesForChannel(ch);
                        return (
                          <div
                            key={ch}
                            className={`rounded-lg border p-3 space-y-3 ${cfg.enabled ? "border-tenant/40 bg-tenant-soft/30" : "border-border bg-muted/30"}`}
                          >
                            <label className="flex items-center justify-between cursor-pointer">
                              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                                <Icon className="h-4 w-4 text-tenant" /> {meta.label}
                              </span>
                              <input
                                type="checkbox"
                                checked={cfg.enabled}
                                onChange={(e) =>
                                  updateChannel(code, ch, { enabled: e.target.checked })
                                }
                                className="h-4 w-4 accent-tenant"
                              />
                            </label>
                            {cfg.enabled && (
                              <div className="space-y-2">
                                <div>
                                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                                    {isReminderStatus
                                      ? "First reminder after (days)"
                                      : "Start outreach after (days)"}
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={cfg.startAfterDays}
                                    onChange={(e) =>
                                      updateChannel(code, ch, {
                                        startAfterDays: Number(e.target.value) || 0,
                                      })
                                    }
                                    className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                                    First template
                                  </label>
                                  <select
                                    value={cfg.templateId}
                                    onChange={(e) =>
                                      updateChannel(code, ch, { templateId: e.target.value })
                                    }
                                    className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background"
                                  >
                                    <option value="">Select template…</option>
                                    {tmpls.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Follow-ups */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {isReminderStatus ? "Follow-up reminders" : "Follow-ups"}
                      </div>
                      <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={rule.followUpsEnabled}
                          onChange={(e) => update(code, { followUpsEnabled: e.target.checked })}
                          className="h-3.5 w-3.5 accent-tenant"
                        />
                        Enable follow-ups
                      </label>
                    </div>
                    {rule.followUpsEnabled && (
                      <div className="space-y-2">
                        {rule.followUps.map((fu, idx) => {
                          const tmpls = templatesForChannel(fu.channel);
                          return (
                            <div
                              key={fu.id}
                              className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg border border-border bg-card"
                            >
                              <div className="col-span-1 text-xs text-muted-foreground font-semibold pb-2">
                                #{idx + 1}
                              </div>
                              <div className="col-span-3">
                                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                                  Channel
                                </label>
                                <select
                                  value={fu.channel}
                                  onChange={(e) => {
                                    const newCh = e.target.value as ChannelKey;
                                    updateFollowUp(code, fu.id, {
                                      channel: newCh,
                                      templateId: templatesForChannel(newCh)[0]?.id ?? "",
                                    });
                                  }}
                                  className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background"
                                >
                                  {(Object.keys(CHANNEL_META) as ChannelKey[]).map((c) => (
                                    <option key={c} value={c}>
                                      {CHANNEL_META[c].label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-span-2">
                                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                                  After (days)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={fu.afterDays}
                                  onChange={(e) =>
                                    updateFollowUp(code, fu.id, {
                                      afterDays: Number(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background"
                                />
                              </div>
                              <div className="col-span-5">
                                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                                  Template
                                </label>
                                <select
                                  value={fu.templateId}
                                  onChange={(e) =>
                                    updateFollowUp(code, fu.id, { templateId: e.target.value })
                                  }
                                  className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background"
                                >
                                  <option value="">Select template…</option>
                                  {tmpls.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <button
                                  onClick={() => removeFollowUp(code, fu.id)}
                                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                                  aria-label="Remove follow-up"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        <button
                          onClick={() => addFollowUp(code)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border text-sm hover:bg-muted w-full justify-center"
                        >
                          <Plus className="h-4 w-4" /> Add follow-up
                        </button>
                      </div>
                    )}
                  </div>

                  {/* BRP escalation */}
                  {code === "BRP" && (
                    <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                      <div className="text-sm font-semibold mb-2">
                        After all follow-ups complete, send to legal review?
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="radio"
                            name={`brp-legal-${code}`}
                            checked={rule.escalateToLegal === true}
                            onChange={() => update(code, { escalateToLegal: true })}
                            className="accent-tenant"
                          />
                          Yes, send to legal review
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="radio"
                            name={`brp-legal-${code}`}
                            checked={rule.escalateToLegal === false}
                            onChange={() => update(code, { escalateToLegal: false })}
                            className="accent-tenant"
                          />
                          No, keep in current workflow
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </PageCard>
          );
        })}
      </section>

      {previewing && <PreviewModal rule={rules[previewing]} onClose={() => setPreviewing(null)} />}
    </Shell>
  );
}

// ─── Preview Modal ──────────────────────────────────────────────────────────
function PreviewModal({ rule, onClose }: { rule: StatusRule; onClose: () => void }) {
  const status = findStatus(rule.statusCode);
  const steps = useMemo(() => {
    const out: { day: number; channel: ChannelKey; templateName: string; kind: string }[] = [];
    (Object.keys(rule.channels) as ChannelKey[]).forEach((ch) => {
      const c = rule.channels[ch];
      if (c.enabled) {
        const tmpl = allTemplates.find((t) => t.id === c.templateId);
        out.push({
          day: c.startAfterDays,
          channel: ch,
          templateName: tmpl?.name ?? "—",
          kind: "First outreach",
        });
      }
    });
    if (rule.followUpsEnabled) {
      let acc = 0;
      rule.followUps.forEach((fu, i) => {
        acc += fu.afterDays;
        const tmpl = allTemplates.find((t) => t.id === fu.templateId);
        out.push({
          day: acc,
          channel: fu.channel,
          templateName: tmpl?.name ?? "—",
          kind: `Follow-up #${i + 1}`,
        });
      });
    }
    return out.sort((a, b) => a.day - b.day);
  }, [rule]);

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
          <div className="flex items-center gap-3">
            {status && (
              <Pill tone={status.tone}>
                {status.icon} {status.code}
              </Pill>
            )}
            <h3 className="font-display text-lg font-bold">Automation flow preview</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-3">
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No steps configured.</p>
          ) : (
            steps.map((s, i) => {
              const Icon = CHANNEL_META[s.channel].icon;
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background"
                >
                  <div className="shrink-0 h-8 w-8 rounded-full bg-tenant-soft text-tenant flex items-center justify-center text-xs font-bold">
                    D{s.day}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      {s.kind}
                    </div>
                    <div className="text-sm font-semibold flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" /> {CHANNEL_META[s.channel].label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{s.templateName}</div>
                  </div>
                </div>
              );
            })
          )}
          {rule.statusCode === "BRP" && rule.escalateToLegal && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-warning/30 bg-warning/10">
              <div className="shrink-0 h-8 w-8 rounded-full bg-warning/20 text-warning-foreground flex items-center justify-center text-xs font-bold">
                ⚖
              </div>
              <div className="text-sm">
                After final follow-up, account is escalated to <strong>Legal Review</strong>.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
