// Full-page states the route guard (PermissionGate in __root.tsx) shows in
// place of a page: while the user's permissions load, when they fail to load,
// and when the user's role doesn't open the page at all.
import { Link } from "@tanstack/react-router";
import { Loader2, Lock, RefreshCw, TriangleAlert } from "lucide-react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { permissionLabel, type PermissionKey } from "@/lib/permissions/catalog";

function Panel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-6 lg:px-10 py-16">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--tenant)]/10 text-tenant">
          {icon}
        </div>
        <h2 className="mt-4 font-display text-xl font-bold tracking-tight">{title}</h2>
        {children}
      </div>
    </section>
  );
}

export function PermissionsLoading() {
  return (
    <Shell>
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading your access" />
      </div>
    </Shell>
  );
}

export function PermissionsError({ onRetry }: { onRetry: () => void }) {
  return (
    <Shell>
      <Topbar title="Couldn't load your access" />
      <Panel icon={<TriangleAlert className="h-5 w-5" />} title="We couldn't check your access">
        <p className="mt-2 text-sm text-muted-foreground">
          Your permissions didn't load, so this page is hidden for now. Check your connection and
          try again.
        </p>
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </Panel>
    </Shell>
  );
}

export function NoAccess({ required }: { required: readonly PermissionKey[] }) {
  const needs = required.map(permissionLabel).join(" or ");
  return (
    <Shell>
      <Topbar title="No access" />
      <Panel icon={<Lock className="h-5 w-5" />} title="Your role can't open this page">
        <p className="mt-2 text-sm text-muted-foreground">
          It needs the <span className="font-semibold text-foreground">{needs}</span> permission.
          Ask a tenant administrator to add it to your role.
        </p>
        <Link
          to="/tenant"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-tenant px-4 py-2 text-sm font-semibold text-white shadow-tenant"
        >
          Go to Overview
        </Link>
      </Panel>
    </Shell>
  );
}
