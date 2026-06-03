// Global notification center — Phase 1, in-memory + localStorage.
// Categories are deliberately limited to high-signal events. Outbound AI
// messages do NOT generate notifications (client feedback: noise).
import { useSyncExternalStore } from "react";

export type NotificationCategory =
  | "inbound_sms"
  | "inbound_email"
  | "inbound_call"
  | "after_hours_message"
  | "debtor_callback_request"
  | "ai_transfer_failed"
  | "validation_warning"
  | "payment_reported"
  | "payment_posted"
  | "assignment_changed"
  | "dispute_raised";

export type Notification = {
  id: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  debtorId?: string;
  debtorName?: string;
  href?: string;
  createdAt: string;          // ISO
  read: boolean;
  severity: "info" | "success" | "warning" | "danger";
};

const LS_KEY = "collectrix.notifications.v1";

function loadInitial(): Notification[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Notification[];
  } catch { /* noop */ }
  return SEED;
}

const SEED: Notification[] = [
  { id: "n_s1", category: "inbound_sms", severity: "info",
    title: "Inbound SMS from Janelle Carter",
    body: "Can I pay half this week and the rest next month?",
    debtorId: "d_10421", debtorName: "Janelle Carter",
    href: "/tenant/debtors/d_10421",
    createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(), read: false },
  { id: "n_s2", category: "debtor_callback_request", severity: "warning",
    title: "Callback requested by Marcus Webb",
    body: "Prefers Thursday after 5pm.",
    debtorId: "d_10422", debtorName: "Marcus Webb",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), read: false },
  { id: "n_s3", category: "payment_reported", severity: "success",
    title: "Payment reported by agent",
    body: "$250 ACH — needs finance posting.",
    debtorId: "d_10421", debtorName: "Janelle Carter",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), read: true },
];

let state: Notification[] = loadInitial();
const listeners = new Set<() => void>();

function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* noop */ } }
function emit() { for (const l of listeners) l(); persist(); }

export function useNotifications(): Notification[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
    () => state,
  );
}

export function unreadCount(): number {
  return state.filter((n) => !n.read).length;
}

export function notify(input: Omit<Notification, "id" | "createdAt" | "read"> & { read?: boolean }): Notification {
  const next: Notification = {
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    read: input.read ?? false,
    ...input,
  };
  state = [next, ...state].slice(0, 200);
  emit();
  return next;
}

export function markRead(id: string) {
  state = state.map((n) => (n.id === id ? { ...n, read: true } : n));
  emit();
}
export function markAllRead() {
  state = state.map((n) => ({ ...n, read: true }));
  emit();
}
export function clearAll() {
  state = [];
  emit();
}

export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  inbound_sms: "Inbound SMS",
  inbound_email: "Inbound email",
  inbound_call: "Inbound call",
  after_hours_message: "After-hours message",
  debtor_callback_request: "Callback request",
  ai_transfer_failed: "AI transfer failed",
  validation_warning: "Validation warning",
  payment_reported: "Payment reported",
  payment_posted: "Payment posted",
  assignment_changed: "Assignment changed",
  dispute_raised: "Dispute raised",
};
