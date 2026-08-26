// Mock data for EPIC 4 — Multi-CRM Integration (US-036 → US-045)
// Replaced with live Lovable Cloud queries when integration goes live.

export type ConnectorId =
  | "collect"
  | "ezycollect"
  | "salesforce"
  | "interprose"
  | "custom"
  | "none";

export type ConnectorStatus = "available" | "coming_soon" | "custom" | "standalone";

export type Connector = {
  id: ConnectorId;
  name: string;
  vendor: string;
  status: ConnectorStatus;
  description: string;
  docsUrl: string;
  supportEmail: string;
  authMethods: ("api_key" | "basic" | "oauth2")[];
};

export const connectors: Connector[] = [
  {
    id: "collect",
    name: "COLLECT!",
    vendor: "Comtech Systems",
    status: "available",
    description: "Industry-standard collection management. Phase 1 supported (v5.0+).",
    docsUrl: "https://docs.example.com/collect",
    supportEmail: "support@collectrix.ai",
    authMethods: ["api_key", "basic", "oauth2"],
  },
  {
    id: "ezycollect",
    name: "ezyCollect",
    vendor: "ezyCollect Pty Ltd",
    status: "coming_soon",
    description: "AR & collections automation for SMB. Connector in development.",
    docsUrl: "https://docs.example.com/ezycollect",
    supportEmail: "support@collectrix.ai",
    authMethods: ["api_key"],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    vendor: "Salesforce.com",
    status: "coming_soon",
    description: "Enterprise CRM. Use for creditor client relationship management.",
    docsUrl: "https://docs.example.com/salesforce",
    supportEmail: "support@collectrix.ai",
    authMethods: ["oauth2"],
  },
  {
    id: "interprose",
    name: "Interprose",
    vendor: "Interprose",
    status: "coming_soon",
    description: "Legal collection software. Connector planned for Q3.",
    docsUrl: "https://docs.example.com/interprose",
    supportEmail: "support@collectrix.ai",
    authMethods: ["api_key"],
  },
  {
    id: "custom",
    name: "Custom API",
    vendor: "Webhook-based",
    status: "custom",
    description: "Bring-your-own CRM via webhooks and REST. Custom development required.",
    docsUrl: "https://docs.example.com/custom",
    supportEmail: "support@collectrix.ai",
    authMethods: ["api_key", "oauth2"],
  },
  {
    id: "none",
    name: "Standalone",
    vendor: "No external CRM",
    status: "standalone",
    description: "Use Collectrix as your primary CRM. No external sync.",
    docsUrl: "https://docs.example.com/standalone",
    supportEmail: "support@collectrix.ai",
    authMethods: [],
  },
];

export type SyncDirection = "in" | "out" | "bi";
export type SyncFrequency = "realtime" | "hourly" | "daily" | "manual";

export type CrmConnection = {
  id: string;
  connectorId: ConnectorId;
  label: string;
  serverUrl: string;
  database?: string;
  authMethod: "api_key" | "basic" | "oauth2";
  username?: string;
  status: "connected" | "degraded" | "disconnected";
  lastSyncAt: string;
  uptime: number;
  syncDirection: SyncDirection;
  frequency: SyncFrequency;
  scope: string;
  isPrimary: boolean;
  isReadOnly: boolean;
  conflictStrategy: "last_write" | "platform_wins" | "crm_wins" | "manual";
};

export const crmConnections: CrmConnection[] = [
  {
    id: "cnx_01",
    connectorId: "collect",
    label: "COLLECT! Production",
    serverUrl: "https://collect.apex-recovery.com",
    database: "APEX_PROD",
    authMethod: "api_key",
    username: "api-svc",
    status: "connected",
    lastSyncAt: "2 min ago",
    uptime: 98.5,
    syncDirection: "bi",
    frequency: "realtime",
    scope: "All customers",
    isPrimary: true,
    isReadOnly: false,
    conflictStrategy: "last_write",
  },
  {
    id: "cnx_02",
    connectorId: "salesforce",
    label: "Salesforce — Creditor CRM",
    serverUrl: "https://apex.my.salesforce.com",
    authMethod: "oauth2",
    status: "degraded",
    lastSyncAt: "1h ago",
    uptime: 91.2,
    syncDirection: "out",
    frequency: "hourly",
    scope: "Balance > $5,000",
    isPrimary: false,
    isReadOnly: true,
    conflictStrategy: "platform_wins",
  },
];

export type SyncEvent = {
  id: string;
  when: string;
  direction: "out" | "in";
  entity: "debtor" | "payment" | "activity" | "document" | "recording" | "status";
  refId: string;
  summary: string;
  status: "success" | "failed" | "pending" | "retrying";
  attempts: number;
  errorMessage?: string;
  durationMs: number;
};

export const syncEvents: SyncEvent[] = [
  { id: "se_001", when: "12s ago", direction: "out", entity: "payment", refId: "PAY-44821", summary: "Payment $500 → COLLECT!", status: "success", attempts: 1, durationMs: 412 },
  { id: "se_002", when: "1m ago", direction: "in", entity: "status", refId: "DEB-10421", summary: "Status A → P (PTP)", status: "success", attempts: 1, durationMs: 188 },
  { id: "se_003", when: "3m ago", direction: "out", entity: "activity", refId: "ACT-9981", summary: "AI call outcome → Activity log", status: "success", attempts: 1, durationMs: 622 },
  { id: "se_004", when: "5m ago", direction: "out", entity: "debtor", refId: "DEB-10419", summary: "Balance update $14,280 → $13,780", status: "retrying", attempts: 2, errorMessage: "503 Service Unavailable", durationMs: 30000 },
  { id: "se_005", when: "8m ago", direction: "in", entity: "document", refId: "DOC-7741", summary: "Settlement_Agreement_v2.pdf", status: "success", attempts: 1, durationMs: 1840 },
  { id: "se_006", when: "12m ago", direction: "out", entity: "recording", refId: "REC-22099", summary: "Call recording (4m 12s)", status: "success", attempts: 1, durationMs: 2210 },
  { id: "se_007", when: "18m ago", direction: "out", entity: "status", refId: "DEB-10418", summary: "PIF status push", status: "failed", attempts: 5, errorMessage: "Invalid transition C → P (CRM rules)", durationMs: 412 },
  { id: "se_008", when: "22m ago", direction: "in", entity: "payment", refId: "PAY-44820", summary: "Bank draft $300 imported", status: "success", attempts: 1, durationMs: 198 },
];

export type FieldMapping = {
  id: string;
  crmField: string;
  crmType: string;
  platformField: string;
  platformType: string;
  direction: SyncDirection;
  required: boolean;
  custom: boolean;
  sample?: string;
};

export const fieldMappings: FieldMapping[] = [
  { id: "fm_01", crmField: "Customer.Name", crmType: "string", platformField: "full_name", platformType: "text", direction: "bi", required: true, custom: false, sample: "Margaret Chen" },
  { id: "fm_02", crmField: "Customer.Balance", crmType: "decimal", platformField: "balance", platformType: "numeric", direction: "bi", required: true, custom: false, sample: "8420.12" },
  { id: "fm_03", crmField: "Customer.Status", crmType: "char(1)", platformField: "status", platformType: "enum", direction: "bi", required: true, custom: false, sample: "A → active" },
  { id: "fm_04", crmField: "Customer.AccountNumber", crmType: "string", platformField: "external_id", platformType: "text", direction: "bi", required: true, custom: false, sample: "RBC-447821" },
  { id: "fm_05", crmField: "Customer.Phone1", crmType: "string", platformField: "phones[0]", platformType: "phone", direction: "bi", required: false, custom: false, sample: "(416) 555-1234" },
  { id: "fm_06", crmField: "Customer.VIP_FLAG", crmType: "boolean", platformField: "custom.vip_client", platformType: "boolean", direction: "out", required: false, custom: true, sample: "true" },
  { id: "fm_07", crmField: "Customer.Creditor", crmType: "string", platformField: "creditor_client", platformType: "text", direction: "in", required: false, custom: false, sample: "RBC" },
];

export type StatusMap = {
  id: string;
  platform: string;
  crm: string;
  syncOut: boolean;
  syncIn: boolean;
  conflict: "last_write" | "platform_wins" | "crm_wins" | "manual";
};

export const statusMaps: StatusMap[] = [
  { id: "sm_01", platform: "NEW", crm: "N", syncOut: true, syncIn: true, conflict: "last_write" },
  { id: "sm_02", platform: "ACTIVE", crm: "A", syncOut: true, syncIn: true, conflict: "last_write" },
  { id: "sm_03", platform: "PTP", crm: "P", syncOut: true, syncIn: true, conflict: "last_write" },
  { id: "sm_04", platform: "BRP", crm: "B", syncOut: true, syncIn: false, conflict: "platform_wins" },
  { id: "sm_05", platform: "LEGAL", crm: "L", syncOut: true, syncIn: true, conflict: "manual" },
  { id: "sm_06", platform: "PIF", crm: "C", syncOut: true, syncIn: true, conflict: "crm_wins" },
  { id: "sm_07", platform: "SIF", crm: "C", syncOut: true, syncIn: false, conflict: "platform_wins" },
  { id: "sm_08", platform: "DISPUTED", crm: "D", syncOut: true, syncIn: true, conflict: "manual" },
  { id: "sm_09", platform: "CEASE", crm: "X", syncOut: true, syncIn: true, conflict: "last_write" },
];

export type PaymentRecord = {
  id: string;
  debtor: string;
  amount: number;
  date: string;
  method: "check" | "etransfer" | "credit_card" | "bank_draft" | "ach";
  reference: string;
  syncStatus: "synced" | "pending" | "reversed" | "failed";
  source: "platform" | "crm";
};

export const paymentRecords: PaymentRecord[] = [
  { id: "p_01", debtor: "Margaret Chen", amount: 500, date: "2026-04-17", method: "etransfer", reference: "ETR-99821", syncStatus: "synced", source: "platform" },
  { id: "p_02", debtor: "Daniel O'Connor", amount: 250, date: "2026-04-17", method: "check", reference: "CHK-44120", syncStatus: "synced", source: "platform" },
  { id: "p_03", debtor: "Sofia Andersson", amount: 300, date: "2026-04-15", method: "bank_draft", reference: "BD-22041", syncStatus: "synced", source: "crm" },
  { id: "p_04", debtor: "Liam Patel", amount: 320, date: "2026-04-14", method: "credit_card", reference: "CC-77104", syncStatus: "reversed", source: "platform" },
  { id: "p_05", debtor: "Priya Nakamura", amount: 1200, date: "2026-04-13", method: "ach", reference: "ACH-99100", syncStatus: "pending", source: "platform" },
];

export type CrmDocument = {
  id: string;
  filename: string;
  category: "Legal" | "Financial" | "Correspondence" | "ID" | "Other";
  sizeKb: number;
  debtor: string;
  uploadedBy: string;
  uploadedAt: string;
  source: "platform" | "crm";
  version: number;
  syncStatus: "synced" | "pending" | "failed";
};

export const crmDocuments: CrmDocument[] = [
  { id: "d_01", filename: "Settlement_Agreement_v2.pdf", category: "Legal", sizeKb: 412, debtor: "Margaret Chen", uploadedBy: "Maya Lindstrom", uploadedAt: "8m ago", source: "platform", version: 2, syncStatus: "synced" },
  { id: "d_02", filename: "Signed_Payment_Plan.pdf", category: "Financial", sizeKb: 218, debtor: "Daniel O'Connor", uploadedBy: "COLLECT! sync", uploadedAt: "1h ago", source: "crm", version: 1, syncStatus: "synced" },
  { id: "d_03", filename: "Debtor_ID_Scan.jpg", category: "ID", sizeKb: 1842, debtor: "Aisha Ramirez", uploadedBy: "Daniel Kim", uploadedAt: "3h ago", source: "platform", version: 1, syncStatus: "synced" },
  { id: "d_04", filename: "Demand_Letter_Final.pdf", category: "Legal", sizeKb: 188, debtor: "Hugo Tremblay", uploadedBy: "Workflow engine", uploadedAt: "yesterday", source: "platform", version: 1, syncStatus: "pending" },
  { id: "d_05", filename: "Statement_Q1.xlsx", category: "Financial", sizeKb: 64, debtor: "Sofia Andersson", uploadedBy: "COLLECT! sync", uploadedAt: "2d ago", source: "crm", version: 1, syncStatus: "synced" },
];

export type CallRecording = {
  id: string;
  debtor: string;
  agent: string;
  durationSec: number;
  outcome: "connected" | "voicemail" | "no_answer" | "wrong_number";
  sentiment: "positive" | "neutral" | "negative";
  flags: string[];
  recordedAt: string;
  syncStatus: "synced" | "pending" | "archived";
  retentionUntil: string;
};

export const callRecordings: CallRecording[] = [
  { id: "r_01", debtor: "Margaret Chen", agent: "AI · Claude", durationSec: 252, outcome: "connected", sentiment: "positive", flags: [], recordedAt: "12m ago", syncStatus: "synced", retentionUntil: "2033-04-20" },
  { id: "r_02", debtor: "Daniel O'Connor", agent: "AI · Claude", durationSec: 88, outcome: "voicemail", sentiment: "neutral", flags: [], recordedAt: "1h ago", syncStatus: "synced", retentionUntil: "2033-04-20" },
  { id: "r_03", debtor: "Aisha Ramirez", agent: "Maya Lindstrom", durationSec: 412, outcome: "connected", sentiment: "negative", flags: ["dispute_raised", "supervisor_review"], recordedAt: "3h ago", syncStatus: "synced", retentionUntil: "legal_hold" },
  { id: "r_04", debtor: "Hugo Tremblay", agent: "AI · Claude", durationSec: 22, outcome: "no_answer", sentiment: "neutral", flags: [], recordedAt: "yesterday", syncStatus: "synced", retentionUntil: "2033-04-20" },
  { id: "r_05", debtor: "Ethan Wong", agent: "AI · Claude", durationSec: 188, outcome: "connected", sentiment: "negative", flags: ["cease_request", "DNC_violation_check"], recordedAt: "2d ago", syncStatus: "synced", retentionUntil: "legal_hold" },
];

export type WorkflowTrigger = {
  id: string;
  name: string;
  event: string;
  crmWorkflow: string;
  conditions: string;
  enabled: boolean;
  runs: number;
  successRate: number;
  avgMs: number;
};

export const workflowTriggers: WorkflowTrigger[] = [
  { id: "wt_01", name: "Legal escalation", event: "status → LEGAL", crmWorkflow: "COLLECT!.Legal_Escalation_WF", conditions: "balance > $1,000", enabled: true, runs: 45, successRate: 100, avgMs: 1820 },
  { id: "wt_02", name: "Payment confirmation", event: "payment.received", crmWorkflow: "COLLECT!.Payment_Confirmation_WF", conditions: "any", enabled: true, runs: 89, successRate: 98.9, avgMs: 920 },
  { id: "wt_03", name: "PTP follow-up", event: "ai_call.outcome=PTP", crmWorkflow: "COLLECT!.PTP_Followup_WF", conditions: "any", enabled: true, runs: 25, successRate: 96.0, avgMs: 1240 },
  { id: "wt_04", name: "Dispute investigation", event: "dispute.raised", crmWorkflow: "COLLECT!.Dispute_Investigation_WF", conditions: "any", enabled: false, runs: 0, successRate: 0, avgMs: 0 },
];

export type ActivityLogEntry = {
  id: string;
  when: string;
  type: "ai_call" | "email" | "status_change" | "note" | "payment" | "document";
  debtor: string;
  actor: string;
  summary: string;
  source: "platform" | "crm";
  syncedToCrm: boolean;
};

export const activityLog: ActivityLogEntry[] = [
  { id: "al_01", when: "2m ago", type: "ai_call", debtor: "Margaret Chen", actor: "AI · Claude", summary: "Outbound call · 4m12s · PTP for $500 on May 1", source: "platform", syncedToCrm: true },
  { id: "al_02", when: "8m ago", type: "status_change", debtor: "Margaret Chen", actor: "Maya Lindstrom", summary: "ACTIVE → PTP (Payment arrangement made)", source: "platform", syncedToCrm: true },
  { id: "al_03", when: "15m ago", type: "email", debtor: "Daniel O'Connor", actor: "Workflow engine", summary: "Payment reminder sent · delivered", source: "platform", syncedToCrm: true },
  { id: "al_04", when: "1h ago", type: "note", debtor: "Aisha Ramirez", actor: "Daniel Kim", summary: "Internal note added (not visible to creditor)", source: "platform", syncedToCrm: true },
  { id: "al_05", when: "1h ago", type: "payment", debtor: "Sofia Andersson", actor: "COLLECT! sync", summary: "Bank draft $300 received", source: "crm", syncedToCrm: false },
  { id: "al_06", when: "yesterday", type: "document", debtor: "Margaret Chen", actor: "Maya Lindstrom", summary: "Settlement_Agreement_v2.pdf uploaded", source: "platform", syncedToCrm: true },
];

export type SyncError = {
  id: string;
  when: string;
  connection: string;
  operation: string;
  error: string;
  retries: number;
  status: "queued" | "retrying" | "failed" | "resolved";
};

export const syncErrors: SyncError[] = [
  { id: "er_01", when: "5m ago", connection: "COLLECT! Production", operation: "Update customer balance", error: "503 Service Unavailable", retries: 2, status: "retrying" },
  { id: "er_02", when: "18m ago", connection: "COLLECT! Production", operation: "Status PIF push", error: "Invalid transition C → P (COLLECT! rules)", retries: 5, status: "failed" },
  { id: "er_03", when: "1h ago", connection: "Salesforce", operation: "Creditor record sync", error: "401 Unauthorized — token expired", retries: 3, status: "failed" },
  { id: "er_04", when: "2h ago", connection: "COLLECT! Production", operation: "Document upload", error: "Connection timeout (30s)", retries: 1, status: "resolved" },
];
