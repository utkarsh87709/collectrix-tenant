import { useState, type ReactNode } from "react";
import { preActionCheck, type Channel } from "@/lib/compliance-orchestrator";
import { detectJurisdiction } from "@/lib/jurisdiction-detect";
import { logAudit } from "@/lib/compliance-audit-store";
import { recordContact } from "@/lib/frequency-limit-engine";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pill } from "@/components/tenant/ui";
import { ShieldCheck, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";

export function CallTimeGuard({
  debtorId, channel, address, phone, actor = "Current Agent", actorRole = "agent",
  onProceed, children,
}: {
  debtorId: string;
  channel: Channel;
  address: { postal?: string; province?: string; state?: string; country?: string };
  phone?: string;
  actor?: string;
  actorRole?: "agent" | "supervisor" | "compliance" | "admin";
  onProceed: () => void;
  children: (open: () => void) => ReactNode;
}) {
  const [openDialog, setOpenDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const detection = detectJurisdiction({ ...address, phone });
  const codes = [detection.primary, detection.federal].filter((v, i, a) => a.indexOf(v) === i);
  const result = preActionCheck({ debtorId, channel, jurisdictionCodes: codes });

  const handleAttempt = () => {
    if (result.allowed) {
      logAudit({ debtorId, actor, actorRole, action: `outbound_${channel}`, decision: "allowed",
        jurisdictionCode: detection.primary, ruleCode: "PRE_ACTION_CHECK" });
      if (channel !== "letter") recordContact({ debtorId, channel, jurisdictionCode: detection.primary });
      onProceed();
      return;
    }
    setOpenDialog(true);
  };

  const handleOverride = () => {
    if (!overrideReason.trim()) return toast.error("Override reason required");
    if (!["supervisor", "compliance", "admin"].includes(actorRole)) {
      return toast.error(`Override requires supervisor/compliance/admin role (you are ${actorRole})`);
    }
    logAudit({
      debtorId, actor, actorRole, action: `outbound_${channel}`, decision: "override",
      jurisdictionCode: detection.primary, ruleCode: "PRE_ACTION_CHECK",
      reason: `OVERRIDE: ${overrideReason} | Blockers: ${result.blockers.join("; ")}`,
    });
    if (channel !== "letter") recordContact({ debtorId, channel, jurisdictionCode: detection.primary });
    setOpenDialog(false); setOverrideReason("");
    onProceed();
    toast.success("Override recorded in audit log");
  };

  const handleBlock = () => {
    logAudit({ debtorId, actor, actorRole, action: `outbound_${channel}`, decision: "blocked",
      jurisdictionCode: detection.primary, ruleCode: "PRE_ACTION_CHECK",
      reason: result.blockers.join("; ") });
    setOpenDialog(false);
    toast.error("Action blocked — audit logged");
  };

  return (
    <>
      {children(handleAttempt)}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" /> Compliance check failed
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">Channel: <code className="bg-muted px-1 rounded">{channel}</code> · Jurisdictions: {codes.join(", ")}</div>
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
              <div className="text-xs uppercase tracking-wider font-semibold text-destructive">Blockers</div>
              {result.blockers.map((b, i) => (
                <div key={i} className="text-xs flex items-start gap-1.5"><Pill tone="danger">{i + 1}</Pill>{b}</div>
              ))}
            </div>
            {result.warnings.length > 0 && (
              <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-1">
                <div className="text-xs uppercase tracking-wider font-semibold text-warning"><AlertTriangle className="inline h-3 w-3" /> Warnings</div>
                {result.warnings.map((w, i) => <div key={i} className="text-xs">{w}</div>)}
              </div>
            )}
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Supervisor / compliance override (optional, audited)
              </label>
              <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}
                rows={2} placeholder="Reason for override…"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm" />
              <div className="text-[10px] text-muted-foreground mt-1">
                Your role: <code className="bg-muted px-1 rounded">{actorRole}</code> — overrides require supervisor / compliance / admin.
              </div>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <button onClick={handleBlock}
              className="px-4 py-2 rounded-lg bg-muted text-sm font-semibold hover:bg-muted/70">Cancel & log block</button>
            <button onClick={handleOverride}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold">
              <ShieldCheck className="h-4 w-4" /> Override & proceed
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
