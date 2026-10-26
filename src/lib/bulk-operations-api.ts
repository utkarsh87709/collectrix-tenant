// Bulk Operations calls to the separately-hosted backend — "Engagement → Bulk
// Operations": the log of bulk emails and bulk document runs started from Case
// Files → Customers, and every file each one touched.
//   POST /tenant/getBulkOperation    { page, size, clientId, status } -> { totalCount, bulkOperationsList[] }
//        Verified live 2026-10-26. `size` is mandatory ("Parameter size is
//        mandatory" otherwise); pagination is server-side via totalCount.
//        clientId and status are real filters (null = all). There is NO
//        search, type or performed-by-user param — userId, createdBy,
//        createdUserId, performedBy and searchText were all ignored — so the
//        ticket's "filter by user" can't be offered yet. Rows carry only the
//        creator's firstName, no user id.
//        `id` is unique per type only: an email op and a document op can both
//        be id 1, so a row is keyed by type + id (see operationKey).
//        Status values: "completed" verified; the Postman collection documents
//        "scheduled or completed". Nothing else could be observed without
//        starting a real bulk run, so unknown values render humanised.
//   POST /tenant/bulkOperationDetails { id, bulkOperationType } -> BulkOperationDetails
//        Verified live 2026-10-26 for both types. An unknown id returns
//        meta.status:false "Server Error". `debtorList[].outcome` was only ever
//        "Sent"; the skipped/failed spellings are guessed by keyword (see
//        outcomeBucket). Document runs carry `archiveLink`, a public zip with
//        one generated document per file (CORS *); email runs carry the
//        attachment names in `documentNameList` (names only, no URLs).
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
  });
  return {
    totalCount: data?.totalCount ?? 0,
    bulkOperationsList: data?.bulkOperationsList ?? [],
  };
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

/* ------------------------------- Helpers -------------------------------- */

/** Status filter options. Only the values the backend documents — add more
 *  here once the backend confirms them. */
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
