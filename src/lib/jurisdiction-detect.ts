// Epic 13 — Jurisdiction detection from address & phone

import { areaCodeMap, jurisdictionFromPostal } from "./compliance-mock";
import { findJurisdiction } from "./compliance-store";

export type DetectionInput = {
  postal?: string;
  province?: string;
  state?: string;
  country?: string;
  phone?: string;
};

export type DetectionResult = {
  primary: string;        // jurisdiction code
  federal: string;        // FDCPA or CDSSA
  source: "address" | "phone" | "fallback";
  mismatch: boolean;
  details: { fromAddress: string | null; fromPhone: string | null };
};

const PROVINCE_MAP: Record<string, string> = {
  ON: "ON", ONTARIO: "ON",
  QC: "QC", QUEBEC: "QC", "QUÉBEC": "QC",
  CA: "CA", CALIFORNIA: "CA",
  NY: "NY", "NEW YORK": "NY",
};

export function detectJurisdiction(input: DetectionInput): DetectionResult {
  let fromAddress: string | null = null;
  if (input.province) fromAddress = PROVINCE_MAP[input.province.toUpperCase()] ?? null;
  if (!fromAddress && input.state) fromAddress = PROVINCE_MAP[input.state.toUpperCase()] ?? null;
  if (!fromAddress && input.postal) fromAddress = jurisdictionFromPostal(input.postal);

  let fromPhone: string | null = null;
  if (input.phone) {
    const digits = input.phone.replace(/\D/g, "");
    const area = digits.length >= 10 ? digits.slice(-10, -7) : null;
    if (area) fromPhone = areaCodeMap[area] ?? null;
  }

  const primary = fromAddress ?? fromPhone ?? "FDCPA";
  const j = findJurisdiction(primary);
  const federal = j?.country === "Canada" ? "CDSSA" : "FDCPA";
  const mismatch = !!(fromAddress && fromPhone && fromAddress !== fromPhone);

  return {
    primary,
    federal,
    source: fromAddress ? "address" : fromPhone ? "phone" : "fallback",
    mismatch,
    details: { fromAddress, fromPhone },
  };
}
