import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loginRequest, logoutRequest, type AuthUser } from "@/lib/auth-api";
import { AUTH_USER_KEY, clearSession, getAuthToken, setAuthToken } from "@/lib/auth-token";

// Only tenant admins may use this portal. The backend returns this role value.
const TENANT_ROLE = "tenantAdmin";

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
    if (u.role !== TENANT_ROLE) {
      throw new Error("Access denied. This portal is for tenant administrators only.");
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
