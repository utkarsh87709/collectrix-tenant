// Validation issues store — tracks per-row / per-field warnings produced
// during debtor data intake. Backed by localStorage so updates persist across
// the import page and the debtor detail page.
import { useEffect, useState } from "react";

export type IssueStatus = "pending" | "fixed" | "ignored" | "acknowledged";
export type IssueSeverity = "critical" | "warning" | "info";

export type ValidationIssue = {
  id: string;
  fileName: string;
  creditor: string;
  rowNumber: number;
  debtorId: string;       // links to debtors[].id
  debtorName: string;
  field: string;          // e.g. "phone", "email", "postal_code"
  reason: string;
  severity: IssueSeverity;
  status: IssueStatus;
  createdAt: string;
  history: { at: string; actor: string; action: string; note?: string }[];
  // Enriched fields (Data Validation):
  issueType?: string;          // e.g. "Format mismatch", "Unparseable date"
  currentValue?: string;       // current invalid value as captured at intake
  recommendedFix?: string;     // suggested correction, if available
};

// ── Tenant-level validation policy ──────────────────────────────────────────
export type ProceedPolicy = "yes" | "no" | "manager_approval" | "reason_required";
export type TenantValidationPolicy = {
  proceedOnCritical: ProceedPolicy;
};
const POLICY_KEY = "collectrix.tenant.validation_policy.v1";
const DEFAULT_POLICY: TenantValidationPolicy = { proceedOnCritical: "reason_required" };

export function getValidationPolicy(): TenantValidationPolicy {
  if (typeof window === "undefined") return DEFAULT_POLICY;
  try {
    const raw = localStorage.getItem(POLICY_KEY);
    if (raw) return { ...DEFAULT_POLICY, ...JSON.parse(raw) };
  } catch { /* noop */ }
  return DEFAULT_POLICY;
}
export function setValidationPolicy(p: TenantValidationPolicy) {
  try {
    localStorage.setItem(POLICY_KEY, JSON.stringify(p));
    window.dispatchEvent(new CustomEvent("collectrix:validation-policy"));
  } catch { /* noop */ }
}
export function useValidationPolicy(): [TenantValidationPolicy, (p: TenantValidationPolicy) => void] {
  const [p, setP] = useState<TenantValidationPolicy>(DEFAULT_POLICY);
  useEffect(() => {
    const sync = () => setP(getValidationPolicy());
    sync();
    window.addEventListener("collectrix:validation-policy", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("collectrix:validation-policy", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return [p, (next) => { setValidationPolicy(next); setP(next); }];
}

const LS_KEY = "collectrix.validation_issues.v2";

const SEED: ValidationIssue[] = [
  {
    id: "vi_001", fileName: "RBC_Q1_2026_placement.xlsx", creditor: "RBC",
    rowNumber: 47, debtorId: "d_10421", debtorName: "Margaret Chen",
    field: "phone", reason: "Invalid format: 'see notes'",
    severity: "warning", status: "pending",
    issueType: "Format mismatch",
    currentValue: "see notes",
    recommendedFix: "Enter a 10-digit number (e.g. 416-555-0142)",
    createdAt: "2h ago",
    history: [{ at: "2h ago", actor: "Import job_2841", action: "Flagged" }],
  },
  {
    id: "vi_002", fileName: "RBC_Q1_2026_placement.xlsx", creditor: "RBC",
    rowNumber: 102, debtorId: "d_10421", debtorName: "Margaret Chen",
    field: "postal_code", reason: "Invalid Canadian postal: 'A1B'",
    severity: "warning", status: "pending",
    issueType: "Format mismatch",
    currentValue: "A1B",
    recommendedFix: "Expected pattern A1A 1A1 (e.g. M5V 1K4)",
    createdAt: "2h ago",
    history: [{ at: "2h ago", actor: "Import job_2841", action: "Flagged" }],
  },
  {
    id: "vi_006", fileName: "RBC_Q1_2026_placement.xlsx", creditor: "RBC",
    rowNumber: 47, debtorId: "d_10421", debtorName: "Margaret Chen",
    field: "sin", reason: "SIN checksum failed (Luhn)",
    severity: "critical", status: "pending",
    issueType: "Invalid identifier",
    currentValue: "123-456-780",
    recommendedFix: "Re-verify with source — last digit appears transposed",
    createdAt: "2h ago",
    history: [{ at: "2h ago", actor: "Import job_2841", action: "Flagged" }],
  },
  {
    id: "vi_007", fileName: "RBC_Q1_2026_placement.xlsx", creditor: "RBC",
    rowNumber: 47, debtorId: "d_10421", debtorName: "Margaret Chen",
    field: "creditor_client", reason: "Creditor name not in master list",
    severity: "info", status: "pending",
    issueType: "Reference data",
    currentValue: "RBC Royal Bk",
    recommendedFix: "Map to canonical 'Royal Bank of Canada'",
    createdAt: "2h ago",
    history: [{ at: "2h ago", actor: "Import job_2841", action: "Flagged" }],
  },
  {
    id: "vi_003", fileName: "TD_personal_loans_apr.csv", creditor: "TD Bank",
    rowNumber: 188, debtorId: "d_10420", debtorName: "Daniel O'Connor",
    field: "email", reason: "Invalid email: 'daniel@@example'",
    severity: "warning", status: "pending",
    issueType: "Format mismatch",
    currentValue: "daniel@@example",
    recommendedFix: "Looks like duplicate '@' — try daniel@example.com",
    createdAt: "1h ago",
    history: [{ at: "1h ago", actor: "Import job_2840", action: "Flagged" }],
  },
  {
    id: "vi_004", fileName: "scotia_auto_batch_47.xlsx", creditor: "Scotiabank",
    rowNumber: 314, debtorId: "d_10419", debtorName: "Aisha Ramirez",
    field: "balance", reason: "Cannot parse '$N/A' as number — defaulted to 0",
    severity: "critical", status: "pending",
    issueType: "Missing financial value",
    currentValue: "$N/A",
    recommendedFix: "Replace with outstanding principal from source ledger",
    createdAt: "3h ago",
    history: [{ at: "3h ago", actor: "Import job_2839", action: "Flagged" }],
  },
  {
    id: "vi_005", fileName: "scotia_auto_batch_47.xlsx", creditor: "Scotiabank",
    rowNumber: 502, debtorId: "d_10417", debtorName: "Sofia Andersson",
    field: "date_of_birth", reason: "Unparseable date '00/00/0000'",
    severity: "warning", status: "fixed",
    issueType: "Unparseable date",
    currentValue: "00/00/0000",
    recommendedFix: "Use ISO date (YYYY-MM-DD)",
    createdAt: "yesterday",
    history: [
      { at: "yesterday", actor: "Import job_2837", action: "Flagged" },
      { at: "3h ago", actor: "M. Lindstrom", action: "Marked fixed", note: "Corrected DOB from source system" },
    ],
  },
];

function read(): ValidationIssue[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as ValidationIssue[];
  } catch { /* noop */ }
  localStorage.setItem(LS_KEY, JSON.stringify(SEED));
  return SEED;
}

function write(items: ValidationIssue[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("collectrix:validation-issues"));
  } catch { /* noop */ }
}

export function getValidationIssues(): ValidationIssue[] {
  return read();
}

export function useValidationIssues(filterDebtorId?: string) {
  const [items, setItems] = useState<ValidationIssue[]>([]);
  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    window.addEventListener("collectrix:validation-issues", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("collectrix:validation-issues", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return filterDebtorId ? items.filter((i) => i.debtorId === filterDebtorId) : items;
}

export function setIssueStatus(id: string, status: IssueStatus, actor = "You", note?: string) {
  const items = read();
  const label =
    status === "fixed" ? "Marked fixed" :
    status === "ignored" ? "Ignored" :
    status === "acknowledged" ? "Acknowledged" :
    "Reopened";
  const next = items.map((it) =>
    it.id === id
      ? {
          ...it,
          status,
          history: [
            ...it.history,
            { at: "just now", actor, action: label, note },
          ],
        }
      : it,
  );
  write(next);
}

export function summary() {
  const items = read();
  const pending = items.filter((i) => i.status === "pending").length;
  const warnings = items.filter((i) => i.severity === "warning").length;
  const critical = items.filter((i) => i.severity === "critical").length;
  return { total: items.length, pending, warnings, critical };
}
