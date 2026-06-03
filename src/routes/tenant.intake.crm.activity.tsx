import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { ArrowLeft, Phone, Mail, RefreshCw, FileText, Wallet, Edit3 } from "lucide-react";
import { activityLog } from "@/lib/crm-mock";
import { useState } from "react";

export const Route = createFileRoute("/tenant/intake/crm/activity")({
  head: () => ({ meta: [{ title: "Activity Logging · Tenant Admin" }] }),
  component: ActivityPage,
});

const iconFor = (t: string) => {
  if (t === "ai_call") return Phone;
  if (t === "email") return Mail;
  if (t === "status_change") return RefreshCw;
  if (t === "document") return FileText;
  if (t === "payment") return Wallet;
  return Edit3;
};

function ActivityPage() {
  const [filter, setFilter] = useState<"all" | "platform" | "crm">("all");
  const filtered = activityLog.filter((e) => filter === "all" || e.source === filter);
  return (
    <Shell>
      <Topbar
        title="Activity Logging"
        subtitle="US-038 · Every platform action mirrored to CRM activity log"
        action={
          <Link to="/tenant/intake/crm" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />
      <section className="px-6 lg:px-10 py-6">
        <PageCard>
          <CardHead
            title="Unified activity timeline"
            subtitle="Platform + CRM events, chronological"
            action={
              <div className="flex items-center gap-1 text-xs">
                {(["all", "platform", "crm"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-md font-semibold ${filter === f ? "bg-tenant-soft text-tenant" : "text-muted-foreground hover:text-foreground"}`}>{f}</button>
                ))}
              </div>
            }
          />
          <ul className="divide-y divide-border">
            {filtered.map((e) => {
              const Icon = iconFor(e.type);
              return (
                <li key={e.id} className="px-6 py-4 flex items-start gap-4 text-sm">
                  <div className="h-9 w-9 rounded-xl bg-tenant-soft text-tenant flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{e.debtor}</span>
                      <span className="text-xs text-muted-foreground">· {e.actor}</span>
                      <span className="text-xs text-muted-foreground">· {e.when}</span>
                    </div>
                    <div className="text-sm text-foreground/80 mt-0.5">{e.summary}</div>
                  </div>
                  <Pill tone={e.source === "platform" ? "tenant" : "info"}>{e.source}</Pill>
                  <Pill tone={e.syncedToCrm ? "success" : "warning"}>{e.syncedToCrm ? "synced" : "queued"}</Pill>
                </li>
              );
            })}
          </ul>
        </PageCard>
      </section>
    </Shell>
  );
}
