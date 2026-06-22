// Tenant profile calls to the separately-hosted backend.
//   POST /tenant/myProfile               {}  -> profile
//   POST /tenant/getTimezoneList         {}  -> { timezoneList: [{timezone, timezoneValue}] }
//   POST /tenant/updateProfile           { firstName, lastName, phoneNo, timezone }
//   POST /tenant/uploadProfilePic        (multipart: file)
//   POST /tenant/sendResetMyPasswordLink {}  -> emails the signed-in user a reset link
//   POST /tenant/validateResetPassword   { resetPasswordCode }            (public, no auth)
//   POST /tenant/resetPassword           { resetPasswordCode, newPassword } (public, no auth)
import { apiPost, apiUrl } from "./api-client";
import { getAuthToken } from "./auth-token";

export type MyProfile = {
  userId: number;
  firstName: string;
  lastName: string;
  role: string;
  emailId: string;
  phoneNo: string;
  roleId: number;
  calendarConnected: boolean | null;
  timezone: string;
  profilePic: string | null;
  lastPasswordChanged: string | null;
};

export type TimezoneItem = { timezone: string; timezoneValue: number };

export function getMyProfile(): Promise<MyProfile> {
  return apiPost<MyProfile>("/tenant/myProfile");
}

export function getTimezoneList(): Promise<{ timezoneList: TimezoneItem[] }> {
  return apiPost<{ timezoneList: TimezoneItem[] }>("/tenant/getTimezoneList");
}

export function updateProfile(input: {
  firstName: string;
  lastName: string;
  phoneNo: string;
  timezone: string;
}): Promise<unknown> {
  return apiPost("/tenant/updateProfile", { ...input });
}

export function sendResetMyPasswordLink(): Promise<{ resetPasswordLink?: string }> {
  return apiPost<{ resetPasswordLink?: string }>("/tenant/sendResetMyPasswordLink");
}

// Multipart upload — can't use the JSON apiPost helper. Attach the raw token but
// let the browser set the multipart Content-Type (with boundary) itself.
export async function uploadProfilePic(file: File): Promise<Partial<MyProfile>> {
  const form = new FormData();
  form.append("file", file);
  const token = getAuthToken();
  const res = await fetch(apiUrl("/tenant/uploadProfilePic"), {
    method: "POST",
    headers: token ? { Authorization: token } : undefined,
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.meta?.status) {
    throw new Error(json?.meta?.message || "Failed to upload photo");
  }
  return (json.data ?? {}) as Partial<MyProfile>;
}

// Public reset-password flow (no auth token required). A reset link can be
// issued either from the signed-in user's own account (sendResetMyPasswordLink)
// or for another user from the Users screen (resetUserPassword) — both land the
// recipient on /resetpassword?resetPasswordCode=…, and the handling is identical.
//
// These use a bare fetch (not apiFetch/apiPost) on purpose: the visitor is
// logged out, so a 401/expired-code response must surface as an inline error
// rather than tripping the global "session expired" redirect to /login.
async function publicPost(path: string, body: Record<string, unknown>, failMsg: string): Promise<unknown> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!json?.meta?.status) {
    throw new Error(json?.meta?.message || `${failMsg} (status ${res.status}).`);
  }
  return json.data;
}

export function validateResetPassword(resetPasswordCode: string): Promise<unknown> {
  return publicPost(
    "/tenant/validateResetPassword",
    { resetPasswordCode },
    "This reset link is invalid or has expired",
  );
}

export function resetPassword(resetPasswordCode: string, newPassword: string): Promise<unknown> {
  return publicPost(
    "/tenant/resetPassword",
    { resetPasswordCode, newPassword },
    "Failed to reset password. The link may have expired",
  );
}
