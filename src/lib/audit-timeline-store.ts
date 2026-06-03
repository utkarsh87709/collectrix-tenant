// Unified audit timeline for a debtor — captures every meaningful event.
// Mock store with localStorage persistence + useSyncExternalStore.

import { useSyncExternalStore } from "react";

export type AuditActorKind = "human" | "ai" | "system";

export type AuditCategory =
  | "debtor_created"
  | "csv_imported"
  | "validation"
  | "field_edit"
  | "status_changed"
  | "owner_changed"
  | "team_changed"
  | "flag"
  | "rpv"
  | "call"
  | "comms"
  | "note"
  | "payment_reported"
  | "payment_posted"
  | "balance_updated"
  | "engagement"
  | "archive"
  | "delete";

export type AuditEvent = {
  id: string;
  debtorId: string;
  at: string;                  // ISO
  actor: string;
  actorKind: AuditActorKind;
  category: AuditCategory;
  action: string;              // short verb phrase
  summary?: string;            // optional descriptive line
  before?: string;
  after?: string;
  reason?: string;
  meta?: Record<string, string | number | boolean>;
};

const KEY = "collectrix.audit.timeline.v1";

function load(): AuditEvent[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return seed();
    return JSON.parse(raw) as AuditEvent[];
  } catch { return seed(); }
}
function persist() {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(events)); } catch { /* noop */ }
}

function seed(): AuditEvent[] {
  const now = Date.now();
  const t = (mins: number) => new Date(now - mins * 60_000).toISOString();
  const ids = ["d_10421", "d_10420", "d_10419", "d_10418", "d_10417"];
  const out: AuditEvent[] = [];
  for (const debtorId of ids) {
    out.push(
      { id: `au_${debtorId}_1`, debtorId, at: t(60 * 24 * 14), actor: "system", actorKind: "system", category: "debtor_created", action: "Debtor record created", summary: "Initial placement from creditor" },
      { id: `au_${debtorId}_2`, debtorId, at: t(60 * 24 * 14 - 5), actor: "system", actorKind: "system", category: "csv_imported", action: "Imported from CSV", summary: "spring-2026-placements.csv · row 142" },
      { id: `au_${debtorId}_3`, debtorId, at: t(60 * 24 * 10), actor: "Maya Lindstrom", actorKind: "human", category: "validation", action: "Validation issue resolved", summary: "Postal code corrected" },
      { id: `au_${debtorId}_4`, debtorId, at: t(60 * 24 * 6), actor: "AI Assistant", actorKind: "ai", category: "rpv", action: "RPV attempted (failed)", summary: "Could not verify DOB — transferred to agent" },
      { id: `au_${debtorId}_5`, debtorId, at: t(60 * 24 * 6 - 10), actor: "Maya Lindstrom", actorKind: "human", category: "rpv", action: "RPV passed (manual)", summary: "Verified via last name + account number" },
      { id: `au_${debtorId}_6`, debtorId, at: t(60 * 24 * 3), actor: "Maya Lindstrom", actorKind: "human", category: "call", action: "Call completed", summary: "Spoke 6m — debtor will call back Friday" },
      { id: `au_${debtorId}_7`, debtorId, at: t(60 * 24 * 2), actor: "AI Assistant", actorKind: "ai", category: "comms", action: "SMS received", summary: "Inbound: \"Can I pay half this week?\"" },
    );
  }
  return out;
}

let events: AuditEvent[] = load();
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const sub = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };

export function useDebtorAuditTimeline(debtorId: string): AuditEvent[] {
  const all = useSyncExternalStore(sub, () => events, () => events);
  return all
    .filter((e) => e.debtorId === debtorId)
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function logAudit(input: Omit<AuditEvent, "id" | "at"> & { at?: string }): AuditEvent {
  const next: AuditEvent = {
    id: `au_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: input.at ?? new Date().toISOString(),
    ...input,
  };
  events = [next, ...events];
  persist();
  emit();
  return next;
}

export const CATEGORY_LABEL: Record<AuditCategory, string> = {
  debtor_created: "Created",
  csv_imported: "CSV import",
  validation: "Validation",
  field_edit: "Field edit",
  status_changed: "Status",
  owner_changed: "Owner",
  team_changed: "Team",
  flag: "Flag",
  rpv: "RPV",
  call: "Call",
  comms: "Comms",
  note: "Note",
  payment_reported: "Payment reported",
  payment_posted: "Payment posted",
  balance_updated: "Balance",
  engagement: "Engagement",
  archive: "Archive",
  delete: "Delete",
};
