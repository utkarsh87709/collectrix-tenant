// Real, backend-driven permission flags for the Customers module — replaces the
// client-only demo role switcher (see demo-role.ts) for the pieces wired to live
// APIs. A signed-in user's grants are the allowedConfiguration array on their
// role (POST /tenant/getAllRole), matched by roleId (POST /tenant/myProfile).
// configId numbers come straight from POST /tenant/getConfiguredRoles, which is
// the authoritative, tenant-wide permission catalog — configIds are fixed
// platform identifiers, not something a tenant renumbers, so hardcoding the ones
// this module cares about is safe (same trust level as a statusId or teamId).
import { useEffect, useState } from "react";
import { getMyProfile } from "./profile-api";
import { getAllRoles } from "./roles-api";

const CONFIG_ID = {
  updateFileStatus: 18, // "Update file status (within permitted range)"
  updateAssignments: 16, // "Update assignments for each debtor"
  archiveDebtorFiles: 13, // "Archive debtor files"
  stopEngagement: 11, // "Stop engagement on a debtor file"
  resumeEngagement: 12, // "Resume engagement on a debtor file"
  makeManualOutboundCalls: 23,
  sendSmsAndEmail: 24, // "Send SMS and email messages"
  addNotes: 6, // "Add notes to debtor files"
} as const;

export type CustomerPermissions = {
  /** True until the permission fetch resolves; treat gated UI as hidden/disabled meanwhile. */
  loading: boolean;
  allowedConfiguration: Set<number>;
  /** Gates the list screen's row checkboxes + bulk action bar. */
  canBulkManage: boolean;
  canArchive: boolean;
  canStopEngagement: boolean;
  canResumeEngagement: boolean;
  canMakeCalls: boolean;
  canSendComms: boolean;
  canAddNotes: boolean;
};

async function loadAllowedConfiguration(): Promise<Set<number>> {
  const [profile, roles] = await Promise.all([getMyProfile(), getAllRoles()]);
  const role = roles.roles.find((r) => r.roleId === profile.roleId);
  return new Set(role?.allowedConfiguration ?? []);
}

export function useCustomerPermissions(): CustomerPermissions {
  const [allowed, setAllowed] = useState<Set<number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAllowedConfiguration()
      .catch(() => new Set<number>()) // fail closed — no grants rather than a thrown error
      .then((set) => {
        if (!cancelled) setAllowed(set);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = allowed ?? new Set<number>();
  return {
    loading: allowed === null,
    allowedConfiguration: set,
    canBulkManage: set.has(CONFIG_ID.updateAssignments) || set.has(CONFIG_ID.updateFileStatus),
    canArchive: set.has(CONFIG_ID.archiveDebtorFiles),
    canStopEngagement: set.has(CONFIG_ID.stopEngagement),
    canResumeEngagement: set.has(CONFIG_ID.resumeEngagement),
    canMakeCalls: set.has(CONFIG_ID.makeManualOutboundCalls),
    canSendComms: set.has(CONFIG_ID.sendSmsAndEmail),
    canAddNotes: set.has(CONFIG_ID.addNotes),
  };
}
