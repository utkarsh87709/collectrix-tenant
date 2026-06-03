// Epic 13 — Append-only compliance audit log (US-122)

import { useSyncExternalStore } from "react";

export type ComplianceAuditEntry = {
  id: string;
  at: string;
  debtorId?: string;
  actor: string;
  actorRole: "agent" | "supervisor" | "compliance" | "admin" | "system";
  action: string;
  decision: "allowed" | "blocked" | "override" | "logged";
  jurisdictionCode?: string;
  ruleCode?: string;
  reason?: string;
  meta?: Record<string, unknown>;
};

let entries: ComplianceAuditEntry[] = [
  {
    id: "ca-1", at: new Date(Date.now() - 3600000).toISOString(),
    debtorId: "1", actor: "Sarah K.", actorRole: "agent",
    action: "outbound_call", decision: "blocked",
    jurisdictionCode: "ON", ruleCode: "CALLING_HOURS",
    reason: "Attempted call at 6:45 AM ET (Ontario allows 7 AM–9 PM)",
  },
  {
    id: "ca-2", at: new Date(Date.now() - 7200000).toISOString(),
    debtorId: "2", actor: "system", actorRole: "system",
    action: "validation_request_created", decision: "logged",
    ruleCode: "FDCPA_VALIDATION", reason: "Collections paused for 30 days",
  },
];

const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

export function useAuditEntries(debtorId?: string): ComplianceAuditEntry[] {
  const all = useSyncExternalStore(subscribe, () => entries, () => entries);
  return debtorId ? all.filter((e) => e.debtorId === debtorId) : all;
}
export function getAuditEntries() { return entries; }

export function logAudit(input: Omit<ComplianceAuditEntry, "id" | "at"> & { at?: string }): ComplianceAuditEntry {
  const next: ComplianceAuditEntry = {
    id: `ca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: input.at ?? new Date().toISOString(), ...input,
  };
  entries = [next, ...entries]; emit(); return next;
}

export function complianceSummary() {
  const last24h = entries.filter((e) => Date.now() - new Date(e.at).getTime() < 86400000);
  return {
    total: entries.length,
    blocked24h: last24h.filter((e) => e.decision === "blocked").length,
    overrides24h: last24h.filter((e) => e.decision === "override").length,
    allowed24h: last24h.filter((e) => e.decision === "allowed").length,
  };
}
