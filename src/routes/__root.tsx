import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { PortalProvider } from "@/lib/portal-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";

// Only these tenant modules are enabled (have real API integration). Any other
// /tenant/* path is blocked — even via direct URL entry — and bounced to Overview.
const ENABLED_TENANT_PREFIXES = [
  "/tenant/users",
  "/tenant/roles",
  "/tenant/teams",
  "/tenant/team-deck",
  "/tenant/audit",
  "/tenant/settings",
  // Demo-only modules (mock data, no API yet).
  "/tenant/analytics",
  "/tenant/debtors",
  "/tenant/intake/clients",
  "/tenant/intake/upload",
  "/tenant/engagement/phone-numbers",
  "/tenant/engagement/template-library",
];
function isEnabledTenantPath(pathname: string): boolean {
  if (pathname === "/tenant" || pathname === "/tenant/") return true; // Overview
  return ENABLED_TENANT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const p = location.pathname;
    const isTenant = p === "/tenant" || p.startsWith("/tenant/");
    if (isTenant && !isEnabledTenantPath(p)) {
      throw redirect({ to: "/tenant" });
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Collectrix Tenant" },
      { name: "description", content: "Collectrix Tenant" },
      { name: "author", content: "Collectrix" },
      { property: "og:title", content: "Collectrix Tenant" },
      { property: "og:description", content: "Collectrix Tenant" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Collectrix" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Password-reset and tenant-invite pages are for logged-out users only.
  const loggedOutOnlyPaths = ["/reset-password", "/resetpassword", "/tenantinvite"];
  const publicPaths = ["/login", ...loggedOutOnlyPaths];
  const isPublic = publicPaths.includes(pathname);
  const isLoggedOutOnly = loggedOutOnlyPaths.includes(pathname);

  useEffect(() => {
    if (!isAuthenticated && !isPublic) {
      navigate({ to: "/login" });
    } else if (isAuthenticated && isLoggedOutOnly) {
      // A signed-in user has no business on a reset/invite link — send them home.
      navigate({ to: "/tenant" });
    }
  }, [isAuthenticated, isPublic, isLoggedOutOnly, navigate]);

  if (!isAuthenticated && !isPublic) return null;
  if (isAuthenticated && isLoggedOutOnly) return null;
  return <>{children}</>;
}

function RootComponent() {
  return (
    <AuthProvider>
      <HeadContent />
      <PortalProvider>
        <AuthGate>
          <Outlet />
        </AuthGate>
        <Toaster position="top-right" richColors />
      </PortalProvider>
    </AuthProvider>
  );
}
