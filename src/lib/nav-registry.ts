import { LayoutDashboard, Users, ShieldCheck, Gauge } from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  description?: string;
  keywords?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/* ---------------------------------- TENANT ---------------------------------- */

// Only modules with real API integration are enabled. Everything else is
// hidden from navigation and blocked at the route level (see __root.tsx).
export const tenantGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { to: "/tenant", label: "Overview", icon: Gauge, description: "Dashboards, KPIs and reports" },
    ],
  },
  {
    label: "Access Control",
    items: [
      { to: "/tenant/users", label: "Users", icon: Users, description: "Members and invitations", keywords: "users members invite" },
      { to: "/tenant/roles", label: "Roles & Permissions", icon: ShieldCheck, description: "Custom roles and permissions", keywords: "roles permissions access" },
    ],
  },
];

/* --------------------------- SEARCHABLE FLAT LIST --------------------------- */

/** Used by the global ⌘K palette — only the enabled destinations. */
export const allRoutes: NavItem[] = tenantGroups.flatMap((g) =>
  g.items.map((i) => ({ ...i, keywords: `tenant ${g.label} ${i.keywords ?? ""}` })),
);

