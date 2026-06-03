// Shared client-safe helpers for agent availability checks.

export type DayHours = { start: string; end: string; enabled: boolean };
export type WeeklyHours = Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", DayHours>;

export const DAY_KEYS: (keyof WeeklyHours)[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABELS: Record<keyof WeeklyHours, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function nowInTz(tz: string, date: Date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? "00";
  const wkMap: Record<string, keyof WeeklyHours> = {
    Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun",
  };
  return {
    weekday: wkMap[get("weekday") as keyof typeof wkMap] ?? "mon",
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    label: `${get("weekday")} ${get("hour")}:${get("minute")} (${tz})`,
  };
}

export function isAgentAvailable(weekly: WeeklyHours, tz: string, when: Date = new Date()) {
  const { weekday, minutes, label } = nowInTz(tz, when);
  const day = weekly[weekday];
  if (!day || !day.enabled) {
    return { available: false as const, reason: `Agents off on ${weekday.toUpperCase()}`, debtorLocal: label };
  }
  const s = timeToMinutes(day.start);
  const e = timeToMinutes(day.end);
  if (minutes < s) return { available: false as const, reason: `Before ${day.start}`, debtorLocal: label };
  if (minutes >= e) return { available: false as const, reason: `After ${day.end}`, debtorLocal: label };
  return { available: true as const, debtorLocal: label };
}
