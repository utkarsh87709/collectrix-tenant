// TEMPORARY sample data for the conversation list — delete once the backend
// ships the conversation summary on getInboxCustomers.
//
// Confirmed 2026-09-10 from a live response: the inbox row has unreadMsgCount
// (real, used as-is) but no last-message text, timestamp or channel — yet the
// design leads with exactly those. Raised with backend (asked for lastMessage,
// lastMessageAt, lastMessageChannel, lastMessageDirection on every row). Until
// they land, a row that lacks a field shows the matching sample below so the
// layout can be reviewed against the design.
//
// A real value on the row ALWAYS wins (see resolveInboxRow): the moment the
// backend adds a field it shows through with no change here. The unread sample
// is only a safety net for a row that somehow omits unreadMsgCount.
import { inboxPreview, inboxUnread, type InboxCustomer, type InboxPreview } from "@/lib/inbox-api";

type Sample = { body: string; channel: "sms" | "email"; minutesAgo: number; unread: number };

const SAMPLES: Sample[] = [
  { body: "Call me after 5pm please", channel: "sms", minutesAgo: 9, unread: 2 },
  { body: "I can pay $400 on Friday", channel: "sms", minutesAgo: 23, unread: 1 },
  {
    body: "I have already paid this account on March 12 — see the attached receipt.",
    channel: "email",
    minutesAgo: 38,
    unread: 3,
  },
  { body: "STOP", channel: "sms", minutesAgo: 50, unread: 0 },
  {
    body: "Thanks — confirming my payment went through.",
    channel: "email",
    minutesAgo: 26 * 60,
    unread: 0,
  },
  { body: "Who is calling me?", channel: "sms", minutesAgo: 27 * 60, unread: 1 },
  {
    body: "Can you send me the balance breakdown by email?",
    channel: "email",
    minutesAgo: 3 * 24 * 60,
    unread: 0,
  },
  {
    body: "I'll be able to settle this next month.",
    channel: "sms",
    minutesAgo: 5 * 24 * 60,
    unread: 0,
  },
];

// Fixed at module load so the sample timestamps don't drift between renders.
const SESSION_NOW = Date.now();

function sampleFor(id: number): Sample {
  return SAMPLES[Math.abs(id) % SAMPLES.length];
}

export type ResolvedInboxRow = {
  preview: InboxPreview;
  unread: number;
  /** True when any part of this row came from SAMPLES rather than the API. */
  sample: boolean;
};

/** The row's conversation summary — real fields first, samples for the gaps. */
export function resolveInboxRow(row: InboxCustomer): ResolvedInboxRow {
  const real = inboxPreview(row);
  const realUnread = inboxUnread(row);
  const s = sampleFor(row.uploadedDebtorId);
  let sample = false;
  const pick = <T>(value: T | null, fallback: T): T => {
    if (value !== null && value !== undefined) return value;
    sample = true;
    return fallback;
  };
  const preview: InboxPreview = {
    body: pick(real.body, s.body),
    at: pick(real.at, new Date(SESSION_NOW - s.minutesAgo * 60_000).toISOString()),
    channel: pick(real.channel, s.channel),
    direction: pick(real.direction, "incoming"),
  };
  const unread = pick(realUnread, s.unread);
  return { preview, unread, sample };
}
