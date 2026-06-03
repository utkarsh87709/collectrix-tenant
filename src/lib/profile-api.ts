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

// Public reset-password flow (no auth token required).
export function validateResetPassword(resetPasswordCode: string): Promise<unknown> {
  return apiPost("/tenant/validateResetPassword", { resetPasswordCode });
}

export function resetPassword(resetPasswordCode: string, newPassword: string): Promise<unknown> {
  return apiPost("/tenant/resetPassword", { resetPasswordCode, newPassword });
}
