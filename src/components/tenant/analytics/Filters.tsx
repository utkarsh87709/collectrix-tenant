import type { Filters as F } from "@/lib/analytics-types";
import { teams } from "@/lib/tenant-mock";

export type FilterKey = "dateRange" | "creditor" | "placementBatch" | "productionCategory" | "teamType" | "team" | "agent" | "role";

const inputCls = "px-3 py-1.5 rounded-lg bg-muted border border-border text-xs outline-none focus:ring-2 ring-tenant";

export function FiltersBar({
  filters, setFilters, show,
}: {
  filters: F;
  setFilters: (f: F) => void;
  show: FilterKey[];
}) {
  const upd = (patch: Partial<F>) => setFilters({ ...filters, ...patch });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {show.includes("dateRange") && (
        <select className={inputCls} value={filters.dateRange} onChange={(e) => upd({ dateRange: e.target.value as F["dateRange"] })}>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="ytd">Year to date</option>
        </select>
      )}
      {show.includes("productionCategory") && (
        <select className={inputCls} value={filters.productionCategory ?? "all"} onChange={(e) => upd({ productionCategory: e.target.value as F["productionCategory"] })}>
          <option value="all">All categories</option>
          <option value="collection">Collection</option>
          <option value="legal">Legal</option>
          <option value="other">Other</option>
        </select>
      )}
      {show.includes("teamType") && (
        <select className={inputCls} value={filters.teamType ?? "all"} onChange={(e) => upd({ teamType: e.target.value as F["teamType"] })}>
          <option value="all">All team types</option>
          <option value="production">Production</option>
          <option value="support">Support</option>
        </select>
      )}
      {show.includes("team") && (
        <select className={inputCls} value={filters.teamId ?? ""} onChange={(e) => upd({ teamId: e.target.value || undefined })}>
          <option value="">All teams</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      {show.includes("creditor") && (
        <select className={inputCls} value={filters.creditor ?? ""} onChange={(e) => upd({ creditor: e.target.value || undefined })}>
          <option value="">All creditors</option>
          <option value="p1">Creditor A</option>
          <option value="p2">Creditor B</option>
          <option value="p3">Creditor C</option>
        </select>
      )}
      {show.includes("placementBatch") && (
        <select className={inputCls} value={filters.placementBatch ?? ""} onChange={(e) => upd({ placementBatch: e.target.value || undefined })}>
          <option value="">All batches</option>
          <option value="b1">2026-Q1</option>
          <option value="b2">2025-Q4</option>
        </select>
      )}
      {show.includes("role") && (
        <select className={inputCls} value={filters.role ?? ""} onChange={(e) => upd({ role: e.target.value || undefined })}>
          <option value="">All roles</option>
          <option value="Collection Agent">Collection Agent</option>
          <option value="Senior Collection Agent">Senior Collection Agent</option>
          <option value="Collection Supervisor">Supervisor</option>
        </select>
      )}
    </div>
  );
}
