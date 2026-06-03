import { useMemo } from "react";
import { KPICard } from "./KPICard";
import { ChartCard, TrendArea, CompareLines, CompareBars } from "./Charts";
import { EmptyState } from "./EmptyState";
import { getTenantKPIs, getTrend, getTeamKPIs } from "@/lib/analytics-mock";
import { tenantTargets } from "@/lib/kpi-targets-store";
import { teams } from "@/lib/tenant-mock";
import type { Filters } from "@/lib/analytics-types";

export function OverviewTab({ filters, tenantId }: { filters: Filters; tenantId: string }) {
  const k = useMemo(() => getTenantKPIs(tenantId, filters), [tenantId, filters]);
  const targets = tenantTargets();
  const productionTeams = useMemo(() => teams.filter((t) => t.type === "production"
    && (!filters.productionCategory || filters.productionCategory === "all" || t.productionCategory === filters.productionCategory)),
    [filters.productionCategory]);

  if (!k || productionTeams.length === 0) {
    return <EmptyState reason="no_production_teams" />;
  }

  const teamKpis = productionTeams.map((t) => ({ team: t, k: getTeamKPIs(t.id, filters.dateRange) }));
  const ranked = [...teamKpis].sort((a, b) => b.k.amountCollected - a.k.amountCollected);
  const top = ranked.slice(0, 3);
  const bottom = [...ranked].reverse().slice(0, 3);

  const creditors = [
    { label: "Creditor A", value: Math.round(k.amountCollected * 0.42) },
    { label: "Creditor B", value: Math.round(k.amountCollected * 0.31) },
    { label: "Creditor C", value: Math.round(k.amountCollected * 0.27) },
  ];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KPICard label="Total Amount Collected"    value={k.amountCollected}     prev={k.amountCollected * 0.92}   suffix="$" sparkline={getTrend(tenantId + "ac", 12, filters.dateRange)} tooltip="Gross dollars posted across production teams" target={targets.monthlyCollection} />
        <KPICard label="Net Recovery Rate"          value={k.recoveryRate}        prev={k.recoveryRate * 0.96}      suffix="%"  tooltip="Net recovered / placed inventory" target={targets.teamRecovery} />
        <KPICard label="Inventory Penetration"      value={k.inventoryPenetration} prev={k.inventoryPenetration * 0.94} suffix="%" tooltip="Accounts worked / accounts assigned" target={targets.inventoryPenetration} />
        <KPICard label="RPC Rate"                   value={k.rpcRate}             prev={k.rpcRate * 0.93}           suffix="%"  tooltip="Right party contact rate" target={targets.rpc} />
        <KPICard label="PTP Kept Rate"              value={k.ptpKeptRate}         prev={k.ptpKeptRate * 0.98}       suffix="%"  tooltip="Promises to pay kept / total PTPs" target={targets.ptpKept} />
        <KPICard label="Payment Conversion Rate"    value={k.paymentConversion}   prev={k.paymentConversion * 0.97} suffix="%"  tooltip="Payments captured / qualified contacts" />
        <KPICard label="Legal Recovery Rate"        value={k.legalRecoveryRate}   prev={k.legalRecoveryRate * 1.02} suffix="%"  tooltip="Recovery on legal-status inventory" target={targets.legalRecovery} />
        <KPICard label="Productivity per FTE"       value={k.productivityFTE}     prev={k.productivityFTE * 0.95}   suffix="$"  tooltip="Collections divided by full-time equivalents" />
        <KPICard label="Forecast vs Actual"         value={k.forecastVsActual}    prev={97}                          suffix="%"  tooltip="% of forecast attained" target={targets.forecast} />
        <KPICard label="Compliance / QA Score"      value={k.complianceScore}     prev={k.complianceScore * 0.99}   suffix="%"  tooltip="Composite quality + compliance score" target={targets.qaScore} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Collections trend"        subtitle="Period-over-period">  <TrendArea data={getTrend(tenantId + "col", 12, filters.dateRange)} name="Collections" /></ChartCard>
        <ChartCard title="Recovery rate trend"      subtitle="Net recovery %">      <TrendArea data={getTrend(tenantId + "rec", 12, filters.dateRange)} name="Recovery %" /></ChartCard>
        <ChartCard title="Forecast vs actual"       subtitle="Plan vs realized">    <CompareLines data={getTrend(tenantId + "fc", 12, filters.dateRange)} currentName="Actual" prevName="Forecast" /></ChartCard>
        <ChartCard title="Collection vs legal recovery" subtitle="Recovery split">  <CompareBars data={[
          { label: "Collection", value: Math.round(k.amountCollected * 0.78) },
          { label: "Legal",      value: Math.round(k.amountCollected * 0.22) },
        ]} name="Amount" /></ChartCard>
        <ChartCard title="Production team comparison" subtitle="Amount collected">  <CompareBars data={teamKpis.map((x) => ({ label: x.team.name, value: x.k.amountCollected }))} name="Collected" /></ChartCard>
        <ChartCard title="Compliance / QA trend"     subtitle="Score over time">    <TrendArea data={getTrend(tenantId + "qa", 12, filters.dateRange)} name="Score" /></ChartCard>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankTable title="Top performing teams"          rows={top}    tone="success" />
        <RankTable title="Underperforming teams"         rows={bottom} tone="warning" />
        <CreditorTable rows={creditors} />
        <ContributorsTable rows={ranked.slice(0, 5)} total={k.amountCollected} />
      </div>
    </div>
  );
}

function RankTable({ title, rows, tone }: { title: string; rows: Array<{ team: { id: string; name: string }; k: { amountCollected: number; recoveryRate: number } }>; tone: "success" | "warning" }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-bold">{title}</h3>
        <span className={`text-xs ${tone === "success" ? "text-success" : "text-warning"} font-semibold`}>{tone === "success" ? "Above target" : "Below target"}</span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40">
          <tr><th className="text-left px-5 py-2">Team</th><th className="text-right px-5 py-2">Collected</th><th className="text-right px-5 py-2">Recovery</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team.id} className="border-t border-border">
              <td className="px-5 py-2.5 font-medium">{r.team.name}</td>
              <td className="px-5 py-2.5 text-right tabular-nums">${r.k.amountCollected.toLocaleString()}</td>
              <td className="px-5 py-2.5 text-right tabular-nums">{r.k.recoveryRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreditorTable({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
      <div className="px-5 py-4 border-b border-border"><h3 className="text-sm font-bold">Creditor / creditor performance</h3></div>
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40">
          <tr><th className="text-left px-5 py-2">Creditor</th><th className="text-right px-5 py-2">Collected</th><th className="text-right px-5 py-2">Share</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-border">
              <td className="px-5 py-2.5 font-medium">{r.label}</td>
              <td className="px-5 py-2.5 text-right tabular-nums">${r.value.toLocaleString()}</td>
              <td className="px-5 py-2.5 text-right tabular-nums">{((r.value / total) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContributorsTable({ rows, total }: { rows: Array<{ team: { id: string; name: string }; k: { amountCollected: number } }>; total: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
      <div className="px-5 py-4 border-b border-border"><h3 className="text-sm font-bold">Top performer contribution</h3></div>
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40">
          <tr><th className="text-left px-5 py-2">Team</th><th className="text-right px-5 py-2">Collected</th><th className="text-right px-5 py-2">% of total</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team.id} className="border-t border-border">
              <td className="px-5 py-2.5 font-medium">{r.team.name}</td>
              <td className="px-5 py-2.5 text-right tabular-nums">${r.k.amountCollected.toLocaleString()}</td>
              <td className="px-5 py-2.5 text-right tabular-nums">{((r.k.amountCollected / total) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
