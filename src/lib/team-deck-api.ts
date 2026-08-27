// Team Deck calls to the separately-hosted backend.
//   POST /tenant/getTeamDeckTeamList       {}                                          -> { teamList: [{teamId, teamName}] }
//        Teams the caller can act on: teams the user belongs to (and ALL of them for
//        tenantAdmin), restricted to teams that have at least one debtor assigned.
//   POST /tenant/getTeamDeckDebtors        { searchText, creditorName, page, size, status, teamId } -> { totalCount, debtorList[] }
//        status: "inDeck"   -> debtors handed to the team but not yet given to a member (assignedTo === null)
//        status: "assigned" -> debtors currently being worked by a team member (assignedTo !== null)
//        creditorName: exact match against the debtor's creditor field — the "All
//        creditors" filter (per backend dev, 2026-08-27; NOT YET live on devapi as of
//        that date — sending it has no effect until the backend deploys support).
//        Each row is a flat debtor record (same default-field set as upload-debtor-api's
//        DebtorRecord, but returned flat rather than nested under debtorDetails/customFields).
//   POST /tenant/getCreditorList            {}                                         -> { creditorList: string[] }
//        Every creditor name across the tenant, for the "All creditors" filter dropdown.
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

/** A debtor row on the Team Deck — the default-field set, flat (verified live;
 *  there is no `debtorName`/`city`/`province`/`clientFileNo`/`creditorNumber` —
 *  the name is split into debtorFirstName/debtorMiddleName/debtorLastName). */
export type TeamDeckDebtor = {
  uploadedDebtorId: number;
  createdAt: string;
  fileId: number;
  statusId: number | null;
  validRecord?: number;
  invalidAttribute?: { parameterName: string; reason: string }[];
  ourFileNo: string;
  creditorName: string;
  debtorFirstName: string | null;
  debtorMiddleName: string | null;
  debtorLastName: string | null;
  address: string;
  homeNo: string;
  cellNo1: string;
  cellNo2: string;
  email: string;
  dob: string;
  principal: string;
  interestRate: string;
  interestType: string;
  compoundingFrequency: string;
  interestStartDate: string;
  currentOutstandingBalance: string;
  currency: string;
  delinquencyDate: string;
  dateOfLastPayment: string;
  lastPaymentAmount: string;
  lastPaymentMethod: string;
  totalPaidToDate: string;
  preferredLanguage: string;
  clientName: string;
  clientNumber: string;
  /** The team this debtor is assigned to. */
  assignedTeamId: number | null;
  teamName: string | null;
  /** The member this debtor is assigned to (null while in deck). */
  assignedTo: number | null;
  assignedUserFirstName: string | null;
  assignedUserLastName: string | null;
};

/** "First Middle Last" from a deck debtor's split name fields. */
export function deckDebtorName(d: TeamDeckDebtor): string {
  return [d.debtorFirstName, d.debtorMiddleName, d.debtorLastName].filter(Boolean).join(" ");
}

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
  /** Exact match against a debtor's creditor name — the "All creditors" filter. */
  creditorName?: string;
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

/** Every creditor name across the tenant, for the "All creditors" filter dropdown. */
export function getCreditorList(): Promise<{ creditorList: string[] }> {
  return apiPost<{ creditorList: string[] }>("/tenant/getCreditorList");
}

export function getTeamDeckDebtors(
  params: GetTeamDeckDebtorsParams,
): Promise<GetTeamDeckDebtorsResult> {
  return apiPost<GetTeamDeckDebtorsResult>("/tenant/getTeamDeckDebtors", {
    teamId: params.teamId,
    status: params.status,
    searchText: params.searchText ?? "",
    creditorName: params.creditorName ?? "",
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
