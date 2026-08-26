import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, Pill } from "@/components/tenant/ui";
import { findStatus } from "@/lib/status-mock";
import { LETTER_TEMPLATES } from "@/lib/letters-mock";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Eye,
  AlertCircle,
  Sparkles,
  CalendarClock,
  X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/settings/document-automation")({
  head: () => ({ meta: [{ title: "AI Document Generation · Tenant Admin" }] }),
  component: DocumentAutomationPage,
});

// ─── Types ──────────────────────────────────────────────────────────────────
type DeliveryMode = "generate" | "generate_send";

type DocSchedule = {
  id: string;
  dayOffset: number; // days after status was set
  templateId: string;
  delivery: DeliveryMode;
  note?: string;
};

type StatusDocRule = {
  statusCode: string;
  enabled: boolean;
  repeat: boolean; // continue generating until status changes
  schedules: DocSchedule[];
};

// Statuses for which document automation makes business sense
const DOC_STATUSES = ["ACT", "PTP", "BRP", "PPA", "PPD", "REV"] as const;

const ACTIVE_TEMPLATES = LETTER_TEMPLATES.filter((t) => t.status === "active");

function tplName(id: string) {
  return LETTER_TEMPLATES.find((t) => t.id === id)?.name ?? "—";
}

const DEFAULT_RULES: Record<string, StatusDocRule> = {
  ACT: {
    statusCode: "ACT",
    enabled: true,
    repeat: false,
    schedules: [
      {
        id: "s1",
        dayOffset: 1,
        templateId: "lt-001",
        delivery: "generate_send",
        note: "Initial demand on placement",
      },
      {
        id: "s2",
        dayOffset: 30,
        templateId: "lt-004",
        delivery: "generate_send",
        note: "Settlement offer after 30 days",
      },
      {
        id: "s3",
        dayOffset: 60,
        templateId: "lt-002",
        delivery: "generate_send",
        note: "Final notice before legal",
      },
    ],
  },
  PTP: {
    statusCode: "PTP",
    enabled: true,
    repeat: false,
    schedules: [
      {
        id: "s1",
        dayOffset: 0,
        templateId: "lt-008",
        delivery: "generate_send",
        note: "PTP acknowledgement letter",
      },
    ],
  },
  BRP: {
    statusCode: "BRP",
    enabled: true,
    repeat: false,
    schedules: [
      {
        id: "s1",
        dayOffset: 2,
        templateId: "lt-002",
        delivery: "generate_send",
        note: "Broken-promise warning",
      },
      {
        id: "s2",
        dayOffset: 14,
        templateId: "lt-005",
        delivery: "generate",
        note: "Final settlement opportunity (review before send)",
      },
    ],
  },
  PPA: {
    statusCode: "PPA",
    enabled: true,
    repeat: false,
    schedules: [
      {
        id: "s1",
        dayOffset: 1,
        templateId: "lt-007",
        delivery: "generate_send",
        note: "Payment plan confirmation",
      },
    ],
  },
  PPD: {
    statusCode: "PPD",
    enabled: false,
    repeat: false,
    schedules: [],
  },
  REV: {
    statusCode: "REV",
    enabled: false,
    repeat: false,
    schedules: [],
  },
};

const cloneDefaults = (): Record<string, StatusDocRule> =>
  JSON.parse(JSON.stringify(DEFAULT_RULES));

function validateRule(rule: StatusDocRule): string | null {
  if (!rule.enabled) return null;
  if (rule.schedules.length === 0) return "At least one document schedule required";
  for (const s of rule.schedules) {
    if (!s.templateId) return "Every schedule needs a template";
    if (s.dayOffset < 0) return "Day offset cannot be negative";
  }
  // Detect duplicate offsets
  const offsets = rule.schedules.map((s) => s.dayOffset);
  if (new Set(offsets).size !== offsets.length) return "Two schedules share the same day offset";
  return null;
}

function DocumentAutomationPage() {
  const [rules, setRules] = useState<Record<string, StatusDocRule>>(cloneDefaults);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ ACT: true });
  const [previewing, setPreviewing] = useState<string | null>(null);

  const update = (code: string, patch: Partial<StatusDocRule>) =>
    setRules((p) => ({ ...p, [code]: { ...p[code], ...patch } }));

  const updateSchedule = (code: string, id: string, patch: Partial<DocSchedule>) =>
    setRules((p) => ({
      ...p,
      [code]: {
        ...p[code],
        schedules: p[code].schedules.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      },
    }));

  const addSchedule = (code: string) =>
    setRules((p) => {
      const next = p[code].schedules.length
        ? Math.max(...p[code].schedules.map((s) => s.dayOffset)) + 7
        : 1;
      return {
        ...p,
        [code]: {
          ...p[code],
          schedules: [
            ...p[code].schedules,
            {
              id: `s${Date.now()}`,
              dayOffset: next,
              templateId: ACTIVE_TEMPLATES[0]?.id ?? "",
              delivery: "generate_send",
            },
          ],
        },
      };
    });

  const removeSchedule = (code: string, id: string) =>
    setRules((p) => ({
      ...p,
      [code]: { ...p[code], schedules: p[code].schedules.filter((s) => s.id !== id) },
    }));

  const handleSave = () => {
    for (const code of DOC_STATUSES) {
      const err = validateRule(rules[code]);
      if (err) {
        const s = findStatus(code);
        toast.error(`${s?.displayName ?? code}: ${err}`);
        setExpanded((p) => ({ ...p, [code]: true }));
        return;
      }
    }
    toast.success("Document generation rules saved");
  };

  const handleReset = () => {
    setRules(cloneDefaults());
    toast.info("Reset to defaults");
  };

  const totalSchedules = useMemo(
    () => Object.values(rules).reduce((n, r) => n + (r.enabled ? r.schedules.length : 0), 0),
    [rules],
  );

  return (
    <Shell>
      <Topbar
        title="AI Document Generation"
        subtitle="Schedule AI-generated letters by customer status and time"
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
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold">AI document schedules per status</h2>
              <p className="text-sm text-muted-foreground max-w-3xl">
                Define which letters AI should generate from your template library while a customer
                remains in a given status. Set the day offset (counted from when the status was
                set), pick the template, and choose whether the document is auto-sent or staged for
                review. Schedules are tenant-specific and every generated document is audit-logged.
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>{totalSchedules}</strong> active schedule(s) configured across{" "}
                {DOC_STATUSES.length} statuses.
              </p>
            </div>
          </div>
        </PageCard>

        {DOC_STATUSES.map((code) => {
          const status = findStatus(code);
          if (!status) return null;
          const rule = rules[code];
          const isOpen = expanded[code] ?? false;
          const validationError = validateRule(rule);

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
                    <div className="font-semibold">{status.displayName}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {status.description}
                    </div>
                  </div>
                  <span className="ml-2 text-xs text-muted-foreground">
                    · {rule.schedules.length} doc(s)
                  </span>
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
                    <Eye className="h-3.5 w-3.5" /> Timeline
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
                  className={`px-6 py-5 space-y-5 ${!rule.enabled ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Document schedule
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Day offset is counted from when the status was set on the customer.
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.repeat}
                        onChange={(e) => update(code, { repeat: e.target.checked })}
                        className="h-4 w-4 accent-tenant"
                      />
                      Repeat last schedule weekly while status persists
                    </label>
                  </div>

                  {rule.schedules.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No document schedules yet. Add one to start generating AI letters for this
                      status.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rule.schedules
                        .slice()
                        .sort((a, b) => a.dayOffset - b.dayOffset)
                        .map((s) => (
                          <div
                            key={s.id}
                            className="rounded-lg border border-border bg-muted/20 p-3 grid grid-cols-12 gap-3 items-start"
                          >
                            <div className="col-span-12 md:col-span-2">
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                                Day offset
                              </label>
                              <div className="flex items-center gap-2">
                                <CalendarClock className="h-4 w-4 text-tenant shrink-0" />
                                <input
                                  type="number"
                                  min={0}
                                  value={s.dayOffset}
                                  onChange={(e) =>
                                    updateSchedule(code, s.id, {
                                      dayOffset: Number(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background"
                                />
                              </div>
                            </div>
                            <div className="col-span-12 md:col-span-5">
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                                Template
                              </label>
                              <select
                                value={s.templateId}
                                onChange={(e) =>
                                  updateSchedule(code, s.id, { templateId: e.target.value })
                                }
                                className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background"
                              >
                                <option value="">Select template…</option>
                                {ACTIVE_TEMPLATES.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-span-12 md:col-span-3">
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                                Delivery
                              </label>
                              <select
                                value={s.delivery}
                                onChange={(e) =>
                                  updateSchedule(code, s.id, {
                                    delivery: e.target.value as DeliveryMode,
                                  })
                                }
                                className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background"
                              >
                                <option value="generate_send">Generate & send</option>
                                <option value="generate">Generate only (queue for review)</option>
                              </select>
                            </div>
                            <div className="col-span-11 md:col-span-2">
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                                Note
                              </label>
                              <input
                                value={s.note ?? ""}
                                onChange={(e) =>
                                  updateSchedule(code, s.id, { note: e.target.value })
                                }
                                placeholder="Optional"
                                className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background"
                              />
                            </div>
                            <div className="col-span-1 flex justify-end pt-5">
                              <button
                                onClick={() => removeSchedule(code, s.id)}
                                className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                                aria-label="Remove schedule"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  <button
                    onClick={() => addSchedule(code)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-tenant hover:bg-tenant-soft"
                  >
                    <Plus className="h-4 w-4" /> Add document schedule
                  </button>
                </div>
              )}
            </PageCard>
          );
        })}
      </section>

      {previewing && (
        <PreviewModal
          code={previewing}
          rule={rules[previewing]}
          onClose={() => setPreviewing(null)}
        />
      )}
    </Shell>
  );
}

function PreviewModal({
  code,
  rule,
  onClose,
}: {
  code: string;
  rule: StatusDocRule;
  onClose: () => void;
}) {
  const status = findStatus(code);
  const sorted = rule.schedules.slice().sort((a, b) => a.dayOffset - b.dayOffset);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Document timeline preview</div>
            <div className="font-display text-lg font-bold">
              {status?.displayName} ({status?.code})
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">
          {!rule.enabled && (
            <div className="text-sm text-muted-foreground italic mb-4">
              Automation is currently disabled for this status.
            </div>
          )}
          {sorted.length === 0 ? (
            <div className="text-sm text-muted-foreground">No documents scheduled.</div>
          ) : (
            <ol className="relative border-l-2 border-tenant/30 ml-3 space-y-5">
              {sorted.map((s) => (
                <li key={s.id} className="pl-5 relative">
                  <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-tenant border-2 border-background" />
                  <div className="text-xs font-semibold text-tenant">
                    Day {s.dayOffset === 0 ? "0 (same day)" : `+${s.dayOffset}`}
                  </div>
                  <div className="text-sm font-semibold flex items-center gap-2 mt-0.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    {tplName(s.templateId)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {s.delivery === "generate_send"
                      ? "Auto-generate & send"
                      : "Generate only — queued for review"}
                    {s.note ? ` · ${s.note}` : ""}
                  </div>
                </li>
              ))}
              {rule.repeat && (
                <li className="pl-5 relative">
                  <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-muted border-2 border-background" />
                  <div className="text-xs font-semibold text-muted-foreground">Then weekly</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Re-generate the last template every 7 days while status remains {code}.
                  </div>
                </li>
              )}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
