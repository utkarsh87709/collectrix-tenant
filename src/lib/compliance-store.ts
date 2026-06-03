// Epic 13 — Compliance store: jurisdictions, disclosures, prohibited practices

import { useSyncExternalStore } from "react";
import {
  seedJurisdictions, seedDisclosures, seedProhibitedPractices,
  type Jurisdiction, type Disclosure, type ProhibitedPractice,
} from "./compliance-mock";

let jurisdictions: Jurisdiction[] = seedJurisdictions.map((j) => ({ ...j }));
let disclosures: Disclosure[] = [...seedDisclosures];
let practices: ProhibitedPractice[] = [...seedProhibitedPractices];

const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

// ── Jurisdictions
export function useJurisdictions(): Jurisdiction[] {
  return useSyncExternalStore(subscribe, () => jurisdictions, () => jurisdictions);
}
export function getJurisdictions() { return jurisdictions; }
export function findJurisdiction(code: string) { return jurisdictions.find((j) => j.code === code); }
export function updateJurisdiction(code: string, patch: Partial<Jurisdiction>): boolean {
  const idx = jurisdictions.findIndex((j) => j.code === code);
  if (idx === -1) return false;
  jurisdictions = jurisdictions.map((j) => (j.code === code ? { ...j, ...patch, code: j.code } : j));
  emit(); return true;
}
export function toggleJurisdiction(code: string) {
  const j = findJurisdiction(code); if (!j) return;
  updateJurisdiction(code, { enabled: !j.enabled });
}

// ── Disclosures
export function useDisclosures(): Disclosure[] {
  return useSyncExternalStore(subscribe, () => disclosures, () => disclosures);
}
export function getDisclosures() { return disclosures; }
export function addDisclosure(input: Partial<Disclosure>): Disclosure {
  const code = input.code ?? `CUSTOM_${disclosures.length + 1}`;
  const next: Disclosure = {
    code, title: input.title ?? "New disclosure",
    text: input.text ?? "—", channels: input.channels ?? ["email"],
    jurisdictions: input.jurisdictions ?? [], required: input.required ?? false,
  };
  disclosures = [...disclosures, next]; emit(); return next;
}
export function updateDisclosure(code: string, patch: Partial<Disclosure>): boolean {
  const idx = disclosures.findIndex((d) => d.code === code);
  if (idx === -1) return false;
  disclosures = disclosures.map((d) => (d.code === code ? { ...d, ...patch, code: d.code } : d));
  emit(); return true;
}
export function deleteDisclosure(code: string): boolean {
  disclosures = disclosures.filter((d) => d.code !== code); emit(); return true;
}

// ── Prohibited practices
export function useProhibitedPractices(): ProhibitedPractice[] {
  return useSyncExternalStore(subscribe, () => practices, () => practices);
}
export function getProhibitedPractices() { return practices; }
export function addProhibitedPractice(input: Partial<ProhibitedPractice>): ProhibitedPractice {
  const code = input.code ?? `PP_${practices.length + 1}`;
  const next: ProhibitedPractice = {
    code, label: input.label ?? "New practice", severity: input.severity ?? "medium",
    keywords: input.keywords ?? [], jurisdictions: input.jurisdictions ?? [],
  };
  practices = [...practices, next]; emit(); return next;
}
export function updateProhibitedPractice(code: string, patch: Partial<ProhibitedPractice>): boolean {
  const idx = practices.findIndex((p) => p.code === code);
  if (idx === -1) return false;
  practices = practices.map((p) => (p.code === code ? { ...p, ...patch, code: p.code } : p));
  emit(); return true;
}
export function deleteProhibitedPractice(code: string): boolean {
  practices = practices.filter((p) => p.code !== code); emit(); return true;
}
