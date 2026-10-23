// The permission catalog: every permission a tenant role can hold.
//
// This file is the single source of truth for the Roles & Permissions editor,
// for UI gating across the app (usePermissions().can(key)), and for the backend
// contract in docs/roles-and-permissions.md. It deliberately has NO imports so
// it stays plain data the backend team can mirror (or load) as-is.
//
// Shape: MODULE (mirrors a sidebar group) → RESOURCE (a page, or a tab of a
// page) → ACTIONS. Every action is a stable string key, `<resource>.<action>`,
// e.g. "customers.notes.delete". Keys are what roles store and what the server
// enforces, so never rename or reuse one — add a new key and migrate instead.
//
// Rules that hold for every role (enforced by normalizePermissions below, and
// expected to be enforced server-side on createRole/updateRole too):
//   1. Any non-view action requires its own resource's view permission.
//   2. Cross-resource requirements are listed in REQUIRES.
//
// `endpoints` lists the backend calls each permission unlocks. Shared lookup
// endpoints (status/client/team pickers, the caller's own profile) need no
// permission and are documented separately in the contract doc. An empty list
// means the action is frontend-only (e.g. a client-side CSV export).

export type ActionKind = "view" | "create" | "edit" | "delete" | "other";

export type PermissionActionDef = {
  readonly key: string;
  readonly kind: ActionKind;
  /** Short verb shown in the editor ("View", "Send SMS"). */
  readonly label: string;
  /** One sentence on what the permission lets a user do. */
  readonly description: string;
  /** Grants control over access itself (users, roles) — flagged in the editor. */
  readonly sensitive?: boolean;
  readonly endpoints: readonly string[];
};

export type PermissionResourceDef = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly actions: readonly PermissionActionDef[];
};

export type PermissionModuleDef = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly resources: readonly PermissionResourceDef[];
};

export const PERMISSION_CATALOG = [
  {
    id: "caseFiles",
    label: "Case Files",
    description: "Customer files and the team queues they move through.",
    resources: [
      {
        id: "customers",
        label: "Customers",
        description: "The customer list and profile, with status, flags and lifecycle actions.",
        actions: [
          {
            key: "customers.view",
            kind: "view",
            label: "View",
            description:
              "Open the Customers list and customer profiles, including flags and the activity timeline.",
            endpoints: [
              "/tenant/getCustomerList",
              "/tenant/getCustomerDetails",
              "/tenant/getCustomerTimeline",
              "/tenant/getTagList",
            ],
          },
          {
            key: "customers.edit",
            kind: "edit",
            label: "Edit",
            description: "Change a customer's contact, financial and file details.",
            endpoints: ["/tenant/updateCustomerDetails"],
          },
          {
            key: "customers.changeStatus",
            kind: "other",
            label: "Change status",
            description: "Set a file's status, one at a time or in bulk.",
            endpoints: ["/tenant/updateCustomerStatus"],
          },
          {
            key: "customers.manageFlags",
            kind: "other",
            label: "Manage flags",
            description: "Add and remove flags on a file.",
            endpoints: ["/tenant/assignCustomerTag", "/tenant/deleteCustomerTag"],
          },
          {
            key: "customers.moveTeam",
            kind: "other",
            label: "Move to team",
            description: "Transfer files to another team's Moved Files queue.",
            endpoints: ["/tenant/changeCustomerTeam"],
          },
          {
            key: "customers.archive",
            kind: "other",
            label: "Archive",
            description: "Park a file in the Archive, out of the active workload.",
            endpoints: ["/tenant/archiveCustomer"],
          },
          {
            key: "customers.stopEngagement",
            kind: "other",
            label: "Stop engagement",
            description: "Pause all outreach on a file.",
            endpoints: ["/tenant/stopEngagement"],
          },
          {
            key: "customers.resumeEngagement",
            kind: "other",
            label: "Resume engagement",
            description: "Restart outreach on a file where it was stopped.",
            endpoints: ["/tenant/startEngagement"],
          },
          {
            key: "customers.export",
            kind: "other",
            label: "Export",
            description: "Download customer files as CSV.",
            endpoints: [],
          },
        ],
      },
      {
        id: "customers.notes",
        label: "Notes",
        description: "Notes and attachments on a customer file.",
        actions: [
          {
            key: "customers.notes.view",
            kind: "view",
            label: "View",
            description: "Read a file's notes and open their attachments.",
            endpoints: ["/tenant/getCustomerNotes"],
          },
          {
            key: "customers.notes.create",
            kind: "create",
            label: "Create",
            description: "Add notes, with attachments, to a file.",
            endpoints: ["/tenant/createCustomerNotes"],
          },
          {
            key: "customers.notes.edit",
            kind: "edit",
            label: "Edit",
            description: "Change any note on a file.",
            endpoints: ["/tenant/updateCustomerNotes"],
          },
          {
            key: "customers.notes.delete",
            kind: "delete",
            label: "Delete",
            description: "Delete any note on a file. A reason is always required.",
            endpoints: ["/tenant/deleteCustomerNotes"],
          },
        ],
      },
      {
        id: "customers.messages",
        label: "SMS & email",
        description: "The message history with a customer, and sending new messages.",
        actions: [
          {
            key: "customers.messages.view",
            kind: "view",
            label: "View",
            description: "Read the SMS and email history on a file.",
            endpoints: ["/tenant/getCustomerSms", "/tenant/getCustomerEmail"],
          },
          {
            key: "customers.messages.sendSms",
            kind: "other",
            label: "Send SMS",
            description: "Text a customer from the profile or the inbox.",
            endpoints: ["/tenant/sendCustomerSms"],
          },
          {
            key: "customers.messages.sendEmail",
            kind: "other",
            label: "Send email",
            description: "Email a customer from the profile or the inbox.",
            endpoints: ["/tenant/sendCustomerEmail"],
          },
        ],
      },
      {
        id: "customers.calls",
        label: "Calls",
        description: "Call recordings, transcripts and placing calls.",
        actions: [
          {
            key: "customers.calls.view",
            kind: "view",
            label: "View",
            description: "Play recordings and read call transcripts and summaries.",
            endpoints: ["/tenant/getCustomerCalls", "/tenant/getCustomerCallDetails"],
          },
          {
            key: "customers.calls.place",
            kind: "other",
            label: "Place calls",
            description: "Call a customer from one of the tenant's caller IDs.",
            endpoints: ["/tenant/callCustomerNumberList", "/tenant/initiateCustomerCall"],
          },
        ],
      },
      {
        id: "customers.documents",
        label: "Documents",
        description: "Documents generated from templates for a customer file.",
        actions: [
          {
            key: "customers.documents.view",
            kind: "view",
            label: "View",
            description: "See and download a file's generated documents.",
            endpoints: ["/tenant/getCustomerDocuments"],
          },
          {
            key: "customers.documents.generate",
            kind: "create",
            label: "Generate",
            description: "Generate a document for a file from one of its client's templates.",
            endpoints: [
              "/tenant/getCustomerDocumentTemplateList",
              "/tenant/generateCustomerDocuments",
            ],
          },
          {
            key: "customers.documents.delete",
            kind: "delete",
            label: "Delete",
            description: "Delete a generated document.",
            endpoints: ["/tenant/deleteCustomerDocument"],
          },
        ],
      },
      {
        id: "teamDeck",
        label: "Team Deck",
        description: "Files handed to a team that are waiting for a member.",
        actions: [
          {
            key: "teamDeck.view",
            kind: "view",
            label: "View",
            description: "Browse each team's deck and the files its members are working.",
            endpoints: [
              "/tenant/getTeamDeckTeamList",
              "/tenant/getTeamDeckDebtors",
              "/tenant/getCreditorList",
            ],
          },
          {
            key: "teamDeck.assign",
            kind: "other",
            label: "Assign to member",
            description: "Hand deck files to a team member, or reassign them.",
            endpoints: ["/tenant/teamDeckAssignUser"],
          },
        ],
      },
      {
        id: "movedFiles",
        label: "Moved Files",
        description: "Files transferred in from another team, waiting to be taken on.",
        actions: [
          {
            key: "movedFiles.view",
            kind: "view",
            label: "View",
            description: "See the files moved to each team.",
            endpoints: ["/tenant/getMovedCustomers"],
          },
          {
            key: "movedFiles.takeOn",
            kind: "other",
            label: "Take on",
            description: "Set a status on moved files and hand them to a member.",
            endpoints: ["/tenant/assignMovedFileStatusAndUser"],
          },
        ],
      },
      {
        id: "archive",
        label: "Archive",
        description: "Parked files, removed from the active workload.",
        actions: [
          {
            key: "archive.view",
            kind: "view",
            label: "View",
            description: "Browse and search archived files.",
            endpoints: ["/tenant/getArchivedCustomers"],
          },
          {
            key: "archive.restore",
            kind: "other",
            label: "Restore",
            description: "Return an archived file to its team's active workload.",
            endpoints: ["/tenant/UnArchiveCustomer"],
          },
          {
            key: "archive.export",
            kind: "other",
            label: "Export",
            description: "Download the archive list as CSV.",
            endpoints: [],
          },
        ],
      },
    ],
  },
  {
    id: "inbox",
    label: "Inbound Inbox",
    description: "Customer replies by SMS and email, in one place.",
    resources: [
      {
        id: "inbox",
        label: "Inbound Inbox",
        description:
          "Conversations with replies waiting. Replying, calling and notes follow the Case Files permissions.",
        actions: [
          {
            key: "inbox.view",
            kind: "view",
            label: "View",
            description: "Open the inbox and read conversations.",
            endpoints: ["/tenant/getInboxCustomers"],
          },
          {
            key: "inbox.assign",
            kind: "other",
            label: "Reassign",
            description: "Hand a conversation's file to another member of its team.",
            endpoints: ["/tenant/inboxAssignUser"],
          },
        ],
      },
    ],
  },
  {
    id: "engagement",
    label: "Engagement",
    description: "The phone numbers and templates outreach is sent with.",
    resources: [
      {
        id: "phoneNumbers",
        label: "Phone numbers",
        description: "The tenant's caller IDs and SMS numbers.",
        actions: [
          {
            key: "phoneNumbers.view",
            kind: "view",
            label: "View",
            description: "See the tenant's numbers and their status.",
            endpoints: ["/tenant/getNumberList"],
          },
          {
            key: "phoneNumbers.buy",
            kind: "create",
            label: "Buy",
            description: "Search for and buy new numbers.",
            endpoints: ["/tenant/getTwilioCountries", "/tenant/getNumbers", "/tenant/buyNumber"],
          },
          {
            key: "phoneNumbers.edit",
            kind: "edit",
            label: "Edit",
            description: "Turn numbers on or off and choose whether each one calls, texts or both.",
            endpoints: [
              "/tenant/enableNumber",
              "/tenant/disableNumber",
              "/tenant/updateNumberConfig",
            ],
          },
          {
            key: "phoneNumbers.release",
            kind: "delete",
            label: "Release",
            description: "Release a number permanently. It can't be recovered.",
            endpoints: ["/tenant/releaseNumber"],
          },
        ],
      },
      {
        id: "templates",
        label: "Template library",
        description:
          "Email, SMS and document templates, AI voice agents and AI messaging prompts, per client.",
        actions: [
          {
            key: "templates.view",
            kind: "view",
            label: "View",
            description: "Browse every template, voice agent and prompt.",
            endpoints: ["/tenant/getTemplateClients", "/tenant/getClientTemplate"],
          },
          {
            key: "templates.create",
            kind: "create",
            label: "Create",
            description: "Add templates, voice agents and prompts.",
            endpoints: ["/tenant/createTemplate", "/tenant/createDocumentTemplate"],
          },
          {
            key: "templates.edit",
            kind: "edit",
            label: "Edit",
            description: "Change existing templates, voice agents and prompts.",
            endpoints: ["/tenant/updateTemplate", "/tenant/updateDocumentTemplate"],
          },
          {
            key: "templates.delete",
            kind: "delete",
            label: "Delete",
            description: "Delete templates, voice agents and prompts.",
            endpoints: ["/tenant/deleteTemplate"],
          },
        ],
      },
    ],
  },
  {
    id: "dataIntake",
    label: "Data Intake",
    description: "Clients, customer file imports and bulk updates.",
    resources: [
      {
        id: "clients",
        label: "Client list",
        description: "The creditors you collect for, and the channels each one allows.",
        actions: [
          {
            key: "clients.view",
            kind: "view",
            label: "View",
            description: "See every client and its channel settings.",
            endpoints: ["/tenant/getAllClients"],
          },
          {
            key: "clients.create",
            kind: "create",
            label: "Create",
            description: "Add clients.",
            endpoints: ["/tenant/createClient"],
          },
          {
            key: "clients.edit",
            kind: "edit",
            label: "Edit",
            description: "Rename clients and change which channels they allow.",
            endpoints: ["/tenant/updateClient"],
          },
          {
            key: "clients.delete",
            kind: "delete",
            label: "Delete",
            description: "Delete clients.",
            endpoints: ["/tenant/deleteClient"],
          },
        ],
      },
      {
        id: "imports",
        label: "Upload customer data",
        description: "Customer file imports, the records they created, and team hand-off.",
        actions: [
          {
            key: "imports.view",
            kind: "view",
            label: "View",
            description: "See past imports and the records in each one.",
            endpoints: ["/tenant/getUploadedDebtor", "/tenant/debtorFileDetails"],
          },
          {
            key: "imports.upload",
            kind: "create",
            label: "Upload",
            description: "Validate and import a new customer file.",
            endpoints: [
              "/tenant/downloadSampleTemplate",
              "/tenant/validateDebtorFile",
              "/tenant/uploadDebtor",
            ],
          },
          {
            key: "imports.edit",
            kind: "edit",
            label: "Fix records",
            description: "Correct records that were flagged during validation.",
            endpoints: ["/tenant/updateNewDebtor"],
          },
          {
            key: "imports.assignTeam",
            kind: "other",
            label: "Assign to team",
            description: "Hand imported files to a team.",
            endpoints: ["/tenant/assignTeam"],
          },
        ],
      },
      {
        id: "massUpdate",
        label: "Mass update",
        description: "Export files to a spreadsheet, edit offline, and re-upload the changes.",
        actions: [
          {
            key: "massUpdate.view",
            kind: "view",
            label: "View",
            description: "Browse and filter files for a mass update.",
            endpoints: ["/tenant/getMassUpdateDebtorList"],
          },
          {
            key: "massUpdate.apply",
            kind: "edit",
            label: "Apply updates",
            description: "Upload a corrected spreadsheet and update the files in bulk.",
            endpoints: ["/tenant/validateMassUpdateDebtor", "/tenant/updateMassDebtor"],
          },
          {
            key: "massUpdate.export",
            kind: "other",
            label: "Download spreadsheet",
            description: "Download the selected files as a spreadsheet.",
            endpoints: ["/tenant/downloadMassUpdateDebtorList"],
          },
        ],
      },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    description: "The tenant's audit trail.",
    resources: [
      {
        id: "audit",
        label: "Activity & audit",
        description: "Every account and security event in the tenant.",
        actions: [
          {
            key: "audit.view",
            kind: "view",
            label: "View",
            description: "Search and filter the audit log.",
            endpoints: ["/tenant/getAuditLogs", "/tenant/getEventList"],
          },
          {
            key: "audit.export",
            kind: "other",
            label: "Export report",
            description: "Download the filtered audit log as CSV.",
            endpoints: [],
          },
        ],
      },
    ],
  },
  {
    id: "accessControl",
    label: "Access Control",
    description: "Who can sign in, the teams they belong to, and what they can do.",
    resources: [
      {
        id: "users",
        label: "Users",
        description: "The people who can sign in to this workspace.",
        actions: [
          {
            key: "users.view",
            kind: "view",
            label: "View",
            description: "See every user, their role, teams and numbers.",
            endpoints: ["/tenant/getUsers"],
          },
          {
            key: "users.create",
            kind: "create",
            label: "Add",
            description: "Invite new users and choose their role.",
            sensitive: true,
            endpoints: ["/tenant/createUser"],
          },
          {
            key: "users.edit",
            kind: "edit",
            label: "Edit",
            description: "Change a user's details, role, teams and numbers.",
            sensitive: true,
            endpoints: ["/tenant/updateUser"],
          },
          {
            key: "users.resetPassword",
            kind: "other",
            label: "Reset password",
            description: "Generate a password reset link for a user.",
            endpoints: ["/tenant/resetUserPassword"],
          },
          {
            key: "users.deactivate",
            kind: "other",
            label: "Activate & deactivate",
            description: "Block a user from signing in, or let them back in.",
            endpoints: ["/tenant/activateUser", "/tenant/disableUser"],
          },
        ],
      },
      {
        id: "teams",
        label: "Teams",
        description: "Teams, their leaders, members and phone numbers.",
        actions: [
          {
            key: "teams.view",
            kind: "view",
            label: "View",
            description: "See teams as cards or as an org chart.",
            endpoints: [
              "/tenant/getTeamsCardView",
              "/tenant/getTeamsOrgView",
              "/tenant/getTeamDetails",
            ],
          },
          {
            key: "teams.create",
            kind: "create",
            label: "Create",
            description: "Create teams.",
            endpoints: ["/tenant/createTeam"],
          },
          {
            key: "teams.edit",
            kind: "edit",
            label: "Edit",
            description: "Change a team's name, leader, members and numbers.",
            endpoints: ["/tenant/updateTeam"],
          },
          {
            key: "teams.delete",
            kind: "delete",
            label: "Delete",
            description: "Delete a team. Its members and numbers are released.",
            endpoints: ["/tenant/deleteTeam"],
          },
        ],
      },
      {
        id: "roles",
        label: "Roles & permissions",
        description: "The roles on this page, and the permissions each one grants.",
        actions: [
          {
            key: "roles.view",
            kind: "view",
            label: "View",
            description: "See every role and its permissions.",
            endpoints: ["/tenant/getAllRole"],
          },
          {
            key: "roles.create",
            kind: "create",
            label: "Create",
            description: "Create roles.",
            sensitive: true,
            endpoints: ["/tenant/createRole"],
          },
          {
            key: "roles.edit",
            kind: "edit",
            label: "Edit",
            description: "Change a role's name and permissions.",
            sensitive: true,
            endpoints: ["/tenant/updateRole"],
          },
          {
            key: "roles.delete",
            kind: "delete",
            label: "Delete",
            description: "Delete roles that no user is assigned to.",
            sensitive: true,
            endpoints: ["/tenant/deleteRole"],
          },
        ],
      },
    ],
  },
  {
    id: "configuration",
    label: "Configuration",
    description: "Workspace-wide settings.",
    resources: [
      {
        id: "settings",
        label: "Tenant settings",
        description: "Organization profile, operating hours and the sender email connector.",
        actions: [
          {
            key: "settings.view",
            kind: "view",
            label: "View",
            description: "See the organization, hours and connector settings.",
            endpoints: ["/tenant/getTenantDetails"],
          },
          {
            key: "settings.edit",
            kind: "edit",
            label: "Edit",
            description: "Change the organization profile, operating hours and connectors.",
            endpoints: ["/tenant/updateTenantDetails"],
          },
        ],
      },
      {
        id: "dataFields",
        label: "Data fields",
        description: "The fields every client's import file is validated against.",
        actions: [
          {
            key: "dataFields.view",
            kind: "view",
            label: "View",
            description: "See the default and custom data fields.",
            endpoints: ["/tenant/getDefaultFields", "/tenant/getCustomFields"],
          },
          {
            key: "dataFields.create",
            kind: "create",
            label: "Create",
            description: "Add custom fields.",
            endpoints: ["/tenant/createCustomFields"],
          },
          {
            key: "dataFields.edit",
            kind: "edit",
            label: "Edit",
            description: "Rename custom fields or change their type.",
            endpoints: ["/tenant/updateCustomFields"],
          },
          {
            key: "dataFields.delete",
            kind: "delete",
            label: "Delete",
            description: "Delete custom fields.",
            endpoints: ["/tenant/deleteCustomFields"],
          },
        ],
      },
    ],
  },
  {
    id: "systemConfiguration",
    label: "System Configuration",
    description: "The account lifecycle and what happens automatically at each step.",
    resources: [
      {
        id: "statuses",
        label: "Statuses",
        description: "The account lifecycle statuses for your firm.",
        actions: [
          {
            key: "statuses.view",
            kind: "view",
            label: "View",
            description: "Open the Statuses page.",
            endpoints: [],
          },
          {
            key: "statuses.create",
            kind: "create",
            label: "Create",
            description: "Add statuses.",
            endpoints: ["/tenant/createStatus"],
          },
          {
            key: "statuses.edit",
            kind: "edit",
            label: "Edit",
            description: "Rename and recolour statuses. Changes apply to every file on them.",
            endpoints: ["/tenant/updateStatus"],
          },
          {
            key: "statuses.delete",
            kind: "delete",
            label: "Delete",
            description: "Delete statuses no file is on.",
            endpoints: ["/tenant/deleteStatus"],
          },
        ],
      },
      {
        id: "statusAutomation",
        label: "Status automation",
        description: "Initial statuses and per-status automation for each team and client.",
        actions: [
          {
            key: "statusAutomation.view",
            kind: "view",
            label: "View",
            description: "See the automation configured for each team and client.",
            endpoints: [
              "/tenant/getClientTeamStatusList",
              "/tenant/getStatusAutomationList",
              "/tenant/getStatusAutomationDetails",
            ],
          },
          {
            key: "statusAutomation.edit",
            kind: "edit",
            label: "Edit",
            description: "Change initial statuses and the automation on each status.",
            endpoints: [
              "/tenant/checkInitialStatusUsed",
              "/tenant/changeInitialStatus",
              "/tenant/updateAutomation",
            ],
          },
        ],
      },
      {
        id: "callConfiguration",
        label: "Call configuration",
        description: "How inbound calls to each team's numbers are answered.",
        actions: [
          {
            key: "callConfiguration.view",
            kind: "view",
            label: "View",
            description: "See how each team's inbound calls are answered and routed.",
            endpoints: ["/tenant/getIncomingCallSetting"],
          },
          {
            key: "callConfiguration.edit",
            kind: "edit",
            label: "Edit",
            description: "Change who answers each team's inbound calls and who they ring.",
            endpoints: ["/tenant/updateIncomingCallSetting"],
          },
        ],
      },
    ],
  },
] as const satisfies readonly PermissionModuleDef[];

type Catalog = typeof PERMISSION_CATALOG;

/** Every permission key, as a literal union — `can("customers.notes.craete")` won't compile. */
export type PermissionKey = Catalog[number]["resources"][number]["actions"][number]["key"];

export type ModuleId = Catalog[number]["id"];

// Friendly views of the catalog for UI code: the literal-typed `as const` data
// above is a union of distinct object types, which makes optional fields such
// as `sensitive` awkward to read. These keep the keys typed and nothing else.
export type PermissionAction = Omit<PermissionActionDef, "key"> & { readonly key: PermissionKey };
export type PermissionResource = Omit<PermissionResourceDef, "actions"> & {
  readonly actions: readonly PermissionAction[];
};
export type PermissionModule = Omit<PermissionModuleDef, "id" | "resources"> & {
  readonly id: ModuleId;
  readonly resources: readonly PermissionResource[];
};

export const PERMISSION_MODULES = PERMISSION_CATALOG as readonly PermissionModule[];

/**
 * Cross-resource requirements. The implicit "an action needs its resource's
 * view" rule is NOT repeated here.
 */
export const REQUIRES: Partial<Record<PermissionKey, readonly PermissionKey[]>> = {
  // The customer profile's tabs only exist inside the profile.
  "customers.notes.view": ["customers.view"],
  "customers.messages.view": ["customers.view"],
  "customers.calls.view": ["customers.view"],
  "customers.documents.view": ["customers.view"],
  // The inbox is a view onto customer files and their message threads.
  "inbox.view": ["customers.view", "customers.messages.view"],
};

/* ------------------------------- indexes -------------------------------- */

type Located = {
  module: PermissionModule;
  resource: PermissionResource;
  action: PermissionAction;
};

const INDEX = new Map<string, Located>();
for (const module of PERMISSION_MODULES) {
  for (const resource of module.resources) {
    for (const action of resource.actions) {
      if (INDEX.has(action.key)) throw new Error(`Duplicate permission key: ${action.key}`);
      INDEX.set(action.key, { module, resource, action });
    }
  }
}

/** Every key, in catalog order (the order the editor shows them). */
export const ALL_PERMISSION_KEYS = [...INDEX.keys()] as PermissionKey[];

const ORDER = new Map<string, number>(ALL_PERMISSION_KEYS.map((k, i) => [k, i]));

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && INDEX.has(value);
}

export function locatePermission(key: PermissionKey): Located {
  return INDEX.get(key)!;
}

/** The view key of the resource an action belongs to (null for a view action). */
export function viewKeyFor(key: PermissionKey): PermissionKey | null {
  const { resource, action } = locatePermission(key);
  if (action.kind === "view") return null;
  return resource.actions.find((a) => a.kind === "view")?.key ?? null;
}

/** Direct requirements of a key: its resource view plus REQUIRES. */
export function requirementsOf(key: PermissionKey): PermissionKey[] {
  const out: PermissionKey[] = [];
  const view = viewKeyFor(key);
  if (view) out.push(view);
  for (const r of REQUIRES[key] ?? []) if (!out.includes(r)) out.push(r);
  return out;
}

// Reverse edges, for removing everything that depends on a key.
const DEPENDENTS = new Map<PermissionKey, PermissionKey[]>();
for (const key of ALL_PERMISSION_KEYS) {
  for (const req of requirementsOf(key)) {
    const list = DEPENDENTS.get(req) ?? [];
    list.push(key);
    DEPENDENTS.set(req, list);
  }
}

/** `key` plus everything it needs, transitively. */
export function closureOf(key: PermissionKey): PermissionKey[] {
  const seen = new Set<PermissionKey>();
  const walk = (k: PermissionKey) => {
    if (seen.has(k)) return;
    seen.add(k);
    for (const r of requirementsOf(k)) walk(r);
  };
  walk(key);
  return sortPermissions(seen);
}

/** `key` plus everything that needs it, transitively. */
export function dependentsOf(key: PermissionKey): PermissionKey[] {
  const seen = new Set<PermissionKey>();
  const walk = (k: PermissionKey) => {
    if (seen.has(k)) return;
    seen.add(k);
    for (const d of DEPENDENTS.get(k) ?? []) walk(d);
  };
  walk(key);
  return sortPermissions(seen);
}

export function sortPermissions(keys: Iterable<PermissionKey>): PermissionKey[] {
  return [...new Set(keys)].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
}

/**
 * Turn whatever a server sent into a valid, closed permission set: unknown
 * keys are dropped and every requirement of a kept key is added.
 */
export function normalizePermissions(raw: Iterable<unknown>): PermissionKey[] {
  const out = new Set<PermissionKey>();
  for (const value of raw) {
    if (!isPermissionKey(value)) continue;
    for (const k of closureOf(value)) out.add(k);
  }
  return sortPermissions(out);
}

/** Keys of a module, in catalog order. */
export function moduleKeys(module: PermissionModule): PermissionKey[] {
  return module.resources.flatMap((r) => r.actions.map((a) => a.key));
}

/** Short human label for a key, e.g. "Notes · Delete". */
export function permissionLabel(key: PermissionKey): string {
  const { resource, action } = locatePermission(key);
  return `${resource.label} · ${action.label}`;
}
