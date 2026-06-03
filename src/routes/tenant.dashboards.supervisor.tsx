import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { StatTile, PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { supervisorKpis as k, agents } from "@/lib/dashboards-mock";
import { Headphones, Phone, AlertTriangle, CheckCircle2 } from "lucide-react";
import { DashboardFilters, defaultFilters, activeFilterSummary, type DashboardFilterState } from "@/components/tenant/dashboards/DashboardFilters";

export const Route = createFileRoute("/tenant/dashboards/supervisor")({
  component: Supervisor,
});

function Supervisor() {
  const [filters, setFilters] = useState<DashboardFilterState>(defaultFilters);

  const filteredAgents = useMemo(() => {
    let list = filters.agentId === "all" ? [...agents] : agents.filter((a) => a.id === filters.agentId);
    const m = filters.range === "7d" ? 0.25 : filters.range === "90d" ? 2.7 : filters.range === "ytd" ? 4.1 : 1;
    return list.map((a) => ({
      ...a,
      calls: Math.round(a.calls * m),
      rpc: Math.round(a.rpc * m),
      ptp: Math.round(a.ptp * m),
      kept: Math.round(a.kept * m),
      collected: Math.round(a.collected * m),
    }));
  }, [filters]);

  const collected = filteredAgents.reduce((s, a) => s + a.collected, 0);

  return (
    <div className="px-6 lg:px-10 py-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="tenant">US-145 · Real-time</Pill>
        <span className="text-xs text-muted-foreground">{activeFilterSummary(filters)}</span>
      </div>

      <DashboardFilters value={filters} onChange={setFilters} showCreditor={false} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Agents shown"      value={`${filteredAgents.length}/${agents.length}`} icon={<Headphones className="h-4 w-4" />} tone="tenant" />
        <StatTile label="Calls in progress" value={k.callsInProgress} delta={`Queue ${k.queueDepth}`} icon={<Phone className="h-4 w-4" />} />
        <StatTile label="Collected"         value={"$" + collected.toLocaleString()} delta={activeFilterSummary(filters)} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <StatTile label="SLA breaches"      value={k.slaBreaches} icon={<AlertTriangle className="h-4 w-4" />} tone={k.slaBreaches > 0 ? "warning" : "default"} />
      </div>

      <PageCard>
        <CardHead title="Live team workload" subtitle={activeFilterSummary(filters)} action={<Pill tone="success">Auto-refresh 30s</Pill>} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Agent</th>
                <th className="text-right px-4 py-3">Calls</th>
                <th className="text-right px-4 py-3">RPC</th>
                <th className="text-right px-4 py-3">PTP</th>
                <th className="text-right px-4 py-3">Collected</th>
                <th className="text-right px-4 py-3">QA</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((a) => (
                <tr key={a.id} className="border-t border-border hover:bg-muted/30 cursor-pointer">
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3 text-right">{a.calls}</td>
                  <td className="px-4 py-3 text-right">{a.rpc}</td>
                  <td className="px-4 py-3 text-right">{a.ptp} <span className="text-xs text-muted-foreground">/{a.kept} kept</span></td>
                  <td className="px-4 py-3 text-right font-semibold">${a.collected.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right"><Pill tone={a.qa >= 92 ? "success" : "warning"}>{a.qa}</Pill></td>
                </tr>
              ))}
              {filteredAgents.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No agents match the filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PageCard>
    </div>
  );
}
