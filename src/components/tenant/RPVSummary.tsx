// Compact RPV summary card — surfaces the verification state recorded by RPVCard
// without duplicating the full workflow. Reads the same localStorage key.
import { useEffect, useState } from "react";
import { ShieldCheck, Bot, User, ArrowRight } from "lucide-react";
import { Pill } from "@/components/tenant/ui";

type Verifier = "ai" | "human";
type Outcome = "verified" | "failed" | "refused" | "transferred" | "pending";
type RPVState = {
  status: Outcome;
  verifiedBy?: Verifier;
  verifiedFields: string[];
  failedAttempts: number;
  finalOutcome?: Outcome;
  transferReason?: string;
  otherMethod?: string;
  lastUpdated?: string;
};

const LS_PREFIX = "collectrix.rpv.v1.";
const EMPTY: RPVState = { status: "pending", verifiedFields: [], failedAttempts: 0 };

const TONE: Record<Outcome, "muted" | "tenant" | "success" | "warning" | "danger" | "info"> = {
  pending: "muted",
  verified: "success",
  failed: "danger",
  refused: "warning",
  transferred: "info",
};

export function RPVSummary({ debtorId, onOpen }: { debtorId: string; onOpen?: () => void }) {
  const [s, setS] = useState<RPVState>(EMPTY);
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(LS_PREFIX + debtorId) : null;
      setS(raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY);
    } catch { setS(EMPTY); }
  }, [debtorId]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-elegant px-5 py-4 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2 min-w-[180px]">
        <ShieldCheck className="h-4 w-4 text-tenant" />
        <span className="text-sm font-semibold">Right Party Verification</span>
        <Pill tone={TONE[s.status]}>{s.status.toUpperCase()}</Pill>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">By:</span>
        {s.verifiedBy
          ? <span className="inline-flex items-center gap-1">{s.verifiedBy === "ai" ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}{s.verifiedBy === "ai" ? "AI" : "Human agent"}</span>
          : <span>—</span>}
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Fields:</span>{" "}
        {s.verifiedFields.length ? s.verifiedFields.length : "0"} verified
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Failed:</span>{" "}
        <span className={s.failedAttempts > 0 ? "text-destructive font-semibold" : ""}>{s.failedAttempts}</span>
      </div>
      {s.transferReason && (
        <div className="text-xs text-warning-foreground truncate max-w-[280px]" title={s.transferReason}>
          ⚠ {s.transferReason}
        </div>
      )}
      {s.otherMethod && (
        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
          <span className="font-semibold text-foreground">Other:</span> {s.otherMethod}
        </div>
      )}
      <div className="ml-auto flex items-center gap-3">
        {s.lastUpdated && (
          <span className="text-[11px] text-muted-foreground">Updated {new Date(s.lastUpdated).toLocaleString()}</span>
        )}
        {onOpen && (
          <button onClick={onOpen} className="text-xs font-semibold text-tenant hover:underline inline-flex items-center gap-1">
            Open RPV <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
