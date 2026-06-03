import { useMemo } from "react";
import { KPICard } from "./KPICard";
import { ChartCard, CompareBars, TrendArea } from "./Charts";
import { EmptyState } from "./EmptyState";
import { TeamTypeBadge, CategoryBadge } from "./TeamBadges";
import { getTeamKPIs, getTrend } from "@/lib/analytics-mock";
import { tenantTargets } from "@/lib/kpi-targets-store";
import { teams } from "@/lib/tenant-mock";
import type { Filters } from "@/lib/analytics-types";

export function TeamPerformanceTab({ filters }: { filters: Filters }) {
  const filtered = useMemo(() => {
    return teams.filter((t) => {
      if (filters.teamType && filters.teamType !== "all" && t.type !== filters.teamType) return false;
      if (filters.productionCategory && filters.productionCategory !== "all" && t.productionCategory !== filters.productionCategory) return false;
      if (filters.teamId && t.id !== filters.teamId) return false;
      return true;
    });
  }, [filters]);

  if (filtered.length === 0) return <EmptyState reason="no_filter_results" />;

  // If a single team is selected → drill-down view
  if (filters.teamId) {
    const team = filtered[0];
    if (team.type === "support") {
      return (
        <div className="space-y-5">
          <TeamHeader team={team} />
          <EmptyState reason="support_team" />
        </div>
      );
    }
    return <TeamDetail team={team} filters={filters} />;
  }

  const rows = filtered.map((t) => ({ team: t, k: getTeamKPIs(t.id, filters.dateRange) }));
  const production = rows.filter((r) => r.team.type === "production");
  const support = rows.filter((r) => r.team.type === "support");
  const ranked = [...production].sort((a, b) => b.k.amountCollected - a.k.amountCollected);

  return (
    <div className="space-y-6">
      {production.length > 0 ? (
        <ChartCard title="Production team comparison" subtitle="Amount collected this period">
          <CompareBars data={production.map((r) => ({ label: r.team.name, value: r.k.amountCollected }))} name="Collected" />
        </ChartCard>
      ) : (
        <EmptyState reason="no_production_teams" />
      )}

      <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-bold">Team scorecard</h3>
          <span className="text-xs text-muted-foreground">{rows.length} teams</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2">Team</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Category</th>
                <th className="text-right px-4 py-2">Collected</th>
                <th className="text-right px-4 py-2">Recovery</th>
                <th className="text-right px-4 py-2">RPC</th>
                <th className="text-right px-4 py-2">PTP Kept</th>
                <th className="text-right px-4 py-2">Forecast</th>
                <th className="text-right px-4 py-2">QA</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.team.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium">{r.team.name}</td>
                  <td className="px-4 py-2.5"><TeamTypeBadge type={r.team.type} /></td>
                  <td className="px-4 py-2.5"><CategoryBadge category={r.team.productionCategory} /></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">${r.k.amountCollected.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.k.recoveryRate}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.k.rpcRate}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.k.ptpKeptRate}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.k.forecastVsActual}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.k.complianceScore}%</td>
                </tr>
              ))}
              {support.map((r) => (
                <tr key={r.team.id} className="border-t border-border bg-muted/10 text-muted-foreground">
                  <td className="px-4 py-2.5 font-medium">{r.team.name}</td>
                  <td className="px-4 py-2.5"><TeamTypeBadge type={r.team.type} /></td>
                  <td className="px-4 py-2.5"><CategoryBadge category={r.team.productionCategory} /></td>
                  <td className="px-4 py-2.5 text-right text-xs italic" colSpan={6}>
                    Support team — no production KPIs
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TeamHeader({ team }: { team: typeof teams[number] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="font-display text-xl font-bold">{team.name}</h2>
      <TeamTypeBadge type={team.type} />
      <CategoryBadge category={team.productionCategory} />
      <span className="text-xs text-muted-foreground">Leader: {team.leader} · {team.memberCount} members</span>
    </div>
  );
}

function TeamDetail({ team, filters }: { team: typeof teams[number]; filters: Filters }) {
  const k = getTeamKPIs(team.id, filters.dateRange);
  const targets = tenantTargets();
  return (
    <div className="space-y-6">
      <TeamHeader team={team} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Amount Collected"    value={k.amountCollected}     prev={k.amountCollected * 0.93}    suffix="$" target={targets.monthlyCollection} sparkline={getTrend(team.id + "ac", 12, filters.dateRange)} />
        <KPICard label="Recovery Rate"        value={k.recoveryRate}        prev={k.recoveryRate * 0.96}       suffix="%" target={targets.teamRecovery} />
        <KPICard label="Inventory Penetration" value={k.inventoryPenetration} prev={k.inventoryPenetration * 0.95} suffix="%" target={targets.inventoryPenetration} />
        <KPICard label="RPC Rate"             value={k.rpcRate}             prev={k.rpcRate * 0.94}            suffix="%" target={targets.rpc} />
        <KPICard label="PTP Kept Rate"        value={k.ptpKeptRate}         prev={k.ptpKeptRate * 0.97}        suffix="%" target={targets.ptpKept} />
        <KPICard label="Payment Conversion"   value={k.paymentConversion}   prev={k.paymentConversion * 0.96}  suffix="%" />
        <KPICard label="Forecast vs Actual"   value={k.forecastVsActual}    prev={97}                          suffix="%" target={targets.forecast} />
        <KPICard label="Compliance / QA"      value={k.complianceScore}     prev={k.complianceScore * 0.99}    suffix="%" target={targets.qaScore} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Collections trend" subtitle="Period-over-period">
          <TrendArea data={getTrend(team.id + "trend", 12, filters.dateRange)} name="Collections" />
        </ChartCard>
        <ChartCard title="QA / compliance trend" subtitle="Score over time">
          <TrendArea data={getTrend(team.id + "qa", 12, filters.dateRange)} name="Score" />
        </ChartCard>
      </div>
    </div>
  );
}
