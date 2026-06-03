// Role-based permissions for the debtor detail page.
// Hybrid model: tabs the role has no business in are hidden entirely;
// destructive actions (delete) are hidden for non-admins; sensitive
// fields and admin-style actions are shown-but-disabled with a lock.

import type { DemoRole } from "@/lib/demo-role";

export type DebtorTabKey =
  | "overview"
  | "assignment"
  | "dataprofile"
  | "rpv"
  | "comms"
  | "calls"
  | "payments"
  | "documents"
  | "notes"
  | "timeline";

export type DebtorPermissions = {
  role: DemoRole;
  // Tab visibility
  allowedTabs: Set<DebtorTabKey>;
  // Lifecycle actions
  canArchive: boolean;
  canStopEngagement: boolean;
  canDelete: boolean;
  // Profile editing
  canEditProfile: boolean;       // any field at all
  canEditSensitive: boolean;     // sensitive fields (balance, creditor, etc.)
  // Workspace actions
  canManageNotes: boolean;       // add/edit own notes
  canManageCalls: boolean;       // log/start calls
  canManageComms: boolean;       // send sms/email
  canManagePayments: boolean;    // report/post payments
  canFlag: boolean;
};

const ALL_TABS: DebtorTabKey[] = [
  "overview", "assignment", "dataprofile", "rpv",
  "comms", "calls", "payments", "documents", "notes", "timeline",
];

export function getDebtorPermissions(role: DemoRole): DebtorPermissions {
  switch (role) {
    case "admin":
      return {
        role,
        allowedTabs: new Set(ALL_TABS),
        canArchive: true, canStopEngagement: true, canDelete: true,
        canEditProfile: true, canEditSensitive: true,
        canManageNotes: true, canManageCalls: true,
        canManageComms: true, canManagePayments: true, canFlag: true,
      };
    case "manager":
      return {
        role,
        allowedTabs: new Set(ALL_TABS),
        canArchive: true, canStopEngagement: true, canDelete: false,
        canEditProfile: true, canEditSensitive: true,
        canManageNotes: true, canManageCalls: true,
        canManageComms: true, canManagePayments: true, canFlag: true,
      };
    case "finance":
      return {
        role,
        allowedTabs: new Set<DebtorTabKey>([
          "overview", "dataprofile", "payments", "documents", "timeline",
        ]),
        canArchive: false, canStopEngagement: false, canDelete: false,
        canEditProfile: false, canEditSensitive: false,
        canManageNotes: false, canManageCalls: false,
        canManageComms: false, canManagePayments: true, canFlag: false,
      };
    case "agent":
    default:
      return {
        role,
        allowedTabs: new Set(ALL_TABS),
        canArchive: false, canStopEngagement: false, canDelete: false,
        canEditProfile: true, canEditSensitive: false,
        canManageNotes: true, canManageCalls: true,
        canManageComms: true, canManagePayments: false, canFlag: true,
      };
  }
}

export const ROLE_LABEL: Record<DemoRole, string> = {
  agent: "Agent",
  manager: "Manager",
  admin: "Admin",
  finance: "Finance",
};

// Friendly explanation shown on locked controls.
export function lockReason(role: DemoRole, action: string): string {
  return `${action} requires a higher role (current: ${ROLE_LABEL[role]}).`;
}
