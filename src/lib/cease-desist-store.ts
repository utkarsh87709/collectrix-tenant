// Epic 13 — Cease & Desist register (US-120)

import { useSyncExternalStore } from "react";

export type CeaseChannel = "all" | "call" | "email" | "sms" | "letter";

export type CeaseDesistRecord = {
  id: string;
  debtorId: string;
  receivedAt: string;
  receivedVia: "verbal" | "written" | "attorney" | "bankruptcy";
  scope: CeaseChannel;
  reason: string;
  recordedBy: string;
  active: boolean;
  notes?: string;
};

let records: CeaseDesistRecord[] = [
  {
    id: "cd-1", debtorId: "3", receivedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    receivedVia: "written", scope: "all", reason: "Attorney representation",
    recordedBy: "Compliance — M. Diaz", active: true,
    notes: "Attorney letter on file. Only legal notices permitted.",
  },
];

const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

export function useCeaseRecords(debtorId?: string): CeaseDesistRecord[] {
  const all = useSyncExternalStore(subscribe, () => records, () => records);
  return debtorId ? all.filter((c) => c.debtorId === debtorId) : all;
}
export function getCeaseRecords() { return records; }

export function recordCease(input: Omit<CeaseDesistRecord, "id" | "receivedAt" | "active"> & { receivedAt?: string }): CeaseDesistRecord {
  const next: CeaseDesistRecord = {
    id: `cd-${Date.now()}`, receivedAt: input.receivedAt ?? new Date().toISOString(),
    active: true, ...input,
  };
  records = [next, ...records]; emit(); return next;
}
export function deactivateCease(id: string): boolean {
  records = records.map((r) => (r.id === id ? { ...r, active: false } : r));
  emit(); return true;
}

export type CeaseCheckResult = {
  blocked: boolean;
  reason?: string;
  exception?: "legal_notice";
};

export function checkCease(debtorId: string, channel: Exclude<CeaseChannel, "all">): CeaseCheckResult {
  const active = records.find((r) =>
    r.active && r.debtorId === debtorId && (r.scope === "all" || r.scope === channel)
  );
  if (!active) return { blocked: false };
  return {
    blocked: true,
    reason: `Cease & desist on file (${active.receivedVia}, scope: ${active.scope})`,
    exception: "legal_notice",
  };
}
