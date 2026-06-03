import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, StatTile, Pill } from "@/components/tenant/ui";
import { ArrowLeft, Shield, ShieldAlert, Ban, Clock, Trash2 } from "lucide-react";
import { complianceEvents, dncList } from "@/lib/comms-mock";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/comms/compliance")({
  head: () => ({ meta: [{ title: "Compliance & DNC · Communications" }] }),
  component: CompliancePage,
});

const SEVERITY_TONE: Record<string, "muted"|"warning"|"danger"> = { info: "muted", warning: "warning", critical: "danger" };

function CompliancePage() {
  const [dnc, setDnc] = useState(dncList);
  const critical = complianceEvents.filter((e) => e.severity === "critical").length;

  return (
    <Shell>
      <Topbar
        title="Compliance & DNC"
        subtitle="US-053 · Rate limits · DNC · cease & desist · audit trail"
        action={
          <Link to="/tenant/comms" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      <section className="px-6 lg:px-10 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="DNC entries" value={dnc.length} delta="across all channels" icon={<Ban className="h-4 w-4" />} tone="tenant" />
        <StatTile label="Events · 7d" value={complianceEvents.length} delta="rate-limit + DNC blocks" icon={<Shield className="h-4 w-4" />} />
        <StatTile label="Critical" value={critical} delta="cease & desist · investigations" tone={critical > 0 ? "danger" : "success"} icon={<ShieldAlert className="h-4 w-4" />} />
        <StatTile label="Calling window" value="8am–9pm" delta="local debtor time · enforced" icon={<Clock className="h-4 w-4" />} />
      </section>

      <section className="px-6 lg:px-10 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PageCard>
          <CardHead title="Rate limits & windows" subtitle="Per-debtor caps prevent over-contact" />
          <div className="p-6 space-y-3 text-sm">
            {[
              { label: "Email · max per day", value: "3" },
              { label: "Email · max per week", value: "10" },
              { label: "SMS · max per day", value: "2" },
              { label: "Voice · max per day", value: "1" },
              { label: "Voice · min hours between calls", value: "12" },
              { label: "Letter · max per month", value: "2" },
              { label: "Combined contacts · max per week", value: "7" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <span>{r.label}</span>
                <span className="font-mono font-bold text-tenant">{r.value}</span>
              </div>
            ))}
          </div>
        </PageCard>

        <PageCard>
          <CardHead title="Recent compliance events" subtitle="Auto-blocked attempts · audit retained" />
          <ul className="divide-y divide-border">
            {complianceEvents.map((e) => (
              <li key={e.id} className="px-6 py-3 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <Pill tone={SEVERITY_TONE[e.severity]}>{e.severity}</Pill>
                  <Pill tone="muted">{e.type.replace("_"," ")}</Pill>
                  <Pill tone="muted">{e.channel}</Pill>
                  <span className="text-xs text-muted-foreground ml-auto tabular-nums">{e.ts}</span>
                </div>
                <div className="font-semibold mt-1">{e.debtor}</div>
                <div className="text-xs text-muted-foreground">{e.detail}</div>
              </li>
            ))}
          </ul>
        </PageCard>
      </section>

      <section className="px-6 lg:px-10 pb-10">
        <PageCard>
          <CardHead
            title="Do-Not-Contact list"
            subtitle="System-wide · honoured by all channels & campaigns"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
                <tr>
                  <th className="text-left px-6 py-3">Debtor</th>
                  <th className="text-left px-3 py-3">Channel</th>
                  <th className="text-left px-3 py-3">Reason</th>
                  <th className="text-left px-3 py-3">Added</th>
                  <th className="text-left px-3 py-3">By</th>
                  <th className="text-right px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dnc.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-6 py-3 font-semibold">{d.debtor}</td>
                    <td className="px-3 py-3"><Pill tone={d.channel === "all" ? "danger" : "warning"}>{d.channel}</Pill></td>
                    <td className="px-3 py-3 text-xs">{d.reason}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{d.addedAt}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{d.addedBy}</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => { setDnc((p) => p.filter((x) => x.id !== d.id)); toast.success("Removed from DNC (logged to audit)"); }} className="text-xs font-semibold text-destructive hover:underline inline-flex items-center gap-1">
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageCard>
      </section>
    </Shell>
  );
}
