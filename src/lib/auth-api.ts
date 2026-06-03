// Authentication calls to the separately-hosted backend.
//   POST /user/login   { emailId, password }  -> { meta, data: { token, ...user } }
//   POST /user/logout  (Authorization: <raw token>, empty body)
import { apiUrl } from "./api-client";
import { getAuthToken } from "./auth-token";

export type AuthUser = {
  userId: number;
  emailId: string;
  firstName: string;
  lastName: string;
  phoneNo: string;
  role: string;
};

type LoginApiResponse = {
  meta?: { status?: boolean; message?: string; code?: number };
  data?: ({ token: string } & Partial<AuthUser>) | null;
};

export type LoginResult = { token: string; user: AuthUser };

export async function loginRequest(emailId: string, password: string): Promise<LoginResult> {
  let res: Response;
  try {
    res = await fetch(apiUrl("/user/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId, password }),
    });
  } catch {
    throw new Error("Unable to reach the server. Please check your connection and try again.");
  }

  const json = (await res.json().catch(() => null)) as LoginApiResponse | null;

  if (!res.ok || !json?.meta?.status || !json?.data?.token) {
    throw new Error(json?.meta?.message || "Invalid email or password.");
  }

  const d = json.data;
  return {
    token: d.token,
    user: {
      userId: Number(d.userId ?? 0),
      emailId: d.emailId ?? emailId,
      firstName: d.firstName ?? "",
      lastName: d.lastName ?? "",
      phoneNo: d.phoneNo ?? "",
      role: d.role ?? "",
    },
  };
}

export async function logoutRequest(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;
  try {
    await fetch(apiUrl("/user/logout"), {
      method: "POST",
      headers: { Authorization: token },
    });
  } catch {
    // Best-effort; local session is cleared regardless.
  }
}
