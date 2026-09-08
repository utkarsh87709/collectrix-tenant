import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Gauge,
  ScrollText,
  UsersRound,
  Wallet,
  Settings,
  Database,
  Phone,
  LibraryBig,
  Inbox,
  Tag,
  Zap,
  FileText,
  FolderOpen,
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

// Enabled modules are visible and routable (see __root.tsx). Debtors is
// demo-only for now — it renders mock data with no API behind it.
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
        to: "/tenant/case-files",
        label: "Case Files",
        icon: FolderOpen,
        description: "Customer accounts and team file queues",
        keywords:
          "case files debtors customers accounts collections balances team deck queue archive archived parked restore",
        submodules: [
          { to: "/tenant/debtors", label: "Customers" },
          { to: "/tenant/team-deck", label: "Team Deck" },
          { to: "/tenant/moved-files", label: "Moved Files" },
          { to: "/tenant/archive", label: "Archive" },
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
    label: "Operations",
    items: [
      {
        to: "/tenant/intake",
        label: "Data Intake",
        icon: Database,
        description: "Client list, customer uploads and CRM sync",
        keywords: "data intake import upload debtor crm integration clients",
        submodules: [
          { to: "/tenant/intake/clients", label: "Client List" },
          { to: "/tenant/intake/upload", label: "Upload Customer Data" },
          { to: "/tenant/intake/mass-update", label: "Mass Update" },
        ],
      },
    ],
  },
  {
    label: "Compliance",
    items: [
      {
        to: "/tenant/audit",
        label: "Activity & Audit",
        icon: ScrollText,
        description: "Account and security event log",
        keywords: "audit log compliance activity events security",
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
        to: "/tenant/teams",
        label: "Teams",
        icon: UsersRound,
        description: "Team hierarchy and membership",
        keywords: "teams leaders members hierarchy org chart",
      },
      {
        to: "/tenant/roles",
        label: "Roles & Permissions",
        icon: ShieldCheck,
        description: "Custom roles and permissions",
        keywords: "roles permissions access",
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
      {
        to: "/tenant/settings/status-automation",
        label: "Status Automation",
        icon: Zap,
        description: "Automated behaviour per status, for each team and client",
        keywords:
          "status automation outreach follow-up initial status team client archive inactivity documents ai voice",
      },
      {
        to: "/tenant/settings/document-automation",
        label: "Document Automation",
        icon: FileText,
        description: "AI-generated letters scheduled by status and time",
        keywords: "document automation ai generated letters schedule status",
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
