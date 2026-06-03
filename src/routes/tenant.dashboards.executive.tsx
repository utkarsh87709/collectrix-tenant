import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { StatTile, PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { executiveKpis as base, creditorTrend, fmt, creditors } from "@/lib/dashboards-mock";
import { Wallet, TrendingUp, Activity, Target, Download, FileSpreadsheet } from "lucide-react";
import { DashboardFilters, defaultFilters, activeFilterSummary, type DashboardFilterState } from "@/components/tenant/dashboards/DashboardFilters";

export const Route = createFileRoute("/tenant/dashboards/executive")({
  component: Executive,
});

// Naive scaling so filters visibly affect KPIs in the mock
function scale(filters: DashboardFilterState) {
  let m = 1;
  if (filters.range === "7d") m *= 0.25;
  else if (filters.range === "90d") m *= 2.7;
  else if (filters.range === "ytd") m *= 4.1;
  if (filters.creditorId !== "all") {
    const p = creditors.find((x) => x.id === filters.creditorId);
    if (p) m *= p.balance / base.totalBalance;
  }
  if (filters.status === "ptp" || filters.status === "active") m *= 0.6;
  if (filters.status === "settled") m *= 0.2;
  if (filters.status === "legal") m *= 0.08;
  return m;
}

function Executive() {
  const [filters, setFilters] = useState<DashboardFilterState>(defaultFilters);
  const k = useMemo(() => {
    const m = scale(filters);
    return {
      totalAccounts: Math.round(base.totalAccounts * m),
      activeAccounts: Math.round(base.activeAccounts * m),
      totalBalance: Math.round(base.totalBalance * m),
      recoveryRate: Math.max(0, Math.min(100, base.recoveryRate + (filters.status === "settled" ? 12 : filters.status === "legal" ? -8 : 0))),
      roi: base.roi * (filters.status === "legal" ? 0.5 : 1),
      costPerDollar: base.costPerDollar,
      forecastNext30: Math.round(base.forecastNext30 * m),
    };
  }, [filters]);

  const trend = useMemo(() => {
    const m = scale(filters);
    return creditorTrend.map((p) => ({ ...p, value: +(p.value * m).toFixed(2) }));
  }, [filters]);
  const max = Math.max(...trend.map((p) => p.value), 0.01);

  return (
    <div className="px-6 lg:px-10 py-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="tenant">US-144</Pill>
        <span className="text-xs text-muted-foreground">{activeFilterSummary(filters)}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted"><Download className="h-3.5 w-3.5" /> Export PDF</button>
          <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted"><FileSpreadsheet className="h-3.5 w-3.5" /> Excel</button>
        </div>
      </div>

      <DashboardFilters value={filters} onChange={setFilters} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total accounts"  value={k.totalAccounts.toLocaleString()} delta={`${k.activeAccounts.toLocaleString()} active`} icon={<Wallet className="h-4 w-4" />} tone="tenant" />
        <StatTile label="Creditor AUM"   value={fmt.money(k.totalBalance)} delta={k.totalAccounts > 0 ? `Avg ${fmt.money(Math.round(k.totalBalance / k.totalAccounts))}/acct` : "—"} icon={<TrendingUp className="h-4 w-4" />} />
        <StatTile label="Recovery rate"   value={fmt.pct(k.recoveryRate)} delta="vs prior period" icon={<Target className="h-4 w-4" />} tone="success" />
        <StatTile label="ROI"             value={`${k.roi.toFixed(1)}x`} delta={`Cost ${fmt.money(k.costPerDollar * 100)}/$ collected`} icon={<Activity className="h-4 w-4" />} tone="success" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <PageCard className="lg:col-span-2">
          <CardHead title="Cash recovered" subtitle={`Forecast next 30d: ${fmt.money(k.forecastNext30)}`} />
          <div className="p-6">
            <div className="flex items-end gap-3 h-48">
              {trend.map((p) => (
                <div key={p.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-lg bg-gradient-tenant" style={{ height: `${(p.value / max) * 100}%` }} />
                  <div className="text-[10px] text-muted-foreground">{p.label}</div>
                  <div className="text-xs font-semibold">${p.value.toFixed(2)}M</div>
                </div>
              ))}
            </div>
          </div>
        </PageCard>
        <PageCard>
          <CardHead title="Anomaly watch" subtitle="Auto-flagged patterns" />
          <ul className="p-4 space-y-2 text-sm">
            <li className="p-3 rounded-lg bg-warning/10 border border-warning/30">Globex Medical recovery −4.2pp WoW</li>
            <li className="p-3 rounded-lg bg-success/10 border border-success/30">Initech Telecom +6.8pp — exceeds forecast</li>
            <li className="p-3 rounded-lg bg-info/10 border border-info/30">Voice AI cost-per-call −12% (Aria upgrade)</li>
          </ul>
        </PageCard>
      </div>
    </div>
  );
}
