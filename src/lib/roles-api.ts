// Roles & Permissions calls to the separately-hosted backend.
//   POST /tenant/getAllRole  {}                                                 -> { permissionSchema: 2, roles[] }
//   POST /tenant/createRole  { roleName, roleDescription, permissions[] }        -> {}
//   POST /tenant/updateRole  { roleId, roleName, roleDescription, permissions[] } -> {}
//   POST /tenant/deleteRole  { roleId }                                         -> {}
// `permissions` are string keys from src/lib/permissions/catalog.ts — the full
// contract is in docs/roles-and-permissions.md. The catalog itself lives in the
// frontend; the old POST /tenant/getConfiguredRoles no longer exists.
//
// Verified live 2026-10-14: the backend stores `permissions` exactly as sent —
// it doesn't reject unknown keys, add missing requirements or refuse an empty
// roleName — so reads go through normalizePermissions() and the editor
// validates the name itself. deleteRole reports success even for an unknown
// roleId; the UI only offers it for roles nobody is on.
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";
import { normalizePermissions, type PermissionKey } from "./permissions/catalog";

export type Role = {
  roleId: number;
  roleName: string;
  roleDescription: string;
  /** Users currently on this role — a role can't be deleted while this is above 0. */
  userCount: number;
  /** Closed set (every requirement included), in catalog order. */
  permissions: PermissionKey[];
};

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
};

export async function getAllRoles(): Promise<Role[]> {
  const data = await apiPost<{ roles?: RawRole[] }>("/tenant/getAllRole");
  return (data?.roles ?? []).map((r) => ({
    roleId: r.roleId,
    roleName: r.roleName,
    roleDescription: r.roleDescription ?? "",
    userCount: r.userCount ?? 0,
    permissions: normalizePermissions(Array.isArray(r.permissions) ? r.permissions : []),
  }));
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
