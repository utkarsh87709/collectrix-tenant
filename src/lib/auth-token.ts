// Auth token store, kept in localStorage so the API client can read it
// outside of React. The backend expects the raw token in the Authorization
// header (no "Bearer " prefix).
const TOKEN_KEY = "collectrix.token";

// Single source of truth for the persisted user record key (also used by
// auth-context). Kept here so non-React modules can clear the session.
export const AUTH_USER_KEY = "collectrix.auth";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// Clear the whole local session (token + user record).
export function clearSession(): void {
  clearAuthToken();
  try {
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {
    /* ignore */
  }
}
