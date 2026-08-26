// Mock data for Communications Engine (Epic 5, US-046 → US-058)
export type Channel = "email" | "sms" | "voice" | "letter";
export type TemplateStatus = "active" | "draft" | "archived";

export type Template = {
  id: string;
  name: string;
  channel: Channel;
  category: string;
  subject?: string;
  preview: string;
  variables: string[];
  language: "en" | "fr" | "es";
  status: TemplateStatus;
  updatedAt: string;
  sends30d: number;
  openRate?: number;
  clickRate?: number;
  bounceRate?: number;
  replyRate?: number;
  cost?: string;
};

export const templates: Template[] = [
  { id: "tpl-001", name: "Initial Contact Email — RBC", channel: "email", category: "Initial contact", subject: "Account {{account_number}} — Payment Required", preview: "Dear {{debtor_name}}, your account with {{creditor_client_name}} shows an outstanding balance of {{balance}}…", variables: ["debtor_name","balance","creditor_client_name","account_number","payment_url"], language: "en", status: "active", updatedAt: "2026-04-15", sends30d: 1240, openRate: 48, clickRate: 9, bounceRate: 1.2 },
  { id: "tpl-002", name: "Payment Reminder — 7 day", channel: "email", category: "Payment reminder", subject: "Reminder: payment due in 7 days", preview: "Hi {{debtor_name}}, this is a friendly reminder…", variables: ["debtor_name","balance","due_date","payment_url"], language: "en", status: "active", updatedAt: "2026-04-12", sends30d: 870, openRate: 80, clickRate: 34, bounceRate: 0.8 },
  { id: "tpl-003", name: "Settlement Offer 60%", channel: "email", category: "Settlement offer", subject: "Special offer to resolve your account", preview: "We are authorized to accept {{settlement_offer_amount}} as full settlement…", variables: ["debtor_name","balance","settlement_offer_amount","payment_url"], language: "en", status: "active", updatedAt: "2026-04-10", sends30d: 320, openRate: 67, clickRate: 22, bounceRate: 1.5 },
  { id: "tpl-004", name: "PTP Reminder SMS", channel: "sms", category: "Payment reminder", preview: "Hi {{first_name}}, your promised payment of {{ptp_amount}} is due {{ptp_date}}. Reply Y to confirm.", variables: ["first_name","ptp_amount","ptp_date"], language: "en", status: "active", updatedAt: "2026-04-14", sends30d: 2410, replyRate: 38, cost: "$0.018" },
  { id: "tpl-005", name: "Initial Contact SMS", channel: "sms", category: "Initial contact", preview: "{{first_name}}, you have an account requiring attention. Call {{callback_number}} or pay at {{payment_url}}. Reply STOP to opt out.", variables: ["first_name","callback_number","payment_url"], language: "en", status: "active", updatedAt: "2026-04-09", sends30d: 1880, replyRate: 12, cost: "$0.018" },
  { id: "tpl-006", name: "Voice Script — Payment Reminder", channel: "voice", category: "Payment reminder", preview: "Hello, this is an important call regarding your account ending in {{last4}}…", variables: ["first_name","balance","last4"], language: "en", status: "active", updatedAt: "2026-04-13", sends30d: 540, replyRate: 24 },
  { id: "tpl-007", name: "Demand Letter — Pre-Legal", channel: "letter", category: "Legal notice", preview: "FINAL DEMAND. The above-referenced account remains unpaid…", variables: ["debtor_name","address","balance","creditor_client_name","response_deadline"], language: "en", status: "active", updatedAt: "2026-04-08", sends30d: 89, cost: "$1.85" },
  { id: "tpl-008", name: "Initial Contact — Français", channel: "email", category: "Initial contact", subject: "Compte {{account_number}} — paiement requis", preview: "Cher {{debtor_name}}, votre compte présente un solde impayé…", variables: ["debtor_name","balance","creditor_client_name"], language: "fr", status: "active", updatedAt: "2026-04-11", sends30d: 156, openRate: 52, clickRate: 11, bounceRate: 1.0 },
  { id: "tpl-009", name: "Receipt Confirmation", channel: "email", category: "Receipt confirmation", subject: "Payment received — thank you", preview: "We have received your payment of {{payment_amount}} on {{payment_date}}…", variables: ["debtor_name","payment_amount","payment_date","new_balance"], language: "en", status: "active", updatedAt: "2026-04-07", sends30d: 412, openRate: 91, clickRate: 4, bounceRate: 0.3 },
  { id: "tpl-010", name: "Cease & Desist Acknowledgment", channel: "letter", category: "Compliance", preview: "We acknowledge your written request to cease communications…", variables: ["debtor_name","address","request_date"], language: "en", status: "draft", updatedAt: "2026-04-05", sends30d: 0, cost: "$1.85" },
];

export const VARIABLE_LIBRARY = [
  { key: "{{debtor_name}}", description: "Full customer name", sample: "Jordan Reyes" },
  { key: "{{first_name}}", description: "Customer first name", sample: "Jordan" },
  { key: "{{balance}}", description: "Current outstanding balance", sample: "$2,418.55" },
  { key: "{{account_number}}", description: "Account / file number", sample: "ACC-104822" },
  { key: "{{creditor_client_name}}", description: "Original creditor", sample: "Royal Bank of Canada" },
  { key: "{{due_date}}", description: "Next due date", sample: "May 1, 2026" },
  { key: "{{trust_account_number}}", description: "Trust deposit account", sample: "TR-994201" },
  { key: "{{settlement_offer_amount}}", description: "Authorised settlement", sample: "$1,450.00" },
  { key: "{{payment_url}}", description: "Self-serve portal link", sample: "https://pay.collectrix.ai/r/8K2P" },
  { key: "{{ptp_amount}}", description: "Promised payment", sample: "$500.00" },
  { key: "{{ptp_date}}", description: "Promised payment date", sample: "May 1, 2026" },
  { key: "{{callback_number}}", description: "Callback line", sample: "(416) 555-0199" },
  { key: "{{last4}}", description: "Last 4 of account", sample: "4822" },
  { key: "{{address}}", description: "Mailing address block", sample: "201 King St W, Toronto ON" },
  { key: "{{response_deadline}}", description: "Required response by", sample: "May 14, 2026" },
];

// US-049, US-051, US-053, US-054 — Campaigns
export type Campaign = {
  id: string;
  name: string;
  channel: Channel | "multi";
  status: "draft" | "scheduled" | "running" | "paused" | "complete";
  audience: string;
  audienceCount: number;
  sent: number;
  delivered: number;
  responded: number;
  startedAt: string;
  scheduledFor?: string;
  step?: string;
};

export const campaigns: Campaign[] = [
  { id: "cmp-001", name: "May Statement Cycle", channel: "multi", status: "running", audience: "All ACTIVE in Ontario", audienceCount: 1240, sent: 980, delivered: 945, responded: 312, startedAt: "2026-04-18 09:00", step: "Day 7 — Email reminder + SMS" },
  { id: "cmp-002", name: "Q2 Settlement Push", channel: "email", status: "scheduled", audience: "Balance > $2,000 · 90+ days", audienceCount: 478, sent: 0, delivered: 0, responded: 0, startedAt: "—", scheduledFor: "2026-04-22 09:30" },
  { id: "cmp-003", name: "PTP Confirmation Drip", channel: "sms", status: "running", audience: "PTP status · last 14 days", audienceCount: 312, sent: 312, delivered: 304, responded: 188, startedAt: "2026-04-12 08:00", step: "Day 1 reminder · Day 5 thanks" },
  { id: "cmp-004", name: "March Initial Contact", channel: "multi", status: "complete", audience: "March placements · all", audienceCount: 2104, sent: 2104, delivered: 2052, responded: 612, startedAt: "2026-03-02 09:00" },
  { id: "cmp-005", name: "Pre-Legal Demand Letters", channel: "letter", status: "draft", audience: "60+ DPD · balance > $5,000", audienceCount: 89, sent: 0, delivered: 0, responded: 0, startedAt: "—" },
];

// US-046 → US-049 — Send queue / outbox & history
export type SendEvent = {
  id: string;
  channel: Channel;
  template: string;
  debtor: string;
  status: "queued" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed" | "replied" | "unsubscribed";
  ts: string;
  detail?: string;
};

export const sendHistory: SendEvent[] = [
  { id: "se-1001", channel: "email", template: "Payment Reminder — 7 day", debtor: "Jordan Reyes", status: "opened", ts: "2026-04-20 09:14", detail: "opened 4 min after delivery" },
  { id: "se-1002", channel: "sms", template: "PTP Reminder SMS", debtor: "Priya Singh", status: "delivered", ts: "2026-04-20 09:12" },
  { id: "se-1003", channel: "email", template: "Settlement Offer 60%", debtor: "Marcus Wallace", status: "clicked", ts: "2026-04-20 09:08", detail: "clicked payment link" },
  { id: "se-1004", channel: "sms", template: "Initial Contact SMS", debtor: "Ana Velasquez", status: "replied", ts: "2026-04-20 09:01", detail: "‘Call me after 5pm’" },
  { id: "se-1005", channel: "email", template: "Initial Contact Email — RBC", debtor: "Kenji Tanaka", status: "bounced", ts: "2026-04-20 08:55", detail: "hard bounce — invalid mailbox" },
  { id: "se-1006", channel: "voice", template: "Voice Script — Payment Reminder", debtor: "Diane Holloway", status: "sent", ts: "2026-04-20 08:51", detail: "duration 1m 42s" },
  { id: "se-1007", channel: "letter", template: "Demand Letter — Pre-Legal", debtor: "Rashid Khan", status: "queued", ts: "2026-04-20 08:48", detail: "print queue · ships 4pm" },
  { id: "se-1008", channel: "email", template: "Receipt Confirmation", debtor: "Hannah Olsen", status: "opened", ts: "2026-04-20 08:31" },
  { id: "se-1009", channel: "sms", template: "PTP Reminder SMS", debtor: "Tomas Lindqvist", status: "unsubscribed", ts: "2026-04-20 08:20", detail: "STOP received" },
  { id: "se-1010", channel: "email", template: "Payment Reminder — 7 day", debtor: "Sara Cohen", status: "failed", ts: "2026-04-20 08:14", detail: "provider 5xx · auto-retry queued" },
];

// US-052 — Inbound replies (SMS + email)
export type ReplyLeadStatus = "new" | "active" | "ptp" | "paid" | "legal" | "uncollectable";
export type ReplyFlag = "high-value" | "disputed" | "legal-hold" | "vip";

export type Reply = {
  id: string;
  caseId: string;
  channel: "sms" | "email";
  debtor: string;
  creditor: string;
  preview: string;
  receivedAt: string;
  timestamp: number; // ms epoch for time-range filtering
  intent: "ptp" | "dispute" | "callback" | "stop" | "question" | "payment_made";
  status: ReplyLeadStatus;
  flags: ReplyFlag[];
  unread: boolean;
  unreadCount: number;
};

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.now();

export const replies: Reply[] = [
  { id: "rp-01", caseId: "CASE-104822", channel: "sms", debtor: "Ana Velasquez", creditor: "Maple Bank", preview: "Call me after 5pm please", receivedAt: "9:01 AM", timestamp: NOW - 2 * HOUR, intent: "callback", status: "active", flags: ["high-value"], unread: true, unreadCount: 2 },
  { id: "rp-02", caseId: "CASE-104915", channel: "sms", debtor: "Marcus Wallace", creditor: "Northstar Credit", preview: "I can pay $400 on Friday", receivedAt: "8:47 AM", timestamp: NOW - 3 * HOUR, intent: "ptp", status: "ptp", flags: [], unread: true, unreadCount: 1 },
  { id: "rp-03", caseId: "CASE-105011", channel: "email", debtor: "Kenji Tanaka", creditor: "Pacific Auto Finance", preview: "I have already paid this account on March 12 — see attached.", receivedAt: "8:32 AM", timestamp: NOW - 4 * HOUR, intent: "dispute", status: "active", flags: ["disputed"], unread: true, unreadCount: 3 },
  { id: "rp-04", caseId: "CASE-103221", channel: "sms", debtor: "Tomas Lindqvist", creditor: "Maple Bank", preview: "STOP", receivedAt: "8:20 AM", timestamp: NOW - 5 * HOUR, intent: "stop", status: "uncollectable", flags: ["legal-hold"], unread: false, unreadCount: 0 },
  { id: "rp-05", caseId: "CASE-102887", channel: "email", debtor: "Hannah Olsen", creditor: "Summit Utilities", preview: "Thanks — confirming my payment went through.", receivedAt: "Yesterday", timestamp: NOW - 1 * DAY, intent: "payment_made", status: "paid", flags: [], unread: false, unreadCount: 0 },
  { id: "rp-06", caseId: "CASE-104102", channel: "sms", debtor: "Diane Holloway", creditor: "Northstar Credit", preview: "Who is calling me?", receivedAt: "Yesterday", timestamp: NOW - 1 * DAY - 2 * HOUR, intent: "question", status: "new", flags: [], unread: false, unreadCount: 0 },
];

// US-053 — Compliance violations & DNC
export type ComplianceEvent = {
  id: string;
  type: "dnc_block" | "rate_limit" | "outside_hours" | "unsubscribe" | "cease_request" | "abusive_lang";
  channel: Channel;
  debtor: string;
  ts: string;
  detail: string;
  severity: "info" | "warning" | "critical";
};

export const complianceEvents: ComplianceEvent[] = [
  { id: "ce-01", type: "dnc_block", channel: "voice", debtor: "Sara Cohen", ts: "2026-04-20 09:02", detail: "Outbound call blocked — customer on internal DNC", severity: "warning" },
  { id: "ce-02", type: "rate_limit", channel: "email", debtor: "Marcus Wallace", ts: "2026-04-20 08:42", detail: "3rd email today blocked (max 3/day)", severity: "info" },
  { id: "ce-03", type: "outside_hours", channel: "voice", debtor: "Diane Holloway", ts: "2026-04-19 21:14", detail: "Call attempt outside 8am–9pm window — blocked", severity: "warning" },
  { id: "ce-04", type: "cease_request", channel: "letter", debtor: "Rashid Khan", ts: "2026-04-19 14:11", detail: "Written cease & desist received — all channels suspended", severity: "critical" },
  { id: "ce-05", type: "unsubscribe", channel: "email", debtor: "Tomas Lindqvist", ts: "2026-04-19 09:30", detail: "Email opt-out via footer link", severity: "info" },
  { id: "ce-06", type: "abusive_lang", channel: "voice", debtor: "Brian Walsh", ts: "2026-04-18 16:22", detail: "AI flagged caller language — sent to QA queue", severity: "warning" },
];

export const dncList = [
  { id: "dnc-01", debtor: "Sara Cohen", channel: "voice", reason: "Verbal DNC request", addedAt: "2026-03-04", addedBy: "Agent: J. Owens" },
  { id: "dnc-02", debtor: "Tomas Lindqvist", channel: "email", reason: "Footer unsubscribe", addedAt: "2026-04-19", addedBy: "system" },
  { id: "dnc-03", debtor: "Rashid Khan", channel: "all", reason: "Written cease & desist", addedAt: "2026-04-19", addedBy: "Compliance: M. Lindstrom" },
  { id: "dnc-04", debtor: "Lena Park", channel: "sms", reason: "STOP keyword", addedAt: "2026-04-12", addedBy: "system" },
  { id: "dnc-05", debtor: "Brian Walsh", channel: "voice", reason: "Attorney rep — direct contact only", addedAt: "2026-04-08", addedBy: "Legal: A. Patel" },
];

// US-051 — Bulk operations
export type BulkJob = {
  id: string;
  name: string;
  channel: Channel;
  template: string;
  audience: number;
  sent: number;
  failed: number;
  status: "queued" | "running" | "complete" | "failed";
  startedAt: string;
  finishedAt?: string;
};

export const bulkJobs: BulkJob[] = [
  { id: "bj-01", name: "April reminder blast", channel: "email", template: "Payment Reminder — 7 day", audience: 1240, sent: 1212, failed: 28, status: "complete", startedAt: "2026-04-19 09:00", finishedAt: "2026-04-19 09:24" },
  { id: "bj-02", name: "PTP confirmation SMS", channel: "sms", template: "PTP Reminder SMS", audience: 312, sent: 240, failed: 4, status: "running", startedAt: "2026-04-20 09:00" },
  { id: "bj-03", name: "Demand letter print run", channel: "letter", template: "Demand Letter — Pre-Legal", audience: 89, sent: 0, failed: 0, status: "queued", startedAt: "—" },
  { id: "bj-04", name: "Settlement offer wave", channel: "email", template: "Settlement Offer 60%", audience: 478, sent: 478, failed: 11, status: "complete", startedAt: "2026-04-18 14:00", finishedAt: "2026-04-18 14:11" },
];

// US-054 — A/B tests
export const abTests = [
  { id: "ab-01", name: "Subject A vs B — Initial Contact", channel: "email", variantA: "Account {{account_number}} — Payment Required", variantB: "Action needed on your {{creditor_client_name}} account", aOpen: 38, bOpen: 51, aClick: 6, bClick: 11, sample: 800, winner: "B", confidence: 96 },
  { id: "ab-02", name: "SMS tone — formal vs friendly", channel: "sms", variantA: "You have an outstanding balance…", variantB: "Hey {{first_name}}, quick reminder…", aOpen: 0, bOpen: 0, aClick: 14, bClick: 22, sample: 600, winner: "B", confidence: 88 },
  { id: "ab-03", name: "Voice opener length", channel: "voice", variantA: "12-word opener", variantB: "8-word opener", aOpen: 0, bOpen: 0, aClick: 28, bClick: 34, sample: 400, winner: "tie", confidence: 62 },
];

// US-046 → US-058 — Channel KPIs for analytics
export const channelKpis = {
  email: { sends: 4218, delivered: 4081, open: 47, click: 11, bounce: 1.4, unsub: 0.6 },
  sms: { sends: 6120, delivered: 6012, replyRate: 22, optOut: 0.8, cost: "$110.16" },
  voice: { attempts: 1402, connected: 612, rpc: 38, avgDuration: "1m 47s", flagged: 0.6 },
  letter: { sends: 312, delivered: 298, returned: 4.2, costPerPiece: "$1.85" },
};

// US-049, US-050 — Letter print queue
export const letterQueue = [
  { id: "lt-01", debtor: "Rashid Khan", template: "Demand Letter — Pre-Legal", status: "queued", scheduledShip: "2026-04-20 16:00", trackingNumber: "—" },
  { id: "lt-02", debtor: "Marcus Wallace", template: "Settlement Offer 60%", status: "printed", scheduledShip: "2026-04-19 16:00", trackingNumber: "9405 5118 9956 4321 0001 23" },
  { id: "lt-03", debtor: "Diane Holloway", template: "Demand Letter — Pre-Legal", status: "shipped", scheduledShip: "2026-04-18 16:00", trackingNumber: "9405 5118 9956 4321 0001 17" },
  { id: "lt-04", debtor: "Brian Walsh", template: "Cease & Desist Acknowledgment", status: "delivered", scheduledShip: "2026-04-17 16:00", trackingNumber: "9405 5118 9956 4321 0001 09" },
];
