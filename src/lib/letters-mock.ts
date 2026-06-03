// Epic 8 — Letter Template Engine mocks (US-084 → US-090)

export type LetterCategory = "legal" | "settlement" | "payment" | "compliance";
export type LetterStatus = "draft" | "active" | "archived";
export type Jurisdiction = "ON" | "QC" | "BC" | "AB" | "US-FED";
export type Language = "en" | "fr";

export type LetterTemplate = {
  id: string;
  name: string;
  category: LetterCategory;
  jurisdiction: Jurisdiction;
  language: Language;
  creditorClient?: string;
  status: LetterStatus;
  version: number;
  updatedAt: string;
  usage30d: number;
  tags: string[];
  complianceScore: number; // 0-100
  certifiedBy?: string;
  certifiedAt?: string;
  preview: string;
  requiresApproval: boolean;
};

export const LETTER_TEMPLATES: LetterTemplate[] = [
  { id: "lt-001", name: "Initial Demand — Ontario — RBC Creditor", category: "legal", jurisdiction: "ON", language: "en", creditorClient: "RBC", status: "active", version: 7, updatedAt: "2026-04-12", usage30d: 234, tags: ["pre_legal", "high_balance_only"], complianceScore: 100, certifiedBy: "Atty. J. Smith", certifiedAt: "2026-01-14", preview: "Dear {{debtor_full_name}}, this letter serves as formal notice that your account…", requiresApproval: true },
  { id: "lt-002", name: "Final Notice Before Legal — ON", category: "legal", jurisdiction: "ON", language: "en", status: "active", version: 4, updatedAt: "2026-04-08", usage30d: 156, tags: ["pre_legal", "urgent"], complianceScore: 100, certifiedBy: "Atty. J. Smith", certifiedAt: "2026-02-02", preview: "This is your FINAL NOTICE prior to legal action being commenced…", requiresApproval: true },
  { id: "lt-003", name: "Mise en demeure — Québec (FR)", category: "legal", jurisdiction: "QC", language: "fr", status: "active", version: 3, updatedAt: "2026-03-30", usage30d: 89, tags: ["requires_legal_review"], complianceScore: 96, certifiedBy: "Me. C. Tremblay", certifiedAt: "2026-01-22", preview: "Par la présente, nous vous mettons en demeure de régler la somme de…", requiresApproval: true },
  { id: "lt-004", name: "30-Day Settlement Offer", category: "settlement", jurisdiction: "ON", language: "en", status: "active", version: 9, updatedAt: "2026-04-15", usage30d: 412, tags: ["promotion"], complianceScore: 98, certifiedBy: "Atty. J. Smith", certifiedAt: "2026-03-01", preview: "We are pleased to offer a one-time settlement of {{settlement_amount}}…", requiresApproval: false },
  { id: "lt-005", name: "Final Settlement Opportunity", category: "settlement", jurisdiction: "US-FED", language: "en", status: "active", version: 5, updatedAt: "2026-04-10", usage30d: 178, tags: ["urgent", "promotion"], complianceScore: 100, certifiedBy: "Atty. R. Patel", certifiedAt: "2026-02-18", preview: "Last chance — settle for {{settlement_percentage}}% of balance by {{settlement_expiry}}…", requiresApproval: true },
  { id: "lt-006", name: "Lump Sum Discount Offer", category: "settlement", jurisdiction: "ON", language: "en", status: "active", version: 2, updatedAt: "2026-04-01", usage30d: 67, tags: ["promotion"], complianceScore: 92, preview: "Pay {{lump_sum_amount}} today and we will consider this account satisfied…", requiresApproval: false },
  { id: "lt-007", name: "Payment Plan Confirmation", category: "payment", jurisdiction: "ON", language: "en", status: "active", version: 11, updatedAt: "2026-04-16", usage30d: 543, tags: [], complianceScore: 100, preview: "Thank you for arranging the following payment plan: {{plan_terms}}…", requiresApproval: false },
  { id: "lt-008", name: "PTP Acknowledgment", category: "payment", jurisdiction: "ON", language: "en", status: "active", version: 6, updatedAt: "2026-04-14", usage30d: 289, tags: [], complianceScore: 100, preview: "We confirm your promise to pay {{ptp_amount}} on {{ptp_date}}…", requiresApproval: false },
  { id: "lt-009", name: "Payment Received — Thank You", category: "payment", jurisdiction: "ON", language: "en", status: "active", version: 3, updatedAt: "2026-04-11", usage30d: 798, tags: [], complianceScore: 100, preview: "Thank you for your payment of {{payment_amount}} received on {{payment_date}}…", requiresApproval: false },
  { id: "lt-010", name: "Debt Validation Letter (FDCPA)", category: "compliance", jurisdiction: "US-FED", language: "en", status: "active", version: 8, updatedAt: "2026-04-09", usage30d: 134, tags: ["requires_legal_review"], complianceScore: 100, certifiedBy: "Atty. R. Patel", certifiedAt: "2026-01-30", preview: "This is an attempt to collect a debt. Unless you notify us within 30 days…", requiresApproval: true },
  { id: "lt-011", name: "Cease Communication Confirmation", category: "compliance", jurisdiction: "US-FED", language: "en", status: "active", version: 2, updatedAt: "2026-03-28", usage30d: 23, tags: [], complianceScore: 100, preview: "We acknowledge your written request to cease further communication…", requiresApproval: false },
  { id: "lt-012", name: "Dispute Acknowledgment", category: "compliance", jurisdiction: "US-FED", language: "en", status: "active", version: 4, updatedAt: "2026-04-05", usage30d: 56, tags: [], complianceScore: 100, preview: "We have received your dispute regarding account {{account_number}}…", requiresApproval: false },
  { id: "lt-013", name: "Summons Notice (DRAFT)", category: "legal", jurisdiction: "ON", language: "en", status: "draft", version: 1, updatedAt: "2026-04-17", usage30d: 0, tags: ["requires_legal_review"], complianceScore: 78, preview: "DRAFT — pending legal review. Summons format requires court verification.", requiresApproval: true },
  { id: "lt-014", name: "Old FDCPA Template (ARCHIVED)", category: "compliance", jurisdiction: "US-FED", language: "en", status: "archived", version: 12, updatedAt: "2025-09-14", usage30d: 0, tags: [], complianceScore: 64, preview: "Archived — superseded by lt-010 after FDCPA 2025 amendment.", requiresApproval: false },
];

export const MERGE_VARIABLES = [
  { group: "Debtor", keys: [
    { key: "{{debtor_full_name}}", sample: "John A. Smith" },
    { key: "{{debtor_first_name}}", sample: "John" },
    { key: "{{debtor_address}}", sample: "123 Main St" },
    { key: "{{debtor_city}}", sample: "Toronto" },
    { key: "{{debtor_province}}", sample: "ON" },
    { key: "{{debtor_postal_code}}", sample: "M5V 3A8" },
  ]},
  { group: "Account", keys: [
    { key: "{{account_number}}", sample: "ACC-882134" },
    { key: "{{original_creditor}}", sample: "RBC Royal Bank" },
    { key: "{{balance_due}}", sample: "$2,847.55" },
    { key: "{{interest_accrued}}", sample: "$184.20" },
    { key: "{{total_amount}}", sample: "$3,031.75" },
  ]},
  { group: "Dates", keys: [
    { key: "{{current_date}}", sample: "April 17, 2026" },
    { key: "{{payment_deadline}}", sample: "May 17, 2026" },
    { key: "{{settlement_expiry}}", sample: "April 30, 2026" },
  ]},
  { group: "Firm", keys: [
    { key: "{{law_firm_name}}", sample: "Smith & Associates LLP" },
    { key: "{{attorney_name}}", sample: "Jane Smith, Esq." },
    { key: "{{firm_phone}}", sample: "(416) 555-0199" },
  ]},
];

export type BulkBatch = {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  recipients: number;
  generated: number;
  failed: number;
  status: "queued" | "running" | "completed" | "failed";
  output: "pdf" | "docx" | "print";
  startedAt: string;
  completedAt?: string;
  totalSizeMB: number;
};

export const BULK_BATCHES: BulkBatch[] = [
  { id: "bb-001", name: "Q2_2026_Final_Demand_Campaign", templateId: "lt-002", templateName: "Final Notice Before Legal — ON", recipients: 456, generated: 453, failed: 3, status: "completed", output: "print", startedAt: "2026-04-17 11:00", completedAt: "2026-04-17 11:14", totalSizeMB: 8.5 },
  { id: "bb-002", name: "April_Settlement_Push", templateId: "lt-004", templateName: "30-Day Settlement Offer", recipients: 234, generated: 234, failed: 0, status: "completed", output: "pdf", startedAt: "2026-04-16 09:00", completedAt: "2026-04-16 09:08", totalSizeMB: 4.2 },
  { id: "bb-003", name: "QC_Mise_en_demeure_Batch", templateId: "lt-003", templateName: "Mise en demeure — Québec (FR)", recipients: 89, generated: 51, failed: 0, status: "running", output: "print", startedAt: "2026-04-17 14:32", totalSizeMB: 1.1 },
  { id: "bb-004", name: "Aged_90_Reminder_Wave", templateId: "lt-007", templateName: "Payment Plan Confirmation", recipients: 312, generated: 0, failed: 0, status: "queued", output: "pdf", startedAt: "2026-04-17 23:00", totalSizeMB: 0 },
];

export type ApprovalItem = {
  id: string;
  batchId: string;
  debtor: string;
  template: string;
  balance: number;
  generatedBy: string;
  generatedAt: string;
  priority: "urgent" | "normal";
  queue: "attorney" | "supervisor" | "team_lead";
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
};

export const APPROVAL_ITEMS: ApprovalItem[] = [
  { id: "ap-001", batchId: "bb-001", debtor: "John A. Smith", template: "Final Notice Before Legal — ON", balance: 5847.20, generatedBy: "operator@firm.ca", generatedAt: "2026-04-17 11:14", priority: "urgent", queue: "attorney", status: "pending" },
  { id: "ap-002", batchId: "bb-001", debtor: "Maria L. Chen", template: "Final Notice Before Legal — ON", balance: 3120.00, generatedBy: "operator@firm.ca", generatedAt: "2026-04-17 11:14", priority: "normal", queue: "supervisor", status: "pending" },
  { id: "ap-003", batchId: "bb-001", debtor: "David O. Reilly", template: "Final Notice Before Legal — ON", balance: 9842.55, generatedBy: "operator@firm.ca", generatedAt: "2026-04-17 11:14", priority: "urgent", queue: "attorney", status: "pending" },
  { id: "ap-004", batchId: "bb-002", debtor: "Sarah Patel", template: "30-Day Settlement Offer", balance: 1450.00, generatedBy: "ops@firm.ca", generatedAt: "2026-04-16 09:08", priority: "normal", queue: "team_lead", status: "approved" },
  { id: "ap-005", batchId: "bb-001", debtor: "Robert K. Tan", template: "Final Notice Before Legal — ON", balance: 880.00, generatedBy: "operator@firm.ca", generatedAt: "2026-04-17 11:14", priority: "normal", queue: "supervisor", status: "rejected", rejectionReason: "Incorrect balance amount — update and resubmit" },
  { id: "ap-006", batchId: "bb-003", debtor: "Léa Tremblay", template: "Mise en demeure — Québec (FR)", balance: 2210.00, generatedBy: "ops-qc@firm.ca", generatedAt: "2026-04-17 14:35", priority: "urgent", queue: "attorney", status: "pending" },
];

export type MailDispatch = {
  id: string;
  batchId: string;
  provider: "Lob" | "Stannp";
  count: number;
  postageClass: "first_class" | "certified" | "registered";
  costTotal: number;
  status: "preparing" | "in_transit" | "delivered" | "returned" | "printing";
  mailHouseBatchId?: string;
  printedAt?: string;
  mailedAt?: string;
  expectedDelivery?: string;
  delivered: number;
  returned: number;
};

export const MAIL_DISPATCHES: MailDispatch[] = [
  { id: "md-001", batchId: "bb-001", provider: "Lob", count: 453, postageClass: "first_class", costTotal: 543.60, status: "in_transit", mailHouseBatchId: "ML-2026-04-17-001", printedAt: "2026-04-18 02:00", mailedAt: "2026-04-19 08:00", expectedDelivery: "2026-04-22", delivered: 0, returned: 0 },
  { id: "md-002", batchId: "bb-002", provider: "Lob", count: 234, postageClass: "first_class", costTotal: 280.80, status: "delivered", mailHouseBatchId: "ML-2026-04-16-014", printedAt: "2026-04-16 18:00", mailedAt: "2026-04-17 08:00", expectedDelivery: "2026-04-20", delivered: 218, returned: 16 },
  { id: "md-003", batchId: "bb-005", provider: "Stannp", count: 67, postageClass: "certified", costTotal: 234.50, status: "printing", mailHouseBatchId: "SN-2026-04-17-088", delivered: 0, returned: 0 },
];

export type ComplianceRule = {
  id: string;
  jurisdiction: Jurisdiction;
  type: "required" | "prohibited";
  label: string;
  pattern: string;
  severity: "critical" | "high" | "medium";
};

export const COMPLIANCE_RULES: ComplianceRule[] = [
  { id: "cr-001", jurisdiction: "US-FED", type: "required", label: "Mini-Miranda (FDCPA)", pattern: "This is an attempt to collect a debt", severity: "critical" },
  { id: "cr-002", jurisdiction: "US-FED", type: "required", label: "Dispute rights notice", pattern: "Unless you notify us within 30 days", severity: "critical" },
  { id: "cr-003", jurisdiction: "US-FED", type: "required", label: "Validation notice", pattern: "We will obtain verification", severity: "critical" },
  { id: "cr-004", jurisdiction: "QC", type: "required", label: "French language requirement", pattern: "[FR text]", severity: "critical" },
  { id: "cr-005", jurisdiction: "ON", type: "required", label: "Interest rate disclosure", pattern: "Interest is calculated at", severity: "high" },
  { id: "cr-006", jurisdiction: "US-FED", type: "prohibited", label: "Threat of arrest", pattern: "you will be arrested", severity: "critical" },
  { id: "cr-007", jurisdiction: "US-FED", type: "prohibited", label: "False permanence claim", pattern: "your credit is ruined forever", severity: "critical" },
  { id: "cr-008", jurisdiction: "US-FED", type: "prohibited", label: "Misleading 'Final notice'", pattern: "final notice (when not actually final)", severity: "medium" },
];

export const REGULATORY_ALERTS = [
  { id: "ra-001", severity: "high", title: "FDCPA amendment effective June 1, 2026", body: "12 templates require review due to new validation-period rules.", impactedTemplates: 12, deadline: "2026-06-01" },
  { id: "ra-002", severity: "medium", title: "Quebec Bill 64 — disclosure update", body: "3 QC templates need revised consumer-protection wording.", impactedTemplates: 3, deadline: "2026-07-15" },
];

export type LetterAnalytics = {
  templateId: string;
  templateName: string;
  sent: number;
  delivered: number;
  responses: number;
  payments: number;
  avgPayment: number;
  costPerSend: number;
  responseRate: number;
  paymentRate: number;
  totalCollected: number;
  roi: number;
};

export const LETTER_ANALYTICS: LetterAnalytics[] = [
  { templateId: "lt-002", templateName: "Final Notice Before Legal — Standard", sent: 456, delivered: 432, responses: 68, payments: 55, avgPayment: 543, costPerSend: 1.20, responseRate: 15.7, paymentRate: 12.7, totalCollected: 29865, roi: 5343 },
  { templateId: "lt-002b", templateName: "Final Notice Before Legal — Stern Tone", sent: 434, delivered: 411, responses: 95, payments: 78, avgPayment: 612, costPerSend: 1.20, responseRate: 23.1, paymentRate: 19.0, totalCollected: 47736, roi: 9078 },
  { templateId: "lt-004", templateName: "30-Day Settlement Offer", sent: 567, delivered: 540, responses: 134, payments: 119, avgPayment: 487, costPerSend: 1.20, responseRate: 24.8, paymentRate: 22.0, totalCollected: 57953, roi: 8033 },
  { templateId: "lt-010", templateName: "Debt Validation Letter (FDCPA)", sent: 134, delivered: 128, responses: 18, payments: 6, avgPayment: 720, costPerSend: 3.50, responseRate: 14.1, paymentRate: 4.7, totalCollected: 4320, roi: 1957 },
];

export const VOLUME_BREAKDOWN = {
  totalThisMonth: 2345,
  byType: { final_demand: 890, settlement: 567, payment_reminder: 456, legal_notice: 234, other: 198 },
  byPostage: { first_class: 2100, certified: 200, registered: 45 },
  delivery: { delivered: 2156, returned: 156, in_transit: 33 },
  response: { payments: 423, contact: 234, disputes: 67, no_response: 1432, totalCollected: 286794, avgPayment: 678 },
};

export const TIMING_INSIGHTS = [
  { day: "Monday", paymentRate: 20 },
  { day: "Tuesday", paymentRate: 17 },
  { day: "Wednesday", paymentRate: 16 },
  { day: "Thursday", paymentRate: 14 },
  { day: "Friday", paymentRate: 12 },
];
