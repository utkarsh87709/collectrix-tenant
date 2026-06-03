// Epic 17 — Dashboards & Reporting mock data (US-144 → US-153)

export type Trend = { label: string; value: number }[];

export const executiveKpis = {
  totalAccounts: 18420,
  activeAccounts: 12380,
  totalBalance: 48_720_000,
  recoveryRate: 38.4, // %
  ytdCollected: 14_220_000,
  costPerDollar: 0.18,
  roi: 3.2,
  forecastNext30: 1_640_000,
};

export const creditorTrend: Trend = [
  { label: "Nov", value: 1.02 },
  { label: "Dec", value: 1.18 },
  { label: "Jan", value: 1.34 },
  { label: "Feb", value: 1.41 },
  { label: "Mar", value: 1.55 },
  { label: "Apr", value: 1.64 },
];

export const supervisorKpis = {
  agentsOnline: 18,
  agentsTotal: 24,
  callsInProgress: 7,
  queueDepth: 142,
  ptpToday: 39,
  brpToday: 6,
  collectedToday: 84_320,
  slaBreaches: 2,
};

export const agents = [
  { id: "a1", name: "Élise Tremblay",   calls: 92, rpc: 41, ptp: 12, kept: 9, collected: 18_420, qa: 96 },
  { id: "a2", name: "Marcus Bell",      calls: 78, rpc: 33, ptp: 10, kept: 7, collected: 15_120, qa: 92 },
  { id: "a3", name: "Priya Natarajan",  calls: 84, rpc: 38, ptp: 14, kept: 11, collected: 21_300, qa: 94 },
  { id: "a4", name: "Jordan Reyes",     calls: 61, rpc: 24, ptp:  6, kept: 4, collected:  9_840, qa: 88 },
  { id: "a5", name: "Hannah O'Brien",   calls: 70, rpc: 30, ptp:  9, kept: 7, collected: 13_650, qa: 90 },
] as const;

export const creditors = [
  { id: "p1", name: "Acme Bank — Cards Q1",  accounts: 4820, balance: 12_400_000, recovery: 41.2, age: "0-90"   },
  { id: "p2", name: "Northwind Auto Loans",  accounts: 2640, balance:  9_120_000, recovery: 33.8, age: "91-180" },
  { id: "p3", name: "Globex Medical",        accounts: 6310, balance: 14_800_000, recovery: 28.5, age: "181-360"},
  { id: "p4", name: "Initech Telecom",       accounts: 1920, balance:  4_300_000, recovery: 46.0, age: "0-90"   },
  { id: "p5", name: "Soylent Utilities",     accounts: 2730, balance:  8_100_000, recovery: 36.4, age: "361+"   },
];

export const aging = [
  { bucket: "Current",  pct: 22 },
  { bucket: "0-30",     pct: 28 },
  { bucket: "31-60",    pct: 17 },
  { bucket: "61-90",    pct: 12 },
  { bucket: "91-180",   pct: 13 },
  { bucket: "181+",     pct:  8 },
];

export const creditorClients = [
  { id: "c1", name: "Acme Bank",         placed: 18_400_000, recovered: 6_220_000, rate: 33.8, lastReport: "2026-04-25" },
  { id: "c2", name: "Northwind Auto",    placed:  9_120_000, recovered: 3_080_000, rate: 33.8, lastReport: "2026-04-21" },
  { id: "c3", name: "Globex Medical",    placed: 14_800_000, recovered: 4_220_000, rate: 28.5, lastReport: "2026-04-18" },
  { id: "c4", name: "Initech Telecom",   placed:  4_300_000, recovered: 1_980_000, rate: 46.0, lastReport: "2026-04-26" },
];

export const complianceMetrics = {
  callsAfterHours: 0,
  frequencyViolations: 1,
  ceaseDesistHonored: 100, // %
  miniMirandaRate: 99.7,
  disputesOpen: 4,
  fcraDisputes30d: 7,
  auditCoverage: 98.2,
};

export const complianceReports = [
  { id: "r1", title: "FDCPA Monthly Summary",      cadence: "Monthly",   nextRun: "2026-05-01", recipients: 3 },
  { id: "r2", title: "Quebec OPC Quarterly",       cadence: "Quarterly", nextRun: "2026-06-30", recipients: 2 },
  { id: "r3", title: "FCRA Dispute Log",           cadence: "Weekly",    nextRun: "2026-05-04", recipients: 4 },
  { id: "r4", title: "Cease & Desist Register",    cadence: "Monthly",   nextRun: "2026-05-01", recipients: 2 },
];

export const finance = {
  revenue30d: 1_640_000,
  costs30d:    298_400,
  margin: 81.8,
  contingencyFees: 1_120_000,
  legalCosts: 78_400,
  voiceAiCost: 24_900,
  letterCost: 38_200,
  skipTraceCost: 12_600,
};

export const financeTrend: Trend = [
  { label: "Nov", value: 1180 },
  { label: "Dec", value: 1290 },
  { label: "Jan", value: 1340 },
  { label: "Feb", value: 1410 },
  { label: "Mar", value: 1525 },
  { label: "Apr", value: 1640 },
];

export type CustomReport = {
  id: string;
  name: string;
  owner: string;
  metrics: string[];
  filters: string[];
  lastRun?: string;
};

export const customReports: CustomReport[] = [
  { id: "cr1", name: "VIP Creditor Weekly", owner: "M. Lindstrom", metrics: ["Recovery %","Calls","PTP kept"], filters: ["Creditor = VIP","Last 7d"], lastRun: "2026-04-27" },
  { id: "cr2", name: "Quebec FR Compliance", owner: "C. Boucher",  metrics: ["Calls FR","Disclosures","After-hours"], filters: ["Jurisdiction = QC","Language = FR"], lastRun: "2026-04-26" },
  { id: "cr3", name: "Agent Bonus Calc",     owner: "S. Patel",    metrics: ["Collected","Kept PTP","QA score"], filters: ["Team = Alpha","Month = current"] },
];

export type ScheduledReport = {
  id: string;
  name: string;
  cadence: "Daily" | "Weekly" | "Monthly" | "Quarterly";
  format: "PDF" | "Excel" | "CSV";
  recipients: string[];
  nextRun: string;
  lastStatus: "ok" | "failed" | "pending";
};

export const scheduledReports: ScheduledReport[] = [
  { id: "s1", name: "Executive Daily Digest",   cadence: "Daily",   format: "PDF",   recipients: ["ceo@apex.io","coo@apex.io"], nextRun: "2026-04-29 07:00", lastStatus: "ok" },
  { id: "s2", name: "Acme Bank Client Pack",    cadence: "Weekly",  format: "Excel", recipients: ["ops@acme.com"],              nextRun: "2026-05-02 06:00", lastStatus: "ok" },
  { id: "s3", name: "Compliance Monthly",       cadence: "Monthly", format: "PDF",   recipients: ["compliance@apex.io"],        nextRun: "2026-05-01 06:00", lastStatus: "pending" },
  { id: "s4", name: "Finance Quarterly Board",  cadence: "Quarterly", format: "PDF", recipients: ["board@apex.io"],             nextRun: "2026-06-30 18:00", lastStatus: "ok" },
  { id: "s5", name: "Globex Recovery CSV",      cadence: "Weekly",  format: "CSV",   recipients: ["data@globex.com"],           nextRun: "2026-05-03 06:00", lastStatus: "failed" },
];

export type DataExport = {
  id: string;
  name: string;
  type: "CSV" | "Parquet" | "API" | "Webhook";
  destination: string;
  schedule: string;
  rows?: number;
  lastRun?: string;
};

export const dataExports: DataExport[] = [
  { id: "e1", name: "Daily Debtor Snapshot",  type: "CSV",     destination: "S3 / s3://apex-bi/daily/", schedule: "Daily 02:00", rows: 18420, lastRun: "2026-04-28 02:01" },
  { id: "e2", name: "Payments Stream",        type: "Webhook", destination: "https://bi.apex.io/hooks/payments", schedule: "Real-time", rows: 234, lastRun: "2026-04-28 09:14" },
  { id: "e3", name: "Snowflake Warehouse",    type: "Parquet", destination: "snowflake://APEX_BI.RAW.DEBTORS", schedule: "Hourly", rows: 18420, lastRun: "2026-04-28 09:00" },
  { id: "e4", name: "Tableau Live Connector", type: "API",     destination: "OAuth — bi-readonly key", schedule: "On-demand" },
];

export const fmt = {
  money: (n: number) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 }),
  pct: (n: number) => n.toFixed(1) + "%",
};
