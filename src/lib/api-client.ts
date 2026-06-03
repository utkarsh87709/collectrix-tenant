// Thin fetch wrapper for the separately-hosted backend.
// Set the backend origin via VITE_API_BASE_URL (see .env). When empty,
// requests resolve against the current origin (useful behind a reverse proxy).
import { clearSession, getAuthToken } from "./auth-token";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

// On a 401 the session is dead: clear it and bounce to the login screen.
// Guarded so concurrent failing requests don't trigger multiple redirects.
let redirectingToLogin = false;
function handleUnauthorized(): void {
  clearSession();
  if (typeof window !== "undefined" && !redirectingToLogin && window.location.pathname !== "/login") {
    redirectingToLogin = true;
    window.location.assign("/login");
  }
}

export function apiUrl(path: string): string {
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

type ApiFetchOptions = RequestInit & {
  /** Set false to skip attaching the Authorization token (e.g. login). */
  auth?: boolean;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { auth = true, headers, ...init } = options;
  const token = auth ? getAuthToken() : null;

  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      // Backend expects the raw token, not a "Bearer " prefix.
      ...(token ? { Authorization: token } : {}),
      ...(headers ?? {}),
    },
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    // Prefer the envelope's meta.message when the error body is JSON.
    let message = raw;
    try {
      const parsed = JSON.parse(raw);
      message = parsed?.meta?.message || parsed?.message || raw;
    } catch {
      /* not JSON; use raw text */
    }
    throw new Error(message || `Request failed with status ${res.status}`);
  }

  // Tolerate empty 204 responses.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

type Envelope<T> = {
  meta?: { status?: boolean; message?: string; code?: number };
  data?: T;
};

// POST helper for the standard { meta, data } envelope. Success is read from
// meta.status (the backend returns HTTP 200 even for business errors), and the
// raw token is attached automatically.
export async function apiPost<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await apiFetch<Envelope<T>>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res?.meta?.status) {
    throw new Error(res?.meta?.message || "Request failed. Please try again.");
  }
  return res.data as T;
}
