// Epic 15 — Payment reconciliation / audit log

import { useSyncExternalStore } from "react";

export type PaymentAuditEntry = {
  id: string;
  at: string;
  debtorId?: string;
  actor: string;
  action: "payment_recorded" | "payment_reversed" | "refund_issued" | "settlement_offered" | "settlement_accepted" | "settlement_paid" | "installment_paid" | "allocation_applied" | "reconciliation_export";
  amount?: number;
  reference?: string;
  detail?: string;
};

let entries: PaymentAuditEntry[] = [
  { id: "pa-1", at: new Date(Date.now() - 86400000).toISOString(), debtorId: "1", actor: "Sarah K.", action: "payment_recorded", amount: 200, reference: "CC-44922", detail: "Partial installment payment in-3" },
  { id: "pa-2", at: new Date(Date.now() - 86400000 * 3).toISOString(), debtorId: "2", actor: "system", action: "payment_reversed", amount: 300, reference: "CHK-7740", detail: "NSF reversal" },
  { id: "pa-3", at: new Date(Date.now() - 86400000 * 4).toISOString(), debtorId: "3", actor: "Maya L.", action: "settlement_accepted", amount: 1200, reference: "st-1", detail: "Lump sum 25¢ on the dollar" },
];

const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

export function usePaymentAudit(debtorId?: string): PaymentAuditEntry[] {
  const all = useSyncExternalStore(subscribe, () => entries, () => entries);
  return debtorId ? all.filter((e) => e.debtorId === debtorId) : all;
}

export function logPaymentAudit(input: Omit<PaymentAuditEntry, "id" | "at"> & { at?: string }): PaymentAuditEntry {
  const next: PaymentAuditEntry = {
    id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: input.at ?? new Date().toISOString(),
    ...input,
  };
  entries = [next, ...entries];
  emit();
  return next;
}
