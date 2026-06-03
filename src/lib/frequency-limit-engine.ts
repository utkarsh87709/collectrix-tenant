// Epic 13 — Contact frequency limit engine

import { useSyncExternalStore } from "react";
import { findJurisdiction } from "./compliance-store";

export type ContactRecord = {
  id: string;
  debtorId: string;
  channel: "call" | "email" | "sms";
  at: string;
  jurisdictionCode: string;
};

const seedNow = Date.now();
let contacts: ContactRecord[] = [
  { id: "c-1", debtorId: "1", channel: "call", at: new Date(seedNow - 1 * 86400000).toISOString(), jurisdictionCode: "FDCPA" },
  { id: "c-2", debtorId: "1", channel: "call", at: new Date(seedNow - 3 * 86400000).toISOString(), jurisdictionCode: "FDCPA" },
];

const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

export function useContacts(debtorId?: string): ContactRecord[] {
  const all = useSyncExternalStore(subscribe, () => contacts, () => contacts);
  return debtorId ? all.filter((c) => c.debtorId === debtorId) : all;
}
export function recordContact(input: Omit<ContactRecord, "id" | "at"> & { at?: string }): ContactRecord {
  const next: ContactRecord = { id: `c-${Date.now()}`, at: input.at ?? new Date().toISOString(), ...input };
  contacts = [next, ...contacts]; emit(); return next;
}

export type FrequencyResult = {
  allowed: boolean;
  used: number;
  max: number;
  window: "day" | "week" | "none";
  reason?: string;
  resetIn?: string;
};

export function checkFrequency(debtorId: string, jurisdictionCode: string): FrequencyResult {
  const j = findJurisdiction(jurisdictionCode);
  if (!j?.contactLimit) return { allowed: true, used: 0, max: Infinity, window: "none" };
  const now = Date.now();
  const windowMs = j.contactLimit.window === "day" ? 86400000 : 7 * 86400000;
  const cutoff = now - windowMs;
  const used = contacts.filter((c) => c.debtorId === debtorId && new Date(c.at).getTime() >= cutoff).length;
  if (used >= j.contactLimit.max) {
    return {
      allowed: false, used, max: j.contactLimit.max, window: j.contactLimit.window,
      reason: `${j.code} limit: max ${j.contactLimit.max} contacts per ${j.contactLimit.window}`,
      resetIn: `${Math.ceil((cutoff + windowMs - now) / 3600000)}h`,
    };
  }
  return { allowed: true, used, max: j.contactLimit.max, window: j.contactLimit.window };
}
