import { useState } from "react";
import { Calendar, Filter, X } from "lucide-react";
import { agents, creditors } from "@/lib/dashboards-mock";

export type DashboardFilterState = {
  range: "7d" | "30d" | "90d" | "ytd" | "custom";
  startDate?: string;
  endDate?: string;
  agentId: string; // "all" or agent id
  creditorId: string; // "all" or creditor id
  status: string; // "all" | "active" | "ptp" | "brp" | "settled" | "legal"
};

export const defaultFilters: DashboardFilterState = {
  range: "30d",
  agentId: "all",
  creditorId: "all",
  status: "all",
};

const RANGES: { v: DashboardFilterState["range"]; label: string }[] = [
  { v: "7d", label: "7d" },
  { v: "30d", label: "30d" },
  { v: "90d", label: "90d" },
  { v: "ytd", label: "YTD" },
  { v: "custom", label: "Custom" },
];

const STATUSES = [
  { v: "all", label: "All statuses" },
  { v: "active", label: "Active" },
  { v: "ptp", label: "PTP" },
  { v: "brp", label: "BRP" },
  { v: "settled", label: "Settled" },
  { v: "legal", label: "Legal" },
];

export function DashboardFilters({
  value,
  onChange,
  showAgent = true,
  showCreditor = true,
  showStatus = true,
}: {
  value: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
  showAgent?: boolean;
  showCreditor?: boolean;
  showStatus?: boolean;
}) {
  const set = <K extends keyof DashboardFilterState>(k: K, v: DashboardFilterState[K]) =>
    onChange({ ...value, [k]: v });

  const isDirty =
    value.range !== defaultFilters.range ||
    value.agentId !== "all" ||
    value.creditorId !== "all" ||
    value.status !== "all";

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-3 flex flex-wrap items-center gap-2 shadow-elegant">
      <div className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-muted-foreground">
        <Filter className="h-3.5 w-3.5" /> Filters
      </div>

      {/* Date range pills */}
      <div className="inline-flex items-center rounded-lg bg-muted p-0.5">
        {RANGES.map((r) => (
          <button
            key={r.v}
            onClick={() => set("range", r.v)}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
              value.range === r.v
                ? "bg-gradient-tenant text-white shadow-tenant"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {value.range === "custom" && (
        <div className="inline-flex items-center gap-1.5 text-xs">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="date"
            value={value.startDate ?? ""}
            onChange={(e) => set("startDate", e.target.value)}
            className="px-2 py-1 rounded-md border border-border bg-background"
          />
          <span className="text-muted-foreground">→</span>
          <input
            type="date"
            value={value.endDate ?? ""}
            onChange={(e) => set("endDate", e.target.value)}
            className="px-2 py-1 rounded-md border border-border bg-background"
          />
        </div>
      )}

      {showAgent && (
        <Select label="Agent" value={value.agentId} onChange={(v) => set("agentId", v)}
          options={[{ v: "all", label: "All agents" }, ...agents.map((a) => ({ v: a.id, label: a.name }))]} />
      )}

      {showCreditor && (
        <Select label="Creditor" value={value.creditorId} onChange={(v) => set("creditorId", v)}
          options={[{ v: "all", label: "All creditors" }, ...creditors.map((p) => ({ v: p.id, label: p.name }))]} />
      )}

      {showStatus && (
        <Select label="Status" value={value.status} onChange={(v) => set("status", v)} options={STATUSES} />
      )}

      {isDirty && (
        <button
          onClick={() => onChange(defaultFilters)}
          className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-xs hover:bg-muted"
        >
          <X className="h-3 w-3" /> Reset
        </button>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { v: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs">
      <span className="uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 rounded-md border border-border bg-background text-foreground max-w-[180px]"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function activeFilterSummary(f: DashboardFilterState): string {
  const parts: string[] = [];
  parts.push(
    f.range === "custom"
      ? `${f.startDate ?? "—"} → ${f.endDate ?? "—"}`
      : f.range === "ytd"
        ? "Year-to-date"
        : `Last ${f.range}`
  );
  if (f.agentId !== "all") {
    const a = agents.find((x) => x.id === f.agentId);
    if (a) parts.push(`Agent: ${a.name}`);
  }
  if (f.creditorId !== "all") {
    const p = creditors.find((x) => x.id === f.creditorId);
    if (p) parts.push(`Creditor: ${p.name}`);
  }
  if (f.status !== "all") parts.push(`Status: ${f.status}`);
  return parts.join(" · ");
}
