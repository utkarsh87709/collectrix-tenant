// Status configuration calls to the separately-hosted backend. Tenants define
// their own account-lifecycle statuses (code, display name, pill colour).
//   POST /tenant/getAllStatus {}                                                     -> { statusList[] } | Status[]
//   POST /tenant/createStatus { statusCode, status, statusColorCode, aiContext }      -> {}
//   POST /tenant/updateStatus { statusId, statusCode, status, statusColorCode, aiContext } -> {}
//   POST /tenant/deleteStatus { statusId }                                            -> {}
// updateStatus propagates to any debtor already on that status; deleteStatus
// fails (meta.status:false) when the status is still assigned to a debtor.
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";

export type Status = {
  statusId: number;
  /** Short code, e.g. "ACT". Stays bound to existing files. */
  statusCode: string;
  /** Human-readable display name, e.g. "Active". */
  status: string;
  /** Pill colour, hex (e.g. "#1EC9A0"). */
  statusColorCode: string;
  /** Free-text guidance handed to the AI agent when a file sits on this status.
   *  Null/empty when the tenant hasn't written any. */
  aiContext?: string | null;
  /** 1 when this is the status new debtors start on (set via Status Automation). */
  initialStatusFlag?: number;
};

export type StatusInput = {
  statusCode: string;
  status: string;
  statusColorCode: string;
  /** Optional AI guidance; send "" to clear it. */
  aiContext?: string;
};

export async function getAllStatus(): Promise<Status[]> {
  const data = await apiPost<Status[] | { statusList?: Status[]; statuses?: Status[] }>(
    "/tenant/getAllStatus",
    {},
  );
  if (Array.isArray(data)) return data;
  return data?.statusList ?? data?.statuses ?? [];
}

export function createStatus(input: StatusInput): Promise<unknown> {
  return apiPost("/tenant/createStatus", { ...input, aiContext: input.aiContext ?? "" });
}

export function updateStatus(input: StatusInput & { statusId: number }): Promise<unknown> {
  // Always send aiContext — omitting it would leave stale guidance in place.
  return apiPost("/tenant/updateStatus", { ...input, aiContext: input.aiContext ?? "" });
}

export function deleteStatus(statusId: number): Promise<unknown> {
  return apiPost("/tenant/deleteStatus", { statusId });
}

/** Pick a readable text colour (dark vs white) for a given pill background so
 *  the code/name stay legible on any hex the tenant chooses. */
export function pillTextColor(hex: string): string {
  const c = (hex ?? "").replace("#", "");
  if (c.length !== 3 && c.length !== 6) return "#ffffff";
  const full =
    c.length === 3
      ? c
          .split("")
          .map((x) => x + x)
          .join("")
      : c;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // Relative luminance (sRGB) — > 0.6 is a light background → use dark text.
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0B1220" : "#ffffff";
}

/** True when `hex` is a valid 3- or 6-digit hex colour (with leading #). */
export function isValidHex(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}
