import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, StatTile, Pill } from "@/components/tenant/ui";
import { ArrowLeft, Layers, Plus, Pause, Play, Upload } from "lucide-react";
import { bulkJobs as seedBulkJobs, templates, type BulkJob, type Channel } from "@/lib/comms-mock";
import { useState } from "react";
import { toast } from "sonner";
import { CommsDialog, Field, inputCls, btnPrimary, btnSecondary } from "@/components/tenant/CommsDialog";

export const Route = createFileRoute("/tenant/comms/bulk")({
  head: () => ({ meta: [{ title: "Bulk Operations · Communications" }] }),
  component: BulkPage,
});

const STATUS_TONE: Record<string, "muted"|"tenant"|"success"|"danger"|"warning"> = {
  queued: "warning", running: "tenant", complete: "success", failed: "danger",
};

function BulkPage() {
  const [list, setList] = useState<BulkJob[]>(seedBulkJobs);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", channel: "email" as Channel, template: templates[0]?.name ?? "", audience: 100 });
  const running = list.filter((j) => j.status === "running");
  const totalSent = list.reduce((s, j) => s + j.sent, 0);

  const toggle = (id: string) => {
    setList((p) => p.map((j) => j.id === id ? { ...j, status: j.status === "running" ? "queued" : "running" } : j));
    toast.success("Job state updated");
  };

  const create = () => {
    if (!form.name.trim()) { toast.error("Job name is required"); return; }
    const job: BulkJob = {
      id: `bj-${Date.now()}`,
      name: form.name,
      channel: form.channel,
      template: form.template,
      audience: form.audience,
      sent: 0, failed: 0,
      status: "queued",
      startedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
    };
    setList((p) => [job, ...p]);
    setOpen(false);
    setForm({ name: "", channel: "email", template: templates[0]?.name ?? "", audience: 100 });
    toast.success(`Bulk job "${job.name}" queued`);
  };

  return (
    <Shell>
      <Topbar
        title="Bulk Operations"
        subtitle="US-051 · Mass send · CSV upload · throttle · pause/resume"
        action={
          <Link to="/tenant/comms" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      <section className="px-6 lg:px-10 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Active jobs" value={running.length} icon={<Layers className="h-4 w-4" />} tone="tenant" />
        <StatTile label="Sent · all jobs" value={totalSent.toLocaleString()} delta="across recent runs" tone="success" />
        <StatTile label="Throttle ceiling" value="500/min" delta="provider rate compliant" />
        <StatTile label="Failed · 7d" value={list.reduce((s,j) => s + j.failed, 0)} delta="auto-retried · DLQ on 5x" tone="warning" />
      </section>

      <section className="px-6 lg:px-10 pb-10">
        <PageCard>
          <CardHead
            title="Job queue"
            action={
              <div className="flex items-center gap-2">
                <button onClick={() => toast.message("CSV upload — pick file")} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted"><Upload className="h-3.5 w-3.5" /> Upload CSV</button>
                <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-xs font-semibold shadow-tenant"><Plus className="h-3.5 w-3.5" /> New bulk send</button>
              </div>
            }
          />
          <ul className="divide-y divide-border">
            {list.map((j) => {
              const pct = j.audience === 0 ? 0 : Math.round((j.sent / j.audience) * 100);
              return (
                <li key={j.id} className="px-6 py-4 text-sm">
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-xl bg-tenant-soft text-tenant flex items-center justify-center shrink-0"><Layers className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{j.name}</span>
                        <Pill tone={STATUS_TONE[j.status]}>{j.status}</Pill>
                        <Pill tone="muted">{j.channel}</Pill>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{j.template}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Started: {j.startedAt}{j.finishedAt && ` · finished ${j.finishedAt}`}</div>
                    </div>
                    <div className="text-right text-xs shrink-0">
                      <div className="font-mono font-semibold tabular-nums">{j.sent.toLocaleString()} / {j.audience.toLocaleString()}</div>
                      <div className="text-muted-foreground">{j.failed} failed</div>
                    </div>
                    {(j.status === "running" || j.status === "queued") && (
                      <button onClick={() => toggle(j.id)} className="p-2 rounded-lg border border-border hover:bg-muted shrink-0">
                        {j.status === "running" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                  <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${j.status === "complete" ? "bg-success" : j.status === "failed" ? "bg-destructive" : "bg-gradient-tenant"}`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </PageCard>
      </section>

      <CommsDialog
        open={open}
        onClose={() => setOpen(false)}
        title="New bulk send"
        subtitle="Job is queued and respects throttle ceiling and per-debtor frequency caps."
        footer={
          <>
            <button onClick={() => setOpen(false)} className={btnSecondary}>Cancel</button>
            <button onClick={create} className={btnPrimary}>Queue job</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Job name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. May reminder blast" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Channel">
              <select className={inputCls} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as Channel, template: templates.find((t) => t.channel === (e.target.value as Channel))?.name ?? "" })}>
                <option value="email">Email</option><option value="sms">SMS</option><option value="voice">Voice</option><option value="letter">Letter</option>
              </select>
            </Field>
            <Field label="Audience size"><input type="number" min={1} className={inputCls} value={form.audience} onChange={(e) => setForm({ ...form, audience: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Template">
            <select className={inputCls} value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })}>
              {templates.filter((t) => t.channel === form.channel).map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </Field>
        </div>
      </CommsDialog>
    </Shell>
  );
}
