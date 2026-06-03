import { useMemo } from "react";
import { KPICard } from "./KPICard";
import { ChartCard, CompareBars, TrendArea } from "./Charts";
import { EmptyState } from "./EmptyState";
import { getTeamKPIs, getTrend } from "@/lib/analytics-mock";
import { tenantTargets } from "@/lib/kpi-targets-store";
import { teams } from "@/lib/tenant-mock";
import type { Filters } from "@/lib/analytics-types";

export function LegalTab({ filters, tenantId }: { filters: Filters; tenantId: string }) {
  const legalTeams = useMemo(
    () => teams.filter((t) => t.type === "production" && t.productionCategory === "legal"
      && (!filters.teamId || t.id === filters.teamId)),
    [filters.teamId]
  );

  if (legalTeams.length === 0) return <EmptyState reason="no_legal_production" />;

  const rows = legalTeams.map((t) => ({ team: t, k: getTeamKPIs(t.id, filters.dateRange) }));
  const totals = rows.reduce(
    (acc, r) => ({
      amountCollected: acc.amountCollected + r.k.amountCollected,
      legalRecoveryRate: acc.legalRecoveryRate + r.k.legalRecoveryRate,
      recoveryRate: acc.recoveryRate + r.k.recoveryRate,
      complianceScore: acc.complianceScore + r.k.complianceScore,
      forecastVsActual: acc.forecastVsActual + r.k.forecastVsActual,
    }),
    { amountCollected: 0, legalRecoveryRate: 0, recoveryRate: 0, complianceScore: 0, forecastVsActual: 0 },
  );
  const n = rows.length;
  const avg = (v: number) => +(v / n).toFixed(1);
  const targets = tenantTargets();

  // Mock funnel: filings → judgments → garnishments → recovered
  const filings = Math.round(totals.amountCollected / 1800);
  const funnel = [
    { label: "Filings",      value: filings },
    { label: "Judgments",    value: Math.round(filings * 0.62) },
    { label: "Garnishments", value: Math.round(filings * 0.38) },
    { label: "Recovered",    value: Math.round(filings * 0.24) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Legal Amount Recovered" value={totals.amountCollected} prev={totals.amountCollected * 0.94} suffix="$" sparkline={getTrend(tenantId + "lgl-ac", 12, filters.dateRange)} />
        <KPICard label="Legal Recovery Rate"   value={avg(totals.legalRecoveryRate)} prev={avg(totals.legalRecoveryRate) * 0.96} suffix="%" target={targets.legalRecovery} />
        <KPICard label="Overall Recovery"      value={avg(totals.recoveryRate)}      prev={avg(totals.recoveryRate) * 0.97} suffix="%" target={targets.teamRecovery} />
        <KPICard label="Compliance Score"      value={avg(totals.complianceScore)}   prev={avg(totals.complianceScore) * 0.99} suffix="%" target={targets.complianceThreshold} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Legal funnel" subtitle="Filings → Recovered">
          <CompareBars data={funnel} name="Count" />
        </ChartCard>
        <ChartCard title="Legal recovery trend" subtitle="Amounts recovered over time">
          <TrendArea data={getTrend(tenantId + "lgl-trend", 12, filters.dateRange)} name="Recovered" />
        </ChartCard>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
        <div className="px-5 py-4 border-b border-border"><h3 className="text-sm font-bold">Legal teams</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2">Team</th>
                <th className="text-right px-4 py-2">Recovered</th>
                <th className="text-right px-4 py-2">Legal Recovery</th>
                <th className="text-right px-4 py-2">Forecast</th>
                <th className="text-right px-4 py-2">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.team.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium">{r.team.name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">${r.k.amountCollected.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.k.legalRecoveryRate}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.k.forecastVsActual}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.k.complianceScore}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
