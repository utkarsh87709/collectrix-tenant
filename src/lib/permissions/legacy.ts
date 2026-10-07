// TRANSITION SHIM — delete this file once the backend serves the new
// permission format (docs/roles-and-permissions.md, "Migration").
//
// Before the redesign, a role held `allowedConfiguration: number[]` — numeric
// configIds from POST /tenant/getConfiguredRoles. The old frontend gated only a
// handful of Customers actions on twelve of those ids; every page and every
// other action was open to any signed-in user.
//
// Until the backend switches over, a legacy role is translated so the app keeps
// behaving exactly as it did:
//   • a key listed in LEGACY_CONFIG_IDS is granted when the role holds ANY of
//     its configIds (the same checks the old customer-permissions.ts made);
//   • every other key is granted, because nothing enforced it before.
// The same table is the starting point for the backend's one-off migration of
// existing roles.
import { ALL_PERMISSION_KEYS, normalizePermissions, type PermissionKey } from "./catalog";

// configId → what it meant in the old catalog:
//    3 Edit debtor contact information        13 Archive debtor files
//    4 Edit debtor financial details          15 Export debtor files (CSV / PDF)
//    6 Add notes to debtor files              16 Update assignments for each debtor
//    7 Edit debtor file details               18 Update file status
//   11 Stop engagement on a debtor file       23 Make manual outbound calls
//   12 Resume engagement on a debtor file     24 Send SMS and email messages
export const LEGACY_CONFIG_IDS: Partial<Record<PermissionKey, readonly number[]>> = {
  "customers.edit": [3, 4, 7],
  "customers.changeStatus": [18],
  // Flags had no grant of their own; anyone who could annotate the file could flag it.
  "customers.manageFlags": [3, 6, 7, 18],
  "customers.moveTeam": [16],
  "customers.archive": [13],
  "customers.stopEngagement": [11],
  "customers.resumeEngagement": [12],
  "customers.export": [15],
  "customers.notes.create": [6],
  "customers.notes.edit": [6],
  "customers.notes.delete": [6],
  "customers.messages.sendSms": [24],
  "customers.messages.sendEmail": [24],
  "customers.calls.place": [23],
  // Generating/deleting documents borrowed the notes grant.
  "customers.documents.generate": [6],
  "customers.documents.delete": [6],
  "inbox.assign": [16],
  "archive.restore": [13],
};

/** What a legacy role (numeric configIds) can do, expressed as new keys. */
export function permissionsFromLegacy(allowedConfiguration: readonly unknown[]): PermissionKey[] {
  const held = new Set(allowedConfiguration.map(Number));
  return normalizePermissions(
    ALL_PERMISSION_KEYS.filter((key) => {
      const ids = LEGACY_CONFIG_IDS[key];
      return !ids || ids.some((id) => held.has(id));
    }),
  );
}

// The legacy getAllRole had no roleDescription (and no get-by-id endpoint), so
// the old editor cached descriptions in localStorage by role name. Read-only now:
// only used to show a legacy role's description until the backend returns it.
const LEGACY_DESCRIPTIONS_KEY = "collectrix.roleDescriptions";

export function legacyRoleDescription(roleName: string): string {
  try {
    const all = JSON.parse(localStorage.getItem(LEGACY_DESCRIPTIONS_KEY) || "{}") as Record<
      string,
      string
    >;
    return all[roleName] ?? "";
  } catch {
    return "";
  }
}
