// Starting points offered in the role editor ("Start from a preset"). They only
// pre-fill the checkboxes — the role saves whatever the admin ends up with, so
// nothing here is stored or enforced.
import {
  ALL_PERMISSION_KEYS,
  locatePermission,
  normalizePermissions,
  type PermissionKey,
} from "./catalog";

export type RolePreset = {
  id: string;
  label: string;
  description: string;
  permissions: PermissionKey[];
};

const AGENT: PermissionKey[] = [
  "customers.view",
  "customers.changeStatus",
  "customers.manageFlags",
  "customers.stopEngagement",
  "customers.notes.create",
  "customers.messages.sendSms",
  "customers.messages.sendEmail",
  "customers.calls.place",
  "customers.documents.generate",
  "inbox.view",
];

const TEAM_LEAD: PermissionKey[] = [
  ...AGENT,
  "customers.edit",
  "customers.moveTeam",
  "customers.archive",
  "customers.resumeEngagement",
  "customers.export",
  "customers.notes.edit",
  "customers.notes.delete",
  "customers.documents.delete",
  "teamDeck.assign",
  "movedFiles.takeOn",
  "archive.restore",
  "inbox.assign",
  "teams.view",
];

const OPERATIONS: PermissionKey[] = [
  ...TEAM_LEAD,
  "archive.export",
  "clients.create",
  "clients.edit",
  "clients.delete",
  "imports.upload",
  "imports.edit",
  "imports.assignTeam",
  "massUpdate.apply",
  "massUpdate.export",
  "templates.create",
  "templates.edit",
  "templates.delete",
  "phoneNumbers.view",
  "statuses.create",
  "statuses.edit",
  "statuses.delete",
  "statusAutomation.edit",
  "audit.view",
  "users.view",
];

const VIEW_EVERYTHING = ALL_PERMISSION_KEYS.filter(
  (k) => locatePermission(k).action.kind === "view",
);

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: "agent",
    label: "Collections agent",
    description: "Works their own files: messages, calls, notes, documents and status updates.",
    permissions: normalizePermissions(AGENT),
  },
  {
    id: "teamLead",
    label: "Team lead",
    description: "Agent access, plus the team queues, reassignment, archive and full note control.",
    permissions: normalizePermissions(TEAM_LEAD),
  },
  {
    id: "operations",
    label: "Operations manager",
    description:
      "Runs the book end to end: data intake, templates, statuses and automation. No access control.",
    permissions: normalizePermissions(OPERATIONS),
  },
  {
    id: "auditor",
    label: "Compliance auditor",
    description: "Can open every page but change nothing, and can export the audit log.",
    permissions: normalizePermissions([...VIEW_EVERYTHING, "audit.export"]),
  },
  {
    id: "full",
    label: "Full access",
    description: "Every permission, including users, roles and settings.",
    permissions: [...ALL_PERMISSION_KEYS],
  },
];
