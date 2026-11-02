// Compliance calling hours (Tenant Settings → Hours): when automated calls may
// reach a debtor, per country and province/state. Placing calls by these hours
// (working out a number's jurisdiction from its area code) is a separate
// backend ticket — this is the configuration only. Probed on devapi 2026-11-02:
//   POST /tenant/getCountries       {}                       -> { countryList: [{ countryCode, countryName }] }
//   POST /tenant/getStates          { countryCode }          -> { stateList: [{ stateCode, stateName }] }
//      Codes are lowercase. Every list starts with { stateCode: "default",
//      stateName: "Default" } — the country-wide rule; India has only that one.
//   POST /tenant/getComplianceHours { countryCode, stateCode } -> { complianceHours }
//      {} when no rule exists yet (create it); otherwise the row: id, the two
//      codes and the same per-day columns as tenant hours ("HH:MM" times).
//   POST /tenant/createComplianceHours { countryCode, stateCode, ...days } -> {}
//      An unknown country or state code fails with "Server Error".
//   POST /tenant/updateComplianceHours { countryCode, stateCode, ...days } -> {}
//      Keyed on the two codes (an id alone is ignored) and a FULL replace: a
//      day left out is saved as null, so always send all seven.
//   Nothing else is validated — start after end, "25:00" and an enabled flag of
//   2 are all stored — so the form checks the hours before saving.
import { apiPost } from "./api-client";
import { DAY_KEYS, type WeeklyHours } from "./agent-availability-utils";

export type Country = { countryCode: string; countryName: string };
export type State = { stateCode: string; stateName: string };

/** The state code of a country's country-wide rule. */
export const COUNTRY_WIDE_STATE = "default";

type Day = keyof WeeklyHours;
type DayColumns = { [D in Day as `${D}Enabled`]: number | null } & {
  [D in Day as `${D}StartTime` | `${D}EndTime`]: string | null;
};

/** A saved rule as getComplianceHours returns it. */
export type ComplianceHoursRow = DayColumns & {
  id: number;
  countryCode: string;
  stateCode: string;
};

export async function getCountries(): Promise<Country[]> {
  const res = await apiPost<{ countryList?: Country[] }>("/tenant/getCountries", {});
  return res?.countryList ?? [];
}

export async function getStates(countryCode: string): Promise<State[]> {
  const res = await apiPost<{ stateList?: State[] }>("/tenant/getStates", { countryCode });
  return res?.stateList ?? [];
}

/** The rule for a country/state, or null when none has been created. */
export async function getComplianceHours(
  countryCode: string,
  stateCode: string,
): Promise<ComplianceHoursRow | null> {
  const res = await apiPost<{ complianceHours?: Partial<ComplianceHoursRow> | null }>(
    "/tenant/getComplianceHours",
    { countryCode, stateCode },
  );
  const row = res?.complianceHours;
  return row && typeof row.id === "number" ? (row as ComplianceHoursRow) : null;
}

/** Creates the rule, or replaces it when one already exists. */
export function saveComplianceHours(input: {
  countryCode: string;
  stateCode: string;
  hours: WeeklyHours;
  exists: boolean;
}): Promise<unknown> {
  const body: Record<string, string | number> = {
    countryCode: input.countryCode,
    stateCode: input.stateCode,
  };
  for (const d of DAY_KEYS) {
    body[`${d}Enabled`] = input.hours[d].enabled ? 1 : 0;
    body[`${d}StartTime`] = input.hours[d].start;
    body[`${d}EndTime`] = input.hours[d].end;
  }
  return apiPost(
    input.exists ? "/tenant/updateComplianceHours" : "/tenant/createComplianceHours",
    body,
  );
}

/** Starting hours for a rule that hasn't been created yet: 8am–9pm daily. */
const NEW_RULE_DAY = { enabled: true, start: "08:00", end: "21:00" };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** "HH:MM", dropping seconds the backend may have been sent before. */
const hhmm = (t: string | null | undefined, fallback: string) => {
  const v = (t ?? "").slice(0, 5);
  return HHMM.test(v) ? v : fallback;
};

/** Saved rule → the hours the form edits (new-rule hours when none exists). */
export function hoursFromRow(row: ComplianceHoursRow | null): WeeklyHours {
  const out = {} as WeeklyHours;
  for (const d of DAY_KEYS) {
    out[d] = row
      ? {
          enabled: row[`${d}Enabled`] === 1,
          start: hhmm(row[`${d}StartTime`], NEW_RULE_DAY.start),
          end: hhmm(row[`${d}EndTime`], NEW_RULE_DAY.end),
        }
      : { ...NEW_RULE_DAY };
  }
  return out;
}

/** The days whose hours can't be saved: a missing time, or end not after start. */
export function invalidComplianceDays(hours: WeeklyHours): Day[] {
  return DAY_KEYS.filter((d) => {
    const { enabled, start, end } = hours[d];
    return enabled && (!HHMM.test(start) || !HHMM.test(end) || end <= start);
  });
}
