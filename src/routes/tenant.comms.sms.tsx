import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, StatTile, Pill } from "@/components/tenant/ui";
import { ArrowLeft, MessageSquare, Send, DollarSign, Reply } from "lucide-react";
import { channelKpis, templates, sendHistory, replies } from "@/lib/comms-mock";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/comms/sms")({
  head: () => ({ meta: [{ title: "SMS · Communications" }] }),
  component: SmsPage,
});

function SmsPage() {
  const smsTpls = templates.filter((t) => t.channel === "sms");
  const [text, setText] = useState(smsTpls[0]?.preview ?? "");
  const remaining = 160 - text.length;
  const segments = Math.ceil(text.length / 160) || 1;

  const send = async () => {
    const res = await fetch("/api/comms/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "sms", text, recipientCount: 1 }) });
    const data = await res.json();
    toast.success(`SMS queued · ${data.messageId}`);
  };

  return (
    <Shell>
      <Topbar
        title="SMS"
        subtitle="US-047 · US-052 · Two-way SMS · STOP keyword · opt-in audit"
        action={
          <Link to="/tenant/comms" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      <section className="px-6 lg:px-10 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Sent · 30d" value={channelKpis.sms.sends.toLocaleString()} icon={<Send className="h-4 w-4" />} tone="tenant" />
        <StatTile label="Reply rate" value={`${channelKpis.sms.replyRate}%`} icon={<Reply className="h-4 w-4" />} tone="success" />
        <StatTile label="Opt-out rate" value={`${channelKpis.sms.optOut}%`} delta="STOP keyword" tone="warning" />
        <StatTile label="Spend · 30d" value={channelKpis.sms.cost} icon={<DollarSign className="h-4 w-4" />} />
      </section>

      <section className="px-6 lg:px-10 pb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PageCard>
          <CardHead title="Templates" subtitle={`${smsTpls.length} approved`} action={<Link to="/tenant/comms/templates" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-tenant text-white text-xs font-semibold shadow-tenant">+ New SMS template</Link>} />
          <ul className="divide-y divide-border">
            {smsTpls.map((t) => (
              <li key={t.id}>
                <button onClick={() => setText(t.preview)} className="w-full text-left px-6 py-3 hover:bg-muted/50">
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.preview}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{t.replyRate}% reply · {t.cost}/msg</div>
                </button>
              </li>
            ))}
          </ul>
        </PageCard>

        <PageCard className="lg:col-span-2">
          <CardHead title="Compose & preview" subtitle="160 char per segment · variables substituted" />
          <div className="p-6 space-y-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-border bg-muted/30 p-4 text-sm font-mono outline-none focus:border-tenant"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{text.length} chars · {segments} segment{segments > 1 ? "s" : ""} · {remaining < 0 ? `${Math.abs(remaining)} over limit` : `${remaining} left`}</span>
              <span>STOP / HELP keywords auto-handled</span>
            </div>

            <div className="rounded-2xl border border-border bg-muted/30 p-4 max-w-sm">
              <div className="text-[10px] text-muted-foreground mb-2">iMessage preview · +1 (416) 555-0199</div>
              <div className="bg-tenant text-white rounded-2xl rounded-tl-sm px-4 py-2 text-sm">
                {text.replace("{{first_name}}", "Jordan").replace("{{ptp_amount}}", "$500").replace("{{ptp_date}}", "May 1").replace("{{callback_number}}", "(416) 555-0199").replace("{{payment_url}}", "pay.collectrix.ai/8K2P")}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">Reply STOP to unsubscribe</div>
            </div>

            <button onClick={send} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
              <Send className="h-4 w-4" /> Send to selected customers
            </button>
          </div>
        </PageCard>
      </section>

      <section className="px-6 lg:px-10 pb-10 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PageCard>
          <CardHead title="Recent outbound" />
          <ul className="divide-y divide-border">
            {sendHistory.filter((s) => s.channel === "sms").map((s) => (
              <li key={s.id} className="px-6 py-3 flex items-center gap-3 text-sm">
                <MessageSquare className="h-4 w-4 text-tenant" />
                <div className="flex-1 min-w-0"><div className="font-semibold truncate">{s.debtor}</div><div className="text-xs text-muted-foreground truncate">{s.template}</div></div>
                <Pill tone={s.status === "delivered" ? "success" : s.status === "replied" ? "tenant" : s.status === "unsubscribed" ? "warning" : "muted"}>{s.status}</Pill>
              </li>
            ))}
          </ul>
        </PageCard>
        <PageCard>
          <CardHead title="Inbound replies" subtitle="Auto-classified by intent" action={<Link to="/tenant/comms/inbox" className="text-xs font-semibold text-tenant hover:underline">Open inbox →</Link>} />
          <ul className="divide-y divide-border">
            {replies.filter((r) => r.channel === "sms").map((r) => (
              <li key={r.id} className="px-6 py-3 flex items-center gap-3 text-sm">
                {r.unread && <span className="h-2 w-2 rounded-full bg-tenant shrink-0" />}
                <div className="flex-1 min-w-0"><div className="font-semibold truncate">{r.debtor}</div><div className="text-xs text-muted-foreground truncate">“{r.preview}”</div></div>
                <Pill tone={r.intent === "ptp" ? "success" : r.intent === "stop" ? "danger" : r.intent === "dispute" ? "warning" : "tenant"}>{r.intent}</Pill>
              </li>
            ))}
          </ul>
        </PageCard>
      </section>
    </Shell>
  );
}
