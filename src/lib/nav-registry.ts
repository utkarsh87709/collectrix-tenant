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
  FolderOpen,
} from "lucide-react";
import { useMemo } from "react";
import { canOpen } from "@/lib/permissions/routes";
import { usePermissions } from "@/lib/permissions/store";

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

// Enabled modules are routable (see __root.tsx). Each link is only shown to
// users whose role opens it — see permissions/routes.ts.
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
      {
        to: "/tenant/inbox",
        label: "Inbound Inbox",
        icon: Inbox,
        description: "Customer replies by SMS and email, in one place",
        keywords: "inbox inbound conversations replies sms email messages unread chat",
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
          "status automation outreach follow-up initial status team client archive inactivity documents",
      },
    ],
  },
];

/* ------------------------------ ROLE FILTERING ------------------------------ */

/**
 * Trim the nav to the destinations `isAllowed` accepts. An expandable module
 * stays only while at least one of its submodules does; a group with nothing
 * left is dropped.
 */
export function filterNav(groups: NavGroup[], isAllowed: (to: string) => boolean): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.flatMap((i): NavItem[] => {
        if (i.submodules?.length) {
          const subs = i.submodules.filter((s) => !s.disabled && isAllowed(s.to));
          return subs.length ? [{ ...i, submodules: subs }] : [];
        }
        return isAllowed(i.to) ? [i] : [];
      }),
    }))
    .filter((g) => g.items.length > 0);
}

/** The nav groups the signed-in user's role can open (see permissions/routes.ts). */
export function useVisibleNav(): NavGroup[] {
  const { canAny } = usePermissions();
  return useMemo(() => filterNav(tenantGroups, (to) => canOpen(to, canAny)), [canAny]);
}

/* --------------------------- SEARCHABLE FLAT LIST --------------------------- */

/** Every enabled destination in `groups`, flattened — used by the ⌘K palette. */
export function flattenNav(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((g) =>
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
}

/** All destinations regardless of role — used for breadcrumb labels. */
export const allRoutes: NavItem[] = flattenNav(tenantGroups);
