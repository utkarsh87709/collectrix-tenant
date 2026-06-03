// Roles & Permissions calls to the separately-hosted backend.
//   POST /tenant/getConfiguredRoles  {}                          -> permission catalog
//   POST /tenant/getAllRole          {}                          -> configured roles
//   POST /tenant/createRole          { roleName, roleDescription, allowedConfiguration[] }
//   POST /tenant/updateRole          { roleId, ...same }
// All authenticated with the raw token (attached automatically by apiFetch).
import { apiFetch } from "./api-client";

export type PermissionConfig = {
  configId: number;
  configName: string;
  configCode: string;
  tabsLinked: string[];
};

export type PermissionGroup = {
  header: string;
  configuration: PermissionConfig[];
};

export type TabInfo = {
  tabName: string;
  tabDescription: string;
};

export type ConfiguredRoles = {
  configuredRoles: PermissionGroup[];
  tabsLinked: TabInfo[];
};

export type Role = {
  roleId: number;
  roleName: string;
  userCount: number;
  allowedConfiguration: number[];
};

export type AllRoles = {
  roles: Role[];
  totalConfiguration: number;
};

export type RoleInput = {
  roleName: string;
  roleDescription: string;
  allowedConfiguration: number[];
};

type Envelope<T> = {
  meta?: { status?: boolean; message?: string; code?: number };
  data?: T;
};

// POST helper that enforces the { meta, data } envelope. The backend returns
// HTTP 200 with meta.status:false for business errors (e.g. duplicate name),
// so success must be read from meta.status rather than the HTTP code.
async function post<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await apiFetch<Envelope<T>>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res?.meta?.status) {
    throw new Error(res?.meta?.message || "Request failed. Please try again.");
  }
  return res.data as T;
}

export function getConfiguredRoles(): Promise<ConfiguredRoles> {
  return post<ConfiguredRoles>("/tenant/getConfiguredRoles");
}

export function getAllRoles(): Promise<AllRoles> {
  return post<AllRoles>("/tenant/getAllRole");
}

export function createRole(input: RoleInput): Promise<unknown> {
  return post("/tenant/createRole", { ...input });
}

export function updateRole(input: RoleInput & { roleId: number }): Promise<unknown> {
  return post("/tenant/updateRole", { ...input });
}
