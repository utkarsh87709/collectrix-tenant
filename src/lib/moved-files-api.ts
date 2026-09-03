// Moved Files calls to the separately-hosted backend — the destination team's
// inbox for files transferred in from another team.
//   POST /tenant/getMovedTeamList             {}                                -> { teamList: [{teamId, teamName}] }
//        Teams with moved files to review (verified live, 2026-09-02 — same
//        shape as team-deck-api's TeamDeckTeam).
//   POST /tenant/getMovedCustomers            { teamId, searchText, page, size } -> { totalCount, debtorList[] }
//        Per backend dev (2026-09-02): NOT filtered to "unhandled transfers
//        only" — statusId is not a reliable signal here, since an
//        already-statused/assigned file can also be moved. Verified live: the
//        response can include rows with no move history at all (movedAt/movedBy
//        both null) and archived debtors, alongside actually-moved ones —
//        rendered as-is, trusting the backend's scoping for this team.
//   POST /tenant/assignMovedFileStatusAndUser { uploadedDebtorIdList, newStatusId, assignUserId } -> {}
//        "Take on" a batch of moved files: sets their status and optionally
//        hands them to a member in the same step. newStatusId/assignUserId may
//        each be null to leave that half unchanged (per backend dev, 2026-09-02).
// Status options come from statuses-api's getAllStatus (colour-coded pill);
// member options for a team come from team-deck-api's getTeamDeckAssignUserList
// — both reused as-is rather than duplicated here.
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";

/** A team with moved files to review — same shape as team-deck-api's TeamDeckTeam. */
export type MovedTeam = {
  teamId: number;
  teamName: string;
};

/** Teams the caller can review moved files for. */
export function getMovedTeamList(): Promise<{ teamList: MovedTeam[] }> {
  return apiPost<{ teamList: MovedTeam[] }>("/tenant/getMovedTeamList");
}

/** A debtor row as returned by getMovedCustomers (verified live shape, 2026-09-02).
 *  See the file-header note above — rows here aren't guaranteed to have gone
 *  through an actual move, or to still be statusless. */
export type MovedDebtor = {
  uploadedDebtorId: number;
  createdAt: string;
  fileId: number;
  ourFileNo: string;
  creditorName: string;
  debtorFirstName: string | null;
  debtorMiddleName: string | null;
  debtorLastName: string | null;
  currentOutstandingBalance: string;
  currency: string;
  clientName: string;
  clientNumber: string;
  teamName: string | null;
  assignedTeamId: number | null;
  assignedTo: number | null;
  statusId: number | null;
  archivedFlag: number;
  /** Set once this debtor has actually been through a move; null otherwise. */
  movedAt: string | null;
  movedBy: number | null;
  movedUserFirstName: string | null;
  movedUserLastName: string | null;
};

/** "First Middle Last" from a moved debtor's split name fields. */
export function movedDebtorName(d: MovedDebtor): string {
  return [d.debtorFirstName, d.debtorMiddleName, d.debtorLastName].filter(Boolean).join(" ");
}

/** "Sep 1, 2026, 1:58 PM by Utkarsh Singh Parihar", or null when this row has
 *  no move history at all (movedAt is null). */
export function movedInfo(d: MovedDebtor): string | null {
  if (!d.movedAt) return null;
  const when = new Date(d.movedAt).toLocaleString();
  const who = [d.movedUserFirstName, d.movedUserLastName].filter(Boolean).join(" ").trim();
  return who ? `${when} by ${who}` : when;
}

export type GetMovedCustomersParams = {
  teamId: number;
  searchText?: string;
  page?: number;
  size?: number;
};

export type GetMovedCustomersResult = {
  totalCount: number;
  debtorList: MovedDebtor[];
};

export function getMovedCustomers(
  params: GetMovedCustomersParams,
): Promise<GetMovedCustomersResult> {
  return apiPost<GetMovedCustomersResult>("/tenant/getMovedCustomers", {
    teamId: params.teamId,
    searchText: params.searchText ?? "",
    page: params.page ?? 0,
    size: params.size ?? 10,
  });
}

/** Take on one or more moved files: set their status and, optionally, hand
 *  them to a member in the same step. Pass null to leave a field unchanged. */
export function assignMovedFileStatusAndUser(params: {
  uploadedDebtorIdList: number[];
  newStatusId: number | null;
  assignUserId: number | null;
}): Promise<unknown> {
  return apiPost("/tenant/assignMovedFileStatusAndUser", params);
}
