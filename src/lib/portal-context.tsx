import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { tenants as allTenants, type Tenant } from "@/lib/mock-data";

type Ctx = {
  tenantName: string;
  tenantId: string;
  activeTenant: Tenant | undefined;
  completedOnboarding: Record<string, boolean>;
  markOnboardingComplete: (id: string) => void;
  isFreshlyActivated: (id: string) => boolean;
  isPendingOnboarding: (id: string) => boolean;
};

const PortalCtx = createContext<Ctx | null>(null);

const LS_ONBOARDED = "collectrix.onboarded";

// This frontend serves a single tenant admin; there is no tenant switching.
const ACTIVE_TENANT_ID = "t_01";

// Demo tenants kept permanently in "invited" state so the pending/onboarding
// experience can always be previewed. Onboarding completion is never persisted
// for these IDs.
export const PERSISTENT_INVITED_TENANTS = new Set<string>(["t_11", "t_12"]);

export function PortalProvider({ children }: { children: ReactNode }) {
  const activeTenantId = ACTIVE_TENANT_ID;
  const [completedOnboarding, setCompletedOnboarding] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const o = localStorage.getItem(LS_ONBOARDED);
    if (o) {
      try {
        const parsed = JSON.parse(o) as Record<string, boolean>;
        // Drop any stale completion for demo-pinned tenants so they always
        // show the pending onboarding flow.
        for (const id of PERSISTENT_INVITED_TENANTS) delete parsed[id];
        setCompletedOnboarding(parsed);
        localStorage.setItem(LS_ONBOARDED, JSON.stringify(parsed));
      } catch {}
    }
  }, []);

  const markOnboardingComplete = (id: string) => {
    if (PERSISTENT_INVITED_TENANTS.has(id)) return; // demo tenants stay pending
    const next = { ...completedOnboarding, [id]: true };
    setCompletedOnboarding(next);
    if (typeof window !== "undefined") localStorage.setItem(LS_ONBOARDED, JSON.stringify(next));
  };

  const activeTenant = allTenants.find((t) => t.id === activeTenantId);

  const isFreshlyActivated = (id: string) => {
    const t = allTenants.find((x) => x.id === id);
    if (!t) return false;
    return t.status === "invited" && completedOnboarding[id] === true;
  };

  const isPendingOnboarding = (id: string) => {
    const t = allTenants.find((x) => x.id === id);
    if (!t) return false;
    if (PERSISTENT_INVITED_TENANTS.has(id)) return true;
    return t.status === "invited" && !completedOnboarding[id];
  };

  return (
    <PortalCtx.Provider
      value={{
        tenantName: activeTenant?.name ?? "Apex Recovery Group",
        tenantId: activeTenantId,
        activeTenant,
        completedOnboarding,
        markOnboardingComplete,
        isFreshlyActivated,
        isPendingOnboarding,
      }}
    >
      {children}
    </PortalCtx.Provider>
  );
}

export function usePortal() {
  const ctx = useContext(PortalCtx);
  if (!ctx) throw new Error("usePortal must be used inside PortalProvider");
  return ctx;
}
