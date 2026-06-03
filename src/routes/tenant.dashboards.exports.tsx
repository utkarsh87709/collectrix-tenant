import { createFileRoute } from "@tanstack/react-router";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { dataExports } from "@/lib/dashboards-mock";
import { Database, Plus } from "lucide-react";

export const Route = createFileRoute("/tenant/dashboards/exports")({
  component: Exports,
});

function Exports() {
  return (
    <div className="px-6 lg:px-10 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Pill tone="tenant">US-153 · BI tool integration</Pill>
        <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-tenant text-white text-xs font-semibold"><Plus className="h-3.5 w-3.5" /> New export</button>
      </div>

      <PageCard>
        <CardHead title="Data export streams" subtitle="CSV · Parquet · API · Webhook to Snowflake, Tableau, Power BI" action={<Database className="h-5 w-5 text-tenant" />} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Export</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Destination</th>
                <th className="text-left px-4 py-3">Schedule</th>
                <th className="text-right px-4 py-3">Rows</th>
                <th className="text-left px-4 py-3">Last run</th>
              </tr>
            </thead>
            <tbody>
              {dataExports.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{e.name}</td>
                  <td className="px-4 py-3"><Pill tone="tenant">{e.type}</Pill></td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground truncate max-w-[280px]">{e.destination}</td>
                  <td className="px-4 py-3"><Pill tone="muted">{e.schedule}</Pill></td>
                  <td className="px-4 py-3 text-right">{e.rows ? e.rows.toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.lastRun ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageCard>
    </div>
  );
}
