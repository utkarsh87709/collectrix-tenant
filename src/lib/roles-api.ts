// Roles & Permissions calls to the separately-hosted backend.
//   POST /tenant/getAllRole  {}                                                 -> { roles[], permissionSchema: 2 }
//   POST /tenant/createRole  { roleName, roleDescription, permissions[] }        -> { roleId }
//   POST /tenant/updateRole  { roleId, roleName, roleDescription, permissions[] } -> {}
//   POST /tenant/deleteRole  { roleId }                                         -> {}  (rejected while users hold the role)
// `permissions` are string keys from src/lib/permissions/catalog.ts — the full
// contract (validation, per-endpoint enforcement, migration) is in
// docs/roles-and-permissions.md. The catalog itself lives in the frontend, so
// the old POST /tenant/getConfiguredRoles is no longer called.
//
// TRANSITION: until the backend ships that contract, getAllRole answers in the
// legacy shape — { roles: [{ roleId, roleName, userCount, allowedConfiguration:
// number[] }], totalConfiguration }, no roleDescription. getAllRoles() reads
// both and reports which one it got: legacy roles are translated by
// permissions/legacy.ts and the editor stays read-only, because sending the new
// payload to the old updateRole would wipe the role's grants.
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";
import { normalizePermissions, type PermissionKey } from "./permissions/catalog";
import { legacyRoleDescription, permissionsFromLegacy } from "./permissions/legacy";

/** "v2" once the backend serves string permission keys; "legacy" before that. */
export type PermissionSchema = "v2" | "legacy";

export type Role = {
  roleId: number;
  roleName: string;
  roleDescription: string;
  /** Users currently on this role — a role can't be deleted while this is above 0. */
  userCount: number;
  /** Closed set (every requirement included), in catalog order. */
  permissions: PermissionKey[];
};

export type RolesResult = { roles: Role[]; schema: PermissionSchema };

export type RoleInput = {
  roleName: string;
  roleDescription: string;
  permissions: PermissionKey[];
};

type RawRole = {
  roleId: number;
  roleName: string;
  roleDescription?: string | null;
  userCount?: number | null;
  permissions?: unknown;
  allowedConfiguration?: unknown;
};

type RawRoles = { roles?: RawRole[]; permissionSchema?: number };

export async function getAllRoles(): Promise<RolesResult> {
  const data = await apiPost<RawRoles>("/tenant/getAllRole");
  const rows = data?.roles ?? [];
  const v2 = data?.permissionSchema === 2 || rows.some((r) => Array.isArray(r.permissions));
  return {
    schema: v2 ? "v2" : "legacy",
    roles: rows.map((r) => ({
      roleId: r.roleId,
      roleName: r.roleName,
      roleDescription: r.roleDescription ?? (v2 ? "" : legacyRoleDescription(r.roleName)),
      userCount: r.userCount ?? 0,
      permissions: v2
        ? normalizePermissions(Array.isArray(r.permissions) ? r.permissions : [])
        : permissionsFromLegacy(
            Array.isArray(r.allowedConfiguration) ? r.allowedConfiguration : [],
          ),
    })),
  };
}

export function createRole(input: RoleInput): Promise<unknown> {
  return apiPost("/tenant/createRole", { ...input });
}

export function updateRole(input: RoleInput & { roleId: number }): Promise<unknown> {
  return apiPost("/tenant/updateRole", { ...input });
}

export function deleteRole(roleId: number): Promise<unknown> {
  return apiPost("/tenant/deleteRole", { roleId });
}
