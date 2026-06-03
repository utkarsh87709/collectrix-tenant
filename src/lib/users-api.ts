// User management calls to the separately-hosted backend.
//   POST /tenant/getUsers           { page, size, status, searchText } -> { users[], totalCount }
//   POST /tenant/getRoleList        {}                                 -> { roles: [{roleId, roleName}] }
//   POST /tenant/createUser         { roleId, teamId, emailId, phoneNo, firstName, lastName } -> { resetPasswordLink }
//   POST /tenant/updateUser         { userId, ...same }                -> {}
//   POST /tenant/resetUserPassword  { userId }                         -> { resetPasswordLink }
//   POST /tenant/activateUser       { userId }                         -> {}
//   POST /tenant/disableUser        { userId }                         -> {}
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";

export type UserStatus = "active" | "disabled";

export type TenantUser = {
  userId: number;
  firstName: string;
  lastName: string | null;
  emailId: string;
  phoneNo: string | null;
  role: string;
  roleId: number;
  teamId: number | null;
  status: string;
  loginAt: string | null;
  createdAt: string;
  updatedAt: string;
  calendarConnected: boolean | null;
};

export type GetUsersParams = {
  page: number;
  size: number;
  status: UserStatus | null;
  searchText: string;
};

export type GetUsersResult = { users: TenantUser[]; totalCount: number };

export type RoleListItem = { roleId: number; roleName: string };

export type UserInput = {
  roleId: number;
  teamId: number | null;
  emailId: string;
  phoneNo: string;
  firstName: string;
  lastName: string | null;
};

export function getUsers(params: GetUsersParams): Promise<GetUsersResult> {
  return apiPost<GetUsersResult>("/tenant/getUsers", { ...params });
}

export function getRoleList(): Promise<{ roles: RoleListItem[] }> {
  return apiPost<{ roles: RoleListItem[] }>("/tenant/getRoleList");
}

export function createUser(input: UserInput): Promise<{ resetPasswordLink: string }> {
  return apiPost<{ resetPasswordLink: string }>("/tenant/createUser", { ...input });
}

export function updateUser(input: UserInput & { userId: number }): Promise<unknown> {
  return apiPost("/tenant/updateUser", { ...input });
}

export function resetUserPassword(userId: number): Promise<{ resetPasswordLink: string }> {
  return apiPost<{ resetPasswordLink: string }>("/tenant/resetUserPassword", { userId });
}

export function activateUser(userId: number): Promise<unknown> {
  return apiPost("/tenant/activateUser", { userId });
}

export function disableUser(userId: number): Promise<unknown> {
  return apiPost("/tenant/disableUser", { userId });
}
