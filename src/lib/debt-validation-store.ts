// Epic 13 — FDCPA debt validation store (US-119)

import { useSyncExternalStore } from "react";

export type ValidationStatus = "requested" | "documents_sent" | "verified" | "disputed" | "withdrawn";

export type DebtValidationRequest = {
  id: string;
  debtorId: string;
  requestedAt: string;
  status: ValidationStatus;
  collectionsPaused: boolean;
  responseDeadline: string;     // 30 days from request
  documents: string[];          // mock filenames
  notes: string;
  resolvedAt?: string;
};

let requests: DebtValidationRequest[] = [
  {
    id: "dvr-1", debtorId: "2", requestedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    status: "documents_sent", collectionsPaused: true,
    responseDeadline: new Date(Date.now() + 25 * 86400000).toISOString(),
    documents: ["original-contract.pdf", "itemized-statement.pdf"], notes: "Debtor requested via phone on Apr 23.",
  },
];

const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

export function useValidationRequests(debtorId?: string): DebtValidationRequest[] {
  const all = useSyncExternalStore(subscribe, () => requests, () => requests);
  return debtorId ? all.filter((r) => r.debtorId === debtorId) : all;
}
export function getValidationRequests() { return requests; }

export function createValidationRequest(input: { debtorId: string; notes?: string }): DebtValidationRequest {
  const now = Date.now();
  const next: DebtValidationRequest = {
    id: `dvr-${now}`, debtorId: input.debtorId, requestedAt: new Date(now).toISOString(),
    status: "requested", collectionsPaused: true,
    responseDeadline: new Date(now + 30 * 86400000).toISOString(),
    documents: [], notes: input.notes ?? "",
  };
  requests = [next, ...requests]; emit(); return next;
}
export function updateValidationRequest(id: string, patch: Partial<DebtValidationRequest>): boolean {
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  requests = requests.map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r));
  emit(); return true;
}

export function isCollectionsPaused(debtorId: string): boolean {
  return requests.some((r) => r.debtorId === debtorId && r.collectionsPaused &&
    !["verified", "withdrawn"].includes(r.status));
}
