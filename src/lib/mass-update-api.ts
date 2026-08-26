// Mass Update calls to the separately-hosted backend. Lets a tenant admin
// export a filtered slice of their debtor book as a spreadsheet, edit it
// offline, and re-upload it to update those records in bulk.
//   POST /tenant/getclientList             {}                              -> { clientList: [{clientId, clientName, clientNumber}] }
//                                           (lightweight; used for the filter sidebar, not clients-api's getAllClients)
//   POST /tenant/getStatusList             {}                              -> { statusList: [{statusId, status}] }
//                                           (name-only; use statuses-api's getAllStatus for colour/code)
//   POST /tenant/getMassUpdateDebtorList    { page, size, ...filters }      -> { totalCount, debtorList[] }
//   POST /tenant/downloadMassUpdateDebtorList { uploadedDebtorIdList }      -> { headers[], debtorFieldList[][] }
//                                           (row-major matrix, ready to write out as CSV)
//   POST /tenant/validateMassUpdateDebtor  (multipart: file)                -> ValidateResult (same envelope as validateDebtorFile)
//   POST /tenant/updateMassDebtor          { debtorList: MassUpdateRecord[] } -> {}
//                                           debtorList is validateMassUpdateDebtor's validRecords, passed through
//                                           unmodified — each row is matched to an existing debtor by "Our file
//                                           number" and only the fields present on the record are changed.
// validateMassUpdateDebtor matches rows by "Our file number": if ANY value in
// that column is blank or doesn't belong to this tenant, the WHOLE file is
// rejected (meta.status:false) and nothing is parsed. A blank cell elsewhere
// means "leave this field as-is" — it's simply omitted from the returned
// record; send the literal text [CLEAR] to blank a field out instead.
// The backend does NOT reject a file number repeated across two rows — that
// safety check is enforced client-side in the review step.
// All authenticated with the raw token. validateMassUpdateDebtor can't use the
// JSON apiPost helper (multipart), so it attaches the token by hand.
import { apiPost, apiUrl } from "./api-client";
import { getAuthToken } from "./auth-token";

/** Lightweight client shape for the filter sidebar (see getclientList above). */
export type MassUpdateClient = {
  clientId: number;
  clientName: string;
  clientNumber: string;
};

export function getClientList(): Promise<{ clientList: MassUpdateClient[] }> {
  return apiPost<{ clientList: MassUpdateClient[] }>("/tenant/getclientList");
}

export type MassUpdateStatus = {
  statusId: number;
  status: string;
};

export function getStatusList(): Promise<{ statusList: MassUpdateStatus[] }> {
  return apiPost<{ statusList: MassUpdateStatus[] }>("/tenant/getStatusList");
}

/** One row of the Mass Update table — a debtor file already in the system. */
export type MassUpdateDebtor = {
  uploadedDebtorId: number;
  ourFileNo: string;
  debtorFirstName: string;
  debtorMiddleName?: string | null;
  debtorLastName?: string | null;
  creditorName: string;
  clientName: string;
  clientNumber: string;
  teamName: string | null;
  status: string | null;
  currentOutstandingBalance: string;
};

export type MassUpdateFilters = {
  page?: number;
  size?: number;
  clientId?: number | null;
  teamId?: number | null;
  statusId?: number | null;
  searchText?: string;
  dateOfLastPaymentStart?: string | null;
  dateOfLastPaymentEnd?: string | null;
  delinquencyStartDate?: string | null;
  delinquencyEndDate?: string | null;
  currentOutstandingBalanceMin?: number | null;
  currentOutstandingBalanceMax?: number | null;
};

const FILTER_DEFAULTS: Required<Omit<MassUpdateFilters, "page" | "size">> = {
  clientId: null,
  teamId: null,
  statusId: null,
  searchText: "",
  dateOfLastPaymentStart: null,
  dateOfLastPaymentEnd: null,
  delinquencyStartDate: null,
  delinquencyEndDate: null,
  currentOutstandingBalanceMin: null,
  currentOutstandingBalanceMax: null,
};

export function getMassUpdateDebtorList(
  filters: MassUpdateFilters,
): Promise<{ totalCount: number; debtorList: MassUpdateDebtor[] }> {
  return apiPost("/tenant/getMassUpdateDebtorList", {
    ...FILTER_DEFAULTS,
    ...filters,
    page: filters.page ?? 0,
    size: filters.size ?? 20,
  });
}

/** A downloadable slice, matrix-shaped so it can be written straight out as CSV. */
export type MassUpdateExport = {
  headers: string[];
  debtorFieldList: string[][];
};

export function downloadMassUpdateDebtorList(
  uploadedDebtorIdList: number[],
): Promise<MassUpdateExport> {
  return apiPost<MassUpdateExport>("/tenant/downloadMassUpdateDebtorList", {
    uploadedDebtorIdList,
  });
}

/** A single cell coming back from validateMassUpdateDebtor. Custom fields omit
 *  `fieldCode` (they're identified by `fieldId` only); default fields carry both. */
export type MassUpdateFieldValue = {
  fieldName: string;
  fieldValue: string;
  fieldId: number;
  dataType: string;
  fieldCode?: string;
};

export type MassUpdateInvalidAttribute = { parameterName: string; reason: string };

/** One row's worth of changes. Only fields that were non-blank in the upload
 *  are present — a blank cell means "no change" and is simply omitted. */
export type MassUpdateRecord = {
  record: MassUpdateFieldValue[];
  invalidAttribute?: MassUpdateInvalidAttribute[];
};

export type MassUpdateValidateResult = {
  originalFileName: string;
  newFileName: string;
  totalHeaders: number;
  totalRecords: number;
  validRecords: MassUpdateRecord[];
  invalidRecords: MassUpdateRecord[];
};

export async function validateMassUpdateDebtor(file: File): Promise<MassUpdateValidateResult> {
  const form = new FormData();
  form.append("file", file);
  const token = getAuthToken();
  const res = await fetch(apiUrl("/tenant/validateMassUpdateDebtor"), {
    method: "POST",
    headers: token ? { Authorization: token } : undefined,
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.meta?.status) {
    throw new Error(
      json?.meta?.message || "Could not validate this file. Check the format and try again.",
    );
  }
  return json.data as MassUpdateValidateResult;
}

/** Commits a validated batch. Pass validateMassUpdateDebtor's `validRecords`
 *  as-is — flagged rows should be excluded, they're not matched/applied. */
export function updateMassDebtor(debtorList: MassUpdateRecord[]): Promise<unknown> {
  return apiPost("/tenant/updateMassDebtor", { debtorList });
}

/** Quote a CSV cell only when it needs it (contains a comma, quote or newline). */
function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Build a CSV string from an export payload, ready to hand to a Blob. */
export function buildMassUpdateCsv(payload: MassUpdateExport): string {
  const lines = [payload.headers.map(csvCell).join(",")];
  for (const row of payload.debtorFieldList) {
    lines.push(row.map((cell) => csvCell(cell ?? "")).join(","));
  }
  return lines.join("\n") + "\n";
}
