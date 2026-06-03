import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { creditors, aging, fmt } from "@/lib/dashboards-mock";
import { DashboardFilters, defaultFilters, activeFilterSummary, type DashboardFilterState } from "@/components/tenant/dashboards/DashboardFilters";

export const Route = createFileRoute("/tenant/dashboards/creditors")({
  component: Creditor,
});

function Creditor() {
  const [filters, setFilters] = useState<DashboardFilterState>(defaultFilters);

  const list = useMemo(() => {
    return filters.creditorId === "all" ? creditors : creditors.filter((p) => p.id === filters.creditorId);
  }, [filters]);

  const totalBalance = list.reduce((s, p) => s + p.balance, 0);

  return (
    <div className="px-6 lg:px-10 py-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="tenant">US-147</Pill>
        <span className="text-xs text-muted-foreground">{activeFilterSummary(filters)}</span>
      </div>

      <DashboardFilters value={filters} onChange={setFilters} showAgent={false} />

      <div className="grid lg:grid-cols-3 gap-4">
        <PageCard className="lg:col-span-2">
          <CardHead title="Creditor composition" subtitle={`${list.length} creditor${list.length !== 1 ? "s" : ""} · ${fmt.money(totalBalance)} AUM`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Creditor</th>
                  <th className="text-right px-4 py-3">Accounts</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="text-right px-4 py-3">Recovery %</th>
                  <th className="text-left px-4 py-3">Age band</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30 cursor-pointer">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-right">{p.accounts.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{fmt.money(p.balance)}</td>
                    <td className="px-4 py-3 text-right"><Pill tone={p.recovery >= 40 ? "success" : p.recovery >= 30 ? "tenant" : "warning"}>{fmt.pct(p.recovery)}</Pill></td>
                    <td className="px-4 py-3"><Pill tone="muted">{p.age} d</Pill></td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No creditors match the filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </PageCard>

        <PageCard>
          <CardHead title="Aging buckets" subtitle="Share of total AUM" />
          <div className="p-6 space-y-3">
            {aging.map((b) => (
              <div key={b.bucket}>
                <div className="flex justify-between text-xs mb-1"><span>{b.bucket}</span><span className="font-semibold">{b.pct}%</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-tenant" style={{ width: `${b.pct * 3}%` }} />
                </div>
              </div>
            ))}
          </div>
        </PageCard>
      </div>
    </div>
  );
}
