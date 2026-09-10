// Small presentational helpers shared by the inbox panes.
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isSameDay as dfIsSameDay,
  isToday,
  isYesterday,
} from "date-fns";

/* --------------------------------- Names --------------------------------- */

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Six brand-adjacent gradients so a column of avatars reads as a set rather
// than a rainbow. Picked by a stable hash so a customer keeps their colour.
const AVATAR_TONES = [
  "from-sky-500 to-cyan-400",
  "from-indigo-500 to-sky-400",
  "from-violet-500 to-fuchsia-400",
  "from-emerald-500 to-teal-400",
  "from-amber-500 to-orange-400",
  "from-rose-500 to-pink-400",
];

export function avatarTone(seed: string | number): string {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

/* --------------------------------- Dates --------------------------------- */

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isSameDay(a: string, b: string): boolean {
  const da = toDate(a);
  const db = toDate(b);
  return !!da && !!db && dfIsSameDay(da, db);
}

/** "9:01 AM" */
export function formatClock(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? format(d, "h:mm a") : "";
}

/** Compact timestamp for the conversation list: clock today, "Yesterday",
 *  weekday within the week, otherwise a short date. */
export function formatListTime(iso: string | null | undefined): string {
  const d = toDate(iso);
  if (!d) return "";
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  const days = differenceInCalendarDays(new Date(), d);
  if (days < 7) return format(d, "EEE");
  return format(d, d.getFullYear() === new Date().getFullYear() ? "d MMM" : "d MMM yyyy");
}

/** Day-divider label inside a thread. */
export function dayLabel(iso: string): string {
  const d = toDate(iso);
  if (!d) return "";
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, d.getFullYear() === new Date().getFullYear() ? "EEE, d MMM" : "EEE, d MMM yyyy");
}

/** "2 Mar 2026, 4:31 PM" */
export function formatDateTime(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? format(d, "d MMM yyyy, h:mm a") : "—";
}

export function timeAgo(iso: string | null | undefined): string {
  const d = toDate(iso);
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  if (ms < 60_000) return "just now";
  return `${formatDistanceToNowStrict(d)} ago`;
}

export function oldestFirst<T extends { createdAt: string }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/* ---------------------------------- Text ---------------------------------- */

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/** Email bodies sometimes arrive as HTML. Turn block/line-break tags into
 *  newlines, drop the rest, and decode the common entities — enough to read a
 *  reply as plain text without rendering untrusted markup. */
export function plainText(input: string | null | undefined): string {
  if (!input) return "";
  if (!/<[a-z!/][^>]*>/i.test(input)) return input;
  return input
    .replace(/<\s*(br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** SMS length budget: GSM-7 gives 160 chars per single segment (153 each when
 *  concatenated); anything outside GSM-7 forces UCS-2 at 70 / 67. */
export function smsSegments(text: string): { chars: number; segments: number; perSegment: number } {
  const chars = text.length;
  const unicode = Array.from(text).some((ch) => ch.charCodeAt(0) > 127);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const segments = chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi);
  return { chars, segments, perSegment: segments <= 1 ? single : multi };
}

/* -------------------------------- Filters -------------------------------- */

export type InboxFilters = {
  client: number | "all";
  team: number | "all";
  status: number | "all";
};

export const EMPTY_INBOX_FILTERS: InboxFilters = { client: "all", team: "all", status: "all" };

export function activeInboxFilterCount(f: InboxFilters): number {
  return (f.client !== "all" ? 1 : 0) + (f.team !== "all" ? 1 : 0) + (f.status !== "all" ? 1 : 0);
}
