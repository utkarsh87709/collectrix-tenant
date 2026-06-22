// Debtor data intake calls to the separately-hosted backend.
//   POST /tenant/validateDebtorFile   (multipart: file)            -> validation result + parsed records
//   POST /tenant/uploadDebtor         { originalFileName, newFileName, clientId, debtorList } -> {}
//   POST /tenant/getUploadedDebtor    { page, size }               -> { totalCount, uploadFileList[] }
//   POST /tenant/debtorFileDetails    { page, size, status, searchText, fileId } -> { totalCount, debtorList[] }
//   POST /tenant/assignUserList       { page, size, status, searchText, fileId } -> { userList[] }
//   POST /tenant/assignUser           { uploadedDebtorIdList, userId } -> {}
//   POST /tenant/updateNewDebtor      { uploadedDebtorId, ...fields } -> {}
// All authenticated with the raw token. validateDebtorFile can't use the JSON
// apiPost helper (multipart), so it attaches the token by hand like profile-pic upload.
import { apiPost, apiUrl } from "./api-client";
import { getAuthToken } from "./auth-token";

export type InvalidAttribute = { parameterName: string; reason: string };

/** A debtor record — camelCase keys mirror DEBTOR_FIELDS. Kept loose so callers
 *  can read/write arbitrary system fields without an unwieldy 56-prop type. */
export type DebtorRecord = {
  uploadedDebtorId?: number;
  validRecord?: number;
  invalidAttribute?: InvalidAttribute[];
  assignedTo?: number | null;
  [key: string]: string | number | InvalidAttribute[] | null | undefined;
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
  extraHeaders: string[];
  totalRecords: number;
  validRecords: DebtorRecord[];
  invalidRecords: DebtorRecord[];
};

export type AssignableUser = {
  userId: number;
  firstName: string;
  role: string;
  teamName: string | null;
};

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
  debtorList: DebtorRecord[];
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

export function assignUserList(input: {
  fileId: number;
  status: "new" | "assigned";
  searchText?: string;
}): Promise<{ userList: AssignableUser[] }> {
  return apiPost("/tenant/assignUserList", {
    page: 0,
    size: 100,
    status: input.status,
    searchText: input.searchText ?? "",
    fileId: input.fileId,
  });
}

export function assignUser(uploadedDebtorIdList: number[], userId: number): Promise<unknown> {
  return apiPost("/tenant/assignUser", { uploadedDebtorIdList, userId });
}

export function updateNewDebtor(payload: Record<string, unknown>): Promise<unknown> {
  return apiPost("/tenant/updateNewDebtor", payload);
}
