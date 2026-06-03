// Shared demo role selector for permission-gated UI across debtor detail.
// Mirrors the pattern already used in the payments cards.

import { useSyncExternalStore } from "react";

export type DemoRole = "agent" | "manager" | "admin" | "finance";

const KEY = "collectrix.demo-role";

function load(): DemoRole {
  if (typeof window === "undefined") return "agent";
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "agent" || v === "manager" || v === "admin" || v === "finance") return v;
  } catch { /* noop */ }
  return "agent";
}

let role: DemoRole = load();
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const sub = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };

export function useDemoRole(): DemoRole {
  return useSyncExternalStore(sub, () => role, () => role);
}

export function setDemoRole(next: DemoRole) {
  role = next;
  try { window.localStorage.setItem(KEY, next); } catch { /* noop */ }
  emit();
}

export const isManagerOrAdmin = (r: DemoRole) => r === "manager" || r === "admin";
export const isAdmin = (r: DemoRole) => r === "admin";
