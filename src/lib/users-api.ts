// User management calls to the separately-hosted backend.
//   POST /tenant/getUsers           { page, size, status, searchText } -> { users[] (each w/ teamList, teamName, phoneNoList), totalCount }
//   POST /tenant/getRoleList        {}                                 -> { roles: [{roleId, roleName}] }
//   POST /tenant/getTeamPhoneNumber { teamId }                         -> { phoneNoList[] }  (numbers assigned to a team)
//   POST /tenant/createUser         { roleId, teamId, teamIdList, emailId, phoneNo, firstName, lastName, phoneNoList } -> { resetPasswordLink }
//   POST /tenant/updateUser         { userId, ...same }                -> {}
//   POST /tenant/resetUserPassword  { userId }                         -> { resetPasswordLink }
//   POST /tenant/activateUser       { userId }                         -> {}
//   POST /tenant/disableUser        { userId }                         -> {}
// A user can belong to MULTIPLE teams: send teamId as null and populate teamIdList.
// getUsers returns each user's teams as teamList [{teamId, teamName}] (plus a
// comma-joined teamName convenience string).
// phoneNoList carries the phone numbers allotted to the user, on both sides:
//   - WRITE (create/update): send an array of phoneNoId.
//   - READ  (getUsers): the allotted numbers come back here too. The element
//     shape may be a bare id or an object carrying phoneNoId, so normalize with
//     phoneNoIdsOf() rather than reading it directly.
// A user can only be assigned numbers that belong to one of their teams.
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";
import type { TeamPhoneNumber } from "./teams-api";

export type UserStatus = "active" | "disabled";

/** A team the user belongs to, as returned inside getUsers. */
export type UserTeam = { teamId: number; teamName: string };

export type TenantUser = {
  userId: number;
  firstName: string;
  lastName: string | null;
  emailId: string;
  phoneNo: string | null;
  role: string;
  roleId: number;
  /** @deprecated legacy single-team field; users can now belong to many teams (see teamList). */
  teamId?: number | null;
  /** The teams this user belongs to. */
  teamList?: UserTeam[];
  /** Comma-joined team names, e.g. "Legal, Recovery Team" (convenience for display). */
  teamName: string | null;
  status: string;
  loginAt: string | null;
  createdAt: string;
  updatedAt: string;
  calendarConnected: boolean | null;
  /** The phone numbers allotted to this user, as returned by getUsers. Element
   *  shape isn't guaranteed (bare id or an object with phoneNoId) — read it via
   *  phoneNoIdsOf() to normalize to number[]. */
  phoneNoList?: Array<number | { phoneNoId: number }>;
};

/** Normalize a user's phoneNoList to plain phoneNoId numbers, tolerating either
 *  a bare-id array or an array of objects carrying phoneNoId. */
export function phoneNoIdsOf(user: Pick<TenantUser, "phoneNoList">): number[] {
  return (user.phoneNoList ?? []).map((p) => (typeof p === "number" ? p : p.phoneNoId));
}

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
  /** Always null now — team membership lives in teamIdList. */
  teamId: null;
  /** The teams this user belongs to. */
  teamIdList: number[];
  emailId: string;
  phoneNo: string;
  firstName: string;
  lastName: string | null;
  /** phoneNoIds (from one of the user's teams) to assign to this user. */
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
