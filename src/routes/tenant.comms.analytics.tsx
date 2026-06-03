import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, StatTile, Pill } from "@/components/tenant/ui";
import { ArrowLeft, BarChart3, Mail, MessageSquare, Phone, Mailbox, TrendingUp } from "lucide-react";
import { channelKpis, templates } from "@/lib/comms-mock";

export const Route = createFileRoute("/tenant/comms/analytics")({
  head: () => ({ meta: [{ title: "Comms Analytics · Communications" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const top = [...templates].filter((t) => t.openRate !== undefined).sort((a, b) => (b.openRate ?? 0) - (a.openRate ?? 0)).slice(0, 5);

  return (
    <Shell>
      <Topbar
        title="Communications Analytics"
        subtitle="US-055 · US-056 · Per-template & per-channel KPIs · funnel · cohort"
        action={
          <Link to="/tenant/comms" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      <section className="px-6 lg:px-10 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total messages · 30d" value="12,062" icon={<BarChart3 className="h-4 w-4" />} tone="tenant" />
        <StatTile label="Best channel" value="SMS" delta="22% reply rate" icon={<TrendingUp className="h-4 w-4" />} tone="success" />
        <StatTile label="Cost per response" value="$1.84" delta="↓ 12% MoM" />
        <StatTile label="Right party rate" value="43.7%" delta="voice connection efficacy" tone="tenant" />
      </section>

      <section className="px-6 lg:px-10 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PageCard>
          <CardHead title="Channel comparison" subtitle="Sends · engagement · cost" />
          <div className="p-6 space-y-4">
            {[
              { ch: "Email", icon: Mail, sends: channelKpis.email.sends, metric: `${channelKpis.email.open}% open · ${channelKpis.email.click}% click`, tone: "tenant" as const, bar: 100 },
              { ch: "SMS", icon: MessageSquare, sends: channelKpis.sms.sends, metric: `${channelKpis.sms.replyRate}% reply · ${channelKpis.sms.cost}`, tone: "tenant" as const, bar: 145 },
              { ch: "Voice", icon: Phone, sends: channelKpis.voice.attempts, metric: `${channelKpis.voice.connected} RPC · ${channelKpis.voice.avgDuration} avg`, tone: "muted" as const, bar: 33 },
              { ch: "Letter", icon: Mailbox, sends: channelKpis.letter.sends, metric: `${channelKpis.letter.delivered} delivered · ${channelKpis.letter.costPerPiece}`, tone: "muted" as const, bar: 7 },
            ].map((row) => (
              <div key={row.ch}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2 font-semibold"><row.icon className="h-4 w-4 text-tenant" /> {row.ch}</div>
                  <span className="text-xs text-muted-foreground">{row.sends.toLocaleString()} · {row.metric}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-tenant rounded-full" style={{ width: `${Math.min(row.bar, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </PageCard>

        <PageCard>
          <CardHead title="Top performing templates" subtitle="By open rate" />
          <ul className="divide-y divide-border">
            {top.map((t, i) => (
              <li key={t.id} className="px-6 py-3 flex items-center gap-3 text-sm">
                <span className="font-display font-bold text-lg w-6 text-tenant">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.sends30d.toLocaleString()} sends · {t.clickRate}% click · {t.bounceRate}% bounce</div>
                </div>
                <Pill tone="success">{t.openRate}% open</Pill>
              </li>
            ))}
          </ul>
        </PageCard>
      </section>

      <section className="px-6 lg:px-10 pb-6">
        <PageCard>
          <CardHead title="Engagement funnel · email" subtitle="Last 30 days" />
          <div className="p-6 space-y-3">
            {[
              { label: "Sent", value: 4218, pct: 100 },
              { label: "Delivered", value: 4081, pct: 96.7 },
              { label: "Opened", value: 1918, pct: 47.0 },
              { label: "Clicked", value: 449, pct: 11.0 },
              { label: "Resulted in payment", value: 132, pct: 3.1 },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 text-sm">
                <div className="w-32 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="flex-1 h-7 bg-muted rounded-lg overflow-hidden">
                  <div className="h-full bg-gradient-tenant rounded-lg flex items-center justify-end px-3 text-white text-xs font-bold" style={{ width: `${s.pct}%` }}>
                    {s.value.toLocaleString()}
                  </div>
                </div>
                <div className="w-14 text-right text-xs font-mono">{s.pct}%</div>
              </div>
            ))}
          </div>
        </PageCard>
      </section>

      <section className="px-6 lg:px-10 pb-10">
        <PageCard>
          <CardHead title="Time-of-day heatmap · email opens" subtitle="9-11am window dominates · recommend scheduling sends 8:30am" />
          <div className="p-6 grid grid-cols-12 gap-1">
            {Array.from({ length: 12 * 7 }).map((_, i) => {
              const hour = i % 12;
              const intensity = (hour >= 1 && hour <= 3) ? 0.9 : hour < 6 ? 0.55 : 0.25;
              return (
                <div key={i} className="aspect-square rounded" style={{ background: `color-mix(in oklab, var(--tenant) ${intensity * 100}%, transparent)` }} title={`${(8 + hour)}:00`} />
              );
            })}
          </div>
          <div className="px-6 pb-4 text-xs text-muted-foreground flex items-center gap-2">
            <span>8 AM</span><div className="flex-1 h-1.5 rounded bg-gradient-to-r from-muted to-tenant" /><span>8 PM</span>
          </div>
        </PageCard>
      </section>
    </Shell>
  );
}
