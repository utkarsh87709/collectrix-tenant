import { createFileRoute } from "@tanstack/react-router";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { scheduledReports } from "@/lib/dashboards-mock";
import { Plus, Mail } from "lucide-react";

export const Route = createFileRoute("/tenant/dashboards/scheduled")({
  component: Scheduled,
});

function Scheduled() {
  return (
    <div className="px-6 lg:px-10 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Pill tone="tenant">US-152 · Automated delivery</Pill>
        <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-tenant text-white text-xs font-semibold"><Plus className="h-3.5 w-3.5" /> New schedule</button>
      </div>

      <PageCard>
        <CardHead title="Scheduled reports" subtitle="PDF · Excel · CSV — emailed automatically" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Report</th>
                <th className="text-left px-4 py-3">Cadence</th>
                <th className="text-left px-4 py-3">Format</th>
                <th className="text-left px-4 py-3">Recipients</th>
                <th className="text-left px-4 py-3">Next run</th>
                <th className="text-left px-4 py-3">Last status</th>
              </tr>
            </thead>
            <tbody>
              {scheduledReports.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3"><Pill tone="muted">{r.cadence}</Pill></td>
                  <td className="px-4 py-3"><Pill tone="tenant">{r.format}</Pill></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground"><Mail className="h-3 w-3 inline mr-1" />{r.recipients.join(", ")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.nextRun}</td>
                  <td className="px-4 py-3"><Pill tone={r.lastStatus === "ok" ? "success" : r.lastStatus === "failed" ? "danger" : "warning"}>{r.lastStatus}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageCard>
    </div>
  );
}
