import { useSyncExternalStore } from "react";

export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "currency"
  | "dropdown"
  | "multiselect"
  | "boolean"
  | "file"
  | "masked";

export type CustomField = {
  id: string;
  key: string; // snake_case storage key
  label: string;
  type: CustomFieldType;
  required: boolean;
  validation?: string; // regex or rule description
  visibleToRoles: string[]; // empty = all
  readOnly: boolean;
  options?: string[]; // for dropdown / multiselect
  importMapping?: string;
  crmMapping?: string;
  useInDedupe: boolean;
  useInVerification: boolean;
  useInReporting: boolean;
  createdAt: string;
};

const KEY = "collectrix.customFields";

const DEFAULTS: CustomField[] = [
  {
    id: "cf_vip",
    key: "vip_client",
    label: "VIP client",
    type: "boolean",
    required: false,
    visibleToRoles: [],
    readOnly: false,
    useInDedupe: false,
    useInVerification: false,
    useInReporting: true,
    crmMapping: "Debtor.VIP_FLAG",
    createdAt: "2026-04-10",
  },
  {
    id: "cf_court",
    key: "court_jurisdiction",
    label: "Court jurisdiction",
    type: "dropdown",
    required: false,
    visibleToRoles: ["Legal", "Manager"],
    readOnly: false,
    options: ["ON Small Claims", "BC Civil", "AB Provincial", "QC Civil"],
    useInDedupe: false,
    useInVerification: true,
    useInReporting: true,
    createdAt: "2026-03-22",
  },
];

let cache: CustomField[] | null = null;

function load(): CustomField[] {
  if (cache) return cache;
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as CustomField[]) : DEFAULTS;
  } catch {
    cache = DEFAULTS;
  }
  return cache!;
}

function save(next: CustomField[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useCustomFields(): CustomField[] {
  return useSyncExternalStore(subscribe, load, () => DEFAULTS);
}

export function addCustomField(f: Omit<CustomField, "id" | "createdAt">) {
  const next: CustomField = {
    ...f,
    id: `cf_${Date.now()}`,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  save([...load(), next]);
}

export function updateCustomField(id: string, patch: Partial<CustomField>) {
  save(load().map((f) => (f.id === id ? { ...f, ...patch } : f)));
}

export function deleteCustomField(id: string) {
  save(load().filter((f) => f.id !== id));
}

// --- per-debtor values (mock) ---
const VKEY = "collectrix.customFieldValues";
type ValueMap = Record<string, Record<string, unknown>>; // debtorId -> key -> value
let vcache: ValueMap | null = null;
function loadValues(): ValueMap {
  if (vcache) return vcache;
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(VKEY);
    vcache = raw ? (JSON.parse(raw) as ValueMap) : {};
  } catch {
    vcache = {};
  }
  return vcache!;
}
function saveValues(next: ValueMap) {
  vcache = next;
  try {
    localStorage.setItem(VKEY, JSON.stringify(next));
  } catch {}
  vlisteners.forEach((l) => l());
}
const vlisteners = new Set<() => void>();
function vsubscribe(l: () => void) {
  vlisteners.add(l);
  return () => vlisteners.delete(l);
}
const EMPTY: Record<string, unknown> = Object.freeze({});
export function useDebtorCustomValues(debtorId: string): Record<string, unknown> {
  return useSyncExternalStore(
    vsubscribe,
    () => loadValues()[debtorId] ?? EMPTY,
    () => EMPTY
  );
}
export function setDebtorCustomValue(debtorId: string, key: string, value: unknown) {
  const all = loadValues();
  saveValues({ ...all, [debtorId]: { ...(all[debtorId] ?? {}), [key]: value } });
}
