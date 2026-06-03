// Static, system-defined debtor status workflow.
// Statuses are NOT tenant-configurable — this module re-exports the static
// list and helpers from status-mock.ts and keeps the existing hook API so
// the rest of the app keeps working without churn.

import { statusCodes, findStatus, type StatusCode } from "./status-mock";

export function useStatusCodes(): StatusCode[] {
  return statusCodes;
}

export function getStatusCodes(): StatusCode[] {
  return statusCodes;
}

export function findManagedStatus(code: string): StatusCode | undefined {
  return findStatus(code);
}
