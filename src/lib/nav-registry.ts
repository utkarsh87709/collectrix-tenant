import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Gauge,
  ScrollText,
  UsersRound,
  LineChart,
  Wallet,
  Settings,
  Database,
} from "lucide-react";

export type NavSubItem = {
  to: string;
  label: string;
  /** Disabled submodules render greyed-out and are not routable. */
  disabled?: boolean;
};

export type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  description?: string;
  keywords?: string;
  /** When present, the item is an expandable module with nested links. */
  submodules?: NavSubItem[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/* ---------------------------------- TENANT ---------------------------------- */

// Enabled modules are visible and routable (see __root.tsx). Analytics and
// Debtors are demo-only for now — they render mock data with no API behind them.
export const tenantGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        to: "/tenant",
        label: "Overview",
        icon: Gauge,
        description: "Dashboards, KPIs and reports",
      },
      {
        to: "/tenant/analytics",
        label: "Analytics",
        icon: LineChart,
        description: "Performance insights (demo data)",
        keywords: "analytics insights performance reports charts",
      },
    ],
  },
  {
    label: "Collections",
    items: [
      {
        to: "/tenant/debtors",
        label: "Debtors",
        icon: Wallet,
        description: "Debtor accounts (demo data)",
        keywords: "debtors accounts collections balances",
      },
    ],
  },
  {
    label: "Access Control",
    items: [
      {
        to: "/tenant/users",
        label: "Users",
        icon: Users,
        description: "Members and invitations",
        keywords: "users members invite",
      },
      {
        to: "/tenant/roles",
        label: "Roles & Permissions",
        icon: ShieldCheck,
        description: "Custom roles and permissions",
        keywords: "roles permissions access",
      },
      {
        to: "/tenant/teams",
        label: "Teams",
        icon: UsersRound,
        description: "Team hierarchy and membership",
        keywords: "teams leaders members hierarchy org chart",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        to: "/tenant/intake",
        label: "Data Intake",
        icon: Database,
        description: "Client list, debtor uploads and CRM sync",
        keywords: "data intake import upload debtor crm integration clients",
        submodules: [
          { to: "/tenant/intake/clients", label: "Client List" },
          { to: "/tenant/intake/upload", label: "Upload Debtor Data" },
          { to: "/tenant/intake/crm", label: "CRM Integration", disabled: true },
        ],
      },
    ],
  },
  {
    label: "Compliance",
    items: [
      {
        to: "/tenant/audit",
        label: "Audit",
        icon: ScrollText,
        description: "Account and security event log",
        keywords: "audit log compliance activity events security",
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        to: "/tenant/settings",
        label: "Tenant Settings",
        icon: Settings,
        description: "Workspace, operating hours and connectors",
        keywords: "settings workspace organization hours timezone email twilio sms connectors",
      },
    ],
  },
];

/* --------------------------- SEARCHABLE FLAT LIST --------------------------- */

/** Used by the global ⌘K palette — only the enabled destinations. */
export const allRoutes: NavItem[] = tenantGroups.flatMap((g) =>
  g.items.flatMap((i) => {
    // Expandable modules contribute their enabled submodules as destinations.
    if (i.submodules?.length) {
      return i.submodules
        .filter((s) => !s.disabled)
        .map((s) => ({
          to: s.to,
          label: s.label,
          icon: i.icon,
          keywords: `tenant ${g.label} ${i.label} ${s.label}`,
        }));
    }
    return [{ ...i, keywords: `tenant ${g.label} ${i.keywords ?? ""}` }];
  }),
);
