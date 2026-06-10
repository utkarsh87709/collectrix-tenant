// Compliance audit-log calls to the separately-hosted backend.
//   POST /tenant/getAuditLogs  { page, size, searchText, outcome, startDate, endDate, eventType }
//                              -> { totalCount, auditLogs[] }
//   POST /tenant/getEventList  {}  -> { eventList: [{ eventName }] }  (filter dropdown)
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";

export type AuditOutcome = "Success" | "Failure";
// NOTE: the backend misspells this field as "sevirity".
export type AuditSeverity = "Info" | "Critical";

export type AuditLog = {
  auditId: number;
  createdAt: string;
  eventName: string;
  userId: number;
  tenantId: number;
  outcome: AuditOutcome;
  sevirity: AuditSeverity;
  firstName: string;
  lastName: string;
  emailId: string;
  role: string;
  companyName: string;
};

export type GetAuditLogsParams = {
  page: number;
  size: number;
  searchText: string;
  /** "Success" | "Failure" | "" for all */
  outcome: AuditOutcome | "";
  /** "YYYY-MM-DD" or "" */
  startDate: string;
  /** "YYYY-MM-DD" or "" */
  endDate: string;
  /** eventName from getEventList, or "" for all */
  eventType: string;
};

export type GetAuditLogsResult = { totalCount: number; auditLogs: AuditLog[] };

export type EventListItem = { eventName: string };

export function getAuditLogs(params: GetAuditLogsParams): Promise<GetAuditLogsResult> {
  return apiPost<GetAuditLogsResult>("/tenant/getAuditLogs", { ...params });
}

export function getEventList(): Promise<{ eventList: EventListItem[] }> {
  return apiPost<{ eventList: EventListItem[] }>("/tenant/getEventList");
}
