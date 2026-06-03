import { createFileRoute } from "@tanstack/react-router";
import { StatTile, PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { finance as f, financeTrend, fmt } from "@/lib/dashboards-mock";
import { DollarSign, TrendingDown, PieChart, Percent } from "lucide-react";

export const Route = createFileRoute("/tenant/dashboards/finance")({
  component: Finance,
});

function Finance() {
  const max = Math.max(...financeTrend.map((p) => p.value));
  const costRows = [
    { label: "Voice AI",    value: f.voiceAiCost },
    { label: "Letters",     value: f.letterCost },
    { label: "Skip trace",  value: f.skipTraceCost },
    { label: "Legal",       value: f.legalCosts },
  ];
  const totalCosts = costRows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="px-6 lg:px-10 py-6 space-y-6">
      <Pill tone="tenant">US-150 · Revenue · Cost-to-collect · Margin</Pill>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Revenue (30d)" value={fmt.money(f.revenue30d)} icon={<DollarSign className="h-4 w-4" />} tone="success" />
        <StatTile label="Costs (30d)"   value={fmt.money(f.costs30d)} icon={<TrendingDown className="h-4 w-4" />} />
        <StatTile label="Margin"        value={`${f.margin}%`} icon={<Percent className="h-4 w-4" />} tone="success" />
        <StatTile label="Contingency"   value={fmt.money(f.contingencyFees)} icon={<PieChart className="h-4 w-4" />} tone="tenant" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <PageCard className="lg:col-span-2">
          <CardHead title="Revenue trend (6 months)" />
          <div className="p-6">
            <div className="flex items-end gap-3 h-48">
              {financeTrend.map((p) => (
                <div key={p.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-lg bg-gradient-tenant" style={{ height: `${(p.value / max) * 100}%` }} />
                  <div className="text-[10px] text-muted-foreground">{p.label}</div>
                  <div className="text-xs font-semibold">${(p.value / 1000).toFixed(2)}M</div>
                </div>
              ))}
            </div>
          </div>
        </PageCard>
        <PageCard>
          <CardHead title="Cost breakdown" subtitle={fmt.money(totalCosts) + " / 30d"} />
          <div className="p-6 space-y-3">
            {costRows.map((c) => (
              <div key={c.label}>
                <div className="flex justify-between text-xs mb-1"><span>{c.label}</span><span className="font-semibold">{fmt.money(c.value)}</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-tenant" style={{ width: `${(c.value / totalCosts) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </PageCard>
      </div>
    </div>
  );
}
