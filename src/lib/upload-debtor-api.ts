// Debtor data intake calls to the separately-hosted backend.
//   POST /tenant/downloadSampleTemplate { clientId }                -> { customFieldList: string[] }
//   POST /tenant/validateDebtorFile   (multipart: file)              -> ValidateResult
//   POST /tenant/uploadDebtor         { originalFileName, newFileName, clientId, debtorList } -> {}
//                                     debtorList is validateDebtorFile's validRecords + invalidRecords,
//                                     passed through unmodified — the backend recomputes valid/invalid
//                                     counts itself from each row's fields.
//   POST /tenant/getUploadedDebtor    { page, size }                 -> { totalCount, uploadFileList[] }
//   POST /tenant/debtorFileDetails    { page, size, status, searchText, fileId } -> { totalCount, debtorList[] }
//                                     (assigned records carry assignedTeamId + teamName)
//   POST /tenant/assignTeamList       { page, size, status, searchText, fileId } -> { userList[] }
//                                     NOTE: the response key is "userList" but it holds teams [{teamId, teamName}].
//   POST /tenant/assignTeam           { uploadedDebtorIdList, teamId } -> {}
//   POST /tenant/updateNewDebtor      { uploadedDebtorId, debtorDetails[], customFields[] } -> {}
//                                     Both arrays are mandatory (even empty) — echo back the field
//                                     lists a debtorFileDetails row came with, with edited values.
// Debtors are assigned to a TEAM (not an individual user) on this screen.
// All authenticated with the raw token. validateDebtorFile can't use the JSON
// apiPost helper (multipart), so it attaches the token by hand like profile-pic upload.
import { apiPost, apiUrl } from "./api-client";
import { getAuthToken } from "./auth-token";

export type InvalidAttribute = { parameterName: string; reason: string };

/** One field's value as the backend represents it — default fields carry a
 *  fieldCode (stable key like "debtorFirstName"); tenant custom fields don't,
 *  so they're matched by fieldName instead. Shared shape between a freshly
 *  parsed file row (validateDebtorFile) and a stored record (debtorFileDetails). */
export type FieldValue = {
  fieldId: number;
  fieldName: string;
  dataType: string;
  fieldCode?: string;
  fieldValue: string;
};

/** One row exactly as parsed from an uploaded file. Valid rows carry no
 *  `invalidAttribute`; flagged rows do. Passed straight through to uploadDebtor. */
export type ParsedDebtorRow = {
  record: FieldValue[];
  invalidAttribute?: InvalidAttribute[];
};

/** A stored debtor record, as returned by debtorFileDetails. */
export type DebtorRecord = {
  uploadedDebtorId: number;
  fileId?: number;
  createdAt?: string;
  assignedTo?: number | null;
  /** The team this record is assigned to (assigned status only). */
  assignedTeamId?: number | null;
  teamName?: string | null;
  statusId?: number | null;
  clientName?: string;
  clientNumber?: string;
  validRecord?: number;
  invalidAttribute: InvalidAttribute[];
  debtorDetails: FieldValue[];
  customFields: FieldValue[];
};

export type UploadedFile = {
  fileId: number;
  createdAt: string;
  updatedAt: string;
  originalFileName: string;
  newFileName: string;
  tenantId: number;
  clientId: number;
  clientName: string;
  clientNumber: string;
  status: string;
  totalCount: number;
  newCount?: number;
  assignedCount?: number;
  validCount: number;
  invalidCount: number;
};

export type ValidateResult = {
  originalFileName: string;
  newFileName: string;
  totalHeaders: number;
  totalRecords: number;
  validRecords: ParsedDebtorRow[];
  invalidRecords: ParsedDebtorRow[];
};

/** A team a debtor record can be assigned to (from assignTeamList). */
export type AssignableTeam = {
  teamId: number;
  teamName: string;
};

/** Look up a field's display value by fieldCode (default fields) or fieldName
 *  (tenant custom fields, which have no fieldCode). */
export function fieldValue(fields: FieldValue[] | undefined, codeOrName: string): string {
  return fields?.find((f) => f.fieldCode === codeOrName || f.fieldName === codeOrName)?.fieldValue ?? "";
}

/** The exact column set (default + tenant custom fields) a client's import
 *  file must match — used to build the downloadable sample CSV. */
export function downloadSampleTemplate(clientId: number): Promise<{ customFieldList: string[] }> {
  return apiPost("/tenant/downloadSampleTemplate", { clientId });
}

export async function validateDebtorFile(file: File): Promise<ValidateResult> {
  const form = new FormData();
  form.append("file", file);
  const token = getAuthToken();
  const res = await fetch(apiUrl("/tenant/validateDebtorFile"), {
    method: "POST",
    headers: token ? { Authorization: token } : undefined,
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.meta?.status) {
    throw new Error(json?.meta?.message || "Could not validate this file. Check the format and try again.");
  }
  return json.data as ValidateResult;
}

export function uploadDebtor(input: {
  originalFileName: string;
  newFileName: string;
  clientId: number;
  debtorList: ParsedDebtorRow[];
}): Promise<unknown> {
  return apiPost("/tenant/uploadDebtor", { ...input });
}

export function getUploadedDebtor(page = 0, size = 50): Promise<{ totalCount: number; uploadFileList: UploadedFile[] }> {
  return apiPost("/tenant/getUploadedDebtor", { page, size });
}

export function debtorFileDetails(input: {
  fileId: number;
  status: "new" | "assigned";
  searchText?: string;
  page?: number;
  size?: number;
}): Promise<{ totalCount: number; debtorList: DebtorRecord[] }> {
  return apiPost("/tenant/debtorFileDetails", {
    page: input.page ?? 0,
    size: input.size ?? 100,
    status: input.status,
    searchText: input.searchText ?? "",
    fileId: input.fileId,
  });
}

/** Teams a debtor record can be assigned to. Backend returns them under `userList`
 *  (legacy key reused); we surface them as `teamList` for clarity. */
export async function assignTeamList(input: {
  fileId: number;
  status: "new" | "assigned";
  searchText?: string;
}): Promise<{ teamList: AssignableTeam[] }> {
  const res = await apiPost<{ userList?: AssignableTeam[] }>("/tenant/assignTeamList", {
    page: 0,
    size: 100,
    status: input.status,
    searchText: input.searchText ?? "",
    fileId: input.fileId,
  });
  return { teamList: res.userList ?? [] };
}

export function assignTeam(uploadedDebtorIdList: number[], teamId: number): Promise<unknown> {
  return apiPost("/tenant/assignTeam", { uploadedDebtorIdList, teamId });
}

export function updateNewDebtor(input: {
  uploadedDebtorId: number;
  debtorDetails: FieldValue[];
  customFields: FieldValue[];
}): Promise<unknown> {
  return apiPost("/tenant/updateNewDebtor", input);
}
