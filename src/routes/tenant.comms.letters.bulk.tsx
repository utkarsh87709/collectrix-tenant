import { createFileRoute } from "@tanstack/react-router";
import { PageCard, CardHead, StatTile, Pill } from "@/components/tenant/ui";
import { BULK_BATCHES, LETTER_TEMPLATES } from "@/lib/letters-mock";
import { useState } from "react";
import { toast } from "sonner";
import { Layers, Play, Pause, AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { CommsDialog, Field, inputCls, btnPrimary, btnSecondary } from "@/components/tenant/CommsDialog";

export const Route = createFileRoute("/tenant/comms/letters/bulk")({
  head: () => ({ meta: [{ title: "Bulk Generate · Letters" }] }),
  component: BulkPage,
});

const STATUS_TONE: Record<string, "muted" | "tenant" | "warning" | "success" | "danger"> = {
  queued: "warning", running: "tenant", completed: "success", failed: "danger",
};

function BulkPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: `Q2_${new Date().toLocaleString("en-US", { month: "short" })}_Campaign`,
    templateId: LETTER_TEMPLATES.filter((t) => t.status === "active")[0]?.id ?? "",
    filter: "All legal status customers in Ontario",
    output: "print" as "pdf" | "docx" | "print",
    schedule: "now" as "now" | "tonight" | "scheduled",
  });

  const totals = {
    running: BULK_BATCHES.filter((b) => b.status === "running").length,
    queued: BULK_BATCHES.filter((b) => b.status === "queued").length,
    completed30d: BULK_BATCHES.filter((b) => b.status === "completed").length,
    totalLetters: BULK_BATCHES.reduce((s, b) => s + b.generated, 0),
  };

  const submit = () => {
    if (!form.name.trim() || !form.templateId) { toast.error("Batch name and template required"); return; }
    setOpen(false);
    toast.success(`Batch "${form.name}" queued — ${form.schedule === "now" ? "starting now" : form.schedule === "tonight" ? "starts tonight at 11 PM" : "scheduled"}`);
  };

  return (
    <>
      <section className="px-6 lg:px-10 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Running" value={totals.running} delta="generating PDFs" icon={<Play className="h-4 w-4" />} tone="tenant" />
        <StatTile label="Queued" value={totals.queued} delta="off-peak scheduled" tone="warning" />
        <StatTile label="Completed · 30d" value={totals.completed30d} delta="batches" tone="success" />
        <StatTile label="Letters generated" value={totals.totalLetters.toLocaleString()} delta="across all batches" icon={<FileText className="h-4 w-4" />} />
      </section>

      <section className="px-6 lg:px-10 pb-10 space-y-4">
        <PageCard>
          <CardHead
            title="Generation queue"
            subtitle="US-086 · sequential PDF render with quality checks"
            action={
              <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
                <Layers className="h-4 w-4" /> New batch
              </button>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
                <tr>
                  <th className="text-left px-6 py-3">Batch</th>
                  <th className="text-left px-3 py-3">Template</th>
                  <th className="text-left px-3 py-3">Progress</th>
                  <th className="text-left px-3 py-3">Output</th>
                  <th className="text-left px-3 py-3">Size</th>
                  <th className="text-left px-3 py-3">Status</th>
                  <th className="text-left px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {BULK_BATCHES.map((b) => {
                  const pct = b.recipients > 0 ? Math.round((b.generated / b.recipients) * 100) : 0;
                  return (
                    <tr key={b.id} className="border-t border-border">
                      <td className="px-6 py-3">
                        <div className="font-semibold">{b.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{b.id} · {b.startedAt}</div>
                      </td>
                      <td className="px-3 py-3 text-xs">{b.templateName}</td>
                      <td className="px-3 py-3">
                        <div className="text-xs font-semibold">{b.generated}/{b.recipients} ({pct}%)</div>
                        <div className="mt-1 w-32 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-gradient-tenant" style={{ width: `${pct}%` }} />
                        </div>
                        {b.failed > 0 && <div className="text-[10px] text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {b.failed} failed</div>}
                      </td>
                      <td className="px-3 py-3 text-xs uppercase font-mono">{b.output}</td>
                      <td className="px-3 py-3 text-xs">{b.totalSizeMB} MB</td>
                      <td className="px-3 py-3"><Pill tone={STATUS_TONE[b.status]}>{b.status}</Pill></td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          {b.status === "running" && <button onClick={() => toast.message(`Paused ${b.id}`)} className="px-2 py-1 rounded border border-border text-xs hover:bg-muted inline-flex items-center gap-1"><Pause className="h-3 w-3" /> Pause</button>}
                          {b.status === "queued" && <button onClick={() => toast.success(`Started ${b.id}`)} className="px-2 py-1 rounded border border-border text-xs hover:bg-muted inline-flex items-center gap-1"><Play className="h-3 w-3" /> Start now</button>}
                          {b.status === "completed" && <button onClick={() => toast.success(`Downloaded ${b.id}.zip`)} className="px-2 py-1 rounded border border-border text-xs hover:bg-muted">Download</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PageCard>

        <PageCard>
          <CardHead title="Quality checks · last batch" subtitle="bb-001 · Q2 Final Demand · 453/456 generated" />
          <ul className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-success mt-0.5" /><span>All required fields populated (453/453)</span></li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-success mt-0.5" /><span>No unresolved variable placeholders</span></li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-success mt-0.5" /><span>Mini-Miranda present in 100% of letters</span></li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-success mt-0.5" /><span>Page count 1–3 pages (avg 2.1)</span></li>
            <li className="flex items-start gap-2"><AlertCircle className="h-4 w-4 text-destructive mt-0.5" /><span>2 letters skipped — missing postal code</span></li>
            <li className="flex items-start gap-2"><AlertCircle className="h-4 w-4 text-destructive mt-0.5" /><span>1 letter skipped — invalid postal code format</span></li>
          </ul>
        </PageCard>
      </section>

      <CommsDialog
        open={open}
        onClose={() => setOpen(false)}
        title="New bulk batch"
        subtitle="Generate letters for filtered customer list"
        size="lg"
        footer={
          <>
            <button onClick={() => setOpen(false)} className={btnSecondary}>Cancel</button>
            <button onClick={submit} className={btnPrimary}>Queue batch</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Batch name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Template" hint="Only active templates shown">
            <select className={inputCls} value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
              {LETTER_TEMPLATES.filter((t) => t.status === "active").map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Recipient filter" hint="Or upload CSV of customer IDs">
            <select className={inputCls} value={form.filter} onChange={(e) => setForm({ ...form, filter: e.target.value })}>
              <option>All legal status customers in Ontario</option>
              <option>All accounts aged 90+ days</option>
              <option>Balance &gt; $1000 AND no contact in 30 days</option>
              <option>Custom CSV upload</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Output format">
              <select className={inputCls} value={form.output} onChange={(e) => setForm({ ...form, output: e.target.value as "pdf" | "docx" | "print" })}>
                <option value="pdf">PDF (digital)</option>
                <option value="docx">Word (editable)</option>
                <option value="print">Print-ready (mail house)</option>
              </select>
            </Field>
            <Field label="Schedule">
              <select className={inputCls} value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value as "now" | "tonight" | "scheduled" })}>
                <option value="now">Generate now</option>
                <option value="tonight">Tonight 11 PM (off-peak)</option>
                <option value="scheduled">Specific date…</option>
              </select>
            </Field>
          </div>
          <div className="rounded-xl bg-muted/40 border border-border p-3 text-[11px] text-muted-foreground">
            Exclusions auto-applied: already received this letter in last 30d · in active payment plan · opted out of mail.
          </div>
        </div>
      </CommsDialog>
    </>
  );
}
