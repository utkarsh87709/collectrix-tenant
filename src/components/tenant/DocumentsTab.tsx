import { useMemo, useState } from "react";
import { FileText, Sparkles, Download, Trash2, Search, Filter, Scale, Wallet, Headphones, Bot, Paperclip, Loader2, Eye } from "lucide-react";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { toast } from "sonner";
import { LETTER_TEMPLATES, type LetterTemplate } from "@/lib/letters-mock";

type DocStage =
  | "intake"
  | "validation"
  | "pre_legal"
  | "legal"
  | "payment_plan"
  | "settlement"
  | "closure";

type DocSource = "agent" | "legal" | "finance" | "system" | "debtor";

type DebtorDoc = {
  id: string;
  name: string;
  stage: DocStage;
  source: DocSource;
  uploadedBy: string;
  uploadedAt: string;
  size: string;
  mime: string;
  note?: string;
};

const STAGE_LABEL: Record<DocStage, string> = {
  intake: "Intake",
  validation: "Validation",
  pre_legal: "Pre-Legal",
  legal: "Legal",
  payment_plan: "Payment Plan",
  settlement: "Settlement",
  closure: "Closure",
};

const SOURCE_META: Record<DocSource, { label: string; icon: typeof FileText; tone: "tenant" | "warning" | "success" | "info" | "muted" }> = {
  agent: { label: "Agent", icon: Headphones, tone: "info" },
  legal: { label: "Legal", icon: Scale, tone: "warning" },
  finance: { label: "Finance", icon: Wallet, tone: "success" },
  system: { label: "System", icon: Bot, tone: "muted" },
  debtor: { label: "Customer", icon: Paperclip, tone: "tenant" },
};

// Per-debtor mock seed (stable based on debtorId)
function seedFor(debtorId: string): DebtorDoc[] {
  return [
    { id: `${debtorId}-d1`, name: "Original_Loan_Agreement.pdf", stage: "intake", source: "system", uploadedBy: "CRM Import", uploadedAt: "180d ago", size: "412 KB", mime: "pdf", note: "Imported from creditor placement file" },
    { id: `${debtorId}-d2`, name: "Statement_of_Account_2025-11.pdf", stage: "validation", source: "agent", uploadedBy: "Maya Chen", uploadedAt: "42d ago", size: "186 KB", mime: "pdf" },
    { id: `${debtorId}-d3`, name: "Customer_ID_Verification.jpg", stage: "validation", source: "debtor", uploadedBy: "Customer portal", uploadedAt: "38d ago", size: "1.2 MB", mime: "image" },
    { id: `${debtorId}-d4`, name: "Demand_Letter_Draft_v2.docx", stage: "pre_legal", source: "legal", uploadedBy: "Sarah Klein", uploadedAt: "21d ago", size: "64 KB", mime: "docx", note: "Awaiting senior counsel approval" },
    { id: `${debtorId}-d5`, name: "Statement_of_Claim.pdf", stage: "legal", source: "legal", uploadedBy: "Sarah Klein", uploadedAt: "14d ago", size: "298 KB", mime: "pdf" },
    { id: `${debtorId}-d6`, name: "Affidavit_of_Service.pdf", stage: "legal", source: "legal", uploadedBy: "James O'Brien", uploadedAt: "9d ago", size: "144 KB", mime: "pdf" },
    { id: `${debtorId}-d7`, name: "Payment_Plan_Signed.pdf", stage: "payment_plan", source: "agent", uploadedBy: "Maya Chen", uploadedAt: "5d ago", size: "92 KB", mime: "pdf", note: "$250/mo for 18 months" },
    { id: `${debtorId}-d8`, name: "Receipt_Nov_Installment.pdf", stage: "payment_plan", source: "finance", uploadedBy: "Aisha Patel", uploadedAt: "2d ago", size: "48 KB", mime: "pdf" },
  ];
}

const STAGES: ("all" | DocStage)[] = ["all", "intake", "validation", "pre_legal", "legal", "payment_plan", "settlement", "closure"];
const SOURCES: ("all" | DocSource)[] = ["all", "agent", "legal", "finance", "system", "debtor"];

export function DocumentsTab({ debtorId, debtorName }: { debtorId: string; debtorName: string }) {
  const [docs, setDocs] = useState<DebtorDoc[]>(() => seedFor(debtorId));
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<"all" | DocStage>("all");
  const [source, setSource] = useState<"all" | DocSource>("all");
  const [generateOpen, setGenerateOpen] = useState(false);

  const filtered = useMemo(() => docs.filter((doc) => {
    if (stage !== "all" && doc.stage !== stage) return false;
    if (source !== "all" && doc.source !== source) return false;
    if (q && !doc.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [docs, q, stage, source]);

  const counts = useMemo(() => {
    const c: Record<DocSource, number> = { agent: 0, legal: 0, finance: 0, system: 0, debtor: 0 };
    docs.forEach((d) => { c[d.source]++; });
    return c;
  }, [docs]);

  function handleDelete(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    toast.success("Document removed");
  }

  function handleGenerated(name: string, template: LetterTemplate, body: string, stg: DocStage, note: string) {
    const newDoc: DebtorDoc = {
      id: `${debtorId}-${Date.now()}`,
      name,
      stage: stg,
      source: "system",
      uploadedBy: "AI · ",
      uploadedAt: "just now",
      size: `${Math.max(20, Math.round(body.length / 50))} KB`,
      mime: "pdf",
      note: note || `AI-generated from "${template.name}"`,
    };
    setDocs((prev) => [newDoc, ...prev]);
    setGenerateOpen(false);
    toast.success(`${newDoc.name} generated`);
  }

  return (
    <div className="space-y-4">
      {/* Summary by source */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {(Object.keys(SOURCE_META) as DocSource[]).map((src) => {
          const meta = SOURCE_META[src];
          const Icon = meta.icon;
          return (
            <button
              key={src}
              onClick={() => setSource(source === src ? "all" : src)}
              className={`rounded-xl border p-4 text-left transition ${
                source === src ? "border-tenant bg-tenant-soft" : "border-border bg-card hover:border-tenant/40"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Icon className="h-3.5 w-3.5" /> {meta.label}
              </div>
              <div className="mt-2 font-display text-2xl font-bold">{counts[src]}</div>
            </button>
          );
        })}
      </div>

      <PageCard>
        <CardHead
          title={`Documents (${filtered.length})`}
          subtitle={`Files generated and collected across the lifecycle for ${debtorName}`}
          action={
            <button
              onClick={() => setGenerateOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
            >
              <Sparkles className="h-4 w-4" /> Generate document
            </button>
          }
        />

        <div className="px-6 py-3 border-b border-border flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by file name…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as typeof stage)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>{s === "all" ? "All stages" : STAGE_LABEL[s]}</option>
              ))}
            </select>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s === "all" ? "All sources" : SOURCE_META[s].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left px-6 py-3 font-semibold">Document</th>
                <th className="text-left px-3 py-3 font-semibold">Stage</th>
                <th className="text-left px-3 py-3 font-semibold">Source</th>
                <th className="text-left px-3 py-3 font-semibold">Uploaded by</th>
                <th className="text-left px-3 py-3 font-semibold">When</th>
                <th className="text-right px-3 py-3 font-semibold">Size</th>
                <th className="text-right px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => {
                const meta = SOURCE_META[doc.source];
                const Icon = meta.icon;
                return (
                  <tr key={doc.id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-semibold">{doc.name}</div>
                          {doc.note && <div className="text-xs text-muted-foreground mt-0.5">{doc.note}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><Pill tone="muted">{STAGE_LABEL[doc.stage]}</Pill></td>
                    <td className="px-3 py-3">
                      <Pill tone={meta.tone}>
                        <Icon className="h-3 w-3 mr-1 inline" />{meta.label}
                      </Pill>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{doc.uploadedBy}</td>
                    <td className="px-3 py-3 text-muted-foreground">{doc.uploadedAt}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs">{doc.size}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toast.message(`Downloading ${doc.name}`)}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">No documents match your filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PageCard>

      {generateOpen && (
        <GenerateDialog
          debtorName={debtorName}
          debtorId={debtorId}
          onClose={() => setGenerateOpen(false)}
          onGenerated={handleGenerated}
        />
      )}
    </div>
  );
}

// Mock debtor context used to fill template merge variables.
// In production this would come from the debtor record + creditor + agent profile.
function debtorContext(debtorId: string, debtorName: string): Record<string, string> {
  return {
    debtor_full_name: debtorName,
    account_number: `ACC-${debtorId.slice(-6).toUpperCase()}`,
    original_creditor: "RBC Royal Bank",
    balance_due: "$5,847.20",
    interest_accrued: "$184.20",
    total_amount: "$6,031.40",
    current_date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    payment_deadline: new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    settlement_amount: "$4,500",
    settlement_percentage: "75",
    settlement_expiry: new Date(Date.now() + 14 * 86400000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    lump_sum_amount: "$3,900",
    plan_terms: "$250/month for 18 months starting next month",
    ptp_amount: "$500",
    ptp_date: new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    payment_amount: "$500",
    payment_date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    attorney_name: "Jane Smith, Esq.",
    law_firm_name: "Smith & Associates LLP",
    firm_phone: "(416) 555-0199",
  };
}

function mergeTemplate(text: string, ctx: Record<string, string>): string {
  return text.replace(/{{\s*([a-z_]+)\s*}}/gi, (_, k) => ctx[k] ?? `{{${k}}}`);
}

function stageForCategory(cat: LetterTemplate["category"]): DocStage {
  switch (cat) {
    case "legal": return "legal";
    case "settlement": return "settlement";
    case "payment": return "payment_plan";
    case "compliance": return "validation";
  }
}

function GenerateDialog({
  debtorId,
  debtorName,
  onClose,
  onGenerated,
}: {
  debtorId: string;
  debtorName: string;
  onClose: () => void;
  onGenerated: (name: string, template: LetterTemplate, body: string, stage: DocStage, note: string) => void;
}) {
  const activeTemplates = useMemo(() => LETTER_TEMPLATES.filter((t) => t.status === "active"), []);
  const [templateId, setTemplateId] = useState<string>(activeTemplates[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedBody, setGeneratedBody] = useState<string | null>(null);

  const template = activeTemplates.find((t) => t.id === templateId);
  const ctx = useMemo(() => debtorContext(debtorId, debtorName), [debtorId, debtorName]);

  function runGeneration() {
    if (!template) return;
    setGenerating(true);
    setGeneratedBody(null);
    // Simulated AI generation — produces a fully-merged letter body.
    setTimeout(() => {
      const opening = `${ctx.current_date}\n\n${debtorName}\nRe: Account ${ctx.account_number}\n\n`;
      const body = mergeTemplate(template.preview, ctx) + `\n\nThis document was generated by AI from the "${template.name}" template using the customer's current profile, balance, and account history.\n\nSincerely,\n${ctx.attorney_name}\n${ctx.law_firm_name}\n${ctx.firm_phone}`;
      setGeneratedBody(opening + body);
      setGenerating(false);
    }, 1100);
  }

  function confirm() {
    if (!template || !generatedBody) return;
    const safeName = template.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
    const fileName = `${safeName}_${debtorId.slice(-6).toUpperCase()}.pdf`;
    onGenerated(fileName, template, generatedBody, stageForCategory(template.category), note);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-tenant" />
          <h3 className="font-display text-lg font-bold">Generate document with AI</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Select a template — AI will merge {debtorName}'s details, balance, and account context to produce a ready-to-send document.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Template</label>
            <select
              value={templateId}
              onChange={(e) => { setTemplateId(e.target.value); setGeneratedBody(null); }}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              {activeTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.jurisdiction} · {t.language.toUpperCase()}
                </option>
              ))}
            </select>
            {template && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Pill tone="muted">{template.category}</Pill>
                <Pill tone="info">v{template.version}</Pill>
                {template.requiresApproval && <Pill tone="warning">Approval required</Pill>}
                <Pill tone="success">Compliance {template.complianceScore}/100</Pill>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Internal note about this generation…"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
            />
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Eye className="h-3.5 w-3.5" /> AI preview
              </div>
              <button
                onClick={runGeneration}
                disabled={!template || generating}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-tenant/40 bg-tenant-soft text-tenant text-xs font-semibold hover:bg-tenant/15 disabled:opacity-60"
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {generating ? "Generating…" : generatedBody ? "Regenerate" : "Generate preview"}
              </button>
            </div>
            <div className="bg-background rounded-lg border border-border p-4 min-h-[180px] max-h-[260px] overflow-y-auto text-xs font-serif whitespace-pre-wrap leading-relaxed">
              {generating && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> AI is drafting the document with the customer's details…
                </div>
              )}
              {!generating && generatedBody && generatedBody}
              {!generating && !generatedBody && (
                <span className="text-muted-foreground">Click "Generate preview" to draft the document.</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
          <button
            onClick={confirm}
            disabled={!generatedBody || generating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" /> Save to documents
          </button>
        </div>
      </div>
    </div>
  );
}
