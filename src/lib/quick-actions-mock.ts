// Epic 12 — Quick action templates

import { useSyncExternalStore } from "react";

export type QuickActionStep =
  | { kind: "set_status"; status: string; reason?: string }
  | { kind: "send_email"; templateId: string }
  | { kind: "send_sms"; templateId: string }
  | { kind: "stop_campaigns" }
  | { kind: "sync_crm" }
  | { kind: "create_task"; title: string };

export type QuickAction = {
  id: string;
  name: string;
  icon: string;
  description: string;
  steps: QuickActionStep[];
  undoWindowSec: number;
  custom?: boolean;
};

let actions: QuickAction[] = [
  {
    id: "qa-paid",
    name: "Mark Paid in Full",
    icon: "PD",
    description: "Closes the account, sends thank-you, syncs CRM, stops campaigns.",
    steps: [
      { kind: "set_status", status: "PAID", reason: "PAID_IN_FULL" },
      { kind: "send_email", templateId: "tmpl-thankyou" },
      { kind: "stop_campaigns" },
      { kind: "sync_crm" },
      { kind: "create_task", title: "Send final receipt to client" },
    ],
    undoWindowSec: 300,
  },
  {
    id: "qa-cease",
    name: "Process Cease Request",
    icon: "CS",
    description: "Halts all communication and logs a compliance note.",
    steps: [
      { kind: "set_status", status: "CEASE", reason: "WRITTEN_REQUEST" },
      { kind: "stop_campaigns" },
      { kind: "create_task", title: "Compliance review of cease request" },
      { kind: "sync_crm" },
    ],
    undoWindowSec: 300,
  },
  {
    id: "qa-legal",
    name: "Escalate to Legal",
    icon: "LG",
    description: "Routes the account to legal queue with prerequisite checks.",
    steps: [
      { kind: "set_status", status: "LEGAL" },
      { kind: "send_email", templateId: "tmpl-finaldemand" },
      { kind: "create_task", title: "Legal team review" },
      { kind: "sync_crm" },
    ],
    undoWindowSec: 300,
  },
  {
    id: "qa-uncoll",
    name: "Close as Uncollectable",
    icon: "UC",
    description: "Closes the account as uncollectable and notifies the creditor.",
    steps: [
      { kind: "set_status", status: "CLOSED", reason: "UNCOLLECTABLE" },
      { kind: "stop_campaigns" },
      { kind: "sync_crm" },
      { kind: "create_task", title: "Notify creditor of write-off" },
    ],
    undoWindowSec: 300,
  },
];

const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

export function useQuickActions(): QuickAction[] {
  return useSyncExternalStore(subscribe, () => actions, () => actions);
}
export function getQuickActions() { return actions; }
export function addQuickAction(input: Partial<QuickAction>): QuickAction {
  const next: QuickAction = {
    id: `qa-${Date.now()}`,
    name: input.name ?? "New quick action",
    icon: input.icon ?? "QA",
    description: input.description ?? "",
    steps: input.steps ?? [],
    undoWindowSec: input.undoWindowSec ?? 300,
    custom: true,
  };
  actions = [...actions, next]; emit(); return next;
}
export function updateQuickAction(id: string, patch: Partial<QuickAction>): boolean {
  const idx = actions.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  actions = actions.map((a) => (a.id === id ? { ...a, ...patch, id: a.id } : a));
  emit(); return true;
}
export function deleteQuickAction(id: string): boolean {
  const t = actions.find((a) => a.id === id);
  if (!t || !t.custom) return false;
  actions = actions.filter((a) => a.id !== id); emit(); return true;
}
