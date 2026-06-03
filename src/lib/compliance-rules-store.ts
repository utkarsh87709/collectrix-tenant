// Tenant-managed AI compliance rules — what the AI agent must follow.
// Lightweight Zustand-style store backed by localStorage.

import { useSyncExternalStore } from "react";

export type ComplianceRuleCategory =
  | "calling_hours"
  | "contact_frequency"
  | "language_tone"
  | "prohibited_topics"
  | "required_disclosures"
  | "escalation"
  | "data_handling"
  | "custom";

export type ComplianceRuleSeverity = "block" | "warn" | "advise";

export type ComplianceRule = {
  id: string;
  title: string;
  category: ComplianceRuleCategory;
  severity: ComplianceRuleSeverity;
  instruction: string; // the natural-language rule the AI must follow
  appliesTo: ("voice" | "sms" | "email" | "letter")[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

const KEY = "collectrix.compliance.rules.v1";

const SEED: ComplianceRule[] = [
  {
    id: "cr-seed-1",
    title: "Respect calling hours (8am–9pm local)",
    category: "calling_hours",
    severity: "block",
    instruction: "Do not initiate or continue any outbound contact attempt outside 8:00 AM and 9:00 PM in the debtor's local time zone. If the time falls outside this window, end the call politely and reschedule.",
    appliesTo: ["voice", "sms"],
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cr-seed-2",
    title: "Provide mini-Miranda disclosure on every call",
    category: "required_disclosures",
    severity: "block",
    instruction: "At the start of every voice interaction, state: 'This is an attempt to collect a debt and any information obtained will be used for that purpose.' Confirm the disclosure was delivered before proceeding.",
    appliesTo: ["voice"],
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cr-seed-3",
    title: "Never threaten legal action you cannot take",
    category: "prohibited_topics",
    severity: "block",
    instruction: "Do not threaten lawsuits, arrest, wage garnishment, or property seizure unless legal counsel has explicitly authorized that action for this account.",
    appliesTo: ["voice", "sms", "email", "letter"],
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cr-seed-4",
    title: "Honor cease & desist immediately",
    category: "escalation",
    severity: "block",
    instruction: "If the debtor states (in any language) that they want communications to stop, that they have an attorney, or invokes 'cease and desist', record the request, end the interaction politely, and pause all outbound channels.",
    appliesTo: ["voice", "sms", "email"],
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cr-seed-5",
    title: "Maintain professional, empathetic tone",
    category: "language_tone",
    severity: "warn",
    instruction: "Speak professionally and empathetically. Do not raise voice, use sarcasm, profanity, or accusatory language. Acknowledge hardship when expressed.",
    appliesTo: ["voice", "sms", "email"],
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cr-seed-6",
    title: "Limit contact attempts to 3 per week",
    category: "contact_frequency",
    severity: "block",
    instruction: "Do not attempt more than 3 contact attempts (across all channels combined) per debtor per 7-day rolling window unless the debtor has opted in to additional contact.",
    appliesTo: ["voice", "sms", "email"],
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let state: ComplianceRule[] = (() => {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : SEED;
  } catch {
    return SEED;
  }
})();

const listeners = new Set<() => void>();
const persist = () => {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
};
const emit = () => { persist(); listeners.forEach((l) => l()); };

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const getSnapshot = () => state;

export function useComplianceRules() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function addComplianceRule(input: Omit<ComplianceRule, "id" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const rule: ComplianceRule = { ...input, id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: now, updatedAt: now };
  state = [rule, ...state];
  emit();
  return rule;
}

export function updateComplianceRule(id: string, patch: Partial<Omit<ComplianceRule, "id" | "createdAt">>) {
  state = state.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r));
  emit();
}

export function deleteComplianceRule(id: string) {
  state = state.filter((r) => r.id !== id);
  emit();
}

export function toggleComplianceRule(id: string) {
  state = state.map((r) => (r.id === id ? { ...r, enabled: !r.enabled, updatedAt: new Date().toISOString() } : r));
  emit();
}

export const CATEGORY_META: Record<ComplianceRuleCategory, { label: string; description: string }> = {
  calling_hours: { label: "Calling hours", description: "When the AI can / cannot contact debtors" },
  contact_frequency: { label: "Contact frequency", description: "How often debtors can be contacted" },
  language_tone: { label: "Language & tone", description: "How the AI should speak and write" },
  prohibited_topics: { label: "Prohibited topics", description: "Things the AI must never say or threaten" },
  required_disclosures: { label: "Required disclosures", description: "Statements the AI must always include" },
  escalation: { label: "Escalation triggers", description: "When the AI must hand off or stop" },
  data_handling: { label: "Data handling", description: "How sensitive data must be treated" },
  custom: { label: "Custom", description: "Tenant-specific rule that doesn't fit other categories" },
};
