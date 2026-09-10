// Customer (debtor case file) calls to the separately-hosted backend — the
// "Case Files → Customers" module. getCustomerList only ever returns files
// where the signed-in user is the Assigned Agent (never the whole tenant book,
// a team's book, or files the user merely manages/leads).
//
//   POST /tenant/getCustomerList { page, size, searchText, clientId, teamId, statusId,
//                                  currentOutstandingBalanceMin/Max,
//                                  delinquencyStartDate/EndDate, dateOfLastPaymentStart/End }
//                                -> { totalCount, debtorList[] }
//     Date filters are yyyy-mm-dd (verified against the identical param shape on
//     getMassUpdateDebtorList — dd/mm/yyyy 500s with "Server Error"; ISO works).
//     clientId/teamId/statusId are real server-side equality filters — verified
//     live (2026-09-02): passing a real id narrows totalCount correctly, a
//     non-matching id returns 0 rows. The filter rail gets its option lists from
//     the real master-data endpoints (teams-api's getTeamList, mass-update-api's
//     getClientList, statuses-api's getAllStatus) and passes the chosen id straight
//     through here — no client-side name matching involved. There's no "is
//     unassigned" / "has no status" equality value, so the filter rail doesn't
//     offer those two options at all (rather than fake them client-side against
//     just the current page) — ask backend for a sentinel/flag before adding them.
//     IMPORTANT: each row here is much thinner than getCustomerDetails — no
//     delinquencyDate, dateOfLastPayment, statusColorCode/statusId, or clientId/
//     teamId of its own (name strings only) — fine for display and for the
//     equality filters above, but not enough to recover a stable id per row.
//   POST /tenant/getCustomerDetails { uploadedDebtorId } -> full profile, incl.
//     archivedFlag, engagementStatus (1 active / 0 stopped), statusColorCode, customFields[].
//     Date fields on this endpoint (dob, delinquencyDate, dateOfLastPayment,
//     interestStartDate) are dd/mm/yyyy strings — see parseBackendDate.
//   POST /tenant/getCustomerNotes   { uploadedDebtorId } -> { noteList[] }
//   POST /tenant/createCustomerNotes (multipart: uploadedDebtorId, title, description, file[]) -> {}
//   POST /tenant/updateCustomerNotes (multipart: notesBody=<JSON string>, file[]) -> {}
//   POST /tenant/deleteCustomerNotes { notesId, uploadedDebtorId } -> {}
//     All three mutations return an empty data object — refetch getCustomerNotes after each.
//   POST /tenant/getCustomerEmail  { uploadedDebtorId } -> { emailList[] }
//   POST /tenant/sendCustomerEmail { uploadedDebtorId, emailSubject, emailBody } -> {}
//     Load the most recent thread subject as the default so a reply stays on the same thread.
//   POST /tenant/getCustomerSms    { uploadedDebtorId } -> { emailList[] }
//     NOTE: the backend's own key for this endpoint is literally "emailList" (a
//     server-side copy/paste bug) even though it holds SMS rows — aliased below.
//     One historical row was also seen with fromPhoneNo:"[object Object]" — a
//     backend serialization bug on the send path, not something to work around here.
//   POST /tenant/sendCustomerSms   { uploadedDebtorId, body } -> {}
//   POST /tenant/callCustomerNumberList { uploadedDebtorId, callTo: "" } -> { phoneNoList: string[] }
//     These are the TENANT's own caller-ID numbers (to dial FROM), not the customer's.
//   POST /tenant/initiateCustomerCall { uploadedDebtorId, callTo, callFrom } -> {}
//   POST /tenant/getCustomerCalls   { uploadedDebtorId } -> { callList[] }
//   POST /tenant/getCustomerCallDetails { uploadedDebtorId, id } -> call + transcript + summary
//   POST /tenant/archiveCustomer    { uploadedDebtorId } -> {}
//     Sets archivedFlag. Reversible since 2026-09-08 via archive-api's unArchiveCustomer
//     (POST /tenant/UnArchiveCustomer) — the file sits on Case Files → Archive until restored.
//   POST /tenant/stopEngagement     { uploadedDebtorId } -> {}  (engagementStatus 1 -> 0)
//   POST /tenant/startEngagement    { uploadedDebtorId } -> {}  (engagementStatus 0 -> 1)
//     Verified live and reversible (toggled and restored in dev).
//   POST /tenant/changeCustomerTeam { uploadedDebtorIdList, teamId, remark } -> {}
//     Verified live: clears assignedTo AND resets statusId to the tenant's initial
//     status. The file drops off every member's getCustomerList and appears on the
//     destination team's Moved Files queue (getMovedCustomers) instead — matches the
//     "Move to team" dialog copy exactly. Not reliably reversible from this API alone:
//     assignMovedFileStatusAndUser (Moved Files reassignment) was tested live and
//     appears to no-op (returns meta.status:true but never actually assigns).
//   POST /tenant/assignTeamList     {} -> { userList: [{teamId, teamName}] }
//     Legacy response key ("userList") holds teams, not users — aliased below.
//   POST /tenant/updateCustomerStatus  { uploadedDebtorIdList, statusId } -> {}
//     Bulk or single status change (added 2026-09-10). Used by the list page's
//     bulk bar and the detail header's status dropdown.
//   POST /tenant/updateCustomerDetails { uploadedDebtorId, ...every editable field, statusId,
//                                        customFields[{fieldId, fieldName, fieldValue}] } -> {}
//     Full-record update (added 2026-09-10) — send every field back, not a patch.
//     Dates go as dd/mm/yyyy, the same format getCustomerDetails returns and the
//     intake validators demand; see backendDateToInput / inputDateToBackend.
//   POST /tenant/getTagList        { uploadedDebtorId } -> { tagList[] }
//   POST /tenant/assignCustomerTag { uploadedDebtorId, tagName } -> {}
//   POST /tenant/deleteCustomerTag { uploadedDebtorId, tagName } -> {}
//     Tags ("flags" in the UI) are free-form names. getCustomerDetails carries the
//     file's own tags as customerTags (null when none). Every live probe returned an
//     empty tagList and a null customerTags, so the populated shape is NOT confirmed —
//     normalizeTags accepts a comma-separated string or an array of strings/objects.
// All authenticated with the raw token (attached automatically by apiPost); the two
// multipart note calls attach it by hand, matching every other module's file-upload helper.
import { apiPost, apiUrl } from "./api-client";
import { getAuthToken } from "./auth-token";

/* ------------------------------- List ------------------------------- */

export type CustomerListItem = {
  uploadedDebtorId: number;
  ourFileNo: string;
  debtorFirstName: string | null;
  debtorMiddleName: string | null;
  debtorLastName: string | null;
  creditorName: string;
  clientName: string;
  clientNumber: string;
  teamName: string | null;
  status: string | null;
  currentOutstandingBalance: string | null;
  assignedUserFirstName: string | null;
  assignedUserLastName: string | null;
  leaderFirstName: string | null;
  leaderLastName: string | null;
};

export type CustomerListFilters = {
  page?: number;
  size?: number;
  searchText?: string;
  clientId?: number | null;
  teamId?: number | null;
  statusId?: number | null;
  currentOutstandingBalanceMin?: number | null;
  currentOutstandingBalanceMax?: number | null;
  /** yyyy-mm-dd — native <input type="date"> value, passed straight through. */
  delinquencyStartDate?: string | null;
  delinquencyEndDate?: string | null;
  dateOfLastPaymentStart?: string | null;
  dateOfLastPaymentEnd?: string | null;
};

const LIST_FILTER_DEFAULTS: Required<Omit<CustomerListFilters, "page" | "size">> = {
  searchText: "",
  clientId: null,
  teamId: null,
  statusId: null,
  currentOutstandingBalanceMin: null,
  currentOutstandingBalanceMax: null,
  delinquencyStartDate: null,
  delinquencyEndDate: null,
  dateOfLastPaymentStart: null,
  dateOfLastPaymentEnd: null,
};

export function getCustomerList(
  filters: CustomerListFilters = {},
): Promise<{ totalCount: number; debtorList: CustomerListItem[] }> {
  return apiPost("/tenant/getCustomerList", {
    ...LIST_FILTER_DEFAULTS,
    ...filters,
    page: filters.page ?? 0,
    size: filters.size ?? 200,
  });
}

/* ----------------------------- Details ------------------------------ */

export type CustomFieldValue = {
  fieldId: number;
  fieldName: string;
  dataType: string;
  fieldValue: string | null;
};

export type CustomerDetails = {
  uploadedDebtorId: number;
  createdAt: string;
  fileId: number;
  ourFileNo: string;
  creditorName: string;
  address: string;
  homeNo: string;
  cellNo1: string;
  cellNo2: string;
  email: string;
  /** dd/mm/yyyy */
  dob: string;
  principal: string;
  interestRate: string;
  interestType: string;
  compoundingFrequency: string;
  /** dd/mm/yyyy */
  interestStartDate: string;
  currentOutstandingBalance: string;
  currency: string;
  /** dd/mm/yyyy */
  delinquencyDate: string;
  /** dd/mm/yyyy */
  dateOfLastPayment: string;
  lastPaymentAmount: string;
  lastPaymentMethod: string;
  totalPaidToDate: string;
  preferredLanguage: string;
  invalidAttribute: unknown[];
  assignedTo: number | null;
  assignedTeamId: number | null;
  statusId: number | null;
  validRecord: number;
  debtorFirstName: string | null;
  debtorMiddleName: string | null;
  debtorLastName: string | null;
  initialAssignment: number;
  archivedFlag: number;
  /** 1 = engagement active, 0 = stopped. */
  engagementStatus: number;
  movedAt: string | null;
  movedBy: number | null;
  archivedAt: string | null;
  archivedBy: number | null;
  unreadMsgCount: number;
  /** The file's tags/flags. null when none; populated shape unconfirmed — read via normalizeTags. */
  customerTags: unknown;
  clientName: string;
  clientNumber: string;
  teamName: string | null;
  status: string | null;
  statusCode: string | null;
  statusColorCode: string | null;
  assignedUserFirstName: string | null;
  assignedUserLastName: string | null;
  leaderFirstName: string | null;
  leaderLastName: string | null;
  customFields: CustomFieldValue[];
};

export function getCustomerDetails(uploadedDebtorId: number): Promise<CustomerDetails> {
  return apiPost("/tenant/getCustomerDetails", { uploadedDebtorId });
}

/* ------------------------------ Notes -------------------------------- */

export type CustomerNote = {
  notesId: number;
  createdAt: string;
  updatedAt: string;
  uploadedDebtorId: number;
  createdBy: number;
  title: string;
  description: string;
  files: string[];
  deletedFlag: number;
  createUserFirstName: string;
  createdUserLastName: string;
};

export function getCustomerNotes(uploadedDebtorId: number): Promise<{ noteList: CustomerNote[] }> {
  return apiPost("/tenant/getCustomerNotes", { uploadedDebtorId });
}

// Multipart helper matching the pattern already used by upload-debtor-api.ts,
// mass-update-api.ts and profile-api.ts — apiPost hardcodes JSON content-type,
// so multipart calls attach the token by hand and let the browser set the
// multipart boundary itself.
async function multipartPost(path: string, form: FormData): Promise<void> {
  const token = getAuthToken();
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: token ? { Authorization: token } : undefined,
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.meta?.status) {
    throw new Error(json?.meta?.message || "Request failed. Please try again.");
  }
}

export async function createCustomerNotes(input: {
  uploadedDebtorId: number;
  title: string;
  description: string;
  files?: File[];
}): Promise<void> {
  const form = new FormData();
  form.append("uploadedDebtorId", String(input.uploadedDebtorId));
  form.append("title", input.title);
  form.append("description", input.description);
  for (const f of input.files ?? []) form.append("file", f);
  await multipartPost("/tenant/createCustomerNotes", form);
}

export async function updateCustomerNotes(input: {
  notesId: number;
  uploadedDebtorId: number;
  title: string;
  description: string;
  /** Existing S3 file URLs to keep — omit a URL to drop that attachment. */
  existingFiles?: string[];
  newFiles?: File[];
}): Promise<void> {
  const form = new FormData();
  form.append(
    "notesBody",
    JSON.stringify({
      notesId: input.notesId,
      uploadedDebtorId: input.uploadedDebtorId,
      title: input.title,
      description: input.description,
      files: input.existingFiles ?? [],
    }),
  );
  for (const f of input.newFiles ?? []) form.append("file", f);
  await multipartPost("/tenant/updateCustomerNotes", form);
}

export function deleteCustomerNotes(notesId: number, uploadedDebtorId: number): Promise<unknown> {
  return apiPost("/tenant/deleteCustomerNotes", { notesId, uploadedDebtorId });
}

/* --------------------------- Communication ---------------------------- */

export type CustomerEmailMessage = {
  id: number;
  createdAt: string;
  fromEmail: string;
  toEmail: string;
  emailSubject: string;
  emailBody: string;
  direction: "outgoing" | "incoming";
  createdBy: number | null;
  senderName: string;
};

export function getCustomerEmail(
  uploadedDebtorId: number,
): Promise<{ emailList: CustomerEmailMessage[] }> {
  return apiPost("/tenant/getCustomerEmail", { uploadedDebtorId });
}

export function sendCustomerEmail(input: {
  uploadedDebtorId: number;
  emailSubject: string;
  emailBody: string;
}): Promise<unknown> {
  return apiPost("/tenant/sendCustomerEmail", { ...input });
}

export type CustomerSmsMessage = {
  id: number;
  createdAt: string;
  fromPhoneNo: string;
  toPhoneNo: string;
  body: string;
  direction: "outgoing" | "incoming";
  createdBy: number | null;
  senderName: string;
};

export async function getCustomerSms(
  uploadedDebtorId: number,
): Promise<{ smsList: CustomerSmsMessage[] }> {
  const data = await apiPost<{ emailList?: CustomerSmsMessage[]; smsList?: CustomerSmsMessage[] }>(
    "/tenant/getCustomerSms",
    { uploadedDebtorId },
  );
  return { smsList: data.smsList ?? data.emailList ?? [] };
}

export function sendCustomerSms(input: {
  uploadedDebtorId: number;
  body: string;
}): Promise<unknown> {
  return apiPost("/tenant/sendCustomerSms", { ...input });
}

/* ------------------------------- Calls -------------------------------- */

export type CustomerCall = {
  id: number;
  createdAt: string;
  fromPhoneNo: string;
  toPhoneNo: string;
  direction: "outgoing" | "incoming";
  callStatus: string;
  recordingDuration: number;
  recordingLink: string;
  callType: string;
};

export function getCustomerCalls(uploadedDebtorId: number): Promise<{ callList: CustomerCall[] }> {
  return apiPost("/tenant/getCustomerCalls", { uploadedDebtorId });
}

export type CustomerCallTranscriptLine = { text: string; speaker: string };

export type CustomerCallDetails = CustomerCall & {
  callId: string | null;
  recordingId: string;
  callSummary: string;
  conversation: CustomerCallTranscriptLine[];
};

export function getCustomerCallDetails(
  uploadedDebtorId: number,
  id: number,
): Promise<CustomerCallDetails> {
  return apiPost("/tenant/getCustomerCallDetails", { uploadedDebtorId, id });
}

/** The tenant's own caller-ID numbers available to place an outbound call from. */
export function callCustomerNumberList(
  uploadedDebtorId: number,
): Promise<{ phoneNoList: string[] }> {
  return apiPost("/tenant/callCustomerNumberList", { uploadedDebtorId, callTo: "" });
}

export function initiateCustomerCall(input: {
  uploadedDebtorId: number;
  callTo: string;
  callFrom: string;
}): Promise<unknown> {
  return apiPost("/tenant/initiateCustomerCall", { ...input });
}

/* ---------------------------- Lifecycle -------------------------------- */

/** Reversible: the file lands on Case Files → Archive, and archive-api's
 *  unArchiveCustomer brings it back. */
export function archiveCustomer(uploadedDebtorId: number): Promise<unknown> {
  return apiPost("/tenant/archiveCustomer", { uploadedDebtorId });
}

export function stopEngagement(uploadedDebtorId: number): Promise<unknown> {
  return apiPost("/tenant/stopEngagement", { uploadedDebtorId });
}

export function startEngagement(uploadedDebtorId: number): Promise<unknown> {
  return apiPost("/tenant/startEngagement", { uploadedDebtorId });
}

/** Clears assignment and resets status to the tenant's initial status on every
 *  file moved — warn accordingly in any confirmation dialog. */
export function changeCustomerTeam(input: {
  uploadedDebtorIdList: number[];
  teamId: number;
  remark?: string;
}): Promise<unknown> {
  return apiPost("/tenant/changeCustomerTeam", { remark: "", ...input });
}

export type AssignableTeam = { teamId: number; teamName: string };

/** Teams a customer file can be moved to. Reuses the same backend route as the
 *  intake flow's assignTeamList, called with no body — distinct export so the
 *  two call sites (intake vs. customer detail) don't share a signature. */
export async function getAssignableTeams(): Promise<{ teamList: AssignableTeam[] }> {
  const data = await apiPost<{ userList?: AssignableTeam[] }>("/tenant/assignTeamList", {});
  return { teamList: data.userList ?? [] };
}

/* -------------------------------- Status --------------------------------- */

/** Set the status of one or more files in a single call. */
export function updateCustomerStatus(input: {
  uploadedDebtorIdList: number[];
  statusId: number;
}): Promise<unknown> {
  return apiPost("/tenant/updateCustomerStatus", { ...input });
}

/* ----------------------------- Edit details ------------------------------- */

/** Every field updateCustomerDetails accepts. It replaces the record, so callers
 *  send the current value for anything they didn't change. Dates are dd/mm/yyyy. */
export type UpdateCustomerDetailsInput = {
  uploadedDebtorId: number;
  creditorName: string;
  address: string;
  homeNo: string;
  cellNo1: string;
  cellNo2: string;
  email: string;
  dob: string;
  principal: string;
  interestRate: string;
  interestType: string;
  compoundingFrequency: string;
  interestStartDate: string;
  currentOutstandingBalance: string;
  currency: string;
  delinquencyDate: string;
  dateOfLastPayment: string;
  lastPaymentAmount: string;
  lastPaymentMethod: string;
  totalPaidToDate: string;
  preferredLanguage: string;
  debtorFirstName: string | null;
  debtorMiddleName: string | null;
  debtorLastName: string | null;
  statusId: number | null;
  customFields: { fieldId: number; fieldName: string; fieldValue: string | null }[];
};

export function updateCustomerDetails(input: UpdateCustomerDetailsInput): Promise<unknown> {
  return apiPost("/tenant/updateCustomerDetails", { ...input });
}

/* ------------------------------ Tags / flags ------------------------------ */

/** Tag names known for this file/tenant — see the header note on shape. */
export async function getTagList(uploadedDebtorId: number): Promise<string[]> {
  const data = await apiPost<{ tagList?: unknown } | null>("/tenant/getTagList", {
    uploadedDebtorId,
  });
  return normalizeTags(data?.tagList);
}

export function assignCustomerTag(uploadedDebtorId: number, tagName: string): Promise<unknown> {
  return apiPost("/tenant/assignCustomerTag", { uploadedDebtorId, tagName });
}

export function deleteCustomerTag(uploadedDebtorId: number, tagName: string): Promise<unknown> {
  return apiPost("/tenant/deleteCustomerTag", { uploadedDebtorId, tagName });
}

/** Coerce whatever the backend sends for tags into a clean list of names:
 *  null/undefined → [], "a, b" → ["a","b"], ["a"] → ["a"], [{tagName:"a"}] → ["a"]. */
export function normalizeTags(raw: unknown): string[] {
  if (raw == null) return [];
  const names: string[] = [];
  if (typeof raw === "string") {
    names.push(...raw.split(","));
  } else if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") names.push(item);
      else if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const v = o.tagName ?? o.name ?? o.tag;
        if (typeof v === "string") names.push(v);
      }
    }
  }
  const seen = new Set<string>();
  return names
    .map((n) => n.trim())
    .filter((n) => n && !seen.has(n.toLowerCase()) && (seen.add(n.toLowerCase()), true));
}

/* ------------------------------- Helpers -------------------------------- */

export function customerDisplayName(c: {
  debtorFirstName?: string | null;
  debtorMiddleName?: string | null;
  debtorLastName?: string | null;
  ourFileNo?: string | null;
}): string {
  const full = [c.debtorFirstName, c.debtorMiddleName, c.debtorLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || c.ourFileNo || "—";
}

export function toMoney(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(v: string | number | null | undefined): string {
  return `$${toMoney(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Backend dates (dob, delinquencyDate, dateOfLastPayment, interestStartDate on
 *  getCustomerDetails) are dd/mm/yyyy strings. Returns null when blank/unparseable. */
export function parseBackendDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function fullName(u: { firstName?: string | null; lastName?: string | null }): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
}

/** dd/mm/yyyy (backend) → yyyy-mm-dd for a native date input. "" when blank or
 *  not in that format — callers fall back to a plain text box so an oddly
 *  formatted stored value is never silently wiped on save. */
export function backendDateToInput(s: string | null | undefined): string {
  const d = parseBackendDate(s);
  if (!d) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** yyyy-mm-dd (native date input) → dd/mm/yyyy for the backend; "" stays "". */
export function inputDateToBackend(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
