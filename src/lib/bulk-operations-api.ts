// Bulk Operations calls to the separately-hosted backend — "Engagement → Bulk
// Operations": the log of bulk emails and bulk document runs started from Case
// Files → Customers, and every file each one touched.
//   POST /tenant/getBulkOperation    { page, size, clientId, status, userId } -> { totalCount, bulkOperationsList[] }
//        Verified live 2026-10-26. `size` is mandatory ("Parameter size is
//        mandatory" otherwise); pagination is server-side via totalCount.
//        clientId, status and userId (who started the run, added 2026-10-28)
//        are real filters and combine; null = all. No search or type param.
//        Rows carry only the creator's firstName, no user id.
//   POST /tenant/getBulkOperationUser {} -> { userList: [{ userId, userName }] }
//        Everyone who has started a bulk operation so far — the options for
//        the "Created by" filter (verified live 2026-10-28).
//        `id` is unique per type only: an email op and a document op can both
//        be id 1, so a row is keyed by type + id (see operationKey).
//        Status values: "scheduled" while the background job hasn't run yet,
//        then "completed" (both seen on real runs, 2026-10-26). Anything else
//        renders humanised.
//   POST /tenant/bulkOperationDetails { id, bulkOperationType } -> BulkOperationDetails
//        Verified live 2026-10-26 for both types. An unknown id returns
//        meta.status:false "Server Error". `debtorList[].outcome` was only ever
//        "Sent"; the skipped/failed spellings are guessed by keyword (see
//        outcomeBucket). Document runs carry `archiveLink`, a public zip with
//        one generated document per file (CORS *); email runs carry the
//        attachment names in `documentNameList` (names only, no URLs).
//
// Starting a run (Case Files → Customers, files from ONE client selected):
//   POST /tenant/debtorValidEmailList   { uploadedDebtorIdList } -> { totalSelected, totalValid, totalInvalid }
//        Counts only — no per-file list. Verified live 2026-10-26. An empty
//        list returns "Server Error".
//   POST /tenant/sendDebtorBulkEmail    { uploadedDebtorIdList, templateId } -> {}  "Bulk email is scheduled to be sent."
//   POST /tenant/sendDebtorBulkDocument { uploadedDebtorIdList, templateId } -> {}  "Bulk document is scheduled to be sent."
//        Both verified live 2026-10-26: they return in ~1s and the run shows
//        on getBulkOperation as "scheduled", then "completed" ~1 min later.
//        The backend does NOT check that the template belongs to the files'
//        client, and accepts an EMPTY list (creating an empty operation whose
//        details then fail with "Server Error") — the screen must enforce both.
//        No operation-name field; the run is named after the template.
// All authenticated with the raw token (attached automatically by apiPost).
import { format } from "date-fns";
import { apiPost } from "./api-client";

/** "email" and "document" are the two the backend produces today. */
export type BulkOperationType = "email" | "document" | (string & {});

export type BulkOperationResult = {
  totalCreated: number;
  totalSkipped: number;
  totalFailed: number;
};

/** One row of getBulkOperation (verified live shape, 2026-10-26). */
export type BulkOperation = {
  id: number;
  status: string;
  bulkOperationName: string;
  bulkOperationType: BulkOperationType;
  createdAt: string;
  result: BulkOperationResult | null;
  templateName: string | null;
  clientName: string | null;
  /** The creator's first name — the row has no user id or last name. */
  firstName: string | null;
};

/** One affected file on bulkOperationDetails. */
export type BulkOperationDebtor = {
  uploadedDebtorId: number;
  ourFileNo: string | null;
  debtorFirstName: string | null;
  debtorMiddleName: string | null;
  debtorLastName: string | null;
  email: string | null;
  /** "Sent" seen live; see outcomeBucket for the rest. */
  outcome: string | null;
  failureRemark: string | null;
};

/** bulkOperationDetails (verified live shape for both types, 2026-10-26). */
export type BulkOperationDetails = {
  id: number;
  createdAt: string;
  tenantId: number;
  userId: number;
  uploadedDebtorIdList: number[];
  templateId: number | null;
  bulkOperationName: string;
  templateName: string | null;
  status: string;
  result: BulkOperationResult | null;
  clientName: string | null;
  /** Full name of the user who started it. */
  createdBy: string | null;
  debtorList: BulkOperationDebtor[];
  /** Document runs: zip of the generated documents, one per file. */
  archiveLink?: string | null;
  /** Document runs: the template's uploaded source file. */
  templateOrignalFileName?: string | null;
  /** Email runs: the document templates attached to every email. */
  documentTemplateIdList?: number[] | null;
  documentNameList?: string[] | null;
};

export type GetBulkOperationsParams = {
  page?: number;
  size?: number;
  clientId?: number | null;
  status?: string | null;
  /** Who started the run. */
  userId?: number | null;
};

export type GetBulkOperationsResult = {
  totalCount: number;
  bulkOperationsList: BulkOperation[];
};

export async function getBulkOperations(
  params: GetBulkOperationsParams = {},
): Promise<GetBulkOperationsResult> {
  const data = await apiPost<Partial<GetBulkOperationsResult> | null>("/tenant/getBulkOperation", {
    page: params.page ?? 0,
    size: params.size ?? 10,
    clientId: params.clientId ?? null,
    status: params.status ?? null,
    userId: params.userId ?? null,
  });
  return {
    totalCount: data?.totalCount ?? 0,
    bulkOperationsList: data?.bulkOperationsList ?? [],
  };
}

/** Someone who has started at least one bulk operation. */
export type BulkOperationUser = { userId: number; userName: string };

export async function getBulkOperationUsers(): Promise<BulkOperationUser[]> {
  const data = await apiPost<{ userList?: BulkOperationUser[] } | null>(
    "/tenant/getBulkOperationUser",
  );
  return data?.userList ?? [];
}

export async function getBulkOperationDetails(
  id: number,
  bulkOperationType: BulkOperationType,
): Promise<BulkOperationDetails> {
  const data = await apiPost<BulkOperationDetails>("/tenant/bulkOperationDetails", {
    id,
    bulkOperationType,
  });
  return { ...data, debtorList: data?.debtorList ?? [] };
}

export type ValidEmailCounts = {
  totalSelected: number;
  totalValid: number;
  totalInvalid: number;
};

export async function getValidEmailCounts(
  uploadedDebtorIdList: number[],
): Promise<ValidEmailCounts> {
  const data = await apiPost<Partial<ValidEmailCounts> | null>("/tenant/debtorValidEmailList", {
    uploadedDebtorIdList,
  });
  return {
    totalSelected: data?.totalSelected ?? uploadedDebtorIdList.length,
    totalValid: data?.totalValid ?? 0,
    totalInvalid: data?.totalInvalid ?? 0,
  };
}

/** Starts a bulk run in the background; it appears on getBulkOperation as "scheduled". */
export function startBulkOperation(
  type: "email" | "document",
  uploadedDebtorIdList: number[],
  templateId: number,
): Promise<unknown> {
  if (uploadedDebtorIdList.length === 0) {
    return Promise.reject(new Error("Select at least one customer file."));
  }
  const path = type === "email" ? "/tenant/sendDebtorBulkEmail" : "/tenant/sendDebtorBulkDocument";
  return apiPost(path, { uploadedDebtorIdList, templateId });
}

/* ------------------------------- Helpers -------------------------------- */

/** Status filter options: a run is "scheduled" until the background job
 *  finishes it (seen live 2026-10-26). Add more once the backend confirms them. */
export const BULK_OPERATION_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
] as const;

/** Details only open once an operation has finished (per product, 2026-10-26). */
export function isCompleted(status: string | null | undefined): boolean {
  return status?.toLowerCase() === "completed";
}

/** "completed" → "Completed", "partiallyFailed" → "Partially failed". */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return "Unknown";
  const known = BULK_OPERATION_STATUSES.find((s) => s.value === status.toLowerCase());
  if (known) return known.label;
  const words = status
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** URL-safe key for one operation: "document-1". The id alone isn't unique. */
export function operationKey(op: { id: number; bulkOperationType: BulkOperationType }): string {
  return `${op.bulkOperationType}-${op.id}`;
}

export function parseOperationKey(
  key: string,
): { id: number; bulkOperationType: BulkOperationType } | null {
  const m = key.match(/^([a-zA-Z]+)-(\d+)$/);
  return m ? { bulkOperationType: m[1], id: Number(m[2]) } : null;
}

/** "Bulk email" / "Documents" — what kind of run it was. */
export function typeLabel(type: BulkOperationType): string {
  if (type === "email") return "Bulk email";
  if (type === "document") return "Documents";
  return statusLabel(type);
}

/** The verb for a successful file: an email is sent, a document is created. */
export function createdLabel(type: BulkOperationType): string {
  return type === "email" ? "Sent" : "Created";
}

export type OutcomeBucket = "created" | "skipped" | "failed";

/** Which tab a file's outcome belongs in. Only "Sent" has been seen live, so
 *  skipped/failed are matched by keyword and anything else counts as done. */
export function outcomeBucket(outcome: string | null | undefined): OutcomeBucket {
  const o = (outcome ?? "").toLowerCase();
  if (o.includes("skip")) return "skipped";
  if (o.includes("fail") || o.includes("error")) return "failed";
  return "created";
}

/** "23 Oct 2026 · 07:18 PM", or "—" when missing/unparseable. */
export function formatOperationTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : format(d, "d MMM yyyy · hh:mm a");
}
