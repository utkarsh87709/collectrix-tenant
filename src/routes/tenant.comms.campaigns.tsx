import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, StatTile, Pill } from "@/components/tenant/ui";
import { ArrowLeft, Megaphone, Plus, Play, Pause, Calendar, Users } from "lucide-react";
import { campaigns as seedCampaigns, templates, type Campaign, type Channel } from "@/lib/comms-mock";
import { useState } from "react";
import { toast } from "sonner";
import { CommsDialog, Field, inputCls, btnPrimary, btnSecondary } from "@/components/tenant/CommsDialog";

export const Route = createFileRoute("/tenant/comms/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns · Communications" }] }),
  component: CampaignsPage,
});

const STATUS_TONE: Record<string, "muted"|"tenant"|"success"|"warning"> = {
  draft: "muted", scheduled: "warning", running: "tenant", paused: "muted", complete: "success",
};

function CampaignsPage() {
  const [list, setList] = useState<Campaign[]>(seedCampaigns);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", channel: "email" as Channel | "multi", audience: "", audienceCount: 100, scheduledFor: "" });
  const running = list.filter((c) => c.status === "running").length;

  const toggle = async (id: string) => {
    setList((p) => p.map((c) => c.id === id ? { ...c, status: c.status === "running" ? "paused" : "running" } : c));
    const res = await fetch("/api/comms/schedule", { method: "POST", body: JSON.stringify({ campaignId: id, runAt: new Date().toISOString() }) });
    const data = await res.json();
    toast.success(`Campaign updated · ${data.scheduleId}`);
  };

  const create = () => {
    if (!form.name.trim() || !form.audience.trim()) { toast.error("Name and audience are required"); return; }
    const cmp: Campaign = {
      id: `cmp-${Date.now()}`,
      name: form.name,
      channel: form.channel,
      status: form.scheduledFor ? "scheduled" : "draft",
      audience: form.audience,
      audienceCount: form.audienceCount,
      sent: 0, delivered: 0, responded: 0,
      startedAt: "—",
      scheduledFor: form.scheduledFor || undefined,
    };
    setList((p) => [cmp, ...p]);
    setOpen(false);
    setForm({ name: "", channel: "email", audience: "", audienceCount: 100, scheduledFor: "" });
    toast.success(`Campaign "${cmp.name}" ${cmp.status}`);
  };

  return (
    <Shell>
      <Topbar
        title="Campaigns"
        subtitle="US-049 · Multi-step drip sequences across email · SMS · voice · letter"
        action={
          <Link to="/tenant/comms" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      <section className="px-6 lg:px-10 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total campaigns" value={list.length} icon={<Megaphone className="h-4 w-4" />} tone="tenant" />
        <StatTile label="Running" value={running} delta="auto-progressing steps" tone="success" />
        <StatTile label="Audience reached · 30d" value="4,234" delta="unique customers" icon={<Users className="h-4 w-4" />} />
        <StatTile label="Avg response rate" value="29%" delta="across multi-channel sequences" />
      </section>

      <section className="px-6 lg:px-10 pb-10">
        <PageCard>
          <CardHead
            title="All campaigns"
            subtitle={`${list.length} configured`}
            action={
              <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
                <Plus className="h-4 w-4" /> New campaign
              </button>
            }
          />
          <ul className="divide-y divide-border">
            {list.map((c) => (
              <li key={c.id} className="px-6 py-4 text-sm">
                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-xl bg-tenant-soft text-tenant flex items-center justify-center shrink-0">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold">{c.name}</span>
                      <Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill>
                      <Pill tone="muted">{c.channel}</Pill>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Audience: {c.audience} · {c.audienceCount.toLocaleString()} customers</div>
                    {c.step && <div className="text-xs text-muted-foreground mt-0.5">Current step: <span className="font-semibold text-foreground">{c.step}</span></div>}
                    {c.scheduledFor && <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Calendar className="h-3 w-3" /> Scheduled: {c.scheduledFor}</div>}
                  </div>
                  <div className="text-right text-xs shrink-0">
                    <div className="font-mono font-semibold tabular-nums">{c.sent.toLocaleString()} / {c.audienceCount.toLocaleString()}</div>
                    <div className="text-muted-foreground">{c.delivered} delivered · {c.responded} responded</div>
                  </div>
                  {(c.status === "running" || c.status === "paused" || c.status === "scheduled") && (
                    <button onClick={() => toggle(c.id)} className="p-2 rounded-lg border border-border hover:bg-muted shrink-0" aria-label="Toggle">
                      {c.status === "running" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                  )}
                </div>
                <div className="mt-3 ml-15 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-tenant" style={{ width: `${c.audienceCount === 0 ? 0 : (c.sent / c.audienceCount) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </PageCard>

        <PageCard className="mt-6">
          <CardHead title="Sequence preview · May Statement Cycle" subtitle="Drip with branching by response" />
          <ol className="p-6 space-y-3 text-sm">
            {[
              { day: "Day 0", step: "Email · Initial Contact Email — RBC", status: "complete" },
              { day: "Day 3", step: "SMS · Initial Contact SMS (if no email open)", status: "complete" },
              { day: "Day 7", step: "Email · Payment Reminder — 7 day · + SMS reminder", status: "active" },
              { day: "Day 14", step: "AI Voice · Voice Script — Payment Reminder", status: "pending" },
              { day: "Day 21", step: "Letter · Demand Letter — Pre-Legal", status: "pending" },
              { day: "Day 30", step: "Escalate to legal queue if no response", status: "pending" },
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${s.status === "complete" ? "bg-success text-white" : s.status === "active" ? "bg-gradient-tenant text-white shadow-tenant" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.day}</div>
                  <div className="font-semibold">{s.step}</div>
                </div>
                <Pill tone={s.status === "complete" ? "success" : s.status === "active" ? "tenant" : "muted"}>{s.status}</Pill>
              </li>
            ))}
          </ol>
        </PageCard>
      </section>

      <CommsDialog
        open={open}
        onClose={() => setOpen(false)}
        title="New campaign"
        subtitle="Configure audience and start time. Sequence steps can be edited after creation."
        footer={
          <>
            <button onClick={() => setOpen(false)} className={btnSecondary}>Cancel</button>
            <button onClick={create} className={btnPrimary}>{form.scheduledFor ? "Schedule" : "Save draft"}</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Campaign name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. June Statement Cycle" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Channel">
              <select className={inputCls} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as Channel | "multi" })}>
                <option value="multi">Multi-channel</option><option value="email">Email</option><option value="sms">SMS</option><option value="voice">Voice</option><option value="letter">Letter</option>
              </select>
            </Field>
            <Field label="Audience size"><input type="number" min={1} className={inputCls} value={form.audienceCount} onChange={(e) => setForm({ ...form, audienceCount: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Audience filter" hint="Plain-language description of segment"><input className={inputCls} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="All ACTIVE in Ontario · 30+ DPD" /></Field>
          <Field label="Start at" hint="Leave blank to save as draft"><input type="datetime-local" className={inputCls} value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} /></Field>
        </div>
      </CommsDialog>
    </Shell>
  );
}
