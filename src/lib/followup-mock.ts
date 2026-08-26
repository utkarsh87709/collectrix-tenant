// Epic 7 — Follow-Up & Escalation Automation mock data
// US-076 (follow-up queue, callbacks, no-contact escalation, settlement countdown)
// US-077 (PTP/BRP detection, tone tiers, BRP analytics)
// US-078 (aging-stage rules engine)

export type ActionType = "callback" | "ptp_check" | "ptp_reminder" | "settlement_expiry" | "brp_followup" | "no_contact_escalation";
export type ActionPriority = "high" | "normal" | "low";
export type ActionStatus = "due_today" | "upcoming" | "overdue" | "complete" | "cancelled";

export type FollowUpAction = {
  id: string;
  type: ActionType;
  debtorId: string;
  debtorName: string;
  account: string;
  due: string; // ISO
  priority: ActionPriority;
  assignee: string; // user or queue
  status: ActionStatus;
  notes: string;
  amount?: number;
};

export const followUpActions: FollowUpAction[] = [
  { id: "fa_001", type: "callback", debtorId: "d_201", debtorName: "John Smith", account: "AC-9921", due: "2026-04-20T14:00:00Z", priority: "high", assignee: "Maya Lindstrom", status: "due_today", notes: "Customer requested callback to discuss payment plan", amount: 1240 },
  { id: "fa_002", type: "ptp_check", debtorId: "d_202", debtorName: "Hannah Chen", account: "AC-1042", due: "2026-04-20T09:00:00Z", priority: "high", assignee: "Queue: Senior", status: "due_today", notes: "PTP $500 due today — verify payment", amount: 500 },
  { id: "fa_003", type: "settlement_expiry", debtorId: "d_203", debtorName: "Marcus Webb", account: "AC-3380", due: "2026-04-20T23:59:00Z", priority: "high", assignee: "Queue: Recovery", status: "due_today", notes: "Settlement offer 80% ($800) expires tonight", amount: 800 },
  { id: "fa_004", type: "ptp_reminder", debtorId: "d_204", debtorName: "Aisha Patel", account: "AC-7711", due: "2026-04-21T10:00:00Z", priority: "normal", assignee: "Maya Lindstrom", status: "upcoming", notes: "Send reminder 1 day before PTP ($350 due 4/22)", amount: 350 },
  { id: "fa_005", type: "callback", debtorId: "d_205", debtorName: "Diego Ramirez", account: "AC-6650", due: "2026-04-21T16:30:00Z", priority: "normal", assignee: "Maya Lindstrom", status: "upcoming", notes: "Wants to discuss settlement", amount: 2400 },
  { id: "fa_006", type: "callback", debtorId: "d_206", debtorName: "Linda O'Brien", account: "AC-2208", due: "2026-04-19T11:00:00Z", priority: "high", assignee: "Maya Lindstrom", status: "overdue", notes: "MISSED — customer expecting call yesterday", amount: 980 },
  { id: "fa_007", type: "ptp_check", debtorId: "d_207", debtorName: "Robert Kim", account: "AC-1188", due: "2026-04-19T09:00:00Z", priority: "high", assignee: "Queue: Senior", status: "overdue", notes: "PTP not verified — likely BRP candidate", amount: 1100 },
  { id: "fa_008", type: "no_contact_escalation", debtorId: "d_208", debtorName: "Tara Williams", account: "AC-5544", due: "2026-04-22T12:00:00Z", priority: "normal", assignee: "Queue: Supervisor", status: "upcoming", notes: "5 failed contact attempts — needs supervisor review", amount: 670 },
  { id: "fa_009", type: "brp_followup", debtorId: "d_209", debtorName: "Chris Bennett", account: "AC-8800", due: "2026-04-22T14:00:00Z", priority: "high", assignee: "Maya Lindstrom", status: "upcoming", notes: "2nd broken promise — firmer tone required", amount: 1850 },
  { id: "fa_010", type: "ptp_reminder", debtorId: "d_210", debtorName: "Sandra Lee", account: "AC-9090", due: "2026-04-23T10:00:00Z", priority: "normal", assignee: "Queue: Junior", status: "upcoming", notes: "PTP $200 due 4/24", amount: 200 },
  { id: "fa_011", type: "callback", debtorId: "d_211", debtorName: "Anthony Russo", account: "AC-3331", due: "2026-04-24T15:00:00Z", priority: "low", assignee: "Maya Lindstrom", status: "upcoming", notes: "General inquiry callback", amount: 420 },
  { id: "fa_012", type: "settlement_expiry", debtorId: "d_212", debtorName: "Grace Liu", account: "AC-4400", due: "2026-04-25T23:59:00Z", priority: "normal", assignee: "Queue: Recovery", status: "upcoming", notes: "70% settlement offer expires Friday", amount: 1400 },
];

// US-077 — PTP / BRP records
export type PTPStatus = "active" | "kept" | "broken" | "expired";
export type PTPRecord = {
  id: string;
  debtorId: string;
  debtorName: string;
  amount: number;
  promisedDate: string; // ISO
  status: PTPStatus;
  brpCount: number; // total broken promises by this debtor
  arrangedAt: string;
  channel: "ai_call" | "agent" | "self_service";
  brokenReason?: "hardship" | "technical" | "bad_faith" | "forgot" | null;
};

export const ptpRecords: PTPRecord[] = [
  { id: "ptp_01", debtorId: "d_202", debtorName: "Hannah Chen", amount: 500, promisedDate: "2026-04-20", status: "active", brpCount: 0, arrangedAt: "2026-04-15", channel: "ai_call" },
  { id: "ptp_02", debtorId: "d_207", debtorName: "Robert Kim", amount: 1100, promisedDate: "2026-04-19", status: "broken", brpCount: 1, arrangedAt: "2026-04-12", channel: "agent", brokenReason: "forgot" },
  { id: "ptp_03", debtorId: "d_209", debtorName: "Chris Bennett", amount: 1850, promisedDate: "2026-04-18", status: "broken", brpCount: 2, arrangedAt: "2026-04-10", channel: "ai_call", brokenReason: "hardship" },
  { id: "ptp_04", debtorId: "d_220", debtorName: "Erica Holt", amount: 350, promisedDate: "2026-04-15", status: "kept", brpCount: 0, arrangedAt: "2026-04-08", channel: "self_service" },
  { id: "ptp_05", debtorId: "d_221", debtorName: "Marcus Webb", amount: 600, promisedDate: "2026-04-17", status: "broken", brpCount: 3, arrangedAt: "2026-04-09", channel: "ai_call", brokenReason: "bad_faith" },
  { id: "ptp_06", debtorId: "d_222", debtorName: "Priya Singh", amount: 250, promisedDate: "2026-04-22", status: "active", brpCount: 0, arrangedAt: "2026-04-19", channel: "ai_call" },
  { id: "ptp_07", debtorId: "d_223", debtorName: "James Foster", amount: 900, promisedDate: "2026-04-23", status: "active", brpCount: 1, arrangedAt: "2026-04-16", channel: "agent" },
  { id: "ptp_08", debtorId: "d_224", debtorName: "Olivia Garcia", amount: 1200, promisedDate: "2026-04-14", status: "kept", brpCount: 0, arrangedAt: "2026-04-07", channel: "ai_call" },
];

export const brpMetrics = {
  totalActivePTP: 456,
  brokenThisMonth: 89,
  breakRate: 19.5, // %
  avgDaysToBreak: 12,
  byCount: { one: 67, two: 18, threePlus: 4 },
  recovery: { firstBRP: 45, secondBRP: 22, thirdPlusBRP: 8 }, // % eventually pay
  byDayOfWeek: [
    { day: "Mon", rate: 14 },
    { day: "Tue", rate: 16 },
    { day: "Wed", rate: 18 },
    { day: "Thu", rate: 19 },
    { day: "Fri", rate: 28 }, // payday — highest
    { day: "Sat", rate: 22 },
    { day: "Sun", rate: 17 },
  ],
  byAmount: [
    { bucket: "$0-100", rate: 9 },
    { bucket: "$100-200", rate: 12 },
    { bucket: "$200-500", rate: 18 },
    { bucket: "$500+", rate: 31 },
  ],
  byEmployment: { employed: 15, unemployed: 35 },
  insights: [
    "Friday promises break 2× more than Monday — push customers to commit on Mondays",
    "Promises >$500 break at 31% — break large amounts into multi-payment plans",
    "Unemployed cohort BRP rate is 35% — require down-payment for high-risk segment",
    "Recovery after 3rd BRP is only 8% — escalate to legal track sooner",
  ],
};

// US-077 — Tone-tier templates
export const brpToneTiers = [
  {
    tier: 1,
    label: "Empathetic",
    when: "1st broken promise",
    sample: "Hi {name}, we noticed we did not receive your payment of ${amount}. Is everything okay? We are here to help work something out.",
  },
  {
    tier: 2,
    label: "Firm",
    when: "2nd broken promise",
    sample: "Hi {name}, this is the second missed payment commitment on your account. We need to resolve this today — please call us back.",
  },
  {
    tier: 3,
    label: "Stern",
    when: "3rd+ broken promise",
    sample: "{name}, you have broken 3 payment promises. If we cannot reach an arrangement today, this account will be escalated to our legal department.",
  },
];

// US-078 — Aging stages
export type AgingStage = {
  id: string;
  label: string;
  range: string;
  callCadence: string;
  emailCadence: string;
  smsEnabled: boolean;
  maxTouchesPerWeek: number;
  settlementAuthorized: boolean;
  settlementDiscount?: number; // % off
  legalEnabled: boolean;
  enabled: boolean;
};

export const agingStages: AgingStage[] = [
  { id: "stage_early", label: "Early", range: "0–30 days", callCadence: "Every 7 days", emailCadence: "Every 5 days", smsEnabled: false, maxTouchesPerWeek: 2, settlementAuthorized: false, legalEnabled: false, enabled: true },
  { id: "stage_mid", label: "Mid", range: "31–60 days", callCadence: "Every 5 days", emailCadence: "Every 3 days", smsEnabled: true, maxTouchesPerWeek: 3, settlementAuthorized: false, legalEnabled: false, enabled: true },
  { id: "stage_late", label: "Late", range: "61–90 days", callCadence: "Every 3 days", emailCadence: "Daily", smsEnabled: true, maxTouchesPerWeek: 5, settlementAuthorized: true, settlementDiscount: 20, legalEnabled: false, enabled: true },
  { id: "stage_pre_legal", label: "Pre-legal", range: "91–120 days", callCadence: "Every 2 days (attorney)", emailCadence: "Final demand letter", smsEnabled: true, maxTouchesPerWeek: 6, settlementAuthorized: true, settlementDiscount: 30, legalEnabled: true, enabled: true },
  { id: "stage_legal", label: "Legal", range: "120+ days", callCadence: "Attorney only", emailCadence: "Lawsuit-track", smsEnabled: false, maxTouchesPerWeek: 0, settlementAuthorized: true, settlementDiscount: 35, legalEnabled: true, enabled: true },
];

// US-076 — Callback queue (subset of follow-up actions, callback type)
export type Callback = {
  id: string;
  debtorId: string;
  debtorName: string;
  scheduledFor: string;
  assignee: string;
  priority: ActionPriority;
  notes: string;
  status: "scheduled" | "completed" | "missed";
  outcome?: string;
};

export const callbacks: Callback[] = [
  { id: "cb_01", debtorId: "d_201", debtorName: "John Smith", scheduledFor: "2026-04-20T14:00:00Z", assignee: "Maya Lindstrom", priority: "high", notes: "Discuss payment plan", status: "scheduled" },
  { id: "cb_02", debtorId: "d_205", debtorName: "Diego Ramirez", scheduledFor: "2026-04-21T16:30:00Z", assignee: "Maya Lindstrom", priority: "normal", notes: "Settlement discussion", status: "scheduled" },
  { id: "cb_03", debtorId: "d_206", debtorName: "Linda O'Brien", scheduledFor: "2026-04-19T11:00:00Z", assignee: "Maya Lindstrom", priority: "high", notes: "MISSED yesterday", status: "missed" },
  { id: "cb_04", debtorId: "d_211", debtorName: "Anthony Russo", scheduledFor: "2026-04-24T15:00:00Z", assignee: "Maya Lindstrom", priority: "low", notes: "General inquiry", status: "scheduled" },
  { id: "cb_05", debtorId: "d_230", debtorName: "Felicia Adams", scheduledFor: "2026-04-18T10:00:00Z", assignee: "Maya Lindstrom", priority: "normal", notes: "Completed — PTP $200/mo arranged", status: "completed", outcome: "PTP arranged" },
];

// Queue summary (for the dashboard tile)
export const queueSummary = {
  todayDue: 25,
  todayPTPChecks: 12,
  todaySettlementExpiries: 5,
  tomorrow: 26,
  thisWeek: 67,
  overdueCallbacks: 3,
  overduePTPChecks: 2,
};
