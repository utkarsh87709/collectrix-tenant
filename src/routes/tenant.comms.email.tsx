import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, StatTile, Pill } from "@/components/tenant/ui";
import { ArrowLeft, Mail, Send, Eye, MousePointerClick, AlertTriangle, Calendar } from "lucide-react";
import { channelKpis, templates, sendHistory } from "@/lib/comms-mock";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/comms/email")({
  head: () => ({ meta: [{ title: "Email · Communications" }] }),
  component: EmailPage,
});

function EmailPage() {
  const emailTemplates = templates.filter((t) => t.channel === "email");
  const [selected, setSelected] = useState(emailTemplates[0]);
  const emailSends = sendHistory.filter((s) => s.channel === "email");

  const send = async () => {
    const res = await fetch("/api/comms/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "email", templateId: selected.id, recipientCount: 1 }) });
    const data = await res.json();
    toast.success(`Email queued · ${data.messageId}`);
  };

  return (
    <Shell>
      <Topbar
        title="Email"
        subtitle="US-046 · Builder · preview · delivery & engagement tracking"
        action={
          <Link to="/tenant/comms" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      <section className="px-6 lg:px-10 py-6 grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile label="Sent · 30d" value={channelKpis.email.sends.toLocaleString()} icon={<Send className="h-4 w-4" />} tone="tenant" />
        <StatTile label="Delivered" value={`${((channelKpis.email.delivered/channelKpis.email.sends)*100).toFixed(1)}%`} delta={`${channelKpis.email.delivered.toLocaleString()} inboxed`} tone="success" />
        <StatTile label="Open rate" value={`${channelKpis.email.open}%`} icon={<Eye className="h-4 w-4" />} tone="success" />
        <StatTile label="Click rate" value={`${channelKpis.email.click}%`} icon={<MousePointerClick className="h-4 w-4" />} />
        <StatTile label="Bounce rate" value={`${channelKpis.email.bounce}%`} delta={`unsub ${channelKpis.email.unsub}%`} icon={<AlertTriangle className="h-4 w-4" />} tone="warning" />
      </section>

      <section className="px-6 lg:px-10 pb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PageCard className="lg:col-span-1">
          <CardHead title="Templates" subtitle={`${emailTemplates.length} active`} />
          <ul className="divide-y divide-border max-h-[420px] overflow-y-auto">
            {emailTemplates.map((t) => (
              <li key={t.id}>
                <button onClick={() => setSelected(t)} className={`w-full text-left px-6 py-3 hover:bg-muted/50 ${selected.id === t.id ? "bg-tenant-soft" : ""}`}>
                  <div className="font-semibold text-sm truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.subject}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{t.openRate}% open · {t.clickRate}% click · {t.sends30d} sends</div>
                </button>
              </li>
            ))}
          </ul>
        </PageCard>

        <PageCard className="lg:col-span-2">
          <CardHead
            title="Preview & send"
            subtitle="Variables substituted with sample customer"
            action={
              <div className="flex items-center gap-2">
                <button onClick={() => toast.message("Schedule dialog")} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted">
                  <Calendar className="h-3.5 w-3.5" /> Schedule
                </button>
                <button onClick={send} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-xs font-semibold shadow-tenant">
                  <Send className="h-3.5 w-3.5" /> Send now
                </button>
              </div>
            }
          />
          <div className="p-6">
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-muted/40 px-4 py-3 text-xs space-y-1">
                <div><span className="text-muted-foreground">From:</span> <span className="font-mono">collections@apex-recovery.com</span></div>
                <div><span className="text-muted-foreground">To:</span> <span className="font-mono">jordan.reyes@example.com</span></div>
                <div><span className="text-muted-foreground">Subject:</span> <span className="font-semibold">{selected.subject?.replace("{{account_number}}", "ACC-104822")}</span></div>
              </div>
              <div className="p-6 bg-card text-sm leading-relaxed">
                <p>Dear Jordan Reyes,</p>
                <p className="mt-3">{selected.preview.replace("{{debtor_name}}", "Jordan Reyes").replace("{{balance}}", "$2,418.55").replace("{{creditor_client_name}}", "Royal Bank of Canada").replace("{{settlement_offer_amount}}", "$1,450.00").replace("{{due_date}}", "May 1, 2026")}</p>
                <p className="mt-4">
                  <a href="#" className="inline-block px-4 py-2 rounded-lg bg-gradient-tenant text-white font-semibold no-underline">Pay now →</a>
                </p>
                <p className="mt-6 text-xs text-muted-foreground border-t border-border pt-3">This communication is from a debt collector. Unsubscribe · Manage preferences · Reply STOP to opt out</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground flex flex-wrap gap-3">
              <span>Unsubscribe footer auto-appended (CAN-SPAM)</span>
              <span>DNC list pre-checked</span>
              <span>Rate-limit honoured (max 3/day)</span>
            </div>
          </div>
        </PageCard>
      </section>

      <section className="px-6 lg:px-10 pb-10">
        <PageCard>
          <CardHead title="Recent email events" subtitle="From provider webhook · real-time" />
          <ul className="divide-y divide-border">
            {emailSends.map((s) => (
              <li key={s.id} className="px-6 py-3 flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-tenant" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{s.template} → {s.debtor}</div>
                  {s.detail && <div className="text-xs text-muted-foreground truncate">{s.detail}</div>}
                </div>
                <Pill tone={s.status === "opened" || s.status === "clicked" || s.status === "delivered" ? "success" : s.status === "bounced" || s.status === "failed" ? "danger" : "muted"}>{s.status}</Pill>
                <span className="text-xs text-muted-foreground tabular-nums">{s.ts.split(" ")[1]}</span>
              </li>
            ))}
          </ul>
        </PageCard>
      </section>
    </Shell>
  );
}
