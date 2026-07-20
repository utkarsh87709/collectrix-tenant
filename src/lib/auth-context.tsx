import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loginRequest, logoutRequest, type AuthUser } from "@/lib/auth-api";
import { AUTH_USER_KEY, clearSession, getAuthToken, setAuthToken } from "@/lib/auth-token";

// Roles are dynamic — the backend can return many different role names, and any
// of them may sign in here. The only exception is the platform super admin, who
// belongs on the Collectrix super admin portal instead. (Per-module role-based
// access control is handled separately, not at login.)
const SUPER_ADMIN_ROLE = "superAdmin";

type Ctx = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = AUTH_USER_KEY;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // Treat the session as valid only if we still have both the user and token.
      if (raw && getAuthToken()) setUser(JSON.parse(raw));
      else clearSession();
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user: u } = await loginRequest(email, password);
    if (u.role === SUPER_ADMIN_ROLE) {
      throw new Error("Super admins should sign in to the Collectrix super admin portal instead.");
    }
    setAuthToken(token);
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  };

  const logout = () => {
    // Clear the local session immediately, then notify the backend best-effort.
    void logoutRequest();
    setUser(null);
    clearSession();
  };

  return (
    <AuthCtx.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {hydrated ? children : null}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
