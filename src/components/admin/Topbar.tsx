import { ChevronRight } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { useMemo } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { allRoutes, tenantGroups } from "@/lib/nav-registry";
import { NotificationBell } from "@/components/admin/NotificationBell";

const LABEL_OVERRIDES: Record<string, string> = {
  "/tenant": "Overview",
};

function buildLabelMap() {
  const m: Record<string, string> = { ...LABEL_OVERRIDES };
  tenantGroups.forEach((g) => g.items.forEach((i) => (m[i.to] = i.label)));
  allRoutes.forEach((i) => {
    if (!m[i.to]) m[i.to] = i.label;
  });
  return m;
}

const LABEL_MAP = buildLabelMap();

function humanize(seg: string) {
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function useBreadcrumbs() {
  const { pathname } = useLocation();
  return useMemo(() => {
    if (pathname === "/") return [{ to: "/", label: "Dashboard" }];
    const parts = pathname.split("/").filter(Boolean);
    const crumbs: { to: string; label: string }[] = [];
    let acc = "";
    for (const p of parts) {
      acc += "/" + p;
      const label = LABEL_MAP[acc] ?? humanize(p);
      crumbs.push({ to: acc, label });
    }
    return crumbs;
  }, [pathname]);
}

export function Topbar({
  title,
  subtitle,
  action,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const crumbs = useBreadcrumbs();
  const last = crumbs[crumbs.length - 1];
  const displayTitle = title ?? last?.label ?? "";

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/75 border-b border-border">
      <div className="px-4 sm:px-6 lg:px-10 py-3 sm:py-5 flex items-center gap-3 sm:gap-4">
        <SidebarTrigger className="shrink-0 -ml-1" />

        <div className="flex-1 min-w-0">
          {/* Breadcrumbs */}
          <nav
            aria-label="Breadcrumb"
            className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground mb-1"
          >
            {crumbs.map((c, i) => (
              <span key={c.to} className="flex items-center gap-1 min-w-0">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />}
                {i === crumbs.length - 1 ? (
                  <span className="font-semibold text-tenant truncate">{c.label}</span>
                ) : (
                  <Link to={c.to as never} className="hover:text-foreground transition truncate">
                    {c.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
          <h1 className="text-lg sm:text-2xl font-display font-bold tracking-tight truncate">
            {displayTitle}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>

        <NotificationBell />

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
