// Archive calls to the separately-hosted backend — "Case Files → Archive": the
// parked files removed from the active workload. Nothing is deleted. A file
// lands here via customers-api's archiveCustomer (manual) or a status's
// auto-archive rule (status-automation-api), and leaves via unArchiveCustomer.
//   POST /tenant/getArchivedCustomers { searchText, clientId, teamId, statusId, page, size,
//                                       archivedFromDate, archivedToDate } -> { totalCount, debtorList[] }
//        Request shape is from the backend's Postman collection (2026-09-08):
//        the three id filters are "" when unset (not null), and the two dates
//        are yyyy/mm/dd strings or "" — slashes, unlike getCustomerList's
//        yyyy-mm-dd. The row shape below is inferred from the sibling
//        getMovedCustomers row (moved-files-api) plus the archive columns this
//        tab shows; it could NOT be verified live from this workstation, so the
//        archive-specific fields are optional and the screen renders "—" for
//        anything the backend turns out not to send.
//   POST /tenant/UnArchiveCustomer  { uploadedDebtorId } -> {}
//        Clears archivedFlag and returns the file to its team's active
//        workload; the capital U is the backend's own spelling. Takes no
//        reason/remark, so the Restore dialog deliberately has no reason field.
// Dropdown option lists come from the existing master-data endpoints (per
// backend dev, 2026-09-08): clients → mass-update-api's getClientList,
// statuses → mass-update-api's getStatusList (statuses-api's getAllStatus for
// pill colours), teams → moved-files-api's getMovedTeamList.
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";

/** One archived debtor row. Fields marked optional are the ones not yet
 *  confirmed live — see the file-header note. */
export type ArchivedDebtor = {
  uploadedDebtorId: number;
  createdAt?: string;
  fileId?: number;
  ourFileNo: string;
  creditorName: string | null;
  debtorFirstName: string | null;
  debtorMiddleName: string | null;
  debtorLastName: string | null;
  currentOutstandingBalance: string | null;
  currency: string | null;
  clientId?: number | null;
  clientName: string | null;
  clientNumber: string | null;
  assignedTeamId?: number | null;
  teamName: string | null;
  assignedTo?: number | null;
  /** The status the file was on when it was archived — it keeps it on restore. */
  statusId: number | null;
  status?: string | null;
  statusCode?: string | null;
  statusColorCode?: string | null;
  archivedFlag?: number;
  /** When the file was archived (ISO). Mirrors moved-files-api's movedAt. */
  archivedAt?: string | null;
  /** The user who archived it; null when a status automation did it. */
  archivedBy?: number | null;
  archivedUserFirstName?: string | null;
  archivedUserLastName?: string | null;
};

export type ArchiveSource = "auto" | "manual";

/** "First Middle Last" from an archived debtor's split name fields. */
export function archivedDebtorName(d: ArchivedDebtor): string {
  return [d.debtorFirstName, d.debtorMiddleName, d.debtorLastName].filter(Boolean).join(" ");
}

/** Who archived the file, or null when the backend doesn't say. A null
 *  archivedBy with a timestamp means no user did it — i.e. a status's
 *  auto-archive rule — mirroring how movedBy behaves on getMovedCustomers. */
export function archiveSource(d: ArchivedDebtor): ArchiveSource | null {
  if (d.archivedBy === undefined) return null;
  if (d.archivedBy === null) return d.archivedAt ? "auto" : null;
  return "manual";
}

/** "just now" / "3 hours ago" / "yesterday" / "14 days ago", or null when the
 *  row carries no usable archive timestamp. */
export function archivedAgo(
  iso: string | null | undefined,
  now: number = Date.now(),
): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.floor((now - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins === 1 ? "1 min ago" : `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** Native <input type="date"> gives yyyy-mm-dd; the backend wants yyyy/mm/dd
 *  (or "" for no bound). Anything that isn't a full date is sent as "". */
export function toArchiveDate(yyyyMmDd: string | null | undefined): string {
  if (!yyyyMmDd) return "";
  const m = yyyyMmDd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : "";
}

export type GetArchivedCustomersParams = {
  searchText?: string;
  clientId?: number | null;
  teamId?: number | null;
  statusId?: number | null;
  page?: number;
  size?: number;
  /** yyyy-mm-dd (native date input value); converted to the backend's yyyy/mm/dd. */
  archivedFromDate?: string | null;
  archivedToDate?: string | null;
};

export type GetArchivedCustomersResult = {
  totalCount: number;
  debtorList: ArchivedDebtor[];
};

export async function getArchivedCustomers(
  params: GetArchivedCustomersParams = {},
): Promise<GetArchivedCustomersResult> {
  const data = await apiPost<Partial<GetArchivedCustomersResult> | null>(
    "/tenant/getArchivedCustomers",
    {
      searchText: params.searchText ?? "",
      clientId: params.clientId ?? "",
      teamId: params.teamId ?? "",
      statusId: params.statusId ?? "",
      page: params.page ?? 0,
      size: params.size ?? 10,
      archivedFromDate: toArchiveDate(params.archivedFromDate),
      archivedToDate: toArchiveDate(params.archivedToDate),
    },
  );
  return {
    totalCount: data?.totalCount ?? 0,
    debtorList: data?.debtorList ?? [],
  };
}

/** Undo an archive: the file returns to its team's active workload with the
 *  status it had when it was archived. */
export function unArchiveCustomer(uploadedDebtorId: number): Promise<unknown> {
  return apiPost("/tenant/UnArchiveCustomer", { uploadedDebtorId });
}
