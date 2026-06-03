// Epic 13 — Combined pre-action compliance check
// Most-restrictive-wins across hours, frequency, cease.

import { validateCallTime } from "./calling-hours-engine";
import { checkFrequency } from "./frequency-limit-engine";
import { checkCease } from "./cease-desist-store";
import { isCollectionsPaused } from "./debt-validation-store";

export type Channel = "call" | "email" | "sms" | "letter";

export type PreActionContext = {
  debtorId: string;
  channel: Channel;
  jurisdictionCodes: string[]; // [provincial/state, federal]
};

export type PreActionResult = {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
  detail: {
    hours?: ReturnType<typeof validateCallTime>;
    frequency?: ReturnType<typeof checkFrequency>;
    cease?: ReturnType<typeof checkCease>;
    pausedForValidation: boolean;
  };
};

export function preActionCheck(ctx: PreActionContext): PreActionResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const detail: PreActionResult["detail"] = { pausedForValidation: false };

  // Cease check (all channels)
  if (ctx.channel !== "letter") {
    const c = checkCease(ctx.debtorId, ctx.channel);
    detail.cease = c;
    if (c.blocked) blockers.push(c.reason!);
  }

  // Validation pause
  if (isCollectionsPaused(ctx.debtorId)) {
    detail.pausedForValidation = true;
    warnings.push("Collections paused — debt validation in progress (FDCPA)");
  }

  // Calling hours (calls only) — most restrictive across jurisdictions
  if (ctx.channel === "call") {
    for (const code of ctx.jurisdictionCodes) {
      const h = validateCallTime(code);
      if (!h.allowed) blockers.push(`${code}: ${h.reason}`);
      detail.hours = h;
    }
  }

  // Frequency limits — most restrictive
  for (const code of ctx.jurisdictionCodes) {
    const f = checkFrequency(ctx.debtorId, code);
    if (!f.allowed) blockers.push(f.reason!);
    if (f.window !== "none") detail.frequency = f;
  }

  return { allowed: blockers.length === 0, blockers, warnings, detail };
}
