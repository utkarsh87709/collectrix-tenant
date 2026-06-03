// Epic 13 — Disclosure tracking engine

import { useSyncExternalStore } from "react";
import { getDisclosures } from "./compliance-store";
import type { Disclosure } from "./compliance-mock";

export type DisclosureLog = {
  id: string;
  debtorId: string;
  disclosureCode: string;
  channel: "call" | "email" | "sms" | "letter";
  jurisdictionCode: string;
  providedAt: string;
  providedBy: string;
};

let logs: DisclosureLog[] = [
  { id: "dl-1", debtorId: "1", disclosureCode: "MINI_MIRANDA", channel: "call",
    jurisdictionCode: "FDCPA", providedAt: new Date(Date.now() - 86400000).toISOString(), providedBy: "Sarah K." },
];

const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

export function useDisclosureLogs(debtorId?: string): DisclosureLog[] {
  const all = useSyncExternalStore(subscribe, () => logs, () => logs);
  return debtorId ? all.filter((l) => l.debtorId === debtorId) : all;
}

export function logDisclosure(input: Omit<DisclosureLog, "id" | "providedAt"> & { providedAt?: string }): DisclosureLog {
  const next: DisclosureLog = {
    id: `dl-${Date.now()}`, providedAt: input.providedAt ?? new Date().toISOString(), ...input,
  };
  logs = [next, ...logs]; emit(); return next;
}

export function requiredDisclosuresFor(
  jurisdictionCodes: string[],
  channel: "call" | "email" | "sms" | "letter",
): Disclosure[] {
  const all = getDisclosures();
  return all.filter((d) =>
    d.required &&
    d.channels.includes(channel) &&
    d.jurisdictions.some((j) => jurisdictionCodes.includes(j))
  );
}

export function disclosureCoverage(
  debtorId: string,
  jurisdictionCodes: string[],
  channel: "call" | "email" | "sms" | "letter",
): { required: Disclosure[]; provided: Set<string>; missing: Disclosure[] } {
  const required = requiredDisclosuresFor(jurisdictionCodes, channel);
  const provided = new Set(
    logs.filter((l) => l.debtorId === debtorId && l.channel === channel).map((l) => l.disclosureCode)
  );
  const missing = required.filter((r) => !provided.has(r.code));
  return { required, provided, missing };
}
