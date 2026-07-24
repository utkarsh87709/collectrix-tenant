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
  Phone,
  LibraryBig,
  Inbox,
  Tag,
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
      {
        to: "/tenant/team-deck",
        label: "Team Deck",
        icon: Inbox,
        description: "Files handed to teams, awaiting a member",
        keywords: "team deck assign member debtor files queue in deck assigned",
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
    label: "Engagement",
    items: [
      {
        to: "/tenant/engagement/phone-numbers",
        label: "Phone Numbers",
        icon: Phone,
        description: "Outbound caller IDs and phone numbers",
        keywords: "phone number caller id outbound dialing engagement voice",
      },
      {
        to: "/tenant/engagement/template-library",
        label: "Template Library",
        icon: LibraryBig,
        description: "Reusable email and SMS templates, organised by client",
        keywords: "template library email sms message reusable variables client engagement",
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
  {
    label: "System Configuration",
    items: [
      {
        to: "/tenant/settings/statuses",
        label: "Statuses",
        icon: Tag,
        description: "Define the account lifecycle for your firm",
        keywords: "statuses status lifecycle account codes pills workflow configuration",
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
