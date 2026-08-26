// Tenant-configurable debtor flags + per-debtor flag change history.
// Phase 1: localStorage-backed (mock tenant). Replace with Supabase RLS table later.
import { useSyncExternalStore } from "react";

export type FlagType = {
  key: string;          // slug, unique per tenant (e.g. "high-value")
  label: string;        // display label
  tone: "tenant" | "danger" | "warning" | "info" | "muted" | "success";
  description?: string;
  system?: boolean;     // built-in, cannot be deleted
};

export type FlagHistoryEntry = {
  id: string;
  debtorId: string;
  flag: string;
  action: "added" | "removed";
  actor: string;
  at: string;
};

const LS_TYPES = "collectrix.flags.types.v1";
const LS_HISTORY = "collectrix.flags.history.v1";

const DEFAULT_TYPES: FlagType[] = [
  { key: "high-value",     label: "high-value",     tone: "tenant",  system: true, description: "High account balance / priority" },
  { key: "disputed",       label: "disputed",       tone: "danger",  system: true, description: "Customer disputed the debt" },
  { key: "skip-trace",     label: "skip-trace",     tone: "warning", system: true, description: "Address/phone needs locating" },
  { key: "hardship",       label: "hardship",       tone: "info",    system: true, description: "Financial hardship reported" },
  { key: "do-not-contact", label: "do-not-contact", tone: "danger",  system: true, description: "Honored DNC request" },
  { key: "legal-hold",     label: "legal-hold",     tone: "warning", system: true, description: "Active legal proceedings" },
];

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function safeWrite<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

let typesState: FlagType[] = safeRead<FlagType[]>(LS_TYPES, DEFAULT_TYPES);
let historyState: FlagHistoryEntry[] = safeRead<FlagHistoryEntry[]>(LS_HISTORY, []);

const typeListeners = new Set<() => void>();
const historyListeners = new Set<() => void>();

function emitTypes() { for (const l of typeListeners) l(); safeWrite(LS_TYPES, typesState); }
function emitHistory() { for (const l of historyListeners) l(); safeWrite(LS_HISTORY, historyState); }

export function useFlagTypes(): FlagType[] {
  return useSyncExternalStore(
    (cb) => { typeListeners.add(cb); return () => typeListeners.delete(cb); },
    () => typesState,
    () => typesState,
  );
}

export function useFlagHistory(debtorId?: string): FlagHistoryEntry[] {
  const all = useSyncExternalStore(
    (cb) => { historyListeners.add(cb); return () => historyListeners.delete(cb); },
    () => historyState,
    () => historyState,
  );
  return debtorId ? all.filter((h) => h.debtorId === debtorId) : all;
}

export function addFlagType(input: { key: string; label?: string; tone?: FlagType["tone"]; description?: string }) {
  const key = input.key.trim().toLowerCase().replace(/\s+/g, "-");
  if (!key) throw new Error("Flag key required");
  if (typesState.some((t) => t.key === key)) throw new Error(`Flag "${key}" already exists`);
  const next: FlagType = {
    key,
    label: input.label?.trim() || key,
    tone: input.tone ?? "muted",
    description: input.description,
  };
  typesState = [...typesState, next];
  emitTypes();
  return next;
}

export function updateFlagType(key: string, patch: Partial<Omit<FlagType, "key" | "system">>) {
  typesState = typesState.map((t) => (t.key === key ? { ...t, ...patch } : t));
  emitTypes();
}

export function removeFlagType(key: string) {
  const t = typesState.find((x) => x.key === key);
  if (!t) return;
  if (t.system) throw new Error(`Built-in flag "${key}" cannot be removed`);
  typesState = typesState.filter((x) => x.key !== key);
  emitTypes();
}

export function recordFlagChange(input: { debtorId: string; flag: string; action: "added" | "removed"; actor?: string }) {
  const entry: FlagHistoryEntry = {
    id: `fh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    debtorId: input.debtorId,
    flag: input.flag,
    action: input.action,
    actor: input.actor ?? "Maya Lindstrom",
    at: new Date().toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
  };
  historyState = [entry, ...historyState];
  emitHistory();
  return entry;
}

// Permission stub — Phase 1. Wire to real role/permission system later.
// Only roles with "manage_flag_types" permission may create/delete flag types.
let canManageOverride: boolean | null = null;
export function setCanManageFlagTypes(v: boolean) { canManageOverride = v; }
export function canManageFlagTypes(): boolean {
  if (canManageOverride !== null) return canManageOverride;
  // Default: tenant admin can manage.
  return true;
}

export function findFlagType(key: string): FlagType | undefined {
  return typesState.find((t) => t.key === key);
}
