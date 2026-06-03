// Engagement state — stop/re-engage with reason, channels, duration.

import { useSyncExternalStore } from "react";
import { logAudit } from "./audit-timeline-store";

export type EngagementChannel = "ai_calls" | "sms" | "email" | "all";
export type EngagementDuration = "temporary" | "permanent";

export type EngagementStop = {
  at: string;
  by: string;
  reason: string;
  duration: EngagementDuration;
  channels: EngagementChannel[];
  effectiveDate: string;
  note?: string;
  resumedAt?: string;
  resumedBy?: string;
};

export type EngagementState = {
  status: "active" | "stopped";
  history: EngagementStop[];
};

const KEY = "collectrix.engagement.v1";
type Store = Record<string, EngagementState>;

function load(): Store {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Store; } catch { return {}; }
}
function persist() {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* noop */ }
}

let store: Store = load();
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const sub = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };

export function useEngagement(debtorId: string): EngagementState {
  const snap = useSyncExternalStore(sub, () => store, () => store);
  return snap[debtorId] ?? { status: "active", history: [] };
}

export function stopEngagement(debtorId: string, input: Omit<EngagementStop, "at">, actor: string) {
  const cur = store[debtorId] ?? { status: "active", history: [] };
  const entry: EngagementStop = { ...input, at: new Date().toISOString(), by: actor };
  store = { ...store, [debtorId]: { status: "stopped", history: [entry, ...cur.history] } };
  persist(); emit();
  logAudit({
    debtorId, actor, actorKind: "human", category: "engagement",
    action: `Engagement stopped (${input.duration})`,
    summary: `Channels: ${input.channels.join(", ")} · effective ${input.effectiveDate}`,
    reason: input.reason,
  });
}

export function resumeEngagement(debtorId: string, actor: string) {
  const cur = store[debtorId] ?? { status: "active", history: [] };
  if (cur.status !== "stopped") return;
  const last = cur.history[0];
  const updated = last ? [{ ...last, resumedAt: new Date().toISOString(), resumedBy: actor }, ...cur.history.slice(1)] : cur.history;
  store = { ...store, [debtorId]: { status: "active", history: updated } };
  persist(); emit();
  logAudit({
    debtorId, actor, actorKind: "human", category: "engagement",
    action: "Engagement resumed",
    summary: last ? `Previous stop reason: ${last.reason}` : undefined,
  });
}
