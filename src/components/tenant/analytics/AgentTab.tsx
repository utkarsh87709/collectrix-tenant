import { useMemo, useState } from "react";
import { KPICard } from "./KPICard";
import { ChartCard, CompareBars } from "./Charts";
import { EmptyState } from "./EmptyState";
import { getAgents } from "@/lib/analytics-mock";
import { tenantTargets } from "@/lib/kpi-targets-store";
import { teams, tenantUsers } from "@/lib/tenant-mock";
import { useDemoRole } from "@/lib/demo-role";
import { analyticsScope } from "@/lib/analytics-permissions";
import type { Filters } from "@/lib/analytics-types";

export function AgentTab({ filters }: { filters: Filters }) {
  const role = useDemoRole();
  const scope = analyticsScope(role);
  const [sortKey, setSortKey] = useState<"amountCollected" | "rpcRate" | "ptpKeptRate" | "qaScore">("amountCollected");

  // Scope filter (self / team / tenant)
  const allAgents = useMemo(() => {
    let list = getAgents(filters.teamId);
    if (filters.role) list = list.filter((a) => a.role === filters.role);
    if (filters.teamId) {
      const tm = teams.find((t) => t.id === filters.teamId);
      if (tm) list = list.map((a) => ({ ...a, team: tm.name, teamType: tm.type }));
    }
    // Hide support-team agents from production analytics
    list = list.filter((a) => a.teamType === "production");

    if (scope === "self") {
      // Mock "me" = first agent user
      const me = tenantUsers.find((u) => u.roles.some((r) => r.toLowerCase().includes("agent")));
      list = me ? list.filter((a) => a.id === me.id) : list.slice(0, 1);
    }
    return list;
  }, [filters, scope]);

  if (allAgents.length === 0) return <EmptyState reason="no_agents_in_team" />;

  const sorted = [...allAgents].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
  const totals = sorted.reduce(
    (acc, a) => ({
      collected: acc.collected + a.amountCollected,
      calls:     acc.calls + a.callsMade,
      rpc:       acc.rpc + a.rpcCount,
      ptp:       acc.ptp + a.ptpCount,
      qa:        acc.qa + a.qaScore,
    }),
    { collected: 0, calls: 0, rpc: 0, ptp: 0, qa: 0 },
  );
  const n = sorted.length;
  const targets = tenantTargets();

  const top10 = sorted.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label={scope === "self" ? "My Collections" : "Agent Collections"} value={totals.collected} prev={totals.collected * 0.93} suffix="$" />
        <KPICard label="Total Calls"    value={totals.calls} prev={totals.calls * 0.95} />
        <KPICard label="Avg RPC / agent" value={+(totals.rpc / n).toFixed(0)} prev={+(totals.rpc / n).toFixed(0) * 0.94} target={targets.rpc} />
        <KPICard label="Avg QA Score"    value={+(totals.qa / n).toFixed(1)} prev={+(totals.qa / n).toFixed(1) * 0.99} suffix="%" target={targets.qaScore} />
      </div>

      {scope !== "self" && (
        <ChartCard title="Top 10 agents — amount collected" subtitle="Period to date">
          <CompareBars data={top10.map((a) => ({ label: a.name, value: a.amountCollected }))} name="Collected" />
        </ChartCard>
      )}

      <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-bold">Agent leaderboard</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Sort by</span>
            <select
              className="px-2 py-1 rounded-md bg-muted border border-border outline-none focus:ring-2 ring-tenant"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
            >
              <option value="amountCollected">Collected</option>
              <option value="rpcRate">RPC Rate</option>
              <option value="ptpKeptRate">PTP Kept</option>
              <option value="qaScore">QA Score</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2 w-10">#</th>
                <th className="text-left px-4 py-2">Agent</th>
                <th className="text-left px-4 py-2">Team</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-right px-4 py-2">Calls</th>
                <th className="text-right px-4 py-2">RPC</th>
                <th className="text-right px-4 py-2">RPC %</th>
                <th className="text-right px-4 py-2">PTP / Kept</th>
                <th className="text-right px-4 py-2">Collected</th>
                <th className="text-right px-4 py-2">QA</th>
                <th className="text-right px-4 py-2">Issues</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a, i) => (
                <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium">{a.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{a.team}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{a.role}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{a.callsMade.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{a.rpcCount}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{a.rpcRate}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{a.ptpCount} · {a.ptpKeptRate}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">${a.amountCollected.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{a.qaScore}%</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${a.complianceIssues > 0 ? "text-warning font-semibold" : ""}`}>{a.complianceIssues}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
