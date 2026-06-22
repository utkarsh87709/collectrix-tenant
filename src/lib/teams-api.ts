// Team management calls to the separately-hosted backend.
//   POST /tenant/getTeamList                {} -> { teamList[] }     (lightweight {teamId, teamName} for pickers)
//   POST /tenant/getTeamsCardView          {} -> { teamList[] }
//   POST /tenant/getTeamsOrgView           {} -> { leaderList[] }   (leaders → their teams → members)
//   POST /tenant/getAllLeaderList          {} -> { userList[] }     (candidate leaders = all users)
//   POST /tenant/getUnassignedTeamMemember {} -> { userList[] }     (users not yet on a team)
//   POST /tenant/createTeam  { teamName, leaderId, userList, capacity } -> {}
//   POST /tenant/getTeamDetails { teamId } -> { teamDetails, assignedTeamMembers[], unassignedTeamMembers[] }
//   POST /tenant/updateTeam  { teamId, teamName, leaderId, userList, capacity } -> {}
//   POST /tenant/deleteTeam  { teamId } -> {}  (releases the team's members)
// NOTE: createTeam requires a non-empty userList — an empty member list is rejected
// by the backend ("Server Error"). The leader must NOT also be listed as a member.
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";

export type TeamMember = {
  userId: number;
  firstName: string;
  lastName: string | null;
  emailId: string;
  role: string;
};

export type TeamCard = {
  teamId: number;
  createdAt: string;
  teamName: string;
  capacity: number;
  leaderId: number;
  leaderFirstName: string;
  leaderLastName: string;
  teamMembers: TeamMember[];
};

export type OrgTeam = {
  teamId: number;
  createdAt: string;
  teamName: string;
  capacity: number;
  teamMembers: TeamMember[];
};

export type LeaderGroup = {
  leaderId: number;
  leaderFirstName: string;
  leaderLastName: string;
  teamList: OrgTeam[];
};

/** Shape shared by the leader picker and the unassigned-member picker. */
export type SelectableUser = {
  userId: number;
  firstName: string;
  lastName: string | null;
  emailId: string;
  role: string;
};

export type CreateTeamInput = {
  teamName: string;
  leaderId: number;
  userList: number[];
  capacity: number;
};

export type UpdateTeamInput = CreateTeamInput & { teamId: number };

/** Leader block returned by getTeamDetails (note: leader fields are flattened, not nested). */
export type TeamDetails = {
  teamId: number;
  createdAt: string;
  teamName: string;
  capacity: number;
  leaderId: number;
  firstName: string;
  lastName: string | null;
  role: string;
  emailId: string;
};

export type GetTeamDetailsResult = {
  teamDetails: TeamDetails;
  /** Members currently on the team (pre-selected when editing). */
  assignedTeamMembers: TeamMember[];
  /** Members available to add to this team. */
  unassignedTeamMembers: TeamMember[];
};

/** Minimal team shape for dropdowns (assigning a user to a team). */
export type TeamListItem = {
  teamId: number;
  teamName: string;
};

export function getTeamList(): Promise<{ teamList: TeamListItem[] }> {
  return apiPost<{ teamList: TeamListItem[] }>("/tenant/getTeamList");
}

export function getTeamsCardView(): Promise<{ teamList: TeamCard[] }> {
  return apiPost<{ teamList: TeamCard[] }>("/tenant/getTeamsCardView");
}

export function getTeamsOrgView(): Promise<{ leaderList: LeaderGroup[] }> {
  return apiPost<{ leaderList: LeaderGroup[] }>("/tenant/getTeamsOrgView");
}

export function getAllLeaderList(): Promise<{ userList: SelectableUser[] }> {
  return apiPost<{ userList: SelectableUser[] }>("/tenant/getAllLeaderList");
}

export function getUnassignedTeamMembers(): Promise<{ userList: SelectableUser[] }> {
  return apiPost<{ userList: SelectableUser[] }>("/tenant/getUnassignedTeamMemember");
}

export function createTeam(input: CreateTeamInput): Promise<unknown> {
  return apiPost("/tenant/createTeam", { ...input });
}

export function getTeamDetails(teamId: number): Promise<GetTeamDetailsResult> {
  return apiPost<GetTeamDetailsResult>("/tenant/getTeamDetails", { teamId });
}

export function updateTeam(input: UpdateTeamInput): Promise<unknown> {
  return apiPost("/tenant/updateTeam", { ...input });
}

export function deleteTeam(teamId: number): Promise<unknown> {
  return apiPost("/tenant/deleteTeam", { teamId });
}

export function fullName(u: { firstName: string; lastName?: string | null }): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
}
