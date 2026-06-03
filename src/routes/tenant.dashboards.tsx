import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import {
  Briefcase, Users2, UserCog, PieChart, Building2, ShieldCheck,
  DollarSign, Wrench, CalendarClock, Database, BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/tenant/dashboards")({
  head: () => ({ meta: [{ title: "Dashboards & Reporting · Tenant Admin" }] }),
  component: DashboardsLayout,
});

const TABS: { to: string; label: string; icon: typeof BarChart3; exact?: boolean }[] = [
  { to: "/tenant/dashboards",            label: "Hub",               icon: BarChart3,   exact: true },
  { to: "/tenant/dashboards/executive",  label: "Executive",         icon: Briefcase },
  { to: "/tenant/dashboards/supervisor", label: "Supervisor",        icon: Users2 },
  { to: "/tenant/dashboards/agents",     label: "Agent Performance", icon: UserCog },
  { to: "/tenant/dashboards/creditors",  label: "Creditor Analytics", icon: PieChart },
  { to: "/tenant/dashboards/exports",    label: "Exports & BI",      icon: Database },
] as const;

function DashboardsLayout() {
  const { pathname } = useLocation();
  return (
    <Shell>
      <div className="px-6 lg:px-10 pt-6 pb-0">
        <div className="text-xs uppercase tracking-[0.2em] text-tenant font-semibold mb-2">
          Epic 17 · Dashboards & Reporting
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Dashboards & Reporting</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Role-based dashboards, custom reports, scheduled delivery, and BI exports — US-144 → US-153.
        </p>
      </div>
      <div className="px-6 lg:px-10 pt-5 border-b border-border mt-4">
        <div className="flex items-center gap-1 overflow-x-auto -mb-px">
          {TABS.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link key={t.to} to={t.to as never}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                  active ? "border-tenant text-tenant" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}>
                <Icon className="h-4 w-4" /> {t.label}
              </Link>
            );
          })}
        </div>
      </div>
      <Outlet />
    </Shell>
  );
}
