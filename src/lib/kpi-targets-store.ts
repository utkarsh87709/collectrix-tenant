// Tenant-configurable KPI targets, scoped tenant-wide / per-team / per-category.
import { useSyncExternalStore } from "react";
import { DEFAULT_KPI_TARGETS } from "./analytics-mock";
import type { KPITargets, ProductionCategory } from "./analytics-types";

export type TargetScope =
  | { kind: "tenant" }
  | { kind: "team"; id: string }
  | { kind: "category"; category: ProductionCategory };

export type TargetEntry = {
  scope: TargetScope;
  targets: KPITargets;
  updatedAt: string;
  updatedBy: string;
};

const KEY = "collectrix.kpi-targets";
const DEFAULT_ENTRY: TargetEntry = {
  scope: { kind: "tenant" },
  targets: DEFAULT_KPI_TARGETS,
  updatedAt: new Date().toISOString(),
  updatedBy: "system",
};

function load(): TargetEntry[] {
  if (typeof window === "undefined") return [DEFAULT_ENTRY];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return [DEFAULT_ENTRY];
}

let entries: TargetEntry[] = load();
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const persist = () => {
  try { window.localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* noop */ }
  emit();
};

export function useKPITargets(): TargetEntry[] {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => entries, () => entries);
}

export function upsertKPITargets(scope: TargetScope, targets: KPITargets, updatedBy = "admin") {
  const key = JSON.stringify(scope);
  const next = entries.filter((e) => JSON.stringify(e.scope) !== key);
  next.unshift({ scope, targets, updatedAt: new Date().toISOString(), updatedBy });
  entries = next;
  persist();
}

export function removeKPITargets(scope: TargetScope) {
  const key = JSON.stringify(scope);
  entries = entries.filter((e) => JSON.stringify(e.scope) !== key);
  persist();
}

export function tenantTargets(): KPITargets {
  return entries.find((e) => e.scope.kind === "tenant")?.targets ?? DEFAULT_KPI_TARGETS;
}
