// Frontend-only assignment store (mock). Models debtor ownership,
// configurable assignment rules, AI-assisted routing suggestions,
// team structure, and a reassignment audit history. Real RLS and
// rule execution will live in Supabase — this file is the UI contract.

import { useSyncExternalStore } from "react";
import { debtors } from "./intake-mock";

// ─────────────────────────────────────────────────────────────────────────────
// Reference data — agents, managers, teams, creditors, AI agents
// ─────────────────────────────────────────────────────────────────────────────

export type Person = { id: string; name: string; email?: string };

export type AgentProfile = Person & {
  languages: string[];          // ISO-ish: "en", "fr", "es", "zh"
  timezone: string;             // IANA tz
  skills: string[];             // "legal", "high_value", "telco", "auto", "skip_trace"
  specializations: string[];    // creditor or industry tags
  capacity: number;             // max active files
  currentLoad: number;          // active files now
  available: boolean;           // online / on-shift
  seniority: "junior" | "senior" | "supervisor";
};

export type Team = {
  id: string;
  name: string;
  description?: string;
  managerId: string | null;
  agentIds: string[];
  creditorIds: string[];
  creditors: string[];
  capacity: number;            // total active files team can hold
  escalationOwnerId: string | null;
  active: boolean;
  isolation: "siloed" | "readonly" | "supervisor" | "shared";
};

export type Creditor = { id: string; name: string; creditor: string; teamIds: string[] };

export const agents: AgentProfile[] = [
  { id: "u_agent_01", name: "Maya Lindstrom", email: "maya@collectrix.app", languages: ["en", "sv"], timezone: "America/Toronto", skills: ["high_value", "skip_trace"], specializations: ["RBC", "BMO"], capacity: 80, currentLoad: 54, available: true, seniority: "senior" },
  { id: "u_agent_02", name: "Jordan Reyes", email: "jordan@collectrix.app", languages: ["en", "es"], timezone: "America/Toronto", skills: ["telco"], specializations: ["Rogers"], capacity: 60, currentLoad: 42, available: true, seniority: "junior" },
  { id: "u_agent_03", name: "Nikolai Petrov", email: "niko@collectrix.app", languages: ["en", "ru"], timezone: "America/Toronto", skills: ["legal"], specializations: ["Scotiabank"], capacity: 40, currentLoad: 35, available: true, seniority: "senior" },
  { id: "u_agent_04", name: "Imani Okafor", email: "imani@collectrix.app", languages: ["en", "fr"], timezone: "America/Toronto", skills: ["high_value"], specializations: ["RBC"], capacity: 70, currentLoad: 12, available: true, seniority: "senior" },
  { id: "u_agent_05", name: "Theo Brouwer", email: "theo@collectrix.app", languages: ["en", "nl", "fr"], timezone: "Europe/Amsterdam", skills: ["telco", "auto"], specializations: ["Rogers", "Scotiabank"], capacity: 60, currentLoad: 28, available: false, seniority: "junior" },
  { id: "u_agent_06", name: "Sarah Bouchard", email: "sarah@collectrix.app", languages: ["fr", "en"], timezone: "America/Toronto", skills: ["legal", "high_value"], specializations: ["RBC", "TD Bank"], capacity: 70, currentLoad: 31, available: true, seniority: "senior" },
];

export const managers: Person[] = [
  { id: "u_mgr_01", name: "Helena Park", email: "helena@collectrix.app" },
  { id: "u_mgr_02", name: "Renée Dubois", email: "renee@collectrix.app" },
  { id: "u_mgr_03", name: "Kenji Watanabe", email: "kenji@collectrix.app" },
];

export const creditors: Creditor[] = [
  { id: "pf_rbc_cc",   name: "RBC – Credit Card",     creditor: "RBC",        teamIds: ["tm_consumer", "tm_high_value"] },
  { id: "pf_td_loans", name: "TD – Personal Loans",   creditor: "TD Bank",    teamIds: ["tm_consumer"] },
  { id: "pf_sco_auto", name: "Scotia – Auto Recovery",creditor: "Scotiabank", teamIds: ["tm_legal"] },
  { id: "pf_bmo_misc", name: "BMO – Misc",            creditor: "BMO",        teamIds: ["tm_consumer"] },
  { id: "pf_rogers",   name: "Rogers Wireless",       creditor: "Rogers",     teamIds: ["tm_telco"] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Teams (rich) — supports manager, agents, creditors, capacity, escalation
// ─────────────────────────────────────────────────────────────────────────────

let teams: Team[] = [
  { id: "tm_consumer", name: "Consumer Recovery", description: "Bulk credit card & personal loan recovery", managerId: "u_mgr_01", agentIds: ["u_agent_01", "u_agent_02", "u_agent_04"], creditorIds: ["pf_rbc_cc", "pf_td_loans", "pf_bmo_misc"], creditors: ["RBC", "TD Bank", "BMO"], capacity: 240, escalationOwnerId: "u_mgr_01", active: true, isolation: "shared" },
  { id: "tm_legal", name: "Legal Queue", description: "Court-eligible / disputed files", managerId: "u_mgr_03", agentIds: ["u_agent_03", "u_agent_06"], creditorIds: ["pf_sco_auto"], creditors: ["Scotiabank"], capacity: 80, escalationOwnerId: "u_mgr_03", active: true, isolation: "siloed" },
  { id: "tm_telco", name: "Telco & Utilities", description: "Telecom & utility wholesale recoveries", managerId: "u_mgr_02", agentIds: ["u_agent_02", "u_agent_05"], creditorIds: ["pf_rogers"], creditors: ["Rogers"], capacity: 120, escalationOwnerId: "u_mgr_02", active: true, isolation: "siloed" },
  { id: "tm_high_value", name: "High-Value Accounts", description: "Balances > $10k, sensitive handling", managerId: "u_mgr_01", agentIds: ["u_agent_01", "u_agent_04", "u_agent_06"], creditorIds: ["pf_rbc_cc"], creditors: ["RBC"], capacity: 60, escalationOwnerId: "u_mgr_01", active: true, isolation: "supervisor" },
];

export function getTeams(): Team[] { return teams; }
export function getTeam(id: string | null): Team | undefined { return id ? teams.find((t) => t.id === id) : undefined; }
export function upsertTeam(t: Team) {
  const i = teams.findIndex((x) => x.id === t.id);
  if (i >= 0) teams = teams.map((x, idx) => (idx === i ? t : x));
  else teams = [t, ...teams];
  emit();
}
export function deleteTeam(id: string) { teams = teams.filter((t) => t.id !== id); emit(); }

export const aiAgents: Person[] = [
  { id: "ai_caller_v3", name: "Aria (voice, EN/FR)" },
  { id: "ai_sms_v2", name: "Echo (SMS nudge)" },
  { id: "ai_email_v2", name: "Lumen (email follow-up)" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Assignment methods, triggers, and configurable rule model
// ─────────────────────────────────────────────────────────────────────────────

export type AssignmentMethod =
  | "manual"
  | "round_robin"
  | "team"
  | "creditor"
  | "geographic"
  | "language"
  | "skill"
  | "ai_priority";

export const ASSIGNMENT_METHODS: { value: AssignmentMethod; label: string; blurb: string }[] = [
  { value: "manual",       label: "Manual",                    blurb: "Admin assigns each file by hand" },
  { value: "round_robin",  label: "Round-robin",               blurb: "Evenly distribute across eligible agents" },
  { value: "team",         label: "Team-based",                blurb: "Route to a specific team's queue" },
  { value: "creditor",     label: "Creditor-based",            blurb: "Match to creditor owner / specialist team(s)" },
  { value: "geographic",   label: "Geographic / time-zone",    blurb: "Route by customer region or agent tz" },
  { value: "language",     label: "Language-based",            blurb: "Match preferred language to agent" },
  { value: "skill",        label: "Skill-based",               blurb: "Match required skill tag to agent" },
  { value: "ai_priority",  label: "AI priority",               blurb: "AI ranks best fit by risk & operational signals" },
];

export type AssignmentTrigger =
  | "on_upload"
  | "on_creation"
  | "on_status_change"
  | "on_escalation"
  | "on_missed_ptp"
  | "on_legal_review"
  | "on_agent_unavailable"
  | "on_workload_imbalance";

export const ASSIGNMENT_TRIGGERS: { value: AssignmentTrigger; label: string }[] = [
  { value: "on_upload",              label: "On customer upload" },
  { value: "on_creation",            label: "On customer creation" },
  { value: "on_status_change",       label: "On status change" },
  { value: "on_escalation",          label: "On escalation" },
  { value: "on_missed_ptp",          label: "On missed promise-to-pay" },
  { value: "on_legal_review",        label: "On legal review trigger" },
  { value: "on_agent_unavailable",   label: "On agent unavailable" },
  { value: "on_workload_imbalance",  label: "On workload imbalance" },
];

export type RuleConditionField =
  | "balance" | "creditor" | "status" | "region" | "language"
  | "flag" | "risk_score" | "contactability" | "tenure_days";

export type RuleConditionOp = "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains" | "in";

export type RuleCondition = { field: RuleConditionField; op: RuleConditionOp; value: string };

export type AssignmentRule = {
  id: string;
  name: string;
  priority: number;                  // lower = higher priority
  active: boolean;
  triggers: AssignmentTrigger[];
  method: AssignmentMethod;
  conditions: RuleCondition[];       // ALL must match
  target: {
    teamId?: string | null;
    agentId?: string | null;
    managerId?: string | null;
  };
  fallbackRuleId?: string | null;    // chain to another rule if this fails
  allowManualOverride: boolean;
};

let rules: AssignmentRule[] = [
  {
    id: "ar_01",
    name: "High-value escalation",
    priority: 1,
    active: true,
    triggers: ["on_upload", "on_status_change"],
    method: "skill",
    conditions: [{ field: "balance", op: "gte", value: "10000" }],
    target: { teamId: "tm_high_value" },
    fallbackRuleId: "ar_04",
    allowManualOverride: true,
  },
  {
    id: "ar_02",
    name: "Legal review routing",
    priority: 2,
    active: true,
    triggers: ["on_legal_review", "on_status_change"],
    method: "team",
    conditions: [{ field: "status", op: "eq", value: "legal" }],
    target: { teamId: "tm_legal", managerId: "u_mgr_03" },
    fallbackRuleId: null,
    allowManualOverride: false,
  },
  {
    id: "ar_03",
    name: "French-language preference",
    priority: 3,
    active: true,
    triggers: ["on_upload", "on_creation"],
    method: "language",
    conditions: [{ field: "language", op: "eq", value: "fr" }],
    target: { agentId: "u_agent_06" },
    fallbackRuleId: "ar_04",
    allowManualOverride: true,
  },
  {
    id: "ar_04",
    name: "Round-robin fallback",
    priority: 4,
    active: true,
    triggers: ["on_upload", "on_creation", "on_agent_unavailable", "on_workload_imbalance"],
    method: "round_robin",
    conditions: [],
    target: { teamId: "tm_consumer" },
    fallbackRuleId: null,
    allowManualOverride: true,
  },
  {
    id: "ar_05",
    name: "Telco specialist routing",
    priority: 5,
    active: true,
    triggers: ["on_upload", "on_creation"],
    method: "creditor",
    conditions: [{ field: "creditor", op: "eq", value: "Rogers" }],
    target: { teamId: "tm_telco" },
    fallbackRuleId: "ar_04",
    allowManualOverride: true,
  },
  {
    id: "ar_06",
    name: "AI-priority for sensitive files",
    priority: 6,
    active: false,
    triggers: ["on_upload"],
    method: "ai_priority",
    conditions: [{ field: "flag", op: "contains", value: "disputed" }],
    target: {},
    fallbackRuleId: "ar_04",
    allowManualOverride: true,
  },
];

export function getRules(): AssignmentRule[] { return [...rules].sort((a, b) => a.priority - b.priority); }
export function upsertRule(r: AssignmentRule) {
  const i = rules.findIndex((x) => x.id === r.id);
  if (i >= 0) rules = rules.map((x, idx) => (idx === i ? r : x));
  else rules = [...rules, r];
  emit();
}
export function deleteRule(id: string) { rules = rules.filter((r) => r.id !== id); emit(); }
export function reorderRules(ids: string[]) {
  rules = ids.map((id, i) => {
    const r = rules.find((x) => x.id === id);
    return r ? { ...r, priority: i + 1 } : null;
  }).filter(Boolean) as AssignmentRule[];
  emit();
}
export function toggleRuleActive(id: string) {
  rules = rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r));
  emit();
}

// ─────────────────────────────────────────────────────────────────────────────
// Assignment record + history
// ─────────────────────────────────────────────────────────────────────────────

export type Assignment = {
  agentId: string | null;
  managerId: string | null;
  teamId: string | null;
  creditorId: string | null;
  aiAgentId: string | null;
};

export type AssignmentHistoryEntry = {
  id: string;
  when: string;
  actor: string;
  field: keyof Assignment;
  from: string | null;
  to: string | null;
  reason?: string;
  source: "round-robin" | "manual" | "import" | "rule" | "ai-routing";
  ruleId?: string;
};

type StoreState = {
  byDebtor: Record<string, Assignment>;
  history: Record<string, AssignmentHistoryEntry[]>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Round-robin helper (cursor preserved between calls)
// ─────────────────────────────────────────────────────────────────────────────

let rrCursor = 0;
function nextAgentRR(pool: string[]): string | null {
  if (pool.length === 0) return null;
  const id = pool[rrCursor % pool.length];
  rrCursor++;
  return id;
}

function inferTeam(creditor: string): string {
  if (creditor === "Rogers") return "tm_telco";
  if (creditor === "Scotiabank") return "tm_legal";
  return "tm_consumer";
}
function inferCreditor(creditor: string): string | null {
  const p = creditors.find((pf) => pf.creditor === creditor);
  return p ? p.id : null;
}
function inferManager(teamId: string): string | null {
  return getTeam(teamId)?.managerId ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed initial assignments
// ─────────────────────────────────────────────────────────────────────────────

// Mock: two debtors arrive without owner info to demonstrate the
// Unassigned / Assignment Issue states surfaced through the UI.
const SEED_UNASSIGNED = new Set(["d_10416"]);          // no owner at all
const SEED_ASSIGNMENT_ISSUE = new Set(["d_10414"]);    // team known, agent missing

function seed(): StoreState {
  const byDebtor: Record<string, Assignment> = {};
  const history: Record<string, AssignmentHistoryEntry[]> = {};
  for (const d of debtors) {
    if (SEED_UNASSIGNED.has(d.id)) {
      byDebtor[d.id] = { agentId: null, managerId: null, teamId: null, creditorId: null, aiAgentId: null };
      history[d.id] = [{
        id: `ah-seed-${d.id}`, when: "at import", actor: "CSV import",
        field: "agentId", from: null, to: null,
        reason: "Upload row had no owner / team / desk — sent to Unassigned Queue",
        source: "import",
      }];
      continue;
    }
    const teamId = inferTeam(d.creditor);
    const creditorId = inferCreditor(d.creditor);
    const managerId = inferManager(teamId);
    const teamAgents = getTeam(teamId)?.agentIds ?? agents.map((a) => a.id);
    const agentId = SEED_ASSIGNMENT_ISSUE.has(d.id) ? null : nextAgentRR(teamAgents);
    byDebtor[d.id] = { agentId, managerId, teamId, creditorId, aiAgentId: null };
    history[d.id] = agentId
      ? [{
          id: `ah-seed-${d.id}`,
          when: "at import",
          actor: "System (round-robin)",
          field: "agentId",
          from: null,
          to: agentId,
          reason: `Auto-assigned via team round-robin (${teamId})`,
          source: "round-robin",
        }]
      : [{
          id: `ah-seed-${d.id}`, when: "at import", actor: "CSV import",
          field: "agentId", from: null, to: null,
          reason: `Team resolved (${teamId}) but no agent available — flagged Assignment Issue`,
          source: "import",
        }];
  }
  return { byDebtor, history };
}

export type AssignmentStatus = "assigned" | "unassigned" | "assignment_issue";

/**
 * Derived assignment status for a debtor:
 *  - assigned         → has an owning agent
 *  - unassigned       → no owner at all (agent, team, manager all empty)
 *  - assignment_issue → partial ownership (e.g. team known but no agent)
 *                       so the record can't be worked yet and needs review
 */
export function getAssignmentStatus(debtorId: string): AssignmentStatus {
  const a = getAssignment(debtorId);
  if (a.agentId) return "assigned";
  if (!a.agentId && !a.teamId && !a.managerId && !a.creditorId) return "unassigned";
  return "assignment_issue";
}

let state: StoreState = seed();
const subscribers = new Set<() => void>();
let rulesSnapshot: AssignmentRule[] | null = null;
let teamsSnapshot: Team[] | null = null;
function emit() {
  rulesSnapshot = null;
  teamsSnapshot = null;
  subscribers.forEach((fn) => fn());
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function getAssignment(debtorId: string): Assignment {
  return state.byDebtor[debtorId] ?? { agentId: null, managerId: null, teamId: null, creditorId: null, aiAgentId: null };
}

export function getAssignmentHistory(debtorId: string): AssignmentHistoryEntry[] {
  return state.history[debtorId] ?? [];
}

export function updateAssignment(
  debtorId: string,
  patch: Partial<Assignment>,
  opts: { actor: string; reason?: string; source?: AssignmentHistoryEntry["source"]; ruleId?: string },
) {
  const prev = getAssignment(debtorId);
  const next: Assignment = { ...prev, ...patch };
  const when = new Date().toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const entries: AssignmentHistoryEntry[] = [];
  (Object.keys(patch) as (keyof Assignment)[]).forEach((field) => {
    if (prev[field] !== next[field]) {
      entries.push({
        id: `ah-${Date.now()}-${field}`,
        when,
        actor: opts.actor,
        field,
        from: prev[field],
        to: next[field],
        reason: opts.reason,
        source: opts.source ?? "manual",
        ruleId: opts.ruleId,
      });
    }
  });
  state = {
    byDebtor: { ...state.byDebtor, [debtorId]: next },
    history: { ...state.history, [debtorId]: [...entries, ...(state.history[debtorId] ?? [])] },
  };
  emit();
}

export function unassign(debtorId: string, actor: string, reason?: string) {
  updateAssignment(debtorId, { agentId: null }, { actor, reason, source: "manual" });
}

export function reassignViaRoundRobin(debtorId: string, actor: string) {
  const a = getAssignment(debtorId);
  const pool = (getTeam(a.teamId)?.agentIds ?? agents.map((x) => x.id));
  const next = nextAgentRR(pool);
  updateAssignment(debtorId, { agentId: next }, { actor, reason: "Re-rolled via round-robin", source: "round-robin" });
}

// ─────────────────────────────────────────────────────────────────────────────
// AI-assisted routing — mock scoring engine
// ─────────────────────────────────────────────────────────────────────────────

export type AISuggestion = {
  agentId: string;
  agentName: string;
  teamId: string | null;
  teamName: string | null;
  managerId: string | null;
  managerName: string | null;
  confidence: number;            // 0..1
  reasons: string[];             // human-readable factors
  factors: { label: string; weight: number; positive: boolean }[];
};

/**
 * Scores every available agent against this debtor and returns the best
 * fit + 2 runners-up. Deterministic given the debtor.id seed so the UI
 * is stable across renders.
 */
export function getAISuggestions(debtorId: string): AISuggestion[] {
  const d = debtors.find((x) => x.id === debtorId);
  if (!d) return [];

  // Derived debtor signals (mocked from existing fields + deterministic hash)
  const seed = debtorId.split("").reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const langPref = (seed % 4 === 0) ? "fr" : "en";
  const region = (seed % 3 === 0) ? "QC" : "ON";
  const requiredSkill: string | null =
    d.balance > 10000 ? "high_value" :
    d.status === "legal" ? "legal" :
    d.creditor === "Rogers" ? "telco" : null;
  const sentiment = (seed % 5 === 0) ? "negative" : "neutral";
  const disputeRisk = d.flags.includes("disputed");
  const ptpRisk = d.status === "ptp" && (seed % 2 === 0);

  return agents
    .filter((a) => a.available)
    .map((a) => {
      const factors: AISuggestion["factors"] = [];
      let score = 0.4; // base

      if (a.languages.includes(langPref)) { score += 0.15; factors.push({ label: `Speaks ${langPref.toUpperCase()}`, weight: 0.15, positive: true }); }
      else                                 { factors.push({ label: `Does not speak ${langPref.toUpperCase()}`, weight: 0.15, positive: false }); }

      if (a.timezone.includes(region === "QC" ? "Toronto" : "Toronto")) { score += 0.05; factors.push({ label: "Time-zone aligned", weight: 0.05, positive: true }); }

      if (requiredSkill && a.skills.includes(requiredSkill)) { score += 0.2; factors.push({ label: `${requiredSkill.replace("_", " ")} specialist`, weight: 0.2, positive: true }); }
      else if (requiredSkill)                                { factors.push({ label: `Missing ${requiredSkill.replace("_", " ")} skill`, weight: 0.2, positive: false }); }

      if (a.specializations.includes(d.creditor))            { score += 0.1; factors.push({ label: `Handles ${d.creditor} creditor`, weight: 0.1, positive: true }); }

      const headroom = 1 - (a.currentLoad / Math.max(a.capacity, 1));
      score += headroom * 0.15;
      factors.push({ label: `Workload ${Math.round((1 - headroom) * 100)}% of capacity`, weight: 0.15, positive: headroom > 0.2 });

      if (disputeRisk && a.skills.includes("legal"))         { score += 0.08; factors.push({ label: "Dispute history — legal-aware", weight: 0.08, positive: true }); }
      if (ptpRisk && a.seniority !== "junior")               { score += 0.05; factors.push({ label: "PTP risk — senior judgment", weight: 0.05, positive: true }); }
      if (sentiment === "negative" && a.seniority === "senior") { score += 0.04; factors.push({ label: "Negative sentiment — senior handler", weight: 0.04, positive: true }); }

      const team = teams.find((t) => t.agentIds.includes(a.id)) ?? null;
      return {
        agentId: a.id,
        agentName: a.name,
        teamId: team?.id ?? null,
        teamName: team?.name ?? null,
        managerId: team?.managerId ?? null,
        managerName: team ? managers.find((m) => m.id === team.managerId)?.name ?? null : null,
        confidence: Math.min(0.99, Math.max(0.05, score)),
        reasons: factors.filter((f) => f.positive).slice(0, 3).map((f) => f.label),
        factors,
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

export function acceptAISuggestion(debtorId: string, suggestion: AISuggestion, actor: string) {
  updateAssignment(
    debtorId,
    { agentId: suggestion.agentId, teamId: suggestion.teamId, managerId: suggestion.managerId },
    { actor, source: "ai-routing", reason: `AI suggested (${Math.round(suggestion.confidence * 100)}% confidence): ${suggestion.reasons.join(", ")}` },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

function subscribe(cb: () => void) { subscribers.add(cb); return () => subscribers.delete(cb); }

export function useAssignment(debtorId: string): Assignment {
  return useSyncExternalStore(subscribe, () => getAssignment(debtorId), () => getAssignment(debtorId));
}
export function useAssignmentHistory(debtorId: string): AssignmentHistoryEntry[] {
  return useSyncExternalStore(subscribe, () => getAssignmentHistory(debtorId), () => getAssignmentHistory(debtorId));
}
export function useRules(): AssignmentRule[] {
  const get = () => (rulesSnapshot ??= getRules());
  return useSyncExternalStore(subscribe, get, get);
}
export function useTeams(): Team[] {
  const get = () => (teamsSnapshot ??= teams);
  return useSyncExternalStore(subscribe, get, get);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────────────────────────

export const agentName = (id: string | null) => agents.find((a) => a.id === id)?.name ?? null;
export const managerName = (id: string | null) => managers.find((m) => m.id === id)?.name ?? null;
export const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? null;
export const creditorName = (id: string | null) => creditors.find((p) => p.id === id)?.name ?? null;
export const aiAgentName = (id: string | null) => aiAgents.find((a) => a.id === id)?.name ?? null;

// ─────────────────────────────────────────────────────────────────────────────
// Visibility scope (UI mock — real enforcement happens in RLS)
// ─────────────────────────────────────────────────────────────────────────────

export type ViewerScope = {
  role: "tenant_admin" | "manager" | "agent" | "client_account_manager";
  userId?: string | null;
  managerId?: string | null;
  teamIds?: string[];
  creditorIds?: string[];
  creditors?: string[];
};

export const currentViewer: ViewerScope = { role: "tenant_admin" };

export function isVisibleTo(debtorId: string, viewer: ViewerScope, creditor: string): boolean {
  if (viewer.role === "tenant_admin") return true;
  const a = getAssignment(debtorId);
  if (viewer.role === "agent") return !!viewer.userId && a.agentId === viewer.userId;
  if (viewer.role === "manager") {
    if (a.managerId && viewer.managerId && a.managerId === viewer.managerId) return true;
    if (a.teamId && viewer.teamIds?.includes(a.teamId)) return true;
    if (a.creditorId && viewer.creditorIds?.includes(a.creditorId)) return true;
    return false;
  }
  if (viewer.role === "client_account_manager") {
    if (a.creditorId && viewer.creditorIds?.includes(a.creditorId)) return true;
    if (viewer.creditors?.includes(creditor)) return true;
    return false;
  }
  return false;
}
