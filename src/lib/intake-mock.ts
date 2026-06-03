// Mock data for EPIC 3 — Debtor Data Intake & Management
// Will be swapped for live Lovable Cloud queries once auth is wired.

export type MappingTemplate = {
  id: string;
  name: string;
  creditor: string;
  version: number;
  fields: number;
  lastUsed: string;
  imports: number;
  status: "active" | "draft" | "archived";
};

export const mappingTemplates: MappingTemplate[] = [
  { id: "tpl_01", name: "RBC Credit Card Import", creditor: "RBC", version: 4, fields: 18, lastUsed: "2h ago", imports: 142, status: "active" },
  { id: "tpl_02", name: "TD Personal Loan", creditor: "TD Bank", version: 2, fields: 14, lastUsed: "1d ago", imports: 87, status: "active" },
  { id: "tpl_03", name: "Scotia Auto Recovery", creditor: "Scotiabank", version: 1, fields: 21, lastUsed: "3d ago", imports: 34, status: "active" },
  { id: "tpl_04", name: "BMO Legacy Format", creditor: "BMO", version: 3, fields: 16, lastUsed: "2w ago", imports: 211, status: "archived" },
  { id: "tpl_05", name: "Rogers Wireless 2026", creditor: "Rogers", version: 1, fields: 12, lastUsed: "draft", imports: 0, status: "draft" },
];

export type ImportJob = {
  id: string;
  filename: string;
  template: string;
  rows: number;
  imported: number;
  skipped: number;
  errors: number;
  status: "completed" | "running" | "failed" | "validation";
  startedAt: string;
  duration: string;
};

export const importJobs: ImportJob[] = [
  { id: "job_2841", filename: "RBC_Q1_2026_placement.xlsx", template: "RBC Credit Card Import", rows: 4820, imported: 4798, skipped: 22, errors: 0, status: "completed", startedAt: "12 min ago", duration: "1m 42s" },
  { id: "job_2840", filename: "TD_personal_loans_apr.csv", template: "TD Personal Loan", rows: 1205, imported: 1187, skipped: 14, errors: 4, status: "completed", startedAt: "1h ago", duration: "32s" },
  { id: "job_2839", filename: "scotia_auto_batch_47.xlsx", template: "Scotia Auto Recovery", rows: 8420, imported: 0, skipped: 0, errors: 0, status: "running", startedAt: "2 min ago", duration: "—" },
  { id: "job_2838", filename: "rogers_wireless_test.csv", template: "(none)", rows: 312, imported: 0, skipped: 0, errors: 312, status: "validation", startedAt: "5h ago", duration: "—" },
  { id: "job_2837", filename: "bmo_legacy_recovery_q1.tsv", template: "BMO Legacy Format", rows: 6210, imported: 4112, skipped: 0, errors: 2098, status: "failed", startedAt: "yesterday", duration: "8m 14s" },
];

export type Debtor = {
  id: string;
  name: string;
  external: string;
  creditor: string;
  balance: number;
  status: "new" | "active" | "ptp" | "paid" | "legal" | "uncollectable" | "archived";
  contactability: number;
  collectability: number;
  lastActivity: string;
  flags: string[];
  legalHold: boolean;
  placedAt: string;
};

export const debtors: Debtor[] = [
  { id: "d_10421", name: "Margaret Chen", external: "RBC-447821", creditor: "RBC", balance: 8420.12, status: "active", contactability: 78, collectability: 64, lastActivity: "2h ago", flags: ["high-value"], legalHold: false, placedAt: "12d ago" },
  { id: "d_10420", name: "Daniel O'Connor", external: "TD-99214", creditor: "TD Bank", balance: 1240.5, status: "ptp", contactability: 92, collectability: 88, lastActivity: "5h ago", flags: [], legalHold: false, placedAt: "47d ago" },
  { id: "d_10419", name: "Aisha Ramirez", external: "SCO-22041", creditor: "Scotiabank", balance: 14_280.9, status: "legal", contactability: 31, collectability: 22, lastActivity: "3d ago", flags: ["legal-hold", "disputed"], legalHold: true, placedAt: "184d ago" },
  { id: "d_10418", name: "Liam Patel", external: "BMO-77104", creditor: "BMO", balance: 320.0, status: "paid", contactability: 88, collectability: 100, lastActivity: "1d ago", flags: [], legalHold: false, placedAt: "92d ago" },
  { id: "d_10417", name: "Sofia Andersson", external: "RBC-447701", creditor: "RBC", balance: 5210.45, status: "active", contactability: 54, collectability: 48, lastActivity: "8h ago", flags: [], legalHold: false, placedAt: "21d ago" },
  { id: "d_10416", name: "Hugo Tremblay", external: "ROG-10042", creditor: "Rogers", balance: 412.18, status: "new", contactability: 0, collectability: 0, lastActivity: "—", flags: [], legalHold: false, placedAt: "0d ago" },
  { id: "d_10415", name: "Priya Nakamura", external: "TD-99100", creditor: "TD Bank", balance: 22_140.7, status: "active", contactability: 41, collectability: 38, lastActivity: "1d ago", flags: ["high-value"], legalHold: false, placedAt: "63d ago" },
  { id: "d_10414", name: "Ethan Wong", external: "SCO-21988", creditor: "Scotiabank", balance: 0, status: "uncollectable", contactability: 12, collectability: 4, lastActivity: "180d ago", flags: ["skip"], legalHold: false, placedAt: "412d ago" },
];

export type MatchLevel = "exact" | "partial" | "different" | "missing";
export type MatchTier = "high" | "medium" | "low";

export type DedupeRecord = {
  name: string;
  ext: string;
  creditor: string;
  balance: number;
  dob: string;
  address: string;
  postalCode: string;
  phone: string;
  email: string;
  creditorRef: string;
  govId: string;        // SSN / SIN last4 or similar
  employer: string;
  sourceSystem: string; // lineage: import job, CRM, manual, API
};

export type DedupeMatches = {
  name: number;           // 0–100 fuzzy score
  dob: MatchLevel;
  address: MatchLevel;
  postalCode: MatchLevel;
  phone: MatchLevel;
  email: MatchLevel;
  creditorRef: MatchLevel;
  govId: MatchLevel;
  employer: MatchLevel;
};

export type MergeAuditEntry = {
  id: string;
  when: string;
  actor: string;
  action: "merged" | "unmerged" | "manager_review" | "kept_separate" | "not_duplicate" | "flagged";
  note?: string;
};

export type DedupeCandidate = {
  id: string;
  a: DedupeRecord;
  b: DedupeRecord;
  similarity: number;     // overall confidence 0–1
  tier: MatchTier;
  tierSignals: string[];  // human-readable matched rules (e.g. "Name + DOB + Gov ID")
  matches: DedupeMatches;
  mergeHistory: MergeAuditEntry[];
};

export const dedupeCandidates: DedupeCandidate[] = [
  {
    id: "dup_01",
    a: { name: "Margaret Chen", ext: "RBC-447821", creditor: "RBC", balance: 8420.12, dob: "1981-04-12", address: "12 King St W, Toronto ON", postalCode: "M5H 1A1", phone: "+1 416 555 0101", email: "margaret.chen@example.com", creditorRef: "RBC-447821", govId: "***-**-4821", employer: "Shopify Inc.", sourceSystem: "Import · RBC_Q1_2026" },
    b: { name: "Maggie Chen",   ext: "RBC-447822", creditor: "RBC", balance: 8420.12, dob: "1981-04-12", address: "12 King Street West, Toronto", postalCode: "M5H 1A1", phone: "+1 416 555 0101", email: "m.chen@example.com",       creditorRef: "RBC-447821", govId: "***-**-4821", employer: "Shopify Inc.", sourceSystem: "CRM · Salesforce sync" },
    similarity: 0.96,
    tier: "high",
    tierSignals: ["Name + DOB + Gov ID", "Customer ref + Creditor", "Phone + DOB"],
    matches: { name: 88, dob: "exact", address: "partial", postalCode: "exact", phone: "exact", email: "different", creditorRef: "exact", govId: "exact", employer: "exact" },
    mergeHistory: [
      { id: "h1", when: "auto", actor: "Dedupe engine v3.1", action: "flagged", note: "High-confidence: Name + DOB + Gov ID matched" },
    ],
  },
  {
    id: "dup_02",
    a: { name: "Daniel O'Connor", ext: "TD-99214", creditor: "TD Bank", balance: 1240.5, dob: "1975-09-30", address: "88 Yonge St, Toronto ON",  postalCode: "M5E 1S6", phone: "+1 416 555 0102", email: "daniel@example.com",   creditorRef: "TD-99214", govId: "***-**-9214", employer: "Royal Bank", sourceSystem: "Import · TD_personal_loans_apr" },
    b: { name: "Dan O Connor",    ext: "TD-99301", creditor: "TD Bank", balance: 1100.0, dob: "1975-09-30", address: "201 Bay St, Toronto ON",   postalCode: "M5E 1S6", phone: "+1 416 555 0102", email: "",                     creditorRef: "TD-99301", govId: "***-**-9914", employer: "RBC", sourceSystem: "REST API · ctx_live_a3f1" },
    similarity: 0.74,
    tier: "medium",
    tierSignals: ["Similar name + same postal code", "Same phone + name variation"],
    matches: { name: 82, dob: "exact", address: "different", postalCode: "exact", phone: "exact", email: "missing", creditorRef: "different", govId: "different", employer: "partial" },
    mergeHistory: [
      { id: "h1", when: "auto", actor: "Dedupe engine v3.1", action: "flagged", note: "Medium-confidence: postal code + phone overlap, gov ID differs" },
    ],
  },
  {
    id: "dup_03",
    a: { name: "Sofia Andersson", ext: "RBC-447701", creditor: "RBC", balance: 5210.45, dob: "1988-02-14", address: "44 Spadina Ave, Toronto ON", postalCode: "M5V 2H1", phone: "+1 416 555 0144", email: "sofia.a@example.com",  creditorRef: "RBC-447701", govId: "***-**-7701", employer: "Telus", sourceSystem: "Import · RBC_Q1_2026" },
    b: { name: "Sofia Anderson",  ext: "BMO-22411", creditor: "BMO", balance: 5210.45, dob: "1988-02-14", address: "44 Spadina Ave, Toronto ON", postalCode: "M5V 2H1", phone: "+1 647 555 9921", email: "sofia.a@example.com",  creditorRef: "BMO-22411", govId: "***-**-2411", employer: "Telus", sourceSystem: "CRM · HubSpot sync" },
    similarity: 0.78,
    tier: "medium",
    tierSignals: ["Same DOB + similar address", "Same email + different address"],
    matches: { name: 92, dob: "exact", address: "exact", postalCode: "exact", phone: "different", email: "exact", creditorRef: "different", govId: "different", employer: "exact" },
    mergeHistory: [
      { id: "h1", when: "auto", actor: "Dedupe engine v3.1", action: "flagged", note: "Different creditor + different gov ID — possible household, not same person" },
    ],
  },
  {
    id: "dup_04",
    a: { name: "James Wilson", ext: "RBC-441002", creditor: "RBC", balance: 2100.0, dob: "1990-06-22", address: "5 Adelaide St E, Toronto ON", postalCode: "M5C 2V9", phone: "+1 416 555 7700", email: "j.wilson@example.com", creditorRef: "RBC-441002", govId: "***-**-1002", employer: "Loblaws", sourceSystem: "Import · RBC_Q1_2026" },
    b: { name: "Sarah Wilson", ext: "BMO-31188", creditor: "BMO", balance: 980.0,   dob: "1992-11-04", address: "5 Adelaide St E, Toronto ON", postalCode: "M5C 2V9", phone: "+1 416 555 7700", email: "s.wilson@example.com", creditorRef: "BMO-31188",  govId: "***-**-8821", employer: "Sobeys",   sourceSystem: "Manual · web form" },
    similarity: 0.42,
    tier: "low",
    tierSignals: ["Same last name + same address", "Shared phone number"],
    matches: { name: 54, dob: "different", address: "exact", postalCode: "exact", phone: "exact", email: "different", creditorRef: "different", govId: "different", employer: "different" },
    mergeHistory: [
      { id: "h1", when: "auto", actor: "Dedupe engine v3.1", action: "flagged", note: "Low-confidence: likely household members, not same debtor" },
    ],
  },
  {
    id: "dup_05",
    a: { name: "Michael Brown", ext: "SCO-50001", creditor: "Scotiabank", balance: 4500.0, dob: "1985-03-15", address: "120 Bloor St W, Toronto ON", postalCode: "M5S 1M8", phone: "+1 416 555 3322", email: "mbrown@example.com",   creditorRef: "SCO-50001", govId: "***-**-5001", employer: "Bell Canada", sourceSystem: "Import · scotia_auto_batch_47" },
    b: { name: "Mike Brown",    ext: "SCO-50001-B", creditor: "Scotiabank", balance: 4500.0, dob: "1985-03-15", address: "120 Bloor Street W, Toronto", postalCode: "M5S 1M8", phone: "+1 416 555 3322", email: "michael.brown@example.com", creditorRef: "SCO-50001", govId: "***-**-5001", employer: "Bell Canada", sourceSystem: "REST API · ctx_live_22b8" },
    similarity: 0.97,
    tier: "high",
    tierSignals: ["Customer/account number + Creditor ref", "Email + DOB", "Gov ID + DOB"],
    matches: { name: 90, dob: "exact", address: "partial", postalCode: "exact", phone: "exact", email: "different", creditorRef: "exact", govId: "exact", employer: "exact" },
    mergeHistory: [
      { id: "h1", when: "auto", actor: "Dedupe engine v3.1", action: "flagged", note: "High-confidence: same account reposted by two upstream systems" },
    ],
  },
];

export type ApiToken = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  rateLimit: number;
  lastUsed: string;
  expires: string;
  status: "active" | "expired" | "revoked";
};

export const debtorApiTokens: ApiToken[] = [
  { id: "tok_01", name: "Production ETL", prefix: "ctx_live_a3f1", scopes: ["read", "write"], rateLimit: 240, lastUsed: "3 min ago", expires: "in 84 days", status: "active" },
  { id: "tok_02", name: "Staging webhook receiver", prefix: "ctx_live_22b8", scopes: ["read"], rateLimit: 60, lastUsed: "2h ago", expires: "in 12 days", status: "active" },
  { id: "tok_03", name: "Legacy reporting", prefix: "ctx_live_old1", scopes: ["read"], rateLimit: 30, lastUsed: "98d ago", expires: "expired", status: "expired" },
];

// Retention/archival policies were removed — records are retained for
// compliance (up to 7 years). Archive/delete are now manual, permission-
// controlled actions on the Debtor Detail page.

export type DebtorAuditEntry = {
  id: string;
  when: string;
  actor: string;
  action: string;
  field?: string;
  before?: string;
  after?: string;
  source: string;
};

export const debtorAuditTrail: DebtorAuditEntry[] = [
  { id: "a1", when: "2 min ago", actor: "Maya Lindstrom", action: "Status change", field: "status", before: "active", after: "ptp", source: "Web UI" },
  { id: "a2", when: "1h ago", actor: "API · ctx_live_a3f1", action: "Update balance", field: "balance", before: "8580.12", after: "8420.12", source: "REST API" },
  { id: "a3", when: "3h ago", actor: "Workflow engine", action: "Add flag", field: "risk_flags", before: "[]", after: "[\"high-value\"]", source: "System" },
  { id: "a4", when: "yesterday", actor: "Daniel Kim", action: "Address added", field: "addresses", source: "Web UI" },
  { id: "a5", when: "2d ago", actor: "Import job_2841", action: "Created", source: "Bulk import" },
];
