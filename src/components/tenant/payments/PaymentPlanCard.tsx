// Promise to Pay — debtor commits to pay later. Separate from Payment Verification (which requires proof).

import { useMemo, useState } from "react";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { CalendarClock, AlertTriangle, CheckCircle2, BellRing, Info } from "lucide-react";
import { toast } from "sonner";
import {
  usePaymentPlans, addPaymentPlan, updatePaymentPlan, removePaymentPlan, followUpState,
  type PaymentPlan, type PaymentMethod,
} from "@/lib/payments-split-store";

const STATUS_TONE: Record<PaymentPlan["status"], Parameters<typeof Pill>[0]["tone"]> = {
  active: "success", pending: "warning", defaulted: "danger", cancelled: "muted", completed: "info",
};

const FU_TONE: Record<ReturnType<typeof followUpState>, Parameters<typeof Pill>[0]["tone"]> = {
  overdue: "danger", due_today: "warning", upcoming: "info", none: "muted",
};
const FU_LABEL: Record<ReturnType<typeof followUpState>, string> = {
  overdue: "Follow-up overdue", due_today: "Follow-up due today", upcoming: "Follow-up upcoming", none: "No follow-up set",
};

export function PaymentPlanCard({ debtorId }: { debtorId: string }) {
  const plans = usePaymentPlans(debtorId);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [freq, setFreq] = useState<PaymentPlan["frequency"]>("one_time");
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [followUp, setFollowUp] = useState("");
  const [note, setNote] = useState("");

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid promise amount"); return; }
    addPaymentPlan({
      debtorId, installmentAmount: amt, promisedDate: date, frequency: freq,
      paymentMethod: method, followUpDate: followUp || undefined,
      status: "pending", commitmentNote: note || undefined, createdBy: "Current Agent",
    });
    setAmount(""); setNote(""); setFollowUp(""); toast.success("Promise to pay recorded");
  };

  return (
    <PageCard>
      <CardHead title="Promise to Pay" subtitle="Customer commits to pay later — no proof required. Use Payment Verification when proof is provided." />
      <div className="px-6 py-4 space-y-4 text-sm">
        <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 p-2.5 text-xs text-info-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>A promise to pay does <span className="font-semibold">not</span> change the balance. Reminders & follow-ups are driven by the follow-up date.</div>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Record promise to pay</div>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Promise amount
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$"
                className="w-full mt-1 px-2 py-1.5 rounded-md bg-background border border-border text-sm outline-none" />
            </label>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Promise date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 rounded-md bg-background border border-border text-sm outline-none" />
            </label>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Cadence
              <select value={freq} onChange={(e) => setFreq(e.target.value as PaymentPlan["frequency"])}
                className="w-full mt-1 px-2 py-1.5 rounded-md bg-background border border-border text-sm outline-none">
                <option value="one_time">One-time</option><option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option><option value="monthly">Monthly</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Payment method
              <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full mt-1 px-2 py-1.5 rounded-md bg-background border border-border text-sm outline-none">
                <option value="bank_transfer">Bank transfer</option><option value="ach">ACH</option><option value="wire">Wire</option>
                <option value="card">Card</option><option value="cheque">Cheque</option>
                <option value="cash">Cash</option><option value="money_order">Money order</option>
              </select>
            </label>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Follow-up date
              <input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 rounded-md bg-background border border-border text-sm outline-none" />
            </label>
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes (e.g. 'will pay payday Friday')" rows={2}
            className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm outline-none" />
          <button onClick={submit} className="w-full px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant inline-flex items-center justify-center gap-2">
            <CalendarClock className="h-4 w-4" /> Save promise to pay
          </button>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Promises</div>
          {plans.length === 0 ? (
            <div className="text-xs text-muted-foreground">No promises recorded yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {plans.map((p) => {
                const fu = followUpState(p);
                return (
                  <li key={p.id} className="py-2 text-xs space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">${p.installmentAmount.toFixed(2)}</span>
                      <span className="text-muted-foreground">
                        {p.frequency.replace("_", " ")} · promise {p.promisedDate}
                        {p.paymentMethod && <> · {p.paymentMethod.replace("_", " ")}</>}
                      </span>
                      <Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill>
                      <Pill tone={FU_TONE[fu]}>
                        <BellRing className="h-3 w-3" /> {FU_LABEL[fu]}{p.followUpDate ? ` · ${p.followUpDate}` : ""}
                      </Pill>
                      <span className="ml-auto text-muted-foreground">{p.createdBy}</span>
                      <button onClick={() => removePaymentPlan(p.id)} className="text-muted-foreground hover:text-destructive">×</button>
                    </div>
                    {p.commitmentNote && <div className="text-muted-foreground italic">"{p.commitmentNote}"</div>}
                    <div className="flex items-center gap-1 flex-wrap">
                      {(["active", "pending", "defaulted", "cancelled", "completed"] as const).filter(s => s !== p.status).map(s => (
                        <button key={s} onClick={() => updatePaymentPlan(p.id, { status: s })}
                          className="px-2 py-0.5 rounded border border-border text-[10px] uppercase tracking-wider text-muted-foreground hover:bg-muted">
                          → {s}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-info/30 bg-info/5 p-2.5 text-[11px] text-info-foreground">
          <span className="font-semibold">Follow-up logic:</span> If the promise date is in the future, AI sends reminders before the date. If the promise date was missed, AI or agent follows up the next day. Cadence is configurable per tenant.
        </div>
      </div>
    </PageCard>
  );
}

export function PaymentAffordabilityCard({
  outstanding, annualRatePct = 19.9, proposedMonthly,
}: { outstanding: number; annualRatePct?: number; proposedMonthly: number }) {
  const monthlyInterest = useMemo(() => (outstanding * (annualRatePct / 100)) / 12, [outstanding, annualRatePct]);
  const reducesPrincipal = proposedMonthly > monthlyInterest;
  const deficit = monthlyInterest - proposedMonthly;

  return (
    <PageCard>
      <CardHead title="Payment Affordability Check" subtitle="Does the proposed payment actually reduce the balance?" />
      <div className="px-6 py-4 space-y-3 text-sm">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border border-border p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding</div>
            <div className="font-display font-bold">${outstanding.toFixed(0)}</div>
          </div>
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Monthly interest</div>
            <div className="font-display font-bold text-warning">${monthlyInterest.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border border-tenant/30 bg-tenant/5 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Proposed</div>
            <div className="font-display font-bold text-tenant">${proposedMonthly.toFixed(2)}</div>
          </div>
        </div>
        {reducesPrincipal ? (
          <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 p-2.5 text-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-success" />
            <div>
              <div className="font-semibold text-success">Payment reduces principal</div>
              <div className="text-muted-foreground">Approx. ${(proposedMonthly - monthlyInterest).toFixed(2)} applied to principal each month.</div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
            <div>
              <div className="font-semibold text-destructive">Payment does NOT reduce principal</div>
              <div className="text-muted-foreground">Short by ${deficit.toFixed(2)}/month — balance will grow. Negotiate a higher amount.</div>
            </div>
          </div>
        )}
        <div className="text-[10px] text-muted-foreground">Estimate based on {annualRatePct}% APR · informational only.</div>
      </div>
    </PageCard>
  );
}
