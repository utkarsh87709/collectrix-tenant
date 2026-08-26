// System-defined static debtor status workflow.
// These statuses are global to the platform — tenants cannot create, edit,
// rename or delete them, and cannot change the transition rules.
// Tenant data (debtors, history) remains tenant-scoped.

export type StatusCategory =
  | "intake"        // NEW
  | "collection"    // ACT, PTP, PIF, PPA, PPD
  | "resolved"      // SIF, CLO
  | "risk"          // RTP, DNC
  | "review"        // REV, WEL, UIC
  | "legal";        // PTS, LEG, NAF, CLI, DISC, JDG, POS, WRIT, GAR

export type StatusTone =
  | "muted" | "tenant" | "success" | "warning" | "danger" | "info" | "legal";

export interface StatusCode {
  code: string;
  displayName: string;
  description: string;
  tone: StatusTone;
  icon: string;            // 2–4 char abbreviation
  category: StatusCategory;
  isFinal: boolean;
  requiresApproval: boolean;
  countsAsActive: boolean;
  agingBucket?: string;
  allowedNext: string[];   // codes (REV is auto-added below for non-final)
  custom?: boolean;        // always false in the static engine
}

// Final / terminal statuses (no further transitions).
export const FINAL_STATUSES = ["CLO", "POS", "WRIT", "GAR", "DISC"] as const;

const RAW: Omit<StatusCode, "custom">[] = [
  { code: "NEW",  displayName: "New",                       description: "Newly placed account, awaiting first contact",       tone: "info",    icon: "NEW",  category: "intake",     isFinal: false, requiresApproval: false, countsAsActive: true,  allowedNext: ["ACT"] },
  { code: "ACT",  displayName: "Active",                    description: "In active collection workflow",                      tone: "tenant",  icon: "ACT",  category: "collection", isFinal: false, requiresApproval: false, countsAsActive: true,  allowedNext: ["PIF", "PTP", "SIF", "PPA", "RTP", "DNC", "REV"] },
  { code: "PTP",  displayName: "Promised To Pay",           description: "Customer committed to a payment date",                 tone: "info",    icon: "PTP",  category: "collection", isFinal: false, requiresApproval: false, countsAsActive: true,  allowedNext: ["PPD", "PIF", "BRP", "REV"] },
  { code: "BRP",  displayName: "Broken Promise",            description: "Customer failed to honor a promise to pay",            tone: "warning", icon: "BRP",  category: "collection", isFinal: false, requiresApproval: false, countsAsActive: true,  allowedNext: ["ACT", "PTP", "PPA", "REV"] },
  { code: "PIF",  displayName: "Promised Paid In Full",     description: "Customer committed to full payoff",                    tone: "info",    icon: "PIF",  category: "collection", isFinal: false, requiresApproval: false, countsAsActive: true,  allowedNext: ["CLO", "REV"] },
  { code: "PPA",  displayName: "Payment Plan Agreed",       description: "Active payment plan in place",                       tone: "info",    icon: "PPA",  category: "collection", isFinal: false, requiresApproval: false, countsAsActive: true,  allowedNext: ["PPD", "PIF", "REV"] },
  { code: "PPD",  displayName: "Payment Plan Delinquent",   description: "Payment plan in default",                            tone: "warning", icon: "PPD",  category: "collection", isFinal: false, requiresApproval: false, countsAsActive: true,  allowedNext: ["REV"] },
  { code: "SIF",  displayName: "Settled In Full",           description: "Account settled in full",                            tone: "success", icon: "SIF",  category: "resolved",   isFinal: false, requiresApproval: false, countsAsActive: false, allowedNext: ["CLO", "REV"] },
  { code: "RTP",  displayName: "Refuse To Pay",             description: "Customer refuses payment",                             tone: "danger",  icon: "RTP",  category: "risk",       isFinal: false, requiresApproval: false, countsAsActive: true,  allowedNext: ["REV"] },
  { code: "DNC",  displayName: "Do Not Contact",            description: "Customer invoked do-not-contact",                      tone: "danger",  icon: "DNC",  category: "risk",       isFinal: false, requiresApproval: true,  countsAsActive: false, allowedNext: ["REV"] },
  { code: "REV",  displayName: "Legal Review",              description: "Account under legal review (reachable from any non-final status)", tone: "warning", icon: "REV", category: "review", isFinal: false, requiresApproval: true, countsAsActive: true, allowedNext: ["WEL", "UIC", "PTS"] },
  { code: "WEL",  displayName: "Welfare",                   description: "Customer on welfare — hardship",                       tone: "muted",   icon: "WEL",  category: "review",     isFinal: false, requiresApproval: false, countsAsActive: false, allowedNext: ["CLO"] },
  { code: "UIC",  displayName: "Unemployed",                description: "Customer unemployed — hardship",                       tone: "muted",   icon: "UIC",  category: "review",     isFinal: false, requiresApproval: false, countsAsActive: false, allowedNext: ["CLO"] },
  { code: "PTS",  displayName: "Permission To Sue",         description: "Creditor approved litigation",                       tone: "legal",   icon: "PTS",  category: "legal",      isFinal: false, requiresApproval: true,  countsAsActive: true,  allowedNext: ["LEG"] },
  { code: "LEG",  displayName: "Legal",                     description: "Legal action initiated",                             tone: "legal",   icon: "LEG",  category: "legal",      isFinal: false, requiresApproval: true,  countsAsActive: true,  allowedNext: ["NAF", "CLI", "DISC", "JDG"] },
  { code: "NAF",  displayName: "Notice of Action Filed",    description: "Notice of action filed with the court",              tone: "legal",   icon: "NAF",  category: "legal",      isFinal: false, requiresApproval: true,  countsAsActive: true,  allowedNext: ["CLI"] },
  { code: "CLI",  displayName: "Claim Issued",              description: "Claim issued by the court",                          tone: "legal",   icon: "CLI",  category: "legal",      isFinal: false, requiresApproval: true,  countsAsActive: true,  allowedNext: ["DISC", "JDG"] },
  { code: "DISC", displayName: "Discontinued Claim",        description: "Claim discontinued",                                 tone: "muted",   icon: "DISC", category: "legal",      isFinal: true,  requiresApproval: true,  countsAsActive: false, allowedNext: [] },
  { code: "JDG",  displayName: "Judgement Obtained",        description: "Judgement obtained against customer",                  tone: "legal",   icon: "JDG",  category: "legal",      isFinal: false, requiresApproval: true,  countsAsActive: true,  allowedNext: ["POS", "WRIT", "GAR"] },
  { code: "POS",  displayName: "Power of Sale",             description: "Power of sale enforcement",                          tone: "legal",   icon: "POS",  category: "legal",      isFinal: true,  requiresApproval: true,  countsAsActive: false, allowedNext: [] },
  { code: "WRIT", displayName: "Writ of Execution Issued",  description: "Writ of execution issued",                           tone: "legal",   icon: "WRIT", category: "legal",      isFinal: true,  requiresApproval: true,  countsAsActive: false, allowedNext: [] },
  { code: "GAR",  displayName: "Garnishee Order",           description: "Garnishee order in force",                           tone: "legal",   icon: "GAR",  category: "legal",      isFinal: true,  requiresApproval: true,  countsAsActive: false, allowedNext: [] },
  { code: "CLO",  displayName: "File Closed",               description: "File closed — terminal",                             tone: "muted",   icon: "CLO",  category: "resolved",   isFinal: true,  requiresApproval: false, countsAsActive: false, allowedNext: [] },
];

// Inject REV into every non-final status' allowed-next (Special Rule)
// while never allowing REV out of a final status.
export const statusCodes: StatusCode[] = RAW.map((s) => {
  const next = new Set(s.allowedNext);
  if (!s.isFinal && s.code !== "REV") next.add("REV");
  return { ...s, allowedNext: Array.from(next), custom: false };
});

export const findStatus = (code: string) => statusCodes.find((s) => s.code === code);

export function isFinalStatus(code: string): boolean {
  return statusCodes.find((s) => s.code === code)?.isFinal ?? false;
}

export function getAllowedNext(code: string): StatusCode[] {
  const s = findStatus(code);
  if (!s) return [];
  return s.allowedNext.map(findStatus).filter((x): x is StatusCode => Boolean(x));
}

// ─── Status history (in-memory mock, per-debtor scoped by caller)
export interface StatusEvent {
  id: string;
  when: string;
  fromStatus: string;
  toStatus: string;
  actor: string;
  isSystem: boolean;
  reason: string;
  ref?: string;
}

export const sampleStatusHistory: StatusEvent[] = [
  { id: "se-1", when: "Mar 1, 2026 09:14",  fromStatus: "—",   toStatus: "NEW", actor: "Sarah Mendez", isSystem: false, reason: "Account placed via RBC bulk import" },
  { id: "se-2", when: "Mar 3, 2026 11:02",  fromStatus: "NEW", toStatus: "ACT", actor: "System",       isSystem: true,  reason: "First outbound dial completed" },
  { id: "se-3", when: "Mar 15, 2026 14:38", fromStatus: "ACT", toStatus: "PTP", actor: "John Park",    isSystem: false, reason: "Customer agreed to pay $500 by Mar 25" },
  { id: "se-4", when: "Mar 25, 2026 23:59", fromStatus: "PTP", toStatus: "PPD", actor: "System",       isSystem: true,  reason: "PTP due date passed without payment" },
  { id: "se-5", when: "Mar 27, 2026 10:21", fromStatus: "PPD", toStatus: "REV", actor: "Maya Lindstrom", isSystem: false, reason: "Escalated to legal review" },
];
