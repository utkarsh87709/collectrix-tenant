// Auth token store, kept in a cookie so the API client can read it outside of
// React. The backend expects the raw token in the Authorization header (no
// "Bearer " prefix), so this cookie must stay JS-readable (NOT httpOnly);
// a truly XSS-hardened setup would have the backend set an httpOnly cookie and
// read it server-side instead of via the Authorization header.
const TOKEN_KEY = "collectrix.token";

// Single source of truth for the persisted user record key (also used by
// auth-context). Kept here so non-React modules can clear the session.
export const AUTH_USER_KEY = "collectrix.auth";

// How long the login cookie persists (mirrors the old "stay signed in until
// logout" behaviour of localStorage). A 401 clears it early regardless.
const TOKEN_MAX_AGE_DAYS = 7;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${encodeURIComponent(name)}=`;
  for (const part of document.cookie.split(";")) {
    const c = part.trim();
    if (c.startsWith(prefix)) return decodeURIComponent(c.slice(prefix.length));
  }
  return null;
}

function writeCookie(name: string, value: string, maxAgeDays: number): void {
  if (typeof document === "undefined") return;
  const maxAge = Math.floor(maxAgeDays * 24 * 60 * 60);
  // Secure only over https (so it still works on http://localhost during dev).
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}` +
    `; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(name)}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getAuthToken(): string | null {
  try {
    return readCookie(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    writeCookie(TOKEN_KEY, token, TOKEN_MAX_AGE_DAYS);
  } catch {
    /* ignore */
  }
}

export function clearAuthToken(): void {
  try {
    deleteCookie(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// Clear the whole local session (token cookie + user record).
export function clearSession(): void {
  clearAuthToken();
  try {
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {
    /* ignore */
  }
}
