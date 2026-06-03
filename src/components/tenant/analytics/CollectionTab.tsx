import { useMemo } from "react";
import { KPICard } from "./KPICard";
import { ChartCard, CompareBars, TrendArea } from "./Charts";
import { EmptyState } from "./EmptyState";
import { getTeamKPIs, getTrend } from "@/lib/analytics-mock";
import { tenantTargets } from "@/lib/kpi-targets-store";
import { teams } from "@/lib/tenant-mock";
import type { Filters } from "@/lib/analytics-types";

export function CollectionTab({ filters, tenantId }: { filters: Filters; tenantId: string }) {
  const collectionTeams = useMemo(
    () => teams.filter((t) => t.type === "production" && t.productionCategory === "collection"
      && (!filters.teamId || t.id === filters.teamId)),
    [filters.teamId]
  );

  if (collectionTeams.length === 0) return <EmptyState reason="no_collection_production" />;

  const rows = collectionTeams.map((t) => ({ team: t, k: getTeamKPIs(t.id, filters.dateRange) }));
  const totals = rows.reduce(
    (acc, r) => ({
      amountCollected: acc.amountCollected + r.k.amountCollected,
      recoveryRate: acc.recoveryRate + r.k.recoveryRate,
      rpcRate: acc.rpcRate + r.k.rpcRate,
      ptpKeptRate: acc.ptpKeptRate + r.k.ptpKeptRate,
      paymentConversion: acc.paymentConversion + r.k.paymentConversion,
      inventoryPenetration: acc.inventoryPenetration + r.k.inventoryPenetration,
    }),
    { amountCollected: 0, recoveryRate: 0, rpcRate: 0, ptpKeptRate: 0, paymentConversion: 0, inventoryPenetration: 0 },
  );
  const n = rows.length;
  const avg = (v: number) => +(v / n).toFixed(1);
  const targets = tenantTargets();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Collected (Collection)"  value={totals.amountCollected}        prev={totals.amountCollected * 0.93} suffix="$" target={targets.monthlyCollection} sparkline={getTrend(tenantId + "col-ac", 12, filters.dateRange)} />
        <KPICard label="Avg Recovery Rate"        value={avg(totals.recoveryRate)}      prev={avg(totals.recoveryRate) * 0.96} suffix="%" target={targets.teamRecovery} />
        <KPICard label="Avg RPC Rate"             value={avg(totals.rpcRate)}           prev={avg(totals.rpcRate) * 0.94} suffix="%" target={targets.rpc} />
        <KPICard label="Avg PTP Kept"             value={avg(totals.ptpKeptRate)}       prev={avg(totals.ptpKeptRate) * 0.97} suffix="%" target={targets.ptpKept} />
        <KPICard label="Payment Conversion"       value={avg(totals.paymentConversion)} prev={avg(totals.paymentConversion) * 0.96} suffix="%" />
        <KPICard label="Inventory Penetration"    value={avg(totals.inventoryPenetration)} prev={avg(totals.inventoryPenetration) * 0.95} suffix="%" target={targets.inventoryPenetration} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Collection trend" subtitle="Amounts recovered over time">
          <TrendArea data={getTrend(tenantId + "col-trend", 12, filters.dateRange)} name="Collected" />
        </ChartCard>
        <ChartCard title="Collection team comparison" subtitle="Amount collected">
          <CompareBars data={rows.map((r) => ({ label: r.team.name, value: r.k.amountCollected }))} name="Collected" />
        </ChartCard>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
        <div className="px-5 py-4 border-b border-border"><h3 className="text-sm font-bold">Collection teams</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2">Team</th>
                <th className="text-right px-4 py-2">Collected</th>
                <th className="text-right px-4 py-2">Recovery</th>
                <th className="text-right px-4 py-2">RPC</th>
                <th className="text-right px-4 py-2">PTP Kept</th>
                <th className="text-right px-4 py-2">Conversion</th>
                <th className="text-right px-4 py-2">Penetration</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.team.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium">{r.team.name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">${r.k.amountCollected.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.k.recoveryRate}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.k.rpcRate}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.k.ptpKeptRate}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.k.paymentConversion}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.k.inventoryPenetration}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
