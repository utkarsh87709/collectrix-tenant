import { createFileRoute } from "@tanstack/react-router";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { MERGE_VARIABLES } from "@/lib/letters-mock";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Save, Eye, FileText, Type, Indent, Hash, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/tenant/comms/letters/builder")({
  head: () => ({ meta: [{ title: "Builder · Letters" }] }),
  component: BuilderPage,
});

const inputCls = "w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-tenant focus:bg-background";

const STARTER = `Dear {{debtor_full_name}},

Re: Account {{account_number}} — Balance Due {{balance_due}}

This letter serves as formal notice that your account with {{original_creditor}} is delinquent. As of {{current_date}}, the total amount owing is {{total_amount}} (principal plus interest accrued of {{interest_accrued}}).

{{#if balance_due > 5000}}
This is a substantial debt requiring immediate attention. Failure to respond may result in escalation to legal proceedings.
{{/if}}

{{#if eligible_for_settlement}}
We can offer a one-time settlement of {{settlement_amount}} ({{settlement_percentage}}% of balance) if paid by {{settlement_expiry}}.
{{/if}}

This is an attempt to collect a debt and any information obtained will be used for that purpose. Unless you notify us within 30 days of receipt of this notice that you dispute the validity of this debt, we will assume the debt is valid.

You must respond by {{payment_deadline}} to avoid further action.

Sincerely,
{{attorney_name}}
{{law_firm_name}}
{{firm_phone}}`;

function BuilderPage() {
  const [name, setName] = useState("Initial Demand — Ontario — New Variant");
  const [jurisdiction, setJurisdiction] = useState("ON");
  const [language, setLanguage] = useState("en");
  const [paper, setPaper] = useState("letter");
  const [body, setBody] = useState(STARTER);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const variableCount = (body.match(/{{[^#/].*?}}/g) || []).length;
  const conditionalCount = (body.match(/{{#if/g) || []).length;

  const insertVar = (key: string) => {
    setBody((b) => b + " " + key);
    toast.message(`Inserted ${key}`);
  };

  const save = () => {
    if (!name.trim() || !body.trim()) { toast.error("Name and body are required"); return; }
    toast.success(`Template "${name}" saved as draft (v1)`);
  };

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") { toast.error("Please upload a PDF file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("PDF must be under 10MB"); return; }

    setImporting(true);
    const toastId = toast.loading("AI is reading your PDF…");
    try {
      const buf = await file.arrayBuffer();
      // chunked base64 encode to avoid call-stack issues with large files
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const fileBase64 = btoa(binary);

      const res = await fetch("/api/letters/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64, mimeType: file.type, fileName: file.name }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || "Failed to parse PDF", { id: toastId });
        return;
      }
      setName(data.name);
      setBody(data.body);
      if (data.language === "fr" || data.language === "en") setLanguage(data.language);
      toast.success(`Template imported · ${data.placeholders?.length || 0} placeholders detected`, { id: toastId });
      setShowPreview(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed", { id: toastId });
    } finally {
      setImporting(false);
    }
  };

  const renderPreview = () =>
    body
      .replace(/{{debtor_full_name}}/g, "John A. Smith")
      .replace(/{{account_number}}/g, "ACC-882134")
      .replace(/{{original_creditor}}/g, "RBC Royal Bank")
      .replace(/{{balance_due}}/g, "$5,847.20")
      .replace(/{{interest_accrued}}/g, "$184.20")
      .replace(/{{total_amount}}/g, "$6,031.40")
      .replace(/{{current_date}}/g, "April 17, 2026")
      .replace(/{{payment_deadline}}/g, "May 17, 2026")
      .replace(/{{settlement_amount}}/g, "$4,500")
      .replace(/{{settlement_percentage}}/g, "75")
      .replace(/{{settlement_expiry}}/g, "April 30, 2026")
      .replace(/{{attorney_name}}/g, "Jane Smith, Esq.")
      .replace(/{{law_firm_name}}/g, "Smith & Associates LLP")
      .replace(/{{firm_phone}}/g, "(416) 555-0199")
      .replace(/{{#if [^}]+}}/g, "")
      .replace(/{{\/if}}/g, "");

  return (
    <section className="px-6 lg:px-10 py-6 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
      <div className="space-y-4">
        <PageCard>
          <CardHead
            title="Template Builder"
            subtitle="US-085 · merge fields · conditional logic · jurisdiction-aware"
            action={
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
                <button onClick={onPickFile} disabled={importing} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-tenant/40 bg-tenant-soft text-tenant text-sm font-semibold hover:bg-tenant/15 disabled:opacity-60">
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {importing ? "Parsing…" : "Import PDF with AI"}
                </button>
                <button onClick={() => setShowPreview((s) => !s)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
                  <Eye className="h-4 w-4" /> {showPreview ? "Edit" : "Preview"}
                </button>
                <button onClick={save} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
                  <Save className="h-4 w-4" /> Save draft
                </button>
              </div>
            }
          />
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block">
                <div className="text-xs font-semibold mb-1.5">Template name</div>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="block">
                <div className="text-xs font-semibold mb-1.5">Jurisdiction</div>
                <select className={inputCls} value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
                  <option value="ON">Ontario</option>
                  <option value="QC">Québec</option>
                  <option value="BC">British Columbia</option>
                  <option value="AB">Alberta</option>
                  <option value="US-FED">US Federal (FDCPA)</option>
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-semibold mb-1.5">Language</div>
                <select className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground"><Type className="h-3 w-3" /> Paper</div>
                <select className={inputCls + " mt-1"} value={paper} onChange={(e) => setPaper(e.target.value)}>
                  <option value="letter">US Letter (8.5×11)</option>
                  <option value="legal">Legal (8.5×14)</option>
                  <option value="a4">A4</option>
                </select>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground"><Indent className="h-3 w-3" /> Margins</div>
                <div className="mt-2 font-semibold">1.0&quot; all sides (legal standard)</div>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground"><Hash className="h-3 w-3" /> Detected</div>
                <div className="mt-2 flex gap-1 flex-wrap">
                  <Pill tone="tenant">{variableCount} vars</Pill>
                  <Pill tone="info">{conditionalCount} conditionals</Pill>
                </div>
              </div>
            </div>

            {showPreview ? (
              <div className="rounded-xl border border-border bg-background p-8 text-sm whitespace-pre-wrap font-serif leading-relaxed shadow-inner min-h-[400px]">
                <div className="text-right text-xs text-muted-foreground mb-4">Smith &amp; Associates LLP · Toronto, ON</div>
                {renderPreview()}
              </div>
            ) : (
              <textarea
                className={inputCls + " font-mono text-xs leading-relaxed min-h-[400px]"}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Letter body — use {{variable}} and {{#if condition}}…{{/if}}"
              />
            )}
          </div>
        </PageCard>

        <PageCard>
          <CardHead title="Legal boilerplate library" subtitle="One-click insert — jurisdiction aware" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-6">
            {[
              { title: "Mini-Miranda (FDCPA)", text: "This is an attempt to collect a debt and any information obtained will be used for that purpose." },
              { title: "30-day dispute notice", text: "Unless you notify us within 30 days of receipt of this notice that you dispute the validity of this debt, we will assume the debt is valid." },
              { title: "Quebec French disclosure", text: "Conformément à la Loi sur la protection du consommateur, vous avez le droit de contester cette créance dans un délai de 30 jours." },
              { title: "Interest disclosure (ON)", text: "Interest is calculated at {{interest_rate}}% per annum on the outstanding balance, compounded monthly." },
            ].map((b) => (
              <div key={b.title} className="rounded-xl border border-border p-3 bg-muted/30">
                <div className="font-semibold text-xs text-tenant">{b.title}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{b.text}</div>
                <button onClick={() => { setBody((bd) => bd + "\n\n" + b.text); toast.success("Boilerplate inserted"); }} className="text-[11px] font-semibold text-tenant mt-2 hover:underline">Insert →</button>
              </div>
            ))}
          </div>
        </PageCard>
      </div>

      <PageCard className="self-start sticky top-4">
        <CardHead title="Merge variables" subtitle="Click to insert" />
        <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
          {MERGE_VARIABLES.map((g) => (
            <div key={g.group}>
              <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">{g.group}</div>
              <div className="space-y-1">
                {g.keys.map((k) => (
                  <button key={k.key} onClick={() => insertVar(k.key)} className="w-full text-left rounded-md p-2 bg-muted/40 hover:bg-tenant-soft hover:text-tenant transition">
                    <div className="font-mono text-[11px] font-bold">{k.key}</div>
                    <div className="text-[10px] text-muted-foreground">{k.sample}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="rounded-lg bg-tenant-soft p-3 text-[11px]">
            <div className="font-semibold text-tenant mb-1 flex items-center gap-1"><FileText className="h-3 w-3" /> Conditional syntax</div>
            <code className="block text-[10px]">{`{{#if balance_due > 5000}}…{{/if}}`}</code>
          </div>
        </div>
      </PageCard>
    </section>
  );
}
