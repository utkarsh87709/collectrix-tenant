// Per-tenant monthly payment status, persisted in localStorage.
// Status flows: pending → paid | failed (admin-controlled).

export type MonthlyPaymentStatus = "paid" | "pending" | "failed";

export type PaymentSource = "auto" | "manual";

export type MonthlyPaymentRecord = {
  tenantId: string;
  /** YYYY-MM */
  periodMonth: string;
  status: MonthlyPaymentStatus;
  amount?: number | null;
  markedAt: string; // ISO
  markedBy?: string;
  source?: PaymentSource;
  transactionId?: string;
  note?: string;
};

const STORAGE_KEY = "tenant.monthly-payments.v1";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function loadAll(): MonthlyPaymentRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MonthlyPaymentRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(rows: MonthlyPaymentRecord[]) {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function listMonthlyPayments(tenantId: string): MonthlyPaymentRecord[] {
  return loadAll()
    .filter((r) => r.tenantId === tenantId)
    .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth));
}

export function upsertMonthlyPayment(
  input: Omit<MonthlyPaymentRecord, "markedAt"> & { markedAt?: string },
): MonthlyPaymentRecord {
  const all = loadAll();
  const idx = all.findIndex(
    (r) => r.tenantId === input.tenantId && r.periodMonth === input.periodMonth,
  );
  const record: MonthlyPaymentRecord = {
    ...input,
    markedAt: input.markedAt ?? new Date().toISOString(),
  };
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  saveAll(all);
  return record;
}

/** Returns YYYY-MM for the given Date (defaults to today). */
export function toPeriodMonth(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Format YYYY-MM into a friendly label like "May 2026". */
export function formatPeriodMonth(periodMonth: string): string {
  const [y, m] = periodMonth.split("-").map(Number);
  if (!y || !m) return periodMonth;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/** Increment by N months (positive or negative). */
export function shiftPeriodMonth(periodMonth: string, delta: number): string {
  const [y, m] = periodMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return toPeriodMonth(d);
}

export function nextUntrackedMonth(
  tenantId: string,
  start: string = toPeriodMonth(),
): string {
  const tracked = new Set(listMonthlyPayments(tenantId).map((r) => r.periodMonth));
  let cursor = start;
  // Walk backward in time looking for the most recent month with no record.
  for (let i = 0; i < 36; i++) {
    if (!tracked.has(cursor)) return cursor;
    cursor = shiftPeriodMonth(cursor, -1);
  }
  return start;
}

/** Mock auto-sync from payment gateway. Generates auto records for any
 *  untracked months between `monthsBack` ago and current month. */
export function autoSyncFromGateway(
  tenantId: string,
  opts: { monthsBack?: number; amount?: number } = {},
): MonthlyPaymentRecord[] {
  const monthsBack = opts.monthsBack ?? 3;
  const amount = opts.amount ?? 499;
  const all = loadAll();
  const created: MonthlyPaymentRecord[] = [];
  let cursor = toPeriodMonth();
  for (let i = 0; i <= monthsBack; i++) {
    const exists = all.some(
      (r) => r.tenantId === tenantId && r.periodMonth === cursor,
    );
    if (!exists) {
      // Deterministic mock: most months paid, occasional pending/failed.
      const hash = (cursor + tenantId).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const status: MonthlyPaymentStatus =
        hash % 11 === 0 ? "failed" : hash % 7 === 0 ? "pending" : "paid";
      const rec: MonthlyPaymentRecord = {
        tenantId,
        periodMonth: cursor,
        status,
        amount,
        markedAt: new Date().toISOString(),
        markedBy: "gateway-webhook",
        source: "auto",
        transactionId: `tx_${Math.random().toString(36).slice(2, 10)}`,
      };
      all.push(rec);
      created.push(rec);
    }
    cursor = shiftPeriodMonth(cursor, -1);
  }
  if (created.length) saveAll(all);
  return created;
}
