// Inbound Inbox calls to the separately-hosted backend — the "customerInbox"
// folder of the backend's Postman collection (v19, 2026-09-10).
//
//   POST /tenant/getInboxCustomers { page, size, searchText, clientId, teamId, statusId,
//                                    currentOutstandingBalanceMin/Max,
//                                    delinquencyStartDate/EndDate,
//                                    dateOfLastPaymentStart/End }
//                                  -> { totalCount, debtorList[] }
//     Identical filter body to getCustomerList (ids null when unset, dates yyyy-mm-dd).
//     Row shape RE-CONFIRMED 2026-09-29 from a live response (devapi, tenantId 1):
//       { uploadedDebtorId, ourFileNo, unreadMsgCount, lastMsg, debtorFirstName,
//         debtorMiddleName, debtorLastName, creditorName, clientName, clientNumber,
//         teamName, status }
//     Backend has now shipped the requested last-message summary, but as a single
//     field named lastMsg (plain text, null when the file has no messages) — NOT
//     lastMessage as originally asked for. There is still no lastMessageAt,
//     lastMessageChannel, lastMessageDirection, balance, statusCode/statusColorCode
//     or tags on the row; inboxPreview() below reads lastMsg for the body and
//     leaves the rest null, and the UI shows "No messages yet" / no timestamp
//     rather than guessing.
//     unreadMsgCount itself was already a real field (not a placeholder) — every
//     row checked live today returns 0, so the previously reported "first
//     conversation always shows unreadMsgCount: 1" looks like it was either a
//     backend counting bug since fixed, or the old sample fallback (deleted
//     inbox-placeholders.ts, which stood in for the *message preview* — 100%
//     fake before lastMsg existed) got mistaken for the unread badge itself.
//     Either way, the fake-sample layer is now gone from the UI — everything
//     shown is read straight off this row, so a wrong unread count from here on
//     is a backend data issue, not a frontend one.
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
  /** Plain-text body of the last message on the file, null when it has none.
   *  Confirmed live 2026-09-29 — this is the field backend actually shipped for
   *  the "last message" ask, under a different name than requested. */
  lastMsg?: string | null;
  debtorFirstName: string | null;
  debtorMiddleName: string | null;
  debtorLastName: string | null;
  creditorName: string;
  /** Confirmed live 2026-10-07. */
  clientId: number;
  clientName: string;
  clientNumber: string;
  teamName: string | null;
  /** Status display name only — no code or colour on the row. */
  status: string | null;

  /* ---- Still requested from backend, not on the row yet as of 2026-09-29.
     Optional so the UI picks them up automatically once they land. ---- */
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

/** Read the "last message" summary off a conversation row. lastMsg is the
 *  confirmed real field for the body; the rest (timestamp, channel, direction)
 *  aren't on the row yet, so those stay null — a few plausible alternate names
 *  are tried in case backend adds them under a different key than requested.
 *  A row with no message at all yields all-null and the UI shows "No messages
 *  yet" rather than making anything up. */
export function inboxPreview(row: InboxCustomer): InboxPreview {
  const r = row as unknown as Record<string, unknown>;
  const body = firstString(r, [
    "lastMsg",
    "lastMessage",
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
