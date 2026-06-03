// Epic 15 — Payments store (US-130 → US-133)

import { useSyncExternalStore } from "react";
import {
  seedPlans, seedInstallments, seedPayments, seedSettlements, seedRefunds, seedNSF, seedAccounts,
  type PaymentPlan, type Installment, type Payment, type Settlement, type Refund, type NSFRecord, type AccountAllocation,
} from "./payments-mock";

let plans: PaymentPlan[] = [...seedPlans];
let installments: Installment[] = [...seedInstallments];
let payments: Payment[] = [...seedPayments];
let settlements: Settlement[] = [...seedSettlements];
let refunds: Refund[] = [...seedRefunds];
let nsfs: NSFRecord[] = [...seedNSF];
let allocations: Record<string, AccountAllocation[]> = JSON.parse(JSON.stringify(seedAccounts));

const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

// ── Hooks
export function usePlans(debtorId?: string): PaymentPlan[] {
  const all = useSyncExternalStore(subscribe, () => plans, () => plans);
  return debtorId ? all.filter((p) => p.debtorId === debtorId) : all;
}
export function useInstallments(planId?: string): Installment[] {
  const all = useSyncExternalStore(subscribe, () => installments, () => installments);
  return planId ? all.filter((i) => i.planId === planId) : all;
}
export function usePayments(debtorId?: string): Payment[] {
  const all = useSyncExternalStore(subscribe, () => payments, () => payments);
  return debtorId ? all.filter((p) => p.debtorId === debtorId) : all;
}
export function useSettlements(debtorId?: string): Settlement[] {
  const all = useSyncExternalStore(subscribe, () => settlements, () => settlements);
  return debtorId ? all.filter((s) => s.debtorId === debtorId) : all;
}
export function useRefunds(debtorId?: string): Refund[] {
  const all = useSyncExternalStore(subscribe, () => refunds, () => refunds);
  return debtorId ? all.filter((r) => r.debtorId === debtorId) : all;
}
export function useNSF(debtorId?: string): NSFRecord[] {
  const all = useSyncExternalStore(subscribe, () => nsfs, () => nsfs);
  return debtorId ? all.filter((n) => n.debtorId === debtorId) : all;
}
export function useAllocations(debtorId: string): AccountAllocation[] {
  useSyncExternalStore(subscribe, () => allocations, () => allocations);
  return allocations[debtorId] ?? [];
}

// ── Mutations
export function recordPayment(input: Omit<Payment, "id" | "confirmation" | "receivedAt" | "status"> & Partial<Pick<Payment, "status" | "confirmation" | "receivedAt">>): Payment {
  const next: Payment = {
    id: `py-${Date.now()}`,
    confirmation: input.confirmation ?? `MAN-${Math.floor(Math.random() * 90000 + 10000)}`,
    receivedAt: input.receivedAt ?? new Date().toISOString(),
    status: input.status ?? "cleared",
    ...input,
  };
  payments = [next, ...payments];

  // Apply to installment
  if (next.appliedTo) {
    installments = installments.map((i) => {
      if (i.id !== next.appliedTo) return i;
      const paid = i.paidAmount + next.amount;
      const status: Installment["status"] = paid >= i.amount ? "paid" : "partial";
      return { ...i, paidAmount: paid, status, paidAt: paid >= i.amount ? next.receivedAt : i.paidAt };
    });
  }
  emit();
  return next;
}

export function reversePayment(paymentId: string, reason: string): boolean {
  const p = payments.find((x) => x.id === paymentId);
  if (!p) return false;
  payments = payments.map((x) =>
    x.id === paymentId ? { ...x, status: "reversed", reversedAt: new Date().toISOString(), nsfReason: reason } : x
  );
  // Restore installment paidAmount
  if (p.appliedTo) {
    installments = installments.map((i) => {
      if (i.id !== p.appliedTo) return i;
      const remaining = Math.max(0, i.paidAmount - p.amount);
      const status: Installment["status"] = remaining === 0 ? (new Date(i.dueDate).getTime() < Date.now() ? "missed" : "scheduled") : "partial";
      return { ...i, paidAmount: remaining, status, paidAt: undefined };
    });
  }
  // Log NSF
  nsfs = [{
    id: `nsf-${Date.now()}`, debtorId: p.debtorId, paymentId: p.id,
    method: p.method, reason, fee: 35, occurredAt: new Date().toISOString(),
  }, ...nsfs];
  emit();
  return true;
}

export function issueRefund(paymentId: string, amount: number, reason: Refund["reason"]): Refund | null {
  const p = payments.find((x) => x.id === paymentId);
  if (!p) return null;
  const next: Refund = {
    id: `rf-${Date.now()}`, debtorId: p.debtorId, paymentId, amount, reason,
    status: "pending", createdAt: new Date().toISOString(),
  };
  refunds = [next, ...refunds];
  emit();
  return next;
}

export function markRefundIssued(refundId: string) {
  refunds = refunds.map((r) => r.id === refundId ? { ...r, status: "issued", issuedAt: new Date().toISOString() } : r);
  emit();
}

export function createSettlement(input: Omit<Settlement, "id" | "createdAt" | "status"> & Partial<Pick<Settlement, "status">>): Settlement {
  const next: Settlement = {
    id: `st-${Date.now()}`, createdAt: new Date().toISOString(), status: input.status ?? "offered", ...input,
  };
  settlements = [next, ...settlements];
  emit();
  return next;
}

export function updateSettlement(id: string, patch: Partial<Settlement>): boolean {
  const idx = settlements.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  settlements = settlements.map((s) => s.id === id ? { ...s, ...patch, id: s.id } : s);
  emit();
  return true;
}

export function allocateToAccount(debtorId: string, accountId: string, amount: number) {
  const list = allocations[debtorId] ?? [];
  allocations = { ...allocations, [debtorId]: list.map((a) => a.accountId === accountId ? { ...a, applied: a.applied + amount } : a) };
  emit();
}

// ── Summaries
export function paymentsSummary(debtorId?: string) {
  const list = debtorId ? payments.filter((p) => p.debtorId === debtorId) : payments;
  const cleared = list.filter((p) => p.status === "cleared");
  const reversed = list.filter((p) => p.status === "reversed");
  const pending = list.filter((p) => p.status === "pending");
  const totalCleared = cleared.reduce((s, p) => s + p.amount, 0);
  const totalReversed = reversed.reduce((s, p) => s + p.amount, 0);
  return {
    total: list.length, cleared: cleared.length, reversed: reversed.length, pending: pending.length,
    totalCleared, totalReversed,
  };
}

export function planComplianceSummary(planId?: string) {
  const list = planId ? installments.filter((i) => i.planId === planId) : installments;
  const total = list.length;
  const paid = list.filter((i) => i.status === "paid").length;
  const partial = list.filter((i) => i.status === "partial").length;
  const missed = list.filter((i) => i.status === "missed" || i.status === "late").length;
  const upcoming = list.filter((i) => i.status === "scheduled" || i.status === "due").length;
  const onTimeRate = total === 0 ? 0 : Math.round((paid / total) * 100);
  return { total, paid, partial, missed, upcoming, onTimeRate };
}

export function settlementsSummary(debtorId?: string) {
  const list = debtorId ? settlements.filter((s) => s.debtorId === debtorId) : settlements;
  return {
    total: list.length,
    accepted: list.filter((s) => s.status === "accepted").length,
    paid: list.filter((s) => s.status === "paid").length,
    expired: list.filter((s) => s.status === "expired").length,
    saved: list.reduce((s, x) => s + (x.originalBalance - x.settlementAmount), 0),
  };
}

export function refundsSummary(debtorId?: string) {
  const list = debtorId ? refunds.filter((r) => r.debtorId === debtorId) : refunds;
  return {
    total: list.length,
    pending: list.filter((r) => r.status === "pending").length,
    issued: list.filter((r) => r.status === "issued").length,
    totalAmount: list.reduce((s, r) => s + r.amount, 0),
  };
}

export function nsfSummary(debtorId?: string) {
  const list = debtorId ? nsfs.filter((n) => n.debtorId === debtorId) : nsfs;
  return {
    total: list.length,
    fees: list.reduce((s, n) => s + n.fee, 0),
    methods: Array.from(new Set(list.map((n) => n.method))),
  };
}

// ── Aging buckets (US-130 reconciliation)
export function agingBuckets(debtorId?: string) {
  const due = (debtorId ? installments.filter((i) => plans.find((p) => p.id === i.planId)?.debtorId === debtorId) : installments)
    .filter((i) => i.status !== "paid" && i.status !== "waived");
  const today = Date.now();
  const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };
  for (const i of due) {
    const remaining = i.amount - i.paidAmount;
    const ageDays = Math.floor((today - new Date(i.dueDate).getTime()) / 86400000);
    if (ageDays <= 0) buckets.current += remaining;
    else if (ageDays <= 30) buckets.d30 += remaining;
    else if (ageDays <= 60) buckets.d60 += remaining;
    else if (ageDays <= 90) buckets.d90 += remaining;
    else buckets.d90plus += remaining;
  }
  return buckets;
}
