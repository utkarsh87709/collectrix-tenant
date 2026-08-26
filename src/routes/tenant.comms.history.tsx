import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { ArrowLeft, History as HistoryIcon, Mail, MessageSquare, Phone, Mailbox, Search, Download } from "lucide-react";
import { sendHistory, type Channel } from "@/lib/comms-mock";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/comms/history")({
  head: () => ({ meta: [{ title: "Send History · Communications" }] }),
  component: HistoryPage,
});

const ICON: Record<Channel, typeof Mail> = { email: Mail, sms: MessageSquare, voice: Phone, letter: Mailbox };

function HistoryPage() {
  const [filter, setFilter] = useState<Channel | "all">("all");
  const [q, setQ] = useState("");
  const list = sendHistory.filter((s) => (filter === "all" || s.channel === filter) && (q === "" || s.debtor.toLowerCase().includes(q.toLowerCase()) || s.template.toLowerCase().includes(q.toLowerCase())));

  return (
    <Shell>
      <Topbar
        title="Send History"
        subtitle="US-057 · US-058 · Unified outbound timeline across all channels"
        action={
          <Link to="/tenant/comms" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      <section className="px-6 lg:px-10 py-6">
        <PageCard>
          <CardHead
            title="All outbound events"
            subtitle={`${list.length} matching · 30 days retention shown`}
            action={
              <button onClick={() => toast.success("Export queued — link will arrive by email")} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            }
          />
          <div className="px-6 py-4 border-b border-border flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer or template…" className="bg-transparent text-sm flex-1 outline-none" />
            </div>
            {(["all","email","sms","voice","letter"] as const).map((c) => (
              <button key={c} onClick={() => setFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === c ? "bg-gradient-tenant text-white shadow-tenant" : "bg-muted text-muted-foreground hover:bg-tenant-soft hover:text-tenant"}`}>
                {c}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-border">
            {list.map((s) => {
              const Icon = ICON[s.channel];
              return (
                <li key={s.id} className="px-6 py-3 flex items-center gap-3 text-sm">
                  <div className="h-9 w-9 rounded-lg bg-tenant-soft text-tenant flex items-center justify-center shrink-0"><Icon className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{s.debtor}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.template}{s.detail && ` · ${s.detail}`}</div>
                  </div>
                  <Pill tone={s.status === "delivered" || s.status === "opened" || s.status === "clicked" ? "success" : s.status === "bounced" || s.status === "failed" ? "danger" : s.status === "replied" ? "tenant" : s.status === "unsubscribed" ? "warning" : "muted"}>{s.status}</Pill>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">{s.ts}</span>
                </li>
              );
            })}
          </ul>
          <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
            <HistoryIcon className="h-3.5 w-3.5" />
            Retention: 7 years · customer-level timeline visible on customer profile · webhook-driven status updates
          </div>
        </PageCard>
      </section>
    </Shell>
  );
}
