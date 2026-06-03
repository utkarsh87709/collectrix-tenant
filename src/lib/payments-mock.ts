// Epic 15 — Payment Status Management mock data & types (US-130 → US-133)

export type PaymentMethod = "card" | "ach" | "check" | "wire" | "cash" | "money_order";
export type PaymentSubStatus =
  | "pending" | "cleared" | "reversed" | "refunded" | "failed" | "voided";

export type Payment = {
  id: string;
  debtorId: string;
  amount: number;            // dollars
  appliedTo?: string;        // installmentId | settlementId
  method: PaymentMethod;
  status: PaymentSubStatus;
  receivedAt: string;
  clearedAt?: string;
  reversedAt?: string;
  refundedAt?: string;
  confirmation: string;      // processor confirmation
  batchId?: string;
  nsfReason?: string;
  note?: string;
};

export type InstallmentStatus = "scheduled" | "due" | "paid" | "partial" | "late" | "missed" | "waived";
export type Installment = {
  id: string;
  planId: string;
  seq: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: InstallmentStatus;
  paidAt?: string;
};

export type PaymentPlan = {
  id: string;
  debtorId: string;
  totalAmount: number;
  startDate: string;
  cadence: "weekly" | "biweekly" | "monthly";
  status: "active" | "completed" | "broken" | "cancelled";
  createdAt: string;
};

export type SettlementStatus = "offered" | "accepted" | "paid" | "expired" | "failed" | "withdrawn";
export type Settlement = {
  id: string;
  debtorId: string;
  originalBalance: number;
  settlementAmount: number;
  deadline: string;
  conditions?: string;
  status: SettlementStatus;
  acceptedAt?: string;
  paidAt?: string;
  createdAt: string;
};

export type Refund = {
  id: string;
  debtorId: string;
  paymentId: string;
  amount: number;
  reason: "overpayment" | "error" | "dispute" | "settlement_breakage";
  status: "pending" | "issued" | "failed";
  createdAt: string;
  issuedAt?: string;
};

export type NSFRecord = {
  id: string;
  debtorId: string;
  paymentId: string;
  method: PaymentMethod;
  reason: string;
  fee: number;
  occurredAt: string;
};

export type AccountAllocation = {
  accountId: string;
  label: string;          // e.g., "Acct #4471 — Visa charge-off"
  balance: number;
  applied: number;
};

// ── Seeds (debtors 1, 2, 3 referenced elsewhere)
const now = Date.now();
const days = (n: number) => new Date(now + n * 86400000).toISOString();

export const seedPlans: PaymentPlan[] = [
  { id: "pp-1", debtorId: "1", totalAmount: 2400, startDate: days(-60), cadence: "monthly", status: "active",  createdAt: days(-65) },
  { id: "pp-2", debtorId: "2", totalAmount: 1800, startDate: days(-90), cadence: "biweekly", status: "broken", createdAt: days(-92) },
];

export const seedInstallments: Installment[] = [
  // pp-1 (monthly, $400 x 6)
  { id: "in-1",  planId: "pp-1", seq: 1, dueDate: days(-60), amount: 400, paidAmount: 400, status: "paid",      paidAt: days(-59) },
  { id: "in-2",  planId: "pp-1", seq: 2, dueDate: days(-30), amount: 400, paidAmount: 400, status: "paid",      paidAt: days(-29) },
  { id: "in-3",  planId: "pp-1", seq: 3, dueDate: days(0),   amount: 400, paidAmount: 200, status: "partial" },
  { id: "in-4",  planId: "pp-1", seq: 4, dueDate: days(30),  amount: 400, paidAmount: 0,   status: "scheduled" },
  { id: "in-5",  planId: "pp-1", seq: 5, dueDate: days(60),  amount: 400, paidAmount: 0,   status: "scheduled" },
  { id: "in-6",  planId: "pp-1", seq: 6, dueDate: days(90),  amount: 400, paidAmount: 0,   status: "scheduled" },
  // pp-2 (biweekly, $300 x 6) — broken
  { id: "in-7",  planId: "pp-2", seq: 1, dueDate: days(-90), amount: 300, paidAmount: 300, status: "paid",      paidAt: days(-89) },
  { id: "in-8",  planId: "pp-2", seq: 2, dueDate: days(-76), amount: 300, paidAmount: 0,   status: "missed" },
  { id: "in-9",  planId: "pp-2", seq: 3, dueDate: days(-62), amount: 300, paidAmount: 0,   status: "missed" },
];

export const seedPayments: Payment[] = [
  { id: "py-1", debtorId: "1", amount: 400, appliedTo: "in-1", method: "ach",   status: "cleared",  receivedAt: days(-59), clearedAt: days(-57), confirmation: "ACH-001023", batchId: "B-2025-09" },
  { id: "py-2", debtorId: "1", amount: 400, appliedTo: "in-2", method: "card",  status: "cleared",  receivedAt: days(-29), clearedAt: days(-29), confirmation: "CC-44871",   batchId: "B-2025-10" },
  { id: "py-3", debtorId: "1", amount: 200, appliedTo: "in-3", method: "card",  status: "cleared",  receivedAt: days(-2),  clearedAt: days(-2),  confirmation: "CC-44922",   batchId: "B-2025-11" },
  { id: "py-4", debtorId: "2", amount: 300, appliedTo: "in-7", method: "check", status: "cleared",  receivedAt: days(-89), clearedAt: days(-86), confirmation: "CHK-7711" },
  { id: "py-5", debtorId: "2", amount: 300, appliedTo: "in-8", method: "check", status: "reversed", receivedAt: days(-76), reversedAt: days(-72), confirmation: "CHK-7740", nsfReason: "NSF — insufficient funds" },
  { id: "py-6", debtorId: "3", amount: 1250, method: "card",   status: "cleared", receivedAt: days(-10), clearedAt: days(-10), confirmation: "CC-45011", note: "Overpayment — refund queued" },
];

export const seedSettlements: Settlement[] = [
  { id: "st-1", debtorId: "3", originalBalance: 4800, settlementAmount: 1200, deadline: days(14),  status: "accepted", acceptedAt: days(-3), conditions: "Lump sum within 14 days. Account marked settled in full.", createdAt: days(-7) },
  { id: "st-2", debtorId: "2", originalBalance: 1800, settlementAmount: 900,  deadline: days(-5),  status: "expired",  conditions: "Lump sum.", createdAt: days(-35) },
];

export const seedRefunds: Refund[] = [
  { id: "rf-1", debtorId: "3", paymentId: "py-6", amount: 50, reason: "overpayment", status: "pending", createdAt: days(-1) },
];

export const seedNSF: NSFRecord[] = [
  { id: "nsf-1", debtorId: "2", paymentId: "py-5", method: "check", reason: "NSF — insufficient funds", fee: 35, occurredAt: days(-72) },
];

export const seedAccounts: Record<string, AccountAllocation[]> = {
  "1": [
    { accountId: "ACC-1A", label: "Acct #4471 — Visa charge-off", balance: 1800, applied: 1000 },
    { accountId: "ACC-1B", label: "Acct #4598 — Store card",       balance: 600,  applied: 0 },
  ],
  "2": [
    { accountId: "ACC-2A", label: "Acct #2210 — Auto loan deficit", balance: 1500, applied: 300 },
  ],
  "3": [
    { accountId: "ACC-3A", label: "Acct #9981 — Medical",            balance: 4800, applied: 1250 },
  ],
};
