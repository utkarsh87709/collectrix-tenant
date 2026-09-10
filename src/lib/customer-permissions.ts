// Real, backend-driven permission flags for the Customers module — replaces the
// client-only demo role switcher (see demo-role.ts) for the pieces wired to live
// APIs. A signed-in user's grants are the allowedConfiguration array on their
// role (POST /tenant/getAllRole), matched by roleId (POST /tenant/myProfile).
// configId numbers come straight from POST /tenant/getConfiguredRoles, which is
// the authoritative, tenant-wide permission catalog — configIds are fixed
// platform identifiers, not something a tenant renumbers, so hardcoding the ones
// this module cares about is safe (same trust level as a statusId or teamId).
//
// Tenant administrator: the built-in "tenantAdmin" role is not a row in
// getAllRole, so a roleId lookup finds nothing and — before 2026-09-10 — every
// gated action (move to team, archive, engagement, notes, ...) was hidden from
// the one role that should see all of them. That role now short-circuits to
// "everything allowed" without consulting the roles list.
import { useEffect, useState } from "react";
import { getMyProfile } from "./profile-api";
import { getAllRoles } from "./roles-api";
import { AUTH_USER_KEY } from "./auth-token";

const CONFIG_ID = {
  editContactInformation: 3, // "Edit debtor contact information"
  editFinancialDetails: 4, // "Edit debtor financial details (balance, interest, fees)"
  addNotes: 6, // "Add notes to debtor files"
  editFileDetails: 7, // "Edit debtor file details"
  stopEngagement: 11, // "Stop engagement on a debtor file"
  resumeEngagement: 12, // "Resume engagement on a debtor file"
  archiveDebtorFiles: 13, // "Archive debtor files"
  exportDebtorFiles: 15, // "Export debtor files (CSV / PDF)"
  updateAssignments: 16, // "Update assignments for each debtor"
  updateFileStatus: 18, // "Update file status (within permitted range)"
  makeManualOutboundCalls: 23,
  sendSmsAndEmail: 24, // "Send SMS and email messages"
} as const;

export type CustomerPermissions = {
  /** True until the permission fetch resolves; treat gated UI as hidden/disabled meanwhile. */
  loading: boolean;
  /** The built-in tenant administrator — every action below is allowed. */
  isTenantAdmin: boolean;
  allowedConfiguration: Set<number>;
  /** Gates the list screen's row checkboxes + bulk action bar. */
  canBulkManage: boolean;
  canMoveTeam: boolean;
  /** Hand a file to a member of its team (Inbound Inbox "Allocated to"). */
  canAssignUser: boolean;
  canUpdateStatus: boolean;
  /** Edit the customer record (contact, financial or file details). */
  canEditDetails: boolean;
  /** Add/remove tags ("flags"). The catalog has no tag-specific grant, so anyone
   *  who may annotate the file (notes, status, details) may flag it. */
  canManageFlags: boolean;
  canArchive: boolean;
  canStopEngagement: boolean;
  canResumeEngagement: boolean;
  canMakeCalls: boolean;
  canSendComms: boolean;
  canAddNotes: boolean;
  canExport: boolean;
};

type Grants = { isTenantAdmin: boolean; allowed: Set<number> };

const NO_GRANTS: Grants = { isTenantAdmin: false, allowed: new Set<number>() };
const ALL_GRANTS: Grants = { isTenantAdmin: true, allowed: new Set<number>() };

/** "tenantAdmin" as the backend spells it in login/myProfile, tolerant of
 *  casing/separator drift ("Tenant Admin", "tenant_admin"). */
function isTenantAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").replace(/[\s_-]/g, "").toLowerCase() === "tenantadmin";
}

/** The role name saved at login (auth-context) — lets a tenant admin's actions
 *  render unlocked on first paint instead of waiting on myProfile. */
function storedRoleIsTenantAdmin(): boolean {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return false;
    const u = JSON.parse(raw) as { role?: string };
    return isTenantAdminRole(u.role);
  } catch {
    return false;
  }
}

// Shared across every mount of useCustomerPermissions (list page, detail page,
// its Notes tab, ...) so navigating between Customers screens doesn't re-fire
// myProfile + getAllRole on every remount. Cleared on login/logout (see
// invalidateCustomerPermissions) so a new session never inherits a stale grant
// set from whoever was signed in before.
let cachedGrants: Promise<Grants> | null = null;

function loadGrants(): Promise<Grants> {
  if (!cachedGrants) {
    cachedGrants = getMyProfile()
      .then(async (profile) => {
        if (isTenantAdminRole(profile.role)) return ALL_GRANTS;
        const roles = await getAllRoles();
        const role = roles.roles.find((r) => r.roleId === profile.roleId);
        return { isTenantAdmin: false, allowed: new Set(role?.allowedConfiguration ?? []) };
      })
      .catch((err) => {
        cachedGrants = null; // don't cache a failure — let the next mount retry
        throw err;
      });
  }
  return cachedGrants;
}

/** Drop the cached permission set. Call on login/logout so a new session's
 *  grants can't be shadowed by whichever user was previously signed in. */
export function invalidateCustomerPermissions(): void {
  cachedGrants = null;
}

export function useCustomerPermissions(): CustomerPermissions {
  const [grants, setGrants] = useState<Grants | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGrants()
      // Fail closed for everyone except a tenant admin we already know about
      // from the login record — they'd otherwise lose their whole toolbar to a
      // transient myProfile hiccup.
      .catch((): Grants => (storedRoleIsTenantAdmin() ? ALL_GRANTS : NO_GRANTS))
      .then((g) => {
        if (!cancelled) setGrants(g);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const storedAdmin = grants === null && storedRoleIsTenantAdmin();
  const isTenantAdmin = grants ? grants.isTenantAdmin : storedAdmin;
  const set = grants?.allowed ?? new Set<number>();
  const has = (id: number) => isTenantAdmin || set.has(id);

  return {
    loading: grants === null && !storedAdmin,
    isTenantAdmin,
    allowedConfiguration: set,
    canBulkManage: has(CONFIG_ID.updateAssignments) || has(CONFIG_ID.updateFileStatus),
    canMoveTeam: has(CONFIG_ID.updateAssignments),
    canAssignUser: has(CONFIG_ID.updateAssignments),
    canUpdateStatus: has(CONFIG_ID.updateFileStatus),
    canEditDetails:
      has(CONFIG_ID.editContactInformation) ||
      has(CONFIG_ID.editFinancialDetails) ||
      has(CONFIG_ID.editFileDetails),
    canManageFlags:
      has(CONFIG_ID.addNotes) ||
      has(CONFIG_ID.updateFileStatus) ||
      has(CONFIG_ID.editFileDetails) ||
      has(CONFIG_ID.editContactInformation),
    canArchive: has(CONFIG_ID.archiveDebtorFiles),
    canStopEngagement: has(CONFIG_ID.stopEngagement),
    canResumeEngagement: has(CONFIG_ID.resumeEngagement),
    canMakeCalls: has(CONFIG_ID.makeManualOutboundCalls),
    canSendComms: has(CONFIG_ID.sendSmsAndEmail),
    canAddNotes: has(CONFIG_ID.addNotes),
    canExport: has(CONFIG_ID.exportDebtorFiles),
  };
}
