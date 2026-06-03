// Payment Agreements store — system-defined agreement types shared across tenants;
// agreement records, installments, verifications and history remain tenant-scoped at the
// debtor level (debtorId is the scope key in this mock).

import { useSyncExternalStore } from "react";

export type AgreementType = "PIF" | "SIF" | "PPA" | "PTP";

export type AgreementStatus =
  | "active"
  | "pending_verification"
  | "completed"
  | "cancelled"
  | "delinquent"
  | "broken"
  | "kept";

export type PaymentMethod =
  | "card" | "bank_transfer" | "ach" | "wire" | "cheque" | "cash" | "money_order";

export type Frequency = "monthly" | "biweekly" | "weekly";

export type InstallmentStatus = "upcoming" | "due" | "paid" | "missed" | "failed";

export type Installment = {
  id: string;
  agreementId: string;
  seq: number;
  dueDate: string;
  amount: number;
  interestPortion?: number;
  status: InstallmentStatus;
  paidDate?: string;
};

export type VerificationStatus = "pending" | "verified" | "failed" | "cancelled";

export type VerificationRequest = {
  id: string;
  agreementId: string;
  debtorId: string;
  amount: number;
  interestAmount?: number;
  totalPayable: number;
  dueDate?: string;
  paymentMethod: PaymentMethod;
  status: VerificationStatus;
  note?: string;
  requestedBy: string;
  requestedAt: string;
  resolvedAt?: string;
};

export type PaymentAgreement = {
  id: string;
  debtorId: string;
  type: AgreementType;
  status: AgreementStatus;
  // Common money fields
  totalBalance: number;
  interestAmount: number;
  totalPayable: number;
  paymentMethod: PaymentMethod;
  dueDate?: string;
  note?: string;
  // SIF
  settlementAmount?: number;
  approvalRequired?: boolean;
  approvedBy?: string;
  // PPA
  monthlyAmount?: number;
  installmentCount?: number;
  firstPaymentDate?: string;
  frequency?: Frequency;
  // PTP
  promisedAmount?: number;
  promiseDate?: string;
  promiseOutcome?: "active" | "kept" | "broken" | "cancelled";
  // Audit
  createdBy: string;
  createdAt: string;
  cancelledAt?: string;
  completedAt?: string;
};

// ── Mapping: agreement type → target debtor status code
export const AGREEMENT_TO_STATUS: Record<AgreementType, string> = {
  PIF: "PIF",
  SIF: "SIF",
  PPA: "PPA",
  PTP: "PTP",
};

export const AGREEMENT_LABEL: Record<AgreementType, string> = {
  PIF: "Payment In Full",
  SIF: "Settlement In Full",
  PPA: "Payment Plan Agreed",
  PTP: "Promise To Pay",
};

const KEY_A = "collectrix.payment-agreements.v1";
const KEY_I = "collectrix.payment-installments.v1";
const KEY_V = "collectrix.payment-verifications.v1";

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

let agreements: PaymentAgreement[] = load<PaymentAgreement>(KEY_A, []);
let installments: Installment[] = load<Installment>(KEY_I, []);
let verifications: VerificationRequest[] = load<VerificationRequest>(KEY_V, []);

const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const sub = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };

export function useAgreements(debtorId?: string): PaymentAgreement[] {
  const all = useSyncExternalStore(sub, () => agreements, () => agreements);
  return debtorId ? all.filter((a) => a.debtorId === debtorId) : all;
}
export function useInstallments(agreementId?: string): Installment[] {
  const all = useSyncExternalStore(sub, () => installments, () => installments);
  return agreementId ? all.filter((i) => i.agreementId === agreementId) : all;
}
export function useVerifications(debtorId?: string): VerificationRequest[] {
  const all = useSyncExternalStore(sub, () => verifications, () => verifications);
  return debtorId ? all.filter((v) => v.debtorId === debtorId) : all;
}

export function activeAgreement(list: PaymentAgreement[]): PaymentAgreement | undefined {
  return list.find((a) => a.status === "active" || a.status === "pending_verification" || a.status === "delinquent");
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
}
function addMonths(iso: string, months: number): string {
  const d = new Date(iso); d.setMonth(d.getMonth() + months); return d.toISOString().slice(0, 10);
}
function stepDate(iso: string, freq: Frequency, n: number): string {
  if (freq === "weekly") return addDays(iso, 7 * n);
  if (freq === "biweekly") return addDays(iso, 14 * n);
  return addMonths(iso, n);
}

export function createAgreement(input: Omit<PaymentAgreement, "id" | "createdAt" | "status"> & { status?: AgreementStatus }): PaymentAgreement {
  const next: PaymentAgreement = {
    ...input,
    id: `pa_${Date.now()}`,
    status: input.status ?? "active",
    createdAt: new Date().toISOString(),
  };
  agreements = [next, ...agreements];
  save(KEY_A, agreements);

  // Generate installments for PPA
  if (next.type === "PPA" && next.monthlyAmount && next.installmentCount && next.firstPaymentDate && next.frequency) {
    const total = next.totalPayable;
    const perInterest = next.interestAmount && next.installmentCount > 0
      ? Math.round((next.interestAmount / next.installmentCount) * 100) / 100
      : 0;
    void total;
    const ins: Installment[] = Array.from({ length: next.installmentCount }, (_, i) => ({
      id: `in_${next.id}_${i + 1}`,
      agreementId: next.id,
      seq: i + 1,
      dueDate: stepDate(next.firstPaymentDate!, next.frequency!, i),
      amount: next.monthlyAmount!,
      interestPortion: perInterest || undefined,
      status: i === 0 ? "due" : "upcoming",
    }));
    installments = [...ins, ...installments];
    save(KEY_I, installments);
  }
  emit();
  return next;
}

export function updateAgreement(id: string, patch: Partial<PaymentAgreement>) {
  agreements = agreements.map((a) => a.id === id ? { ...a, ...patch, id: a.id } : a);
  save(KEY_A, agreements); emit();
}

export function cancelAgreement(id: string) {
  updateAgreement(id, { status: "cancelled", cancelledAt: new Date().toISOString() });
}

export function markInstallmentPaid(id: string) {
  installments = installments.map((i) => i.id === id ? { ...i, status: "paid", paidDate: new Date().toISOString().slice(0, 10) } : i);
  save(KEY_I, installments); emit();
}
export function markInstallmentMissed(id: string) {
  installments = installments.map((i) => i.id === id ? { ...i, status: "missed" } : i);
  save(KEY_I, installments); emit();
  // If any installment missed, mark agreement delinquent
  const ins = installments.find((x) => x.id === id);
  if (ins) updateAgreement(ins.agreementId, { status: "delinquent" });
}

export function setPromiseOutcome(id: string, outcome: NonNullable<PaymentAgreement["promiseOutcome"]>) {
  const statusMap: Record<typeof outcome, AgreementStatus> = {
    active: "active", kept: "kept", broken: "broken", cancelled: "cancelled",
  } as const;
  updateAgreement(id, { promiseOutcome: outcome, status: statusMap[outcome] });
}

export function requestVerification(input: Omit<VerificationRequest, "id" | "requestedAt" | "status"> & { status?: VerificationStatus }): VerificationRequest {
  const next: VerificationRequest = {
    ...input,
    id: `vr_${Date.now()}`,
    status: input.status ?? "pending",
    requestedAt: new Date().toISOString(),
  };
  verifications = [next, ...verifications];
  save(KEY_V, verifications); emit();
  // Reflect on agreement
  updateAgreement(input.agreementId, { status: "pending_verification" });
  return next;
}

export function resolveVerification(id: string, status: VerificationStatus) {
  verifications = verifications.map((v) => v.id === id ? { ...v, status, resolvedAt: new Date().toISOString() } : v);
  save(KEY_V, verifications); emit();
}
