// Epic 13 — Prohibited practice text scanner

import { getProhibitedPractices } from "./compliance-store";

export type PracticeViolation = {
  code: string;
  label: string;
  severity: "high" | "medium" | "low";
  matched: string[];
};

export function scanText(text: string, jurisdictionCodes: string[]): PracticeViolation[] {
  const lower = text.toLowerCase();
  const practices = getProhibitedPractices().filter((p) =>
    p.jurisdictions.some((j) => jurisdictionCodes.includes(j))
  );
  const out: PracticeViolation[] = [];
  for (const p of practices) {
    const matched = p.keywords.filter((k) => k && lower.includes(k.toLowerCase()));
    if (matched.length > 0) {
      out.push({ code: p.code, label: p.label, severity: p.severity, matched });
    }
  }
  return out;
}
