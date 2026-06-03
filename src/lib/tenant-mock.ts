// Mock tenant-scoped data used by the Tenant Admin portal (Epic 2).
// In production these come from Lovable Cloud with RLS — here we surface
// the same shape so screens render identically before live wiring.

export type TenantUser = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  roles: string[];
  status: "active" | "pending" | "deactivated" | "archived";
  lastLogin: string;
  clients?: string[];
  twoFA: boolean;
  legalCredential?: { license: string; verified: boolean };
};

export type TenantRole = {
  id: string;
  name: string;
  description: string;
  legalAuthorized: boolean;
  template?: string;
  permissions: Record<string, boolean>;
  userCount: number;
};

export type Team = {
  id: string;
  name: string;
  description?: string;
  leader: string;
  memberCount: number;
  
  capacity: number;
  active: number;
  type: "production" | "support";
  productionCategory: "collection" | "legal" | "other" | "na";
  status: "active" | "inactive";
  analyticsEnabled: boolean;
};

export type SessionRow = {
  id: string;
  user: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  loginAt: string;
  lastActive: string;
};

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  scope: "full" | "read" | "custom";
  expires: string;
  lastUsed: string | null;
  status: "active" | "revoked" | "expired";
  reqsThisMonth: number;
};

export type TempGrant = {
  id: string;
  user: string;
  role: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "active" | "expired";
};

export type AuditEntry = {
  id: string;
  ts: string;
  actor: string;
  target: string;
  action: string;
  severity: "info" | "warning" | "critical";
  before?: string[];
  after?: string[];
  ip: string;
};

export const PERMISSION_GROUPS: { label: string; perms: { key: string; label: string }[] }[] = [
  {
    label: "Debtor File Access",
    perms: [
      { key: "debtor.view.assigned", label: "View assigned debtor files" },
      { key: "debtor.view.all", label: "View all debtor files (not just assigned)" },
      { key: "debtor.edit.contact", label: "Edit debtor contact information" },
      { key: "debtor.edit.financial", label: "Edit debtor financial details (balance, interest, fees)" },
      { key: "debtor.view.notes_history", label: "View file notes and activity history" },
      { key: "debtor.notes.add", label: "Add notes to debtor files" },
      { key: "debtor.edit", label: "Edit debtor file details" },
      { key: "debtor.upload", label: "Upload files for debtor" },
      { key: "debtor.data.upload", label: "Access Debtor Data Upload" },
      { key: "debtor.validation.update", label: "Update validation errors" },
    ],
  },
  {
    label: "Debtor Lifecycle & Assignment",
    perms: [
      { key: "debtor.engagement.stop", label: "Stop engagement on a debtor file" },
      { key: "debtor.engagement.resume", label: "Resume engagement on a debtor file" },
      { key: "debtor.archive", label: "Archive debtor files" },
      { key: "debtor.delete", label: "Delete debtor files" },
      { key: "debtor.export", label: "Export debtor files (CSV / PDF)" },
      { key: "debtor.assignment.update", label: "Update assignments for each debtor" },
      { key: "dedupe.manage", label: "Access and manage deduplication queue" },
    ],
  },
  {
    label: "Status Management",
    perms: [
      { key: "status.update", label: "Update file status (within permitted range)" },
      { key: "status.legal.recommend", label: "Recommend file for legal escalation" },
      { key: "status.legal", label: "Set legal status directly (licensed professionals only)" },
      { key: "status.cease_desist", label: "Set \"Cease & Desist\" status" },
      { key: "status.paid_settled", label: "Set \"Paid in Full / Settled in Full\" status" },
    ],
  },
  {
    label: "Communications",
    perms: [
      { key: "comm.call.manual", label: "Make manual outbound calls" },
      { key: "comm.sms_email", label: "Send SMS and email messages" },
      { key: "comm.history", label: "View communication history" },
      { key: "comm.recordings", label: "Access and download call recordings" },
    ],
  },
  {
    label: "Payments",
    perms: [
      { key: "pay.post", label: "Post payments to debtor records" },
      { key: "pay.edit_reverse", label: "Edit or reverse a posted payment" },
      { key: "pay.verify_request", label: "Place Payment Verification Request" },
      { key: "pay.finance_posted", label: "Place Finance Posted Payments" },
      { key: "pay.promise_update", label: "Update Promise to Pay" },
      { key: "pay.status_update", label: "Update Payment Status" },
    ],
  },
  {
    label: "Legal Actions (module-gated)",
    perms: [
      { key: "legal.letters", label: "Generate legal demand letters" },
      { key: "legal.files", label: "Access files in legal status" },
    ],
  },
  {
    label: "Reporting & Dashboards",
    perms: [
      { key: "report.personal", label: "View personal performance dashboard" },
      { key: "report.team", label: "View team/agent dashboards" },
      { key: "report.kpi", label: "View KPI reports" },
      { key: "report.export", label: "Export reports" },
    ],
  },
];

// Modules group related permissions for one-click selection in the role editor.
// Selecting a module auto-checks all linked permission keys.
export const PERMISSION_MODULES: { key: string; label: string; description: string; perms: string[] }[] = [
  {
    key: "mod.analytics",
    label: "Analytics",
    description: "Dashboards, KPI reports and exports",
    perms: ["report.personal", "report.team", "report.kpi", "report.export"],
  },
  {
    key: "mod.data_intake",
    label: "Data Intake",
    description: "Debtor uploads and deduplication",
    perms: ["debtor.data.upload", "dedupe.manage"],
  },
  {
    key: "mod.debtor_management",
    label: "Debtor Management",
    description: "Full debtor file lifecycle, payments and legal actions",
    perms: [
      "debtor.view.assigned",
      "debtor.view.all",
      "debtor.edit.contact",
      "debtor.edit.financial",
      "debtor.view.notes_history",
      "debtor.notes.add",
      "debtor.edit",
      "debtor.upload",
      "debtor.validation.update",
      "debtor.engagement.stop",
      "debtor.engagement.resume",
      "debtor.archive",
      "debtor.delete",
      "debtor.export",
      "debtor.assignment.update",
      "status.update",
      "status.legal.recommend",
      "status.legal",
      "status.cease_desist",
      "status.paid_settled",
      "comm.call.manual",
      "comm.sms_email",
      "comm.history",
      "comm.recordings",
      "pay.post",
      "pay.edit_reverse",
      "pay.verify_request",
      "pay.finance_posted",
      "pay.promise_update",
      "pay.status_update",
      "legal.letters",
      "legal.files",
    ],
  },
  {
    key: "mod.inbound_inbox",
    label: "Inbound Inbox",
    description: "Respond to inbound messages",
    perms: ["comm.call.manual", "comm.sms_email"],
  },
  {
    key: "mod.appointments",
    label: "Appointments",
    description: "Outreach for scheduling",
    perms: ["comm.call.manual", "comm.sms_email"],
  },
];

export const ROLE_TEMPLATES: { id: string; name: string; description: string; legal: boolean; perms: string[] }[] = [
  {
    id: "tmpl_agent",
    name: "Collection Agent",
    description: "Front-line collector with assigned file access, calls, SMS/email and standard status updates.",
    legal: false,
    perms: ["debtor.view.assigned", "debtor.edit.contact", "debtor.edit.financial", "debtor.view.notes_history", "debtor.notes.add", "debtor.edit", "debtor.upload", "status.update", "status.legal.recommend", "comm.call.manual", "comm.sms_email", "comm.history", "pay.promise_update", "report.personal"],
  },
  {
    id: "tmpl_senior_agent",
    name: "Senior Collection Agent",
    description: "Agent + recordings, payment posting and team reporting.",
    legal: false,
    perms: ["debtor.view.assigned", "debtor.view.all", "debtor.edit.contact", "debtor.edit.financial", "debtor.view.notes_history", "debtor.notes.add", "debtor.edit", "debtor.upload", "debtor.validation.update", "status.update", "status.legal.recommend", "comm.call.manual", "comm.sms_email", "comm.history", "comm.recordings", "pay.post", "pay.promise_update", "pay.status_update", "report.personal", "report.team"],
  },
  {
    id: "tmpl_supervisor",
    name: "Collection Supervisor",
    description: "Team oversight, status reversals, recordings and KPI reporting.",
    legal: false,
    perms: ["debtor.view.assigned", "debtor.view.all", "debtor.edit.contact", "debtor.edit.financial", "debtor.view.notes_history", "debtor.notes.add", "debtor.edit", "debtor.delete", "debtor.upload", "debtor.validation.update", "status.update", "status.legal.recommend", "status.cease_desist", "status.paid_settled", "comm.call.manual", "comm.sms_email", "comm.history", "comm.recordings", "pay.post", "pay.edit_reverse", "pay.verify_request", "pay.promise_update", "pay.status_update", "report.personal", "report.team", "report.kpi", "report.export"],
  },
  {
    id: "tmpl_legal_agent",
    name: "Legal Agent (Paralegal)",
    description: "Legal status access, demand letters and compliance views. Requires credential.",
    legal: true,
    perms: ["debtor.view.assigned", "debtor.edit.contact", "debtor.edit.financial", "debtor.view.notes_history", "debtor.notes.add", "debtor.edit", "debtor.upload", "status.update", "status.legal", "status.cease_desist", "comm.sms_email", "comm.history", "legal.letters", "legal.files", "report.personal"],
  },
  {
    id: "tmpl_attorney",
    name: "Legal Attorney",
    description: "Full legal workflow: legal status, demand letters, post-judgment.",
    legal: true,
    perms: ["debtor.view.assigned", "debtor.view.all", "debtor.edit.contact", "debtor.edit.financial", "debtor.view.notes_history", "debtor.notes.add", "debtor.edit", "debtor.upload", "status.update", "status.legal", "status.cease_desist", "status.paid_settled", "comm.sms_email", "comm.history", "comm.recordings", "legal.letters", "legal.files", "report.personal", "report.team", "report.export"],
  },
  {
    id: "tmpl_qa",
    name: "QA Manager",
    description: "Recording review, communication audit, compliance reports.",
    legal: false,
    perms: ["debtor.view.all", "debtor.view.notes_history", "comm.history", "comm.recordings", "report.team", "report.kpi", "report.export"],
  },
  {
    id: "tmpl_admin",
    name: "Tenant Administrator",
    description: "Full administrative control of the tenant.",
    legal: false,
    perms: ["debtor.view.assigned", "debtor.view.all", "debtor.edit.contact", "debtor.edit.financial", "debtor.view.notes_history", "debtor.notes.add", "debtor.edit", "debtor.delete", "debtor.upload", "debtor.validation.update", "status.update", "status.legal.recommend", "status.cease_desist", "status.paid_settled", "comm.call.manual", "comm.sms_email", "comm.history", "comm.recordings", "pay.post", "pay.edit_reverse", "pay.verify_request", "pay.finance_posted", "pay.promise_update", "pay.status_update", "report.personal", "report.team", "report.kpi", "report.export"],
  },
  {
    id: "tmpl_finance",
    name: "Finance / Back-office",
    description: "Payment posting, verification and financial reporting.",
    legal: false,
    perms: ["debtor.view.all", "debtor.edit.financial", "debtor.view.notes_history", "debtor.upload", "pay.post", "pay.edit_reverse", "pay.verify_request", "pay.finance_posted", "pay.status_update", "report.personal", "report.team", "report.kpi", "report.export"],
  },
];

const permsToMap = (keys: string[]): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  keys.forEach((k) => (out[k] = true));
  return out;
};

export const tenantUsers: TenantUser[] = [
  { id: "u_01", fullName: "Maya Lindstrom", email: "maya.l@apex.io", phone: "+1 (416) 555-0101", roles: ["Tenant Administrator"], status: "active", lastLogin: "12m ago", twoFA: true },
  { id: "u_02", fullName: "Devon Carter", email: "devon.c@apex.io", phone: "+1 (416) 555-0142", roles: ["Senior Collection Agent"], status: "active", lastLogin: "1h ago", clients: ["RBC", "TD"], twoFA: true },
  { id: "u_03", fullName: "Priya Shah", email: "priya.s@apex.io", phone: "+1 (647) 555-0188", roles: ["Legal Attorney"], status: "active", lastLogin: "3h ago", twoFA: true, legalCredential: { license: "LSO P28411", verified: true } },
  { id: "u_04", fullName: "Marcus Webb", email: "marcus.w@apex.io", phone: "+1 (905) 555-0277", roles: ["Collection Agent"], status: "active", lastLogin: "30m ago", clients: ["RBC"], twoFA: false },
  { id: "u_05", fullName: "Sara Kim", email: "sara.k@apex.io", phone: "+1 (416) 555-0319", roles: ["QA Manager"], status: "active", lastLogin: "5h ago", twoFA: true },
  { id: "u_06", fullName: "Tomas Reyes", email: "tomas.r@apex.io", phone: "+1 (437) 555-0402", roles: ["Collection Agent"], status: "pending", lastLogin: "—", twoFA: false },
  { id: "u_07", fullName: "Aisha Bello", email: "aisha.b@apex.io", phone: "+1 (416) 555-0521", roles: ["Collection Supervisor"], status: "active", lastLogin: "8h ago", twoFA: true },
  { id: "u_08", fullName: "Jordan Park", email: "jordan.p@apex.io", phone: "+1 (647) 555-0633", roles: ["Legal Agent (Paralegal)"], status: "active", lastLogin: "1d ago", twoFA: true, legalCredential: { license: "PLS-2241", verified: true } },
  { id: "u_09", fullName: "Henrik Olsen", email: "henrik.o@apex.io", phone: "+1 (905) 555-0744", roles: ["Finance / Back-office"], status: "active", lastLogin: "4h ago", twoFA: false },
  { id: "u_10", fullName: "Lia Nakamura", email: "lia.n@apex.io", phone: "+1 (416) 555-0855", roles: ["Collection Agent"], status: "deactivated", lastLogin: "21d ago", twoFA: false },
];

export const tenantRoles: TenantRole[] = ROLE_TEMPLATES.map((t, i) => ({
  id: `r_${i + 1}`,
  name: t.name,
  description: t.description,
  legalAuthorized: t.legal,
  template: t.id,
  permissions: permsToMap(t.perms),
  userCount: tenantUsers.filter((u) => u.roles.includes(t.name)).length,
}));

export const teams: Team[] = [
  { id: "tm_01", name: "RBC Recovery Team", description: "Primary recovery team for RBC creditor.", leader: "Aisha Bello", memberCount: 6, capacity: 50, active: 38, type: "production", productionCategory: "collection", status: "active", analyticsEnabled: true },
  { id: "tm_02", name: "TD Collections", description: "TD Bank early-stage collections.", leader: "Devon Carter", memberCount: 4, capacity: 50, active: 41, type: "production", productionCategory: "collection", status: "active", analyticsEnabled: true },
  { id: "tm_03", name: "Legal Pipeline", description: "Legal recovery, suits and judgments.", leader: "Priya Shah", memberCount: 3, capacity: 30, active: 18, type: "production", productionCategory: "legal", status: "active", analyticsEnabled: true },
  { id: "tm_04", name: "QA & Compliance", description: "Quality assurance and compliance reviews.", leader: "Sara Kim", memberCount: 2, capacity: 100, active: 24, type: "support", productionCategory: "na", status: "active", analyticsEnabled: false },
  { id: "tm_05", name: "Client Services", description: "Client-facing support and reporting.", leader: "Henrik Olsen", memberCount: 3, capacity: 40, active: 12, type: "support", productionCategory: "na", status: "active", analyticsEnabled: false },
  { id: "tm_06", name: "BMO Recovery Team", description: "Recovery team for BMO portfolio.", leader: "Aisha Bello", memberCount: 4, capacity: 50, active: 22, type: "production", productionCategory: "collection", status: "active", analyticsEnabled: true },
  { id: "tm_07", name: "Scotiabank Collections", description: "Early-stage Scotiabank collections.", leader: "Devon Carter", memberCount: 3, capacity: 40, active: 15, type: "production", productionCategory: "collection", status: "active", analyticsEnabled: true },
];

export const sessions: SessionRow[] = [
  { id: "s_01", user: "Maya Lindstrom", device: "MacBook Pro", browser: "Chrome 128", ip: "72.14.18.22", location: "Toronto, CA", loginAt: "08:42", lastActive: "1m ago" },
  { id: "s_02", user: "Devon Carter", device: "iPhone 15", browser: "Safari Mobile", ip: "104.22.8.91", location: "Mississauga, CA", loginAt: "07:15", lastActive: "12m ago" },
  { id: "s_03", user: "Priya Shah", device: "Windows Desktop", browser: "Edge 129", ip: "172.58.211.4", location: "Toronto, CA", loginAt: "09:01", lastActive: "3m ago" },
  { id: "s_04", user: "Marcus Webb", device: "MacBook Air", browser: "Firefox 131", ip: "108.172.14.220", location: "Hamilton, CA", loginAt: "08:55", lastActive: "20m ago" },
  { id: "s_05", user: "Aisha Bello", device: "Surface Pro", browser: "Chrome 128", ip: "199.7.140.14", location: "Toronto, CA", loginAt: "06:50", lastActive: "5m ago" },
];

export const apiKeys: ApiKey[] = [
  { id: "k_01", name: "CRM Sync Integration", prefix: "ctrx_live_2k4f", scope: "custom", expires: "2026-09-12", lastUsed: "2m ago", status: "active", reqsThisMonth: 142_801 },
  { id: "k_02", name: "Salesforce Webhook Receiver", prefix: "ctrx_live_8a91", scope: "read", expires: "2026-04-30", lastUsed: "18m ago", status: "active", reqsThisMonth: 22_104 },
  { id: "k_03", name: "Nightly Bulk Importer", prefix: "ctrx_live_q11x", scope: "full", expires: "2026-01-01", lastUsed: "9h ago", status: "active", reqsThisMonth: 412 },
  { id: "k_04", name: "Legacy export script", prefix: "ctrx_live_zz4d", scope: "read", expires: "2025-12-15", lastUsed: "44d ago", status: "expired", reqsThisMonth: 0 },
  { id: "k_05", name: "Compromised — incident #441", prefix: "ctrx_live_xx0a", scope: "full", expires: "2026-03-01", lastUsed: "2d ago", status: "revoked", reqsThisMonth: 1_204 },
];

export const tempGrants: TempGrant[] = [
  { id: "g_01", user: "Marcus Webb", role: "Senior Collection Agent", reason: "Vacation coverage for Devon Carter", startsAt: "2026-04-22 08:00", endsAt: "2026-04-29 18:00", status: "scheduled" },
  { id: "g_02", user: "Sara Kim", role: "Tenant Administrator", reason: "Audit support — read-only admin", startsAt: "2026-04-15 09:00", endsAt: "2026-04-22 17:00", status: "active" },
  { id: "g_03", user: "Henrik Olsen", role: "Collection Supervisor", reason: "Q1 close-out — payment posting review", startsAt: "2026-04-01 09:00", endsAt: "2026-04-10 17:00", status: "expired" },
];

export const tenantAudit: AuditEntry[] = [
  { id: "pa_01", ts: "12 min ago", actor: "Maya Lindstrom", target: "Role: Senior Collection Agent", action: "Permission added", severity: "info", before: ["debtor.view", "debtor.edit"], after: ["debtor.view", "debtor.edit", "debtor.bulk"], ip: "72.14.18.22" },
  { id: "pa_02", ts: "38 min ago", actor: "Maya Lindstrom", target: "User: Marcus Webb", action: "Role assignment changed", severity: "info", before: ["Collection Agent"], after: ["Collection Agent", "QA Reviewer"], ip: "72.14.18.22" },
  { id: "pa_03", ts: "1h ago", actor: "Maya Lindstrom", target: "Role: Legal Attorney", action: "Legal authorization granted", severity: "critical", after: ["status.legal", "credential_required"], ip: "72.14.18.22" },
  { id: "pa_04", ts: "2h ago", actor: "System", target: "User: Lia Nakamura", action: "Account auto-deactivated (21d inactive)", severity: "warning", ip: "—" },
  { id: "pa_05", ts: "3h ago", actor: "Aisha Bello", target: "Team: RBC Recovery Team", action: "Capacity increased 40 → 50", severity: "info", before: ["capacity:40"], after: ["capacity:50"], ip: "199.7.140.14" },
  { id: "pa_06", ts: "5h ago", actor: "Maya Lindstrom", target: "API Key: Compromised — incident #441", action: "API key revoked", severity: "critical", ip: "72.14.18.22" },
  { id: "pa_07", ts: "8h ago", actor: "Maya Lindstrom", target: "Tenant security settings", action: "Required 2FA for all admin roles", severity: "info", ip: "72.14.18.22" },
];
