// Per-field validation for debtor profile edits.
// Returns null when valid, otherwise a human-readable error message.

export type FieldValidator = (raw: string) => string | null;

const empty: FieldValidator = () => null; // optional fields

const maxLen = (n: number): FieldValidator => (v) =>
  v.length > n ? `Must be ${n} characters or fewer.` : null;

const compose = (...vs: FieldValidator[]): FieldValidator => (v) => {
  for (const fn of vs) {
    const err = fn(v);
    if (err) return err;
  }
  return null;
};

const optional = (fn: FieldValidator): FieldValidator => (v) =>
  v.trim() === "" ? null : fn(v.trim());

// --- Specific validators ---

const email: FieldValidator = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : "Enter a valid email address.";

// Canadian SIN: 9 digits, optionally separated by spaces or dashes. Luhn check.
const sin: FieldValidator = (v) => {
  const digits = v.replace(/[\s-]/g, "");
  if (!/^\d{9}$/.test(digits)) return "SIN must be 9 digits (e.g. 123-456-789).";
  // Luhn
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = parseInt(digits[i], 10);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0 ? null : "Invalid SIN (checksum failed).";
};

// Canadian postal code: A1A 1A1
const postalCA: FieldValidator = (v) =>
  /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(v.trim())
    ? null
    : "Enter a valid Canadian postal code (e.g. M5V 1K4).";

// North American phone: accepts +1, parens, spaces, dashes; must contain 10 digits
const phone: FieldValidator = (v) => {
  const digits = v.replace(/\D/g, "");
  if (digits.length === 10 || (digits.length === 11 && digits.startsWith("1"))) return null;
  return "Enter a valid 10-digit phone number.";
};

// ISO date or common formats parseable by Date
const dateField: FieldValidator = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "Enter a valid date (YYYY-MM-DD)." : null;
};

// Money: digits with optional decimal & currency symbols/commas
const money: FieldValidator = (v) => {
  const cleaned = v.replace(/[$,\s]/g, "");
  return /^-?\d+(\.\d{1,2})?$/.test(cleaned)
    ? null
    : "Enter a valid amount (e.g. 1500 or 1500.00).";
};

const percent: FieldValidator = (v) => {
  const cleaned = v.replace(/[%\s]/g, "");
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? null : "Enter a valid number (e.g. 5.25).";
};

// VIN: 17 chars, no I, O, Q
const vin: FieldValidator = (v) =>
  /^[A-HJ-NPR-Z0-9]{17}$/i.test(v.trim())
    ? null
    : "VIN must be 17 characters (no I, O, or Q).";

// Driver's licence: 5–20 alphanumerics + dashes
const dl: FieldValidator = (v) =>
  /^[A-Za-z0-9-]{5,20}$/.test(v.trim())
    ? null
    : "Driver's licence must be 5–20 letters/numbers.";

// Province: 2-letter Canadian code OR full word
const province: FieldValidator = (v) => {
  const codes = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];
  const t = v.trim().toUpperCase();
  if (codes.includes(t)) return null;
  if (/^[A-Za-z\s]{3,40}$/.test(v.trim())) return null;
  return "Enter a province (e.g. ON or Ontario).";
};

const RULES: Record<string, FieldValidator> = {
  email: optional(email),
  co_email: optional(email),
  sin: optional(sin),
  co_sin: optional(sin),
  postal_code: optional(postalCA),
  co_postal_code: optional(postalCA),
  courthouse_postal_code: optional(postalCA),
  home_no: optional(phone),
  cell_no: optional(phone),
  poe_no: optional(phone),
  co_home_no: optional(phone),
  co_cell_no: optional(phone),
  co_poe_no: optional(phone),
  dob: optional(dateField),
  co_dob: optional(dateField),
  delinquency_date: optional(dateField),
  charged_off_date: optional(dateField),
  date_of_last_payment: optional(dateField),
  principal: optional(money),
  last_payment_amount: optional(money),
  interest_rate: optional(percent),
  vin: optional(vin),
  dl: optional(dl),
  co_dl: optional(dl),
  province: optional(province),
  co_province: optional(province),
  courthouse_province: optional(province),
};

const DEFAULT = compose(maxLen(500), empty);

export function validateField(key: string, value: string): string | null {
  const fn = RULES[key] ?? DEFAULT;
  // Always enforce length cap on top of specific rules
  const lenErr = maxLen(500)(value);
  if (lenErr) return lenErr;
  return fn(value);
}
