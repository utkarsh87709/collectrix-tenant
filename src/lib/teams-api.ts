// Team management calls to the separately-hosted backend.
//   POST /tenant/getTeamList                {} -> { teamList[] }     (lightweight {teamId, teamName} for pickers)
//   POST /tenant/getTeamsCardView          {} -> { teamList[] }
//   POST /tenant/getTeamsOrgView           {} -> { leaderList[] }   (leaders → their teams → members)
//   POST /tenant/getAllLeaderList          {} -> { userList[] }     (candidate leaders = all users)
//   POST /tenant/getUnassignedTeamMemember {} -> { userList[] }     (users not yet on a team)
//   POST /tenant/getTeamNumbers            {} -> { phoneNoList[] }   (all numbers, with teamId/teamName; null = unassigned)
//   POST /tenant/createTeam  { teamName, leaderId, userList, capacity, phoneNoList } -> {}
//   POST /tenant/getTeamDetails { teamId } -> { teamDetails, assignedTeamMembers[], unassignedTeamMembers[], phoneNoList[] }
//   POST /tenant/updateTeam  { teamId, teamName, leaderId, userList, capacity, phoneNoList } -> {}
//   POST /tenant/deleteTeam  { teamId } -> {}  (releases the team's members AND its phone numbers)
// phoneNoList (create/update) is an array of phoneNoId to assign to the team.
// NOTE: createTeam requires a non-empty userList — an empty member list is rejected
// by the backend ("Server Error"). The leader must NOT also be listed as a member.
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";

/** A tenant phone number, annotated with the team it's assigned to (null = unassigned). */
export type TeamPhoneNumber = {
  phoneNoId: number;
  numberType: "local" | "tollFree";
  countryCode: string;
  areaCode: string;
  phoneNo: string;
  status: string;
  smsEnabled: number;
  callEnabled: number;
  tenantId: number;
  teamId: number | null;
  teamName: string | null;
};

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
  /** phoneNoIds to assign to this team. */
  phoneNoList: number[];
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
  /** Numbers assigned to this team plus unassigned ones available to add. */
  phoneNoList: TeamPhoneNumber[];
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

/** All tenant numbers with their team assignment — used when building/editing a team. */
export function getTeamNumbers(): Promise<{ phoneNoList: TeamPhoneNumber[] }> {
  return apiPost<{ phoneNoList: TeamPhoneNumber[] }>("/tenant/getTeamNumbers");
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

/** "+14284366030" -> "+1 (428) 436-6030"; falls back to the raw string. */
export function formatPhoneNo(e164: string): string {
  const digits = (e164 ?? "").replace(/[^\d]/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return e164 || "—";
}
