// Epic 15 — Payment status card on debtor profile

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { Wallet, Calendar, AlertTriangle, Handshake, Pencil } from "lucide-react";
import { toast } from "sonner";
import { usePlans, useInstallments, useSettlements, useNSF, paymentsSummary, planComplianceSummary } from "@/lib/payments-store";

const PLAN_STATUS_OPTIONS = ["active", "completed", "defaulted", "cancelled", "on_hold"] as const;

export function PaymentStatusCard({ debtorId }: { debtorId: string }) {
  const plans = usePlans(debtorId);
  const allInst = useInstallments();
  const settlements = useSettlements(debtorId);
  const nsfs = useNSF(debtorId);
  const ps = paymentsSummary(debtorId);

  const activePlan = plans.find((p) => p.status === "active") ?? plans[0];
  const planInst = activePlan ? allInst.filter((i) => i.planId === activePlan.id) : [];
  const planSum = activePlan ? planComplianceSummary(activePlan.id) : null;
  const nextDue = planInst.find((i) => i.status === "scheduled" || i.status === "partial" || i.status === "due");

  const activeSettlement = settlements.find((s) => s.status === "accepted" || s.status === "offered");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(activePlan?.status ?? "active");

  const saveStatus = () => {
    if (activePlan) {
      activePlan.status = draft as typeof activePlan.status;
    }
    setEditing(false);
    toast.success(`Payment status updated to ${draft.replace("_", " ")}`);
  };

  return (
    <PageCard>
      <CardHead
        title="Payment Status"
        subtitle="Plans · settlements · NSF history"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setDraft(activePlan?.status ?? "active"); setEditing(true); }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-xs font-semibold hover:bg-muted"
            >
              <Pencil className="h-3 w-3" /> Update
            </button>
            <Link to="/tenant/payments" className="text-xs font-semibold text-tenant hover:underline inline-flex items-center gap-1">
              <Wallet className="h-3 w-3" /> Open hub
            </Link>
          </div>
        }
      />
      <div className="px-6 py-4 space-y-3 text-sm">
        {editing && (
          <div className="rounded-lg border border-tenant/40 bg-tenant/5 p-3 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Update payment status</div>
            <select
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm outline-none"
            >
              {PLAN_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md border border-border text-xs hover:bg-muted">Cancel</button>
              <button onClick={saveStatus} className="px-3 py-1.5 rounded-md bg-gradient-tenant text-white text-xs font-semibold">Save</button>
            </div>
          </div>
        )}
        {nsfs.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-semibold text-destructive">{nsfs.length} NSF event{nsfs.length === 1 ? "" : "s"} on file</div>
              <div className="text-muted-foreground">Payment method flagged for re-collection scrutiny.</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <Calendar className="h-3.5 w-3.5" /> Active plan
            </div>
            {activePlan && planSum ? (
              <>
                <div className="font-display text-2xl font-bold mt-1">{planSum.onTimeRate}%</div>
                <Pill tone={planSum.onTimeRate >= 75 ? "success" : planSum.onTimeRate >= 50 ? "warning" : "danger"}>{activePlan.cadence}</Pill>
                <div className="text-xs text-muted-foreground mt-1">
                  {planSum.paid}/{planSum.total} paid
                  {nextDue && ` · next ${new Date(nextDue.dueDate).toLocaleDateString()}`}
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground mt-1">No active plan</div>
            )}
          </div>

          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <Handshake className="h-3.5 w-3.5" /> Settlement
            </div>
            {activeSettlement ? (
              <>
                <div className="font-display text-2xl font-bold mt-1">${activeSettlement.settlementAmount.toLocaleString()}</div>
                <Pill tone={activeSettlement.status === "accepted" ? "tenant" : "muted"}>{activeSettlement.status}</Pill>
                <div className="text-xs text-muted-foreground mt-1">deadline {new Date(activeSettlement.deadline).toLocaleDateString()}</div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground mt-1">No active settlement</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Lifetime:</span>
          <Pill tone="success">${ps.totalCleared.toLocaleString()} cleared</Pill>
          {ps.reversed > 0 && <Pill tone="danger">{ps.reversed} reversed</Pill>}
          {ps.pending > 0 && <Pill tone="info">{ps.pending} pending</Pill>}
        </div>
      </div>
    </PageCard>
  );
}
