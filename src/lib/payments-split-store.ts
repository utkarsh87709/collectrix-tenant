// Split payments store: Agent-reported (informational) vs Finance-posted (affects balance).
// Phase 1 mock — localStorage-backed.

import { useSyncExternalStore } from "react";

export type ReportedStatus = "reported" | "pending" | "not_received" | "followed_up" | "cancelled";
export type VerificationStatus = "pending_verification" | "verified" | "rejected";
export type PaymentMethod = "card" | "bank_transfer" | "cheque" | "cash" | "money_order" | "wire" | "ach";

export type AgentReportedPayment = {
  id: string;
  debtorId: string;
  amount: number;               // amount the debtor CLAIMS was paid
  method: PaymentMethod;
  paymentDate: string;          // when debtor said they paid
  reference?: string;
  proofName?: string;
  proofDataUrl?: string;
  note?: string;
  status: ReportedStatus;
  reportedBy: string;           // "Submitted by" — agent
  reportedAt: string;
  // Finance review
  verificationStatus: VerificationStatus;
  financeNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  linkedFinanceId?: string;
};

export type FinancePostedPayment = {
  id: string;
  debtorId: string;
  amountReceived: number;
  method: PaymentMethod;
  receivedDate: string;
  postedDate: string;
  bankReference?: string;
  appliedToInterest: number;
  appliedToPrincipal: number;
  remainingBalanceAfter: number;
  postedBy: string;
  notes?: string;
  proofName?: string;
  proofDataUrl?: string;
  linkedReportedId?: string;
};

export type PaymentPlan = {
  id: string;
  debtorId: string;
  promisedDate: string;
  installmentAmount: number;
  frequency: "weekly" | "biweekly" | "monthly" | "one_time";
  paymentMethod?: PaymentMethod;
  followUpDate?: string;
  status: "active" | "pending" | "defaulted" | "cancelled" | "completed";
  commitmentNote?: string;
  createdBy: string;
  createdAt: string;
};

const KEY_R = "collectrix.payments.reported.v1";
const KEY_F = "collectrix.payments.finance.v1";
const KEY_P = "collectrix.payments.plans.v1";

function load<T>(key: string, seed: T[]): T[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return seed;
    return JSON.parse(raw) as T[];
  } catch { return seed; }
}
function save<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(items)); } catch { /* noop */ }
}

const seedReported: AgentReportedPayment[] = [
  { id: "ar1", debtorId: "1", amount: 200, method: "card", paymentDate: new Date(Date.now() - 86400000 * 2).toISOString().slice(0,10), reference: "DEBTOR-SAID-VISA", note: "Customer claims paid via card portal — provided last-4 1234", status: "reported", reportedBy: "Sarah K.", reportedAt: new Date(Date.now() - 86400000 * 2).toISOString(), verificationStatus: "pending_verification" },
];
const seedFinance: FinancePostedPayment[] = [
  { id: "fp1", debtorId: "1", amountReceived: 250, method: "card", receivedDate: new Date(Date.now() - 86400000 * 14).toISOString().slice(0,10), postedDate: new Date(Date.now() - 86400000 * 13).toISOString().slice(0,10), bankReference: "STRIPE-9214", appliedToInterest: 80, appliedToPrincipal: 170, remainingBalanceAfter: 0, postedBy: "Finance Team", notes: "Stripe deposit confirmed" },
];
const seedPlans: PaymentPlan[] = [
  { id: "pln1", debtorId: "1", promisedDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0,10), installmentAmount: 250, frequency: "monthly", paymentMethod: "bank_transfer", followUpDate: new Date(Date.now() + 86400000 * 8).toISOString().slice(0,10), status: "active", commitmentNote: "PTP confirmed via call", createdBy: "Sarah K.", createdAt: new Date().toISOString() },
];

let reported: AgentReportedPayment[] = load(KEY_R, seedReported);
let finance: FinancePostedPayment[] = load(KEY_F, seedFinance);
let plans: PaymentPlan[] = load(KEY_P, seedPlans);

const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const sub = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };

export function useReportedPayments(debtorId?: string): AgentReportedPayment[] {
  const all = useSyncExternalStore(sub, () => reported, () => reported);
  return debtorId ? all.filter(r => r.debtorId === debtorId) : all;
}
export function useFinancePayments(debtorId?: string): FinancePostedPayment[] {
  const all = useSyncExternalStore(sub, () => finance, () => finance);
  return debtorId ? all.filter(r => r.debtorId === debtorId) : all;
}
export function usePaymentPlans(debtorId?: string): PaymentPlan[] {
  const all = useSyncExternalStore(sub, () => plans, () => plans);
  return debtorId ? all.filter(r => r.debtorId === debtorId) : all;
}

export function addReportedPayment(p: Omit<AgentReportedPayment, "id" | "reportedAt">): AgentReportedPayment {
  const next = { ...p, id: `ar_${Date.now()}`, reportedAt: new Date().toISOString() };
  reported = [next, ...reported]; save(KEY_R, reported); emit(); return next;
}
export function updateReportedStatus(id: string, status: ReportedStatus) {
  reported = reported.map(r => r.id === id ? { ...r, status } : r); save(KEY_R, reported); emit();
}
export function updateReportedVerification(id: string, patch: { verificationStatus: VerificationStatus; financeNotes?: string; verifiedBy?: string; linkedFinanceId?: string }) {
  reported = reported.map(r => r.id === id ? { ...r, ...patch, verifiedAt: new Date().toISOString() } : r);
  save(KEY_R, reported); emit();
}
export function removeReportedPayment(id: string) {
  reported = reported.filter(r => r.id !== id); save(KEY_R, reported); emit();
}

// Promise-to-pay follow-up helper
export function followUpState(plan: PaymentPlan): "overdue" | "due_today" | "upcoming" | "none" {
  const target = plan.followUpDate || plan.promisedDate;
  if (!target) return "none";
  const today = new Date().toISOString().slice(0, 10);
  if (target < today) return "overdue";
  if (target === today) return "due_today";
  return "upcoming";
}

export function postFinancePayment(p: Omit<FinancePostedPayment, "id">): FinancePostedPayment {
  const next = { ...p, id: `fp_${Date.now()}` };
  finance = [next, ...finance]; save(KEY_F, finance); emit(); return next;
}
export function removeFinancePayment(id: string) {
  finance = finance.filter(r => r.id !== id); save(KEY_F, finance); emit();
}

export function addPaymentPlan(p: Omit<PaymentPlan, "id" | "createdAt">): PaymentPlan {
  const next = { ...p, id: `pln_${Date.now()}`, createdAt: new Date().toISOString() };
  plans = [next, ...plans]; save(KEY_P, plans); emit(); return next;
}
export function updatePaymentPlan(id: string, patch: Partial<PaymentPlan>) {
  plans = plans.map(p => p.id === id ? { ...p, ...patch, id } : p); save(KEY_P, plans); emit();
}
export function removePaymentPlan(id: string) {
  plans = plans.filter(p => p.id !== id); save(KEY_P, plans); emit();
}

// Interest-first allocation helper
export function allocateInterestFirst(amount: number, accruedInterest: number) {
  const toInterest = Math.min(amount, Math.max(accruedInterest, 0));
  const toPrincipal = Math.max(amount - toInterest, 0);
  return { toInterest, toPrincipal };
}

// Sum of finance posted = actual reduction
export function totalFinancePosted(debtorId: string): number {
  return finance.filter(f => f.debtorId === debtorId).reduce((s, f) => s + f.amountReceived, 0);
}
