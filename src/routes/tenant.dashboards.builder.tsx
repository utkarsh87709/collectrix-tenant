import { createFileRoute } from "@tanstack/react-router";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { customReports } from "@/lib/dashboards-mock";
import { Plus, Save } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/tenant/dashboards/builder")({
  component: Builder,
});

const METRICS = ["Recovery %", "Calls", "RPC", "PTP", "Kept PTP", "Collected $", "QA score", "Disputes", "After-hours", "Cost-to-collect"];
const FILTERS = ["Date range", "Creditor", "Team", "Agent", "Jurisdiction", "Language", "Status", "Balance band"];

function Builder() {
  const [picked, setPicked] = useState<string[]>(["Recovery %", "Collected $"]);
  const toggle = (m: string) => setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));

  return (
    <div className="px-6 lg:px-10 py-6 space-y-6">
      <Pill tone="tenant">US-151 · Custom report builder</Pill>

      <div className="grid lg:grid-cols-3 gap-4">
        <PageCard className="lg:col-span-2">
          <CardHead title="New report" subtitle="Pick metrics and filters, preview, save & share" action={
            <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-tenant text-white text-xs font-semibold"><Save className="h-3.5 w-3.5" /> Save report</button>
          } />
          <div className="p-6 space-y-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Metrics</div>
              <div className="flex flex-wrap gap-2">
                {METRICS.map((m) => (
                  <button key={m} onClick={() => toggle(m)} className={`px-3 py-1.5 rounded-lg text-xs border transition ${picked.includes(m) ? "bg-gradient-tenant text-white border-transparent" : "border-border hover:bg-muted"}`}>{m}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Filters</div>
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <span key={f} className="px-3 py-1.5 rounded-lg text-xs border border-border bg-muted/40 cursor-pointer hover:bg-muted">+ {f}</span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Preview · {picked.length} metric{picked.length !== 1 ? "s" : ""} selected — {picked.join(" · ") || "none"}
            </div>
          </div>
        </PageCard>

        <PageCard>
          <CardHead title="Saved reports" action={<button className="text-tenant text-xs font-semibold inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> New</button>} />
          <ul className="p-3 space-y-2">
            {customReports.map((r) => (
              <li key={r.id} className="p-3 rounded-lg border border-border hover:border-tenant cursor-pointer">
                <div className="font-semibold text-sm">{r.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">By {r.owner} · {r.lastRun ?? "never run"}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {r.metrics.map((m) => <Pill key={m} tone="tenant">{m}</Pill>)}
                </div>
              </li>
            ))}
          </ul>
        </PageCard>
      </div>
    </div>
  );
}
