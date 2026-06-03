// Epic 13 — Multi-Jurisdictional Compliance mock data
// Jurisdictions, calling-hour rules, holidays, disclosures, prohibited terms

export type JurisdictionLevel = "federal" | "state" | "provincial";
export type Country = "USA" | "Canada";

export type Jurisdiction = {
  code: string;            // "FDCPA", "ON", "QC", "CA", "NY"
  name: string;
  country: Country;
  level: JurisdictionLevel;
  enabled: boolean;
  // Calling hours per day-of-week (0=Sun..6=Sat). null = blocked entire day.
  callingHours: { [day: number]: { start: string; end: string } | null };
  contactLimit: { window: "day" | "week"; max: number } | null;
  requiredDisclosures: string[]; // disclosure codes
  prohibitedPractices: string[]; // codes
  holidays: string[];            // ISO MM-DD dates
  languageRule?: "french_required" | "bilingual" | null;
  licenseDisclosureText?: string;
  timezone: string;
  notes?: string;
};

const allDays = (start: string, end: string) =>
  Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { start, end }]));

export const seedJurisdictions: Jurisdiction[] = [
  {
    code: "FDCPA",
    name: "US Federal — FDCPA / TCPA / CFPB",
    country: "USA",
    level: "federal",
    enabled: true,
    callingHours: allDays("08:00", "21:00"),
    contactLimit: null,
    requiredDisclosures: ["MINI_MIRANDA", "DEBT_COLLECTOR_NOTICE"],
    prohibitedPractices: ["THREATEN_ARREST", "FALSE_REP", "HARASSMENT", "PROFANITY"],
    holidays: ["01-01", "07-04", "12-25"],
    timezone: "America/New_York",
  },
  {
    code: "CDSSA",
    name: "Canada Federal — CDSSA",
    country: "Canada",
    level: "federal",
    enabled: true,
    callingHours: allDays("08:00", "21:00"),
    contactLimit: null,
    requiredDisclosures: ["MINI_MIRANDA"],
    prohibitedPractices: ["THREATEN_ARREST", "HARASSMENT", "PROFANITY"],
    holidays: ["01-01", "07-01", "12-25", "12-26"],
    timezone: "America/Toronto",
  },
  {
    code: "ON",
    name: "Ontario — Collection & Debt Settlement Services Act",
    country: "Canada",
    level: "provincial",
    enabled: true,
    callingHours: {
      0: null, // No Sunday calls
      1: { start: "07:00", end: "21:00" },
      2: { start: "07:00", end: "21:00" },
      3: { start: "07:00", end: "21:00" },
      4: { start: "07:00", end: "21:00" },
      5: { start: "07:00", end: "21:00" },
      6: { start: "07:00", end: "21:00" },
    },
    contactLimit: { window: "week", max: 3 },
    requiredDisclosures: ["ONTARIO_LICENSE"],
    prohibitedPractices: ["CONTACT_EMPLOYER"],
    holidays: ["01-01", "07-01", "08-05", "09-02", "10-14", "12-25", "12-26"],
    timezone: "America/Toronto",
    licenseDisclosureText:
      "Licensed by the Ontario Ministry of Consumer Services. License #ON-123456.",
  },
  {
    code: "QC",
    name: "Quebec — Consumer Protection Act",
    country: "Canada",
    level: "provincial",
    enabled: true,
    callingHours: {
      0: null,
      1: { start: "08:00", end: "20:00" },
      2: { start: "08:00", end: "20:00" },
      3: { start: "08:00", end: "20:00" },
      4: { start: "08:00", end: "20:00" },
      5: { start: "08:00", end: "20:00" },
      6: null,
    },
    contactLimit: { window: "day", max: 1 },
    requiredDisclosures: ["QUEBEC_FRENCH"],
    prohibitedPractices: ["EARLY_LATE_CALL"],
    holidays: ["01-01", "06-24", "07-01", "12-25", "12-26"],
    languageRule: "french_required",
    timezone: "America/Montreal",
  },
  {
    code: "CA",
    name: "California — Rosenthal FDCPA",
    country: "USA",
    level: "state",
    enabled: true,
    callingHours: allDays("08:00", "21:00"),
    contactLimit: null,
    requiredDisclosures: ["MINI_MIRANDA", "WRITTEN_NOTICE_5_DAY"],
    prohibitedPractices: ["THREATEN_ARREST", "CRIMINAL_PROSECUTION"],
    holidays: ["01-01", "07-04", "11-11", "12-25"],
    timezone: "America/Los_Angeles",
  },
  {
    code: "NY",
    name: "New York — General Business Law Article 29-H",
    country: "USA",
    level: "state",
    enabled: true,
    callingHours: allDays("08:00", "21:00"),
    contactLimit: { window: "week", max: 7 },
    requiredDisclosures: ["MINI_MIRANDA", "NY_DEBT_DISCLOSURE"],
    prohibitedPractices: ["THREATEN_ARREST", "HARASSMENT"],
    holidays: ["01-01", "07-04", "11-11", "12-25"],
    timezone: "America/New_York",
  },
];

// ── Disclosures library
export type Disclosure = {
  code: string;
  title: string;
  text: string;
  channels: ("call" | "email" | "sms" | "letter")[];
  jurisdictions: string[];
  required: boolean;
};

export const seedDisclosures: Disclosure[] = [
  {
    code: "MINI_MIRANDA",
    title: "FDCPA Mini-Miranda",
    text: "This is an attempt to collect a debt. Any information obtained will be used for that purpose.",
    channels: ["call", "email", "sms", "letter"],
    jurisdictions: ["FDCPA", "CDSSA", "CA", "NY"],
    required: true,
  },
  {
    code: "DEBT_COLLECTOR_NOTICE",
    title: "Debt Collector Identification",
    text: "This communication is from a debt collector.",
    channels: ["call", "email", "letter"],
    jurisdictions: ["FDCPA"],
    required: true,
  },
  {
    code: "ONTARIO_LICENSE",
    title: "Ontario Collection Agency License",
    text: "Licensed by the Ontario Ministry of Consumer Services. License #ON-123456.",
    channels: ["email", "letter", "call"],
    jurisdictions: ["ON"],
    required: true,
  },
  {
    code: "QUEBEC_FRENCH",
    title: "Quebec French-Language Option",
    text: "Pour le français, appuyez sur 2 / For English, press 1.",
    channels: ["call", "email", "sms", "letter"],
    jurisdictions: ["QC"],
    required: true,
  },
  {
    code: "WRITTEN_NOTICE_5_DAY",
    title: "California 5-Day Written Notice",
    text: "You have the right to receive written debt validation within 5 days of first contact.",
    channels: ["letter"],
    jurisdictions: ["CA"],
    required: true,
  },
  {
    code: "NY_DEBT_DISCLOSURE",
    title: "NY Itemized Debt Disclosure",
    text: "Original creditor, charge-off date, and itemized balance available upon request.",
    channels: ["letter", "email"],
    jurisdictions: ["NY"],
    required: true,
  },
];

// ── Prohibited practices catalog
export type ProhibitedPractice = {
  code: string;
  label: string;
  severity: "high" | "medium" | "low";
  keywords: string[]; // for the text scanner
  jurisdictions: string[];
};

export const seedProhibitedPractices: ProhibitedPractice[] = [
  { code: "THREATEN_ARREST", label: "Threatening arrest or jail", severity: "high",
    keywords: ["arrest", "jail", "prison", "police"], jurisdictions: ["FDCPA", "CA", "NY", "ON", "QC"] },
  { code: "FALSE_REP", label: "False representation", severity: "high",
    keywords: ["lawyer", "attorney general", "court order"], jurisdictions: ["FDCPA"] },
  { code: "HARASSMENT", label: "Harassment / abusive language", severity: "high",
    keywords: ["stupid", "loser", "deadbeat"], jurisdictions: ["FDCPA", "CDSSA", "ON", "NY"] },
  { code: "PROFANITY", label: "Profanity", severity: "medium",
    keywords: ["damn", "hell", "shit", "fuck"], jurisdictions: ["FDCPA", "CDSSA"] },
  { code: "CONTACT_EMPLOYER", label: "Contacting employer without court order", severity: "high",
    keywords: ["your boss", "your employer", "workplace"], jurisdictions: ["ON"] },
  { code: "CRIMINAL_PROSECUTION", label: "Threat of criminal prosecution", severity: "high",
    keywords: ["criminal charges", "prosecute", "felony"], jurisdictions: ["CA"] },
  { code: "EARLY_LATE_CALL", label: "Calling outside permitted hours", severity: "medium",
    keywords: [], jurisdictions: ["QC", "ON"] },
];

// ── Area-code → jurisdiction hints
export const areaCodeMap: Record<string, string> = {
  // Ontario
  "416": "ON", "647": "ON", "437": "ON", "905": "ON", "289": "ON", "365": "ON",
  // Quebec
  "514": "QC", "438": "QC", "263": "QC", "450": "QC", "579": "QC", "418": "QC", "581": "QC",
  // California
  "213": "CA", "323": "CA", "424": "CA", "310": "CA", "415": "CA", "510": "CA",
  // New York
  "212": "NY", "646": "NY", "332": "NY", "718": "NY", "917": "NY", "347": "NY",
};

// ── Postal/ZIP → jurisdiction
export function jurisdictionFromPostal(postal: string): string | null {
  const p = postal.trim().toUpperCase();
  if (/^[A-Z]\d[A-Z]/.test(p)) {
    const first = p[0];
    if (["K", "L", "M", "N", "P"].includes(first)) return "ON";
    if (["G", "H", "J"].includes(first)) return "QC";
    return "CDSSA";
  }
  if (/^\d{5}/.test(p)) {
    const n = parseInt(p.slice(0, 3), 10);
    if (n >= 900 && n <= 961) return "CA";
    if ((n >= 100 && n <= 149) || (n >= 60 && n <= 99)) return "NY";
    return "FDCPA";
  }
  return null;
}
