// Epic 12 — Legacy code migration

export type CodeMapping = {
  legacyCode: string;
  legacyLabel: string;
  newCode: string;
  newSubStatus?: string;
  count: number;
};

export type MigrationRun = {
  id: string;
  startedAt: string;
  completedAt?: string;
  totalAccounts: number;
  migrated: number;
  errors: number;
  status: "draft" | "running" | "completed" | "failed";
  mappings: CodeMapping[];
};

export const sampleMappings: CodeMapping[] = [
  { legacyCode: "A1", legacyLabel: "Active - New", newCode: "ACTIVE", newSubStatus: "ACTIVE_NEW_PLACEMENT", count: 1245 },
  { legacyCode: "A2", legacyLabel: "Active - Working", newCode: "ACTIVE", newSubStatus: "ACTIVE_MULTIPLE_ATTEMPTS", count: 890 },
  { legacyCode: "P1", legacyLabel: "Promise", newCode: "PTP", newSubStatus: "PTP_SCHEDULED", count: 340 },
  { legacyCode: "P2", legacyLabel: "Broken Promise", newCode: "BRP", count: 180 },
  { legacyCode: "L1", legacyLabel: "Legal Review", newCode: "LEGAL", newSubStatus: "LEGAL_RECOMMENDED", count: 89 },
  { legacyCode: "L2", legacyLabel: "Lawsuit Filed", newCode: "LEGAL", newSubStatus: "LEGAL_FILED", count: 34 },
  { legacyCode: "C1", legacyLabel: "Closed - Paid", newCode: "PAID", count: 567 },
  { legacyCode: "C2", legacyLabel: "Closed - Uncoll", newCode: "CLOSED", newSubStatus: "CLOSED_UNCOLLECTABLE", count: 234 },
  { legacyCode: "D1", legacyLabel: "Disputed", newCode: "DISPUTED", count: 67 },
  { legacyCode: "X1", legacyLabel: "Cease & Desist", newCode: "CEASE", count: 23 },
];

export const sampleRuns: MigrationRun[] = [
  {
    id: "mig-2026-01",
    startedAt: "Jan 15, 2026 09:00",
    completedAt: "Jan 15, 2026 09:42",
    totalAccounts: 3669,
    migrated: 3651,
    errors: 18,
    status: "completed",
    mappings: sampleMappings,
  },
];
