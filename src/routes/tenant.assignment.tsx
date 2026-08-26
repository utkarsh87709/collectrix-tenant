import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { useMemo, useState } from "react";
import {
  Plus, X, ArrowUp, ArrowDown, Trash2, Sparkles, Layers,
  Zap, ShieldCheck, Bot, AlertTriangle, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  ASSIGNMENT_METHODS,
  ASSIGNMENT_TRIGGERS,
  useRules,
  upsertRule,
  deleteRule,
  reorderRules,
  toggleRuleActive,
  useTeams,
  agents,
  managers,
  getAISuggestions,
  type AssignmentRule,
  type AssignmentMethod,
  type AssignmentTrigger,
  type RuleCondition,
} from "@/lib/assignment-store";
import { debtors } from "@/lib/intake-mock";

export const Route = createFileRoute("/tenant/assignment")({
  head: () => ({ meta: [{ title: "Assignment Rules · Tenant Admin" }] }),
  component: AssignmentPage,
});

const METHOD_ICON: Record<AssignmentMethod, string> = {
  manual: "✋", round_robin: "🔁", team: "👥", creditor: "🏦",
  geographic: "🌍", language: "🗣", skill: "🎯", ai_priority: "🤖",
};

function AssignmentPage() {
  const rules = useRules();
  const teams = useTeams();
  const [editing, setEditing] = useState<AssignmentRule | null>(null);
  const [previewDebtorId, setPreviewDebtorId] = useState<string>(debtors[0]?.id ?? "");

  const move = (idx: number, dir: -1 | 1) => {
    const ids = rules.map((r) => r.id);
    const target = idx + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    reorderRules(ids);
  };

  const startNew = () => {
    setEditing({
      id: `ar_${Date.now().toString(36)}`,
      name: "",
      priority: rules.length + 1,
      active: true,
      triggers: ["on_upload"],
      method: "round_robin",
      conditions: [],
      target: { teamId: teams[0]?.id ?? null },
      fallbackRuleId: null,
      allowManualOverride: true,
    });
  };

  const aiPreview = useMemo(() => previewDebtorId ? getAISuggestions(previewDebtorId) : [], [previewDebtorId]);
  const previewDebtor = debtors.find((d) => d.id === previewDebtorId);

  return (
    <Shell>
      <Topbar
        title="Assignment Rules"
        subtitle="Configure how customer files are routed to teams, agents, and managers"
        action={
          <button onClick={startNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
            <Plus className="h-4 w-4" /> New rule
          </button>
        }
      />

      <section className="px-6 lg:px-10 py-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* ─── Rule list ─── */}
        <PageCard className="xl:col-span-2">
          <CardHead
            title="Rule priority"
            subtitle="Rules evaluate top → bottom. The first matching rule fires; on miss the fallback rule chain runs."
          />
          <ul className="divide-y divide-border">
            {rules.map((r, i) => {
              const fallback = r.fallbackRuleId ? rules.find((x) => x.id === r.fallbackRuleId) : null;
              const targetTxt =
                r.target.agentId ? `Agent · ${agents.find((a) => a.id === r.target.agentId)?.name}` :
                r.target.teamId ? `Team · ${teams.find((t) => t.id === r.target.teamId)?.name ?? "—"}` :
                r.target.managerId ? `Manager · ${managers.find((m) => m.id === r.target.managerId)?.name}` :
                "AI selects target";
              return (
                <li key={r.id} className={`px-6 py-3 flex items-start gap-3 text-sm ${!r.active ? "opacity-50" : ""}`}>
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button onClick={() => move(i, -1)} className="text-muted-foreground hover:text-tenant"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => move(i, 1)} className="text-muted-foreground hover:text-tenant"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="w-7 h-7 rounded-md bg-tenant-soft text-tenant flex items-center justify-center text-xs font-bold shrink-0">{r.priority}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => setEditing(r)} className="font-semibold hover:text-tenant text-left">{r.name || "Untitled rule"}</button>
                      <Pill tone="muted">{METHOD_ICON[r.method]} {ASSIGNMENT_METHODS.find((m) => m.value === r.method)?.label}</Pill>
                      {r.allowManualOverride && <Pill tone="info">Override OK</Pill>}
                      {!r.active && <Pill tone="warning">inactive</Pill>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium">Target:</span> {targetTxt}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Triggers:</span>{" "}
                      {r.triggers.map((t) => ASSIGNMENT_TRIGGERS.find((x) => x.value === t)?.label.replace(/^On /, "")).join(", ")}
                    </div>
                    {r.conditions.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">When:</span>{" "}
                        {r.conditions.map((c) => `${c.field} ${c.op} ${c.value}`).join(" AND ")}
                      </div>
                    )}
                    {fallback && (
                      <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
                        <ChevronRight className="h-3 w-3" /> Fallback: <span className="font-medium text-foreground">{fallback.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={r.active} onChange={() => toggleRuleActive(r.id)} />
                      <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-tenant after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition peer-checked:after:translate-x-4" />
                    </label>
                    <button onClick={() => { if (confirm(`Delete rule "${r.name}"?`)) { deleteRule(r.id); toast.success("Rule deleted"); }}} className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
            {rules.length === 0 && (
              <li className="px-6 py-12 text-center text-sm text-muted-foreground">
                <Layers className="h-8 w-8 mx-auto mb-2 text-tenant" />
                No rules configured. Files will remain unassigned until you create one.
              </li>
            )}
          </ul>
          <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground bg-muted/30">
            <ShieldCheck className="h-3.5 w-3.5 text-tenant inline mr-1" />
            If no rule matches and no fallback chain resolves, files land in the <strong>Unassigned</strong> queue for manual review.
          </div>
        </PageCard>

        {/* ─── AI preview ─── */}
        <PageCard>
          <CardHead title="AI routing preview" subtitle="Test the AI-priority engine against a real customer" />
          <div className="px-6 py-4 space-y-3">
            <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Test customer</label>
            <select
              value={previewDebtorId}
              onChange={(e) => setPreviewDebtorId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              {debtors.map((d) => (
                <option key={d.id} value={d.id}>{d.name} · {d.creditor} · ${d.balance.toLocaleString()}</option>
              ))}
            </select>
            {previewDebtor && (
              <div className="text-xs text-muted-foreground">
                Status: <strong>{previewDebtor.status}</strong> · Flags: {previewDebtor.flags.join(", ") || "none"}
              </div>
            )}
          </div>
          <div className="px-6 pb-5 space-y-2">
            {aiPreview.map((s, idx) => (
              <div key={s.agentId} className={`rounded-lg border p-3 text-sm ${idx === 0 ? "border-tenant bg-tenant-soft" : "border-border"}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {idx === 0 && <Sparkles className="h-3.5 w-3.5 text-tenant" />}
                    <span className="font-semibold">{s.agentName}</span>
                    {s.teamName && <Pill tone="muted">{s.teamName}</Pill>}
                  </div>
                  <Pill tone={s.confidence > 0.7 ? "success" : s.confidence > 0.5 ? "info" : "warning"}>
                    {Math.round(s.confidence * 100)}%
                  </Pill>
                </div>
                {s.managerName && <div className="text-xs text-muted-foreground">Manager: {s.managerName}</div>}
                <ul className="mt-1.5 text-xs text-muted-foreground space-y-0.5">
                  {s.reasons.map((r, i) => <li key={i} className="flex items-center gap-1.5"><span className="text-success">✓</span> {r}</li>)}
                </ul>
              </div>
            ))}
            {aiPreview.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-6">
                <Bot className="h-6 w-6 mx-auto mb-1 text-tenant" /> No agents available
              </div>
            )}
          </div>
        </PageCard>
      </section>

      {editing && (
        <RuleEditor
          rule={editing}
          allRules={rules}
          onClose={() => setEditing(null)}
          onSave={(r) => { upsertRule(r); setEditing(null); toast.success(`Rule "${r.name}" saved`); }}
        />
      )}
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule editor modal
// ─────────────────────────────────────────────────────────────────────────────

function RuleEditor({
  rule, allRules, onClose, onSave,
}: {
  rule: AssignmentRule;
  allRules: AssignmentRule[];
  onClose: () => void;
  onSave: (r: AssignmentRule) => void;
}) {
  const teams = useTeams();
  const [draft, setDraft] = useState<AssignmentRule>(rule);

  const toggleTrigger = (t: AssignmentTrigger) => {
    setDraft((d) => ({
      ...d,
      triggers: d.triggers.includes(t) ? d.triggers.filter((x) => x !== t) : [...d.triggers, t],
    }));
  };

  const addCondition = () => {
    setDraft((d) => ({ ...d, conditions: [...d.conditions, { field: "balance", op: "gt", value: "" }] }));
  };
  const updateCondition = (i: number, patch: Partial<RuleCondition>) => {
    setDraft((d) => ({ ...d, conditions: d.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c) }));
  };
  const removeCondition = (i: number) => {
    setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, idx) => idx !== i) }));
  };

  const save = () => {
    if (!draft.name.trim()) { toast.error("Rule name is required"); return; }
    if (draft.triggers.length === 0) { toast.error("At least one trigger is required"); return; }
    onSave(draft);
  };

  const fallbackOptions = allRules.filter((r) => r.id !== draft.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-card border border-border shadow-tenant overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-display font-bold text-lg">{rule.name ? "Edit rule" : "New assignment rule"}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Define when this rule fires, what method to use, and which team or agent owns the result.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm">
          {/* basics */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Lbl>Rule name</Lbl>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. High-value French escalation"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background" />
            </div>
            <div>
              <Lbl>Priority (lower = first)</Lbl>
              <input type="number" min={1} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background" />
            </div>
          </div>

          {/* method */}
          <div>
            <Lbl>Assignment method</Lbl>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
              {ASSIGNMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setDraft({ ...draft, method: m.value })}
                  className={`text-left p-2.5 rounded-lg border text-xs transition ${draft.method === m.value ? "border-tenant bg-tenant-soft" : "border-border hover:bg-muted"}`}
                >
                  <div className="font-semibold flex items-center gap-1.5">
                    <span>{METHOD_ICON[m.value]}</span> {m.label}
                  </div>
                  <div className="text-muted-foreground mt-0.5">{m.blurb}</div>
                </button>
              ))}
            </div>
          </div>

          {/* triggers */}
          <div>
            <Lbl>Triggers</Lbl>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {ASSIGNMENT_TRIGGERS.map((t) => {
                const on = draft.triggers.includes(t.value);
                return (
                  <button
                    key={t.value}
                    onClick={() => toggleTrigger(t.value)}
                    className={`text-left px-2.5 py-1.5 rounded-md border text-xs transition ${on ? "border-tenant bg-tenant-soft text-tenant font-semibold" : "border-border hover:bg-muted"}`}
                  >
                    <Zap className="h-3 w-3 inline mr-1" />{t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* conditions */}
          <div>
            <div className="flex items-center justify-between">
              <Lbl>Conditions (ALL must match)</Lbl>
              <button onClick={addCondition} className="text-xs text-tenant font-semibold inline-flex items-center gap-1 hover:underline">
                <Plus className="h-3 w-3" /> Add condition
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {draft.conditions.length === 0 && (
                <div className="text-xs text-muted-foreground italic px-1">No conditions — rule fires on every trigger.</div>
              )}
              {draft.conditions.map((c, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <select value={c.field} onChange={(e) => updateCondition(i, { field: e.target.value as RuleCondition["field"] })}
                    className="col-span-4 px-2 py-1.5 rounded-md border border-border bg-background text-xs">
                    {["balance", "creditor", "creditor", "status", "region", "language", "flag", "risk_score", "contactability", "tenure_days"].map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select value={c.op} onChange={(e) => updateCondition(i, { op: e.target.value as RuleCondition["op"] })}
                    className="col-span-3 px-2 py-1.5 rounded-md border border-border bg-background text-xs">
                    {["eq", "neq", "gt", "lt", "gte", "lte", "contains", "in"].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <input value={c.value} onChange={(e) => updateCondition(i, { value: e.target.value })}
                    placeholder="value"
                    className="col-span-4 px-2 py-1.5 rounded-md border border-border bg-background text-xs" />
                  <button onClick={() => removeCondition(i)} className="col-span-1 text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5 mx-auto" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* target */}
          {draft.method !== "ai_priority" && (
            <div>
              <Lbl>Target</Lbl>
              <div className="mt-2 grid sm:grid-cols-3 gap-2">
                <select value={draft.target.teamId ?? ""} onChange={(e) => setDraft({ ...draft, target: { ...draft.target, teamId: e.target.value || null } })}
                  className="px-2 py-2 rounded-md border border-border bg-background text-sm">
                  <option value="">— Any team —</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>Team · {t.name}</option>)}
                </select>
                <select value={draft.target.agentId ?? ""} onChange={(e) => setDraft({ ...draft, target: { ...draft.target, agentId: e.target.value || null } })}
                  className="px-2 py-2 rounded-md border border-border bg-background text-sm">
                  <option value="">— Any agent —</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>Agent · {a.name}</option>)}
                </select>
                <select value={draft.target.managerId ?? ""} onChange={(e) => setDraft({ ...draft, target: { ...draft.target, managerId: e.target.value || null } })}
                  className="px-2 py-2 rounded-md border border-border bg-background text-sm">
                  <option value="">— Any manager —</option>
                  {managers.map((m) => <option key={m.id} value={m.id}>Manager · {m.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* fallback + override */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Lbl>Fallback rule (if no agent matches)</Lbl>
              <select value={draft.fallbackRuleId ?? ""} onChange={(e) => setDraft({ ...draft, fallbackRuleId: e.target.value || null })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background">
                <option value="">— Leave unassigned —</option>
                {fallbackOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 mt-6">
              <input type="checkbox" className="accent-tenant h-4 w-4" checked={draft.allowManualOverride}
                onChange={(e) => setDraft({ ...draft, allowManualOverride: e.target.checked })} />
              <span className="text-sm">Allow manual override on assigned files</span>
            </label>
          </div>

          <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <span className="text-muted-foreground">
              Rules execute at the listed <strong>priority</strong>. If multiple rules match the same trigger, the first matching rule wins and the rest are skipped unless this rule's fallback chain runs.
            </span>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-muted">Cancel</button>
          <button onClick={save} className="px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
            Save rule
          </button>
        </div>
      </div>
    </div>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{children}</label>;
}
