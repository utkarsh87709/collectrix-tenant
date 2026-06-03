// Epic 13 — Calling hour validation engine

import { findJurisdiction } from "./compliance-store";

export type HoursValidationResult = {
  allowed: boolean;
  reason?: string;
  nextAvailable?: string;       // human-readable
  jurisdictionCode: string;
  debtorLocalTime: string;
};

function nowInTz(tz: string, date: Date = new Date()): Date {
  // Build a "wall clock" date in the target tz by formatting then re-parsing.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? "00";
  return new Date(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`);
}

function timeStrToMinutes(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

export function validateCallTime(jurisdictionCode: string, when: Date = new Date()): HoursValidationResult {
  const j = findJurisdiction(jurisdictionCode);
  if (!j) return { allowed: true, jurisdictionCode, debtorLocalTime: when.toISOString() };

  const local = nowInTz(j.timezone, when);
  const day = local.getDay();
  const minutes = local.getHours() * 60 + local.getMinutes();
  const mmdd = `${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
  const localStr = local.toLocaleString("en-CA", { hour: "2-digit", minute: "2-digit", weekday: "short", hour12: true });

  // Holiday block
  if (j.holidays.includes(mmdd)) {
    return { allowed: false, jurisdictionCode, debtorLocalTime: localStr,
      reason: `Holiday in ${j.code} (${mmdd}) — calls blocked`,
      nextAvailable: "Next business day" };
  }

  const window = j.callingHours[day];
  if (!window) {
    return { allowed: false, jurisdictionCode, debtorLocalTime: localStr,
      reason: `${j.code} prohibits calls on ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][day]}`,
      nextAvailable: "Next allowed weekday" };
  }
  const startM = timeStrToMinutes(window.start);
  const endM = timeStrToMinutes(window.end);
  if (minutes < startM) {
    return { allowed: false, jurisdictionCode, debtorLocalTime: localStr,
      reason: `Before allowed start (${window.start} ${j.timezone})`,
      nextAvailable: `Can call after ${window.start} (${j.timezone})` };
  }
  if (minutes >= endM) {
    return { allowed: false, jurisdictionCode, debtorLocalTime: localStr,
      reason: `After allowed end (${window.end} ${j.timezone})`,
      nextAvailable: `Can call tomorrow at ${window.start} (${j.timezone})` };
  }
  return { allowed: true, jurisdictionCode, debtorLocalTime: localStr };
}
