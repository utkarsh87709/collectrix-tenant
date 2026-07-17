// Team Deck calls to the separately-hosted backend.
//   POST /tenant/getTeamDeckTeamList       {}                                          -> { teamList: [{teamId, teamName}] }
//        Teams the caller can act on: teams the user belongs to (and ALL of them for
//        tenantAdmin), restricted to teams that have at least one debtor assigned.
//   POST /tenant/getTeamDeckDebtors        { searchText, page, size, status, teamId }  -> { totalCount, debtorList[] }
//        status: "inDeck"   -> debtors handed to the team but not yet given to a member (assignedTo === null)
//        status: "assigned" -> debtors currently being worked by a team member (assignedTo !== null)
//   POST /tenant/getTeamDeckAssignUserList  { teamId }                                 -> { assignUserList[] }
//        The members of the team a deck debtor can be handed to.
//   POST /tenant/teamDeckAssignUser         { userId, uploadedDebtorIdList }           -> {}
//        Assigns (or re-assigns) one or more deck debtors to a single team member.
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";

/** Minimal team shape for the deck team picker. */
export type TeamDeckTeam = {
  teamId: number;
  teamName: string;
};

/** "inDeck" = awaiting a member; "assigned" = being worked by a member. */
export type DeckStatus = "inDeck" | "assigned";

/** A debtor row on the Team Deck. Only the fields the screen reads are typed;
 *  the backend returns the full debtor record (see upload-debtor-api DebtorRecord). */
export type TeamDeckDebtor = {
  uploadedDebtorId: number;
  createdAt: string;
  fileId: number;
  status: string;
  ourFileNo: string;
  clientFileNo: string;
  creditorName: string;
  creditorNumber: string;
  debtorName: string;
  city: string;
  province: string;
  currentOutstandingBalance: string;
  currency: string;
  clientName: string;
  clientNumber: string;
  /** The team this debtor is assigned to. */
  assignedTeamId: number | null;
  teamName: string | null;
  /** The member this debtor is assigned to (null while in deck). */
  assignedTo: number | null;
  assignedUserFirstName: string | null;
  assignedUserLastName: string | null;
  [key: string]: string | number | boolean | null | undefined | unknown[];
};

/** A team member a deck debtor can be handed to. */
export type AssignableMember = {
  userId: number;
  firstName: string;
  lastName: string | null;
  emailId: string;
  role: string;
};

export type GetTeamDeckDebtorsParams = {
  teamId: number;
  status: DeckStatus;
  searchText?: string;
  page?: number;
  size?: number;
};

export type GetTeamDeckDebtorsResult = {
  totalCount: number;
  debtorList: TeamDeckDebtor[];
};

/** Teams the caller can manage on the deck (must have debtors assigned). */
export function getTeamDeckTeamList(): Promise<{ teamList: TeamDeckTeam[] }> {
  return apiPost<{ teamList: TeamDeckTeam[] }>("/tenant/getTeamDeckTeamList");
}

export function getTeamDeckDebtors(
  params: GetTeamDeckDebtorsParams,
): Promise<GetTeamDeckDebtorsResult> {
  return apiPost<GetTeamDeckDebtorsResult>("/tenant/getTeamDeckDebtors", {
    teamId: params.teamId,
    status: params.status,
    searchText: params.searchText ?? "",
    page: params.page ?? 0,
    size: params.size ?? 10,
  });
}

/** Members of a team, i.e. who a deck debtor can be handed to. */
export function getTeamDeckAssignUserList(
  teamId: number,
): Promise<{ assignUserList: AssignableMember[] }> {
  return apiPost<{ assignUserList: AssignableMember[] }>("/tenant/getTeamDeckAssignUserList", {
    teamId,
  });
}

/** Assign (or re-assign) one or more deck debtors to a single team member. */
export function teamDeckAssignUser(
  userId: number,
  uploadedDebtorIdList: number[],
): Promise<unknown> {
  return apiPost("/tenant/teamDeckAssignUser", { userId, uploadedDebtorIdList });
}

/** "Michelle Osei" style full name from a member (lastName is usually blank). */
export function memberName(m: { firstName: string; lastName?: string | null }): string {
  return [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
}

/** The name of the member a debtor is assigned to, or null while in deck. */
export function assignedMemberName(d: TeamDeckDebtor): string | null {
  if (d.assignedTo == null) return null;
  const name = [d.assignedUserFirstName, d.assignedUserLastName].filter(Boolean).join(" ").trim();
  return name || `User #${d.assignedTo}`;
}

/** "7510.00" + "CAD" -> "$7,510.00 CAD"; tolerant of blank/garbled input. */
export function formatBalance(amount: string, currency: string): string {
  const n = Number(amount);
  if (!amount || Number.isNaN(n)) return amount || "—";
  const formatted = n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${formatted}${currency ? ` ${currency}` : ""}`;
}
