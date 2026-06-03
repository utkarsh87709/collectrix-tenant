import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { agents } from "@/lib/dashboards-mock";
import { Trophy } from "lucide-react";
import { DashboardFilters, defaultFilters, activeFilterSummary, type DashboardFilterState } from "@/components/tenant/dashboards/DashboardFilters";

export const Route = createFileRoute("/tenant/dashboards/agents")({
  component: AgentPerf,
});

function AgentPerf() {
  const [filters, setFilters] = useState<DashboardFilterState>(defaultFilters);

  const sorted = useMemo(() => {
    const m = filters.range === "7d" ? 0.25 : filters.range === "90d" ? 2.7 : filters.range === "ytd" ? 4.1 : 1;
    const list = (filters.agentId === "all" ? agents : agents.filter((a) => a.id === filters.agentId))
      .map((a) => ({ ...a, calls: Math.round(a.calls * m), rpc: Math.round(a.rpc * m), ptp: Math.round(a.ptp * m), kept: Math.round(a.kept * m), collected: Math.round(a.collected * m) }));
    return [...list].sort((a, b) => b.collected - a.collected);
  }, [filters]);

  const max = sorted[0]?.collected ?? 1;

  return (
    <div className="px-6 lg:px-10 py-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="tenant">US-146</Pill>
        <span className="text-xs text-muted-foreground">{activeFilterSummary(filters)}</span>
      </div>

      <DashboardFilters value={filters} onChange={setFilters} showCreditor={false} showStatus={false} />

      <PageCard>
        <CardHead title="Leaderboard — Cash collected" subtitle={activeFilterSummary(filters)} action={<Trophy className="h-5 w-5 text-warning" />} />
        <div className="p-6 space-y-3">
          {sorted.length === 0 && <div className="text-sm text-muted-foreground">No agents match the filters.</div>}
          {sorted.map((a, i) => (
            <div key={a.id}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">#{i + 1} · {a.name}</span>
                <span className="font-semibold">${a.collected.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-tenant" style={{ width: `${(a.collected / max) * 100}%` }} />
              </div>
              <div className="flex flex-wrap gap-2 mt-1.5 text-[11px] text-muted-foreground">
                <span>Calls {a.calls}</span><span>· RPC {a.rpc}</span>
                <span>· PTP {a.ptp}/{a.kept} kept{a.ptp > 0 ? ` (${Math.round((a.kept / a.ptp) * 100)}%)` : ""}</span>
                <span>· QA {a.qa}</span>
              </div>
            </div>
          ))}
        </div>
      </PageCard>
    </div>
  );
}
