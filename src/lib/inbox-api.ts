// Inbound Inbox calls to the separately-hosted backend — the "customerInbox"
// folder of the backend's Postman collection (v19, 2026-09-10).
//
//   POST /tenant/getInboxCustomers { page, size, searchText, clientId, teamId, statusId,
//                                    currentOutstandingBalanceMin/Max,
//                                    delinquencyStartDate/EndDate,
//                                    dateOfLastPaymentStart/End }
//                                  -> { totalCount, debtorList[] }
//     Identical filter body to getCustomerList (ids null when unset, dates yyyy-mm-dd).
//     Row shape CONFIRMED 2026-09-10 from a live response the user pasted:
//       { uploadedDebtorId, ourFileNo, unreadMsgCount, debtorFirstName, debtorMiddleName,
//         debtorLastName, creditorName, clientName, clientNumber, teamName, status }
//     i.e. unreadMsgCount is there, but NO last-message text/time/channel, no balance,
//     no statusCode/statusColorCode and no tags. Raised with backend the same day —
//     the optional fields on InboxCustomer are the names requested, so they show
//     through the moment they're added; until then inbox-placeholders.ts fills the
//     message summary with samples (unread stays real).
//   POST /tenant/inboxAssignUser { uploadedDebtorId, userId } -> {}
//     Hands the file to a member of its own team. Candidate members come from
//     team-deck-api's getTeamDeckAssignUserList(details.assignedTeamId).
//
// Everything else the inbox uses already lives elsewhere: conversations and
// sending (getCustomerSms/sendCustomerSms, getCustomerEmail/sendCustomerEmail),
// engagement (stopEngagement/startEngagement), calling (callCustomerNumberList/
// initiateCustomerCall), notes, and tags (getTagList/assignCustomerTag/
// deleteCustomerTag) are all in customers-api.ts.
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";
import type { CustomerListFilters, CustomerListItem } from "./customers-api";

/** One conversation row, exactly as the backend returns it today. */
export type InboxCustomer = {
  uploadedDebtorId: number;
  ourFileNo: string;
  /** Messages received since the file was last opened — real, verified live. */
  unreadMsgCount: number | null;
  debtorFirstName: string | null;
  debtorMiddleName: string | null;
  debtorLastName: string | null;
  creditorName: string;
  clientName: string;
  clientNumber: string;
  teamName: string | null;
  /** Status display name only — no code or colour on the row. */
  status: string | null;

  /* ---- Requested from backend 2026-09-10, not on the row yet. Optional so the
     UI picks them up automatically once they land. ---- */
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  lastMessageChannel?: string | null;
  lastMessageDirection?: string | null;
  currentOutstandingBalance?: string | null;
  statusCode?: string | null;
  statusColorCode?: string | null;
  customerTags?: unknown;
};

// Mirrors the request body in the collection exactly (nulls, not omissions).
const INBOX_FILTER_DEFAULTS: Required<Omit<CustomerListFilters, "page" | "size">> = {
  searchText: "",
  clientId: null,
  teamId: null,
  statusId: null,
  currentOutstandingBalanceMin: null,
  currentOutstandingBalanceMax: null,
  delinquencyStartDate: null,
  delinquencyEndDate: null,
  dateOfLastPaymentStart: null,
  dateOfLastPaymentEnd: null,
};

export function getInboxCustomers(
  filters: CustomerListFilters = {},
): Promise<{ totalCount: number; debtorList: InboxCustomer[] }> {
  return apiPost("/tenant/getInboxCustomers", {
    ...INBOX_FILTER_DEFAULTS,
    ...filters,
    page: filters.page ?? 0,
    size: filters.size ?? 20,
  });
}

/** Assign (or re-assign) the file to a member of its team. */
export function inboxAssignUser(input: {
  uploadedDebtorId: number;
  userId: number;
}): Promise<unknown> {
  return apiPost("/tenant/inboxAssignUser", { ...input });
}

/* ------------------------------ Row readers ------------------------------- */

export type InboxChannel = "sms" | "email";

export type InboxPreview = {
  /** Raw last-message text (may be HTML for email) — null when the row has none. */
  body: string | null;
  /** ISO-ish timestamp of the last message, when the row carries one. */
  at: string | null;
  channel: InboxChannel | null;
  direction: "incoming" | "outgoing" | null;
};

function firstString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Read the "last message" summary off a conversation row. The requested
 *  names (lastMessage, lastMessageAt, lastMessageChannel, lastMessageDirection)
 *  are tried first, then a few plausible variants in case backend picks
 *  different ones; a row with none yields all-null and the list shows samples. */
export function inboxPreview(row: InboxCustomer): InboxPreview {
  const r = row as unknown as Record<string, unknown>;
  const body = firstString(r, [
    "lastMessage",
    "lastMsg",
    "lastMessageBody",
    "lastMsgBody",
    "lastBody",
    "lastReply",
    "preview",
  ]);
  const at = firstString(r, [
    "lastMessageAt",
    "lastMsgAt",
    "lastMessageTime",
    "lastMsgTime",
    "lastMessageDate",
    "lastMsgDate",
    "lastContactedAt",
    "lastActivityAt",
    "updatedAt",
  ]);
  const ch = firstString(r, [
    "lastMessageChannel",
    "lastMsgChannel",
    "lastChannel",
    "lastMsgType",
    "lastMessageType",
    "channel",
  ])?.toLowerCase();
  const channel: InboxChannel | null = !ch
    ? null
    : ch.includes("mail")
      ? "email"
      : ch.includes("sms") || ch.includes("text")
        ? "sms"
        : null;
  const dir = firstString(r, [
    "lastMessageDirection",
    "lastMsgDirection",
    "direction",
  ])?.toLowerCase();
  const direction = dir === "incoming" || dir === "outgoing" ? dir : null;
  return { body, at, channel, direction };
}

/** Unread count as a safe non-negative integer, or null when the row doesn't
 *  carry the field at all (so a caller can tell "zero unread" from "unknown"). */
export function inboxUnread(row: Pick<InboxCustomer, "unreadMsgCount">): number | null {
  if (!("unreadMsgCount" in row) || row.unreadMsgCount === undefined) return null;
  const n = Number(row.unreadMsgCount);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
