// User management calls to the separately-hosted backend.
//   POST /tenant/getUsers           { page, size, status, searchText } -> { users[] (each w/ teamName, phoneNoList), totalCount }
//   POST /tenant/getRoleList        {}                                 -> { roles: [{roleId, roleName}] }
//   POST /tenant/getTeamPhoneNumber { teamId }                         -> { phoneNoList[] }  (numbers assigned to a team)
//   POST /tenant/createUser         { roleId, teamId, emailId, phoneNo, firstName, lastName, phoneNoList } -> { resetPasswordLink }
//   POST /tenant/updateUser         { userId, ...same }                -> {}
//   POST /tenant/resetUserPassword  { userId }                         -> { resetPasswordLink }
//   POST /tenant/activateUser       { userId }                         -> {}
//   POST /tenant/disableUser        { userId }                         -> {}
// phoneNoList (create/update) is an array of phoneNoId assigned to the user. A user
// can only be assigned numbers that belong to their team.
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";
import type { TeamPhoneNumber } from "./teams-api";

export type UserStatus = "active" | "disabled";

/** A team number as returned inside getUsers — annotated with who it's assigned to. */
export type UserPhoneNumber = TeamPhoneNumber & { assignedUserId: number | null };

export type TenantUser = {
  userId: number;
  firstName: string;
  lastName: string | null;
  emailId: string;
  phoneNo: string | null;
  role: string;
  roleId: number;
  teamId: number | null;
  teamName: string | null;
  status: string;
  loginAt: string | null;
  createdAt: string;
  updatedAt: string;
  calendarConnected: boolean | null;
  /** The user's team's numbers, each carrying assignedUserId. */
  phoneNoList?: UserPhoneNumber[];
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
  /** phoneNoIds (from the user's team) to assign to this user. */
  phoneNoList: number[];
};

export function getUsers(params: GetUsersParams): Promise<GetUsersResult> {
  return apiPost<GetUsersResult>("/tenant/getUsers", { ...params });
}

export function getRoleList(): Promise<{ roles: RoleListItem[] }> {
  return apiPost<{ roles: RoleListItem[] }>("/tenant/getRoleList");
}

/** Numbers assigned to a given team — the pool a user in that team can be given. */
export function getTeamPhoneNumber(teamId: number): Promise<{ phoneNoList: TeamPhoneNumber[] }> {
  return apiPost<{ phoneNoList: TeamPhoneNumber[] }>("/tenant/getTeamPhoneNumber", { teamId });
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
