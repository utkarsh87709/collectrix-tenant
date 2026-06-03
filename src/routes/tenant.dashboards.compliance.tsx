import { createFileRoute } from "@tanstack/react-router";
import { StatTile, PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { complianceMetrics as m, complianceReports } from "@/lib/dashboards-mock";
import { ShieldCheck, AlertTriangle, FileText } from "lucide-react";

export const Route = createFileRoute("/tenant/dashboards/compliance")({
  component: Compliance,
});

function Compliance() {
  return (
    <div className="px-6 lg:px-10 py-6 space-y-6">
      <Pill tone="tenant">US-149 · Regulatory packs</Pill>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="After-hours calls"   value={m.callsAfterHours} icon={<ShieldCheck className="h-4 w-4" />} tone="success" />
        <StatTile label="Frequency violations" value={m.frequencyViolations} icon={<AlertTriangle className="h-4 w-4" />} tone={m.frequencyViolations ? "warning" : "success"} />
        <StatTile label="Mini-Miranda rate"   value={`${m.miniMirandaRate}%`} tone="success" />
        <StatTile label="Audit coverage"      value={`${m.auditCoverage}%`} delta="Last 30d" tone="tenant" />
      </div>

      <PageCard>
        <CardHead title="Regulatory report templates" subtitle="FDCPA · Quebec OPC · FCRA" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Report</th>
                <th className="text-left px-4 py-3">Cadence</th>
                <th className="text-left px-4 py-3">Next run</th>
                <th className="text-right px-4 py-3">Recipients</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {complianceReports.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3"><Pill tone="muted">{r.cadence}</Pill></td>
                  <td className="px-4 py-3 text-muted-foreground">{r.nextRun}</td>
                  <td className="px-4 py-3 text-right">{r.recipients}</td>
                  <td className="px-4 py-3 text-right"><button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-xs hover:bg-muted"><FileText className="h-3 w-3" /> Run now</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageCard>
    </div>
  );
}
