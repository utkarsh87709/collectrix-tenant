// Finance-posted payments + Payment Posting module (interest-first allocation).
// This DOES update the outstanding balance via finance store totals.

import { useMemo, useState } from "react";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { Banknote, FileText, ShieldCheck, Lock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  useFinancePayments, postFinancePayment, removeFinancePayment, allocateInterestFirst, totalFinancePosted,
  useReportedPayments, updateReportedVerification,
  type PaymentMethod,
} from "@/lib/payments-split-store";
import { useDemoRole } from "@/lib/demo-role";

export function FinancePostedPaymentsCard({ debtorId, originalBalance, accruedInterest = 0 }: {
  debtorId: string; originalBalance: number; accruedInterest?: number;
}) {
  const items = useFinancePayments(debtorId);
  const reported = useReportedPayments(debtorId);
  const pendingClaims = reported.filter(r => r.verificationStatus === "pending_verification");
  const demoRole = useDemoRole();
  // Map shared demo role to this card's permission model (manager has no posting rights here)
  const role: "agent" | "finance" | "admin" = demoRole === "finance" ? "finance" : demoRole === "admin" ? "admin" : "agent";
  const canPost = role === "finance" || role === "admin";


  const [received, setReceived] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [postedDate, setPostedDate] = useState(new Date().toISOString().slice(0, 10));
  const [bankReference, setBankReference] = useState("");
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<{ name: string; dataUrl: string } | null>(null);
  const [manualOverride, setManualOverride] = useState(false);
  const [interestApplied, setInterestApplied] = useState("");
  const [principalApplied, setPrincipalApplied] = useState("");

  const totalPosted = totalFinancePosted(debtorId);
  const outstanding = Math.max(originalBalance - totalPosted, 0);

  const allocPreview = useMemo(() => {
    const amt = Number(received);
    if (!amt || amt <= 0) return { toInterest: 0, toPrincipal: 0 };
    if (manualOverride) return { toInterest: Number(interestApplied) || 0, toPrincipal: Number(principalApplied) || 0 };
    return allocateInterestFirst(amt, accruedInterest);
  }, [received, manualOverride, interestApplied, principalApplied, accruedInterest]);

  const handleProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File exceeds 10MB"); return; }
    const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result ?? "")); r.readAsDataURL(file); });
    setProof({ name: file.name, dataUrl });
  };

  const submit = () => {
    if (!canPost) { toast.error("Only Finance users can post payments"); return; }
    const amt = Number(received);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    const { toInterest, toPrincipal } = allocPreview;
    if (Math.abs(toInterest + toPrincipal - amt) > 0.01) {
      toast.error("Interest + Principal must equal received amount");
      return;
    }
    const remaining = Math.max(outstanding - amt, 0);
    postFinancePayment({
      debtorId, amountReceived: amt, method, receivedDate, postedDate,
      bankReference: bankReference || undefined,
      appliedToInterest: toInterest, appliedToPrincipal: toPrincipal,
      remainingBalanceAfter: remaining,
      postedBy: role === "finance" ? "Finance User" : "Admin",
      notes: notes || undefined, proofName: proof?.name, proofDataUrl: proof?.dataUrl,
    });
    setReceived(""); setBankReference(""); setNotes(""); setProof(null);
    setManualOverride(false); setInterestApplied(""); setPrincipalApplied("");
    toast.success(`Posted $${amt.toFixed(2)} — balance reduced to $${remaining.toFixed(2)}`);
  };

  return (
    <PageCard>
      <CardHead
        title="Finance Posted Payments"
        subtitle="Verified payments — updates the actual outstanding balance"
      />

      <div className="px-6 py-4 space-y-4 text-sm">
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded-lg border border-border p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Original</div>
            <div className="font-display font-bold">${originalBalance.toFixed(0)}</div>
          </div>
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Accrued int.</div>
            <div className="font-display font-bold text-warning">${accruedInterest.toFixed(0)}</div>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/5 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Posted</div>
            <div className="font-display font-bold text-success">${totalPosted.toFixed(0)}</div>
          </div>
          <div className="rounded-lg border border-tenant/30 bg-tenant/5 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding</div>
            <div className="font-display font-bold text-tenant">${outstanding.toFixed(0)}</div>
          </div>
        </div>

        {!canPost ? (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-2.5 text-xs">
            <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
            <div><span className="font-semibold">Read-only.</span> Only Finance/Accountant roles can post payments. Switch role above to demo.</div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Post verified payment
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" value={received} onChange={(e) => setReceived(e.target.value)} placeholder="Amount received"
                className="px-2 py-1.5 rounded-md bg-muted border border-border text-sm outline-none focus:ring-2 ring-tenant" />
              <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="px-2 py-1.5 rounded-md bg-muted border border-border text-sm outline-none">
                <option value="bank_transfer">Bank transfer</option><option value="ach">ACH</option><option value="wire">Wire</option>
                <option value="card">Card</option><option value="cheque">Cheque</option>
                <option value="cash">Cash</option><option value="money_order">Money order</option>
              </select>
              <input value={bankReference} onChange={(e) => setBankReference(e.target.value)} placeholder="Bank reference"
                className="px-2 py-1.5 rounded-md bg-muted border border-border text-sm outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Received date
                <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 rounded-md bg-muted border border-border text-sm outline-none" />
              </label>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Posted date
                <input type="date" value={postedDate} onChange={(e) => setPostedDate(e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 rounded-md bg-muted border border-border text-sm outline-none" />
              </label>
            </div>

            {/* Allocation: interest first */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Allocation (interest first)</div>
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <input type="checkbox" checked={manualOverride} onChange={(e) => setManualOverride(e.target.checked)} />
                  Manual override
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-background border border-border p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">To interest</div>
                  {manualOverride ? (
                    <input type="number" value={interestApplied} onChange={(e) => setInterestApplied(e.target.value)}
                      className="w-full mt-0.5 px-1 py-0.5 bg-muted border border-border rounded text-sm" />
                  ) : (
                    <div className="font-display font-bold text-warning">${allocPreview.toInterest.toFixed(2)}</div>
                  )}
                </div>
                <div className="rounded-md bg-background border border-border p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">To principal</div>
                  {manualOverride ? (
                    <input type="number" value={principalApplied} onChange={(e) => setPrincipalApplied(e.target.value)}
                      className="w-full mt-0.5 px-1 py-0.5 bg-muted border border-border rounded text-sm" />
                  ) : (
                    <div className="font-display font-bold text-tenant">${allocPreview.toPrincipal.toFixed(2)}</div>
                  )}
                </div>
                <div className="rounded-md bg-background border border-border p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">New balance</div>
                  <div className="font-display font-bold">${Math.max(outstanding - (Number(received) || 0), 0).toFixed(2)}</div>
                </div>
              </div>
            </div>

            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2}
              className="w-full px-2 py-1.5 rounded-md bg-muted border border-border text-sm outline-none" />
            <div className="flex items-center gap-2">
              <label className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-dashed border-border hover:bg-muted text-xs cursor-pointer text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                {proof ? <span className="font-mono truncate">{proof.name}</span> : <span>Upload bank statement / proof</span>}
                <input type="file" className="hidden" onChange={handleProof} />
              </label>
              {proof && <button onClick={() => setProof(null)} className="text-xs text-muted-foreground hover:text-destructive px-2">Remove</button>}
            </div>
            <button onClick={submit} className="w-full px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant inline-flex items-center justify-center gap-2">
              <Banknote className="h-4 w-4" /> Post payment & update balance
            </button>
          </div>
        )}

        {canPost && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Pending verification requests ({pendingClaims.length})
            </div>
            {pendingClaims.length === 0 ? (
              <div className="text-xs text-muted-foreground">No agent claims awaiting review.</div>
            ) : (
              <ul className="divide-y divide-border">
                {pendingClaims.map((c) => (
                  <PendingClaimRow
                    key={c.id}
                    claim={c}
                    role={role}
                    outstanding={outstanding}
                    accruedInterest={accruedInterest}
                    onApprove={(financeNotes) => {
                      const { toInterest, toPrincipal } = allocateInterestFirst(c.amount, accruedInterest);
                      const remaining = Math.max(outstanding - c.amount, 0);
                      const posted = postFinancePayment({
                        debtorId, amountReceived: c.amount, method: c.method,
                        receivedDate: c.paymentDate, postedDate: new Date().toISOString().slice(0, 10),
                        bankReference: c.reference,
                        appliedToInterest: toInterest, appliedToPrincipal: toPrincipal,
                        remainingBalanceAfter: remaining,
                        postedBy: role === "finance" ? "Finance User" : "Admin",
                        notes: financeNotes ? `Approved claim: ${financeNotes}` : "Approved from agent claim",
                        proofName: c.proofName, proofDataUrl: c.proofDataUrl,
                        linkedReportedId: c.id,
                      });
                      updateReportedVerification(c.id, {
                        verificationStatus: "verified",
                        financeNotes,
                        verifiedBy: role === "finance" ? "Finance User" : "Admin",
                        linkedFinanceId: posted.id,
                      });
                      toast.success(`Approved $${c.amount.toFixed(2)} — balance updated to $${remaining.toFixed(2)}`);
                    }}
                    onReject={(financeNotes) => {
                      if (!financeNotes) { toast.error("Please add a reason"); return; }
                      updateReportedVerification(c.id, {
                        verificationStatus: "rejected",
                        financeNotes,
                        verifiedBy: role === "finance" ? "Finance User" : "Admin",
                      });
                      toast.success("Claim rejected — balance unchanged");
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Posting history</div>
          {items.length === 0 ? (
            <div className="text-xs text-muted-foreground">No posted payments yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((f) => (
                <li key={f.id} className="py-2 text-xs space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-success">${f.amountReceived.toFixed(2)}</span>
                    <span className="text-muted-foreground">{f.method.replace("_", " ")} · received {f.receivedDate} · posted {f.postedDate}</span>
                    <Pill tone="success">posted</Pill>
                    <span className="ml-auto text-muted-foreground">{f.postedBy}</span>
                    {canPost && <button onClick={() => removeFinancePayment(f.id)} className="text-muted-foreground hover:text-destructive">×</button>}
                  </div>
                  <div className="text-muted-foreground">
                    Interest <span className="text-warning font-semibold">${f.appliedToInterest.toFixed(2)}</span>
                    {" · "}Principal <span className="text-tenant font-semibold">${f.appliedToPrincipal.toFixed(2)}</span>
                    {" · "}Remaining <span className="font-semibold">${f.remainingBalanceAfter.toFixed(2)}</span>
                  </div>
                  {f.bankReference && <div className="text-muted-foreground font-mono">{f.bankReference}</div>}
                  {f.notes && <div className="text-muted-foreground italic">"{f.notes}"</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageCard>
  );
}

function PendingClaimRow({
  claim, role, outstanding, accruedInterest, onApprove, onReject,
}: {
  claim: import("@/lib/payments-split-store").AgentReportedPayment;
  role: "agent" | "finance" | "admin";
  outstanding: number;
  accruedInterest: number;
  onApprove: (financeNotes: string) => void;
  onReject: (financeNotes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  void role;
  const { toInterest, toPrincipal } = allocateInterestFirst(claim.amount, accruedInterest);
  const projected = Math.max(outstanding - claim.amount, 0);
  return (
    <li className="py-3 space-y-2 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold">${claim.amount.toFixed(2)}</span>
        <span className="text-muted-foreground">{claim.method.replace("_", " ")} · customer paid {claim.paymentDate}</span>
        <Pill tone="warning">Pending</Pill>
        <span className="ml-auto text-muted-foreground">Submitted by {claim.reportedBy}</span>
      </div>
      {claim.reference && <div className="text-muted-foreground font-mono">Ref: {claim.reference}</div>}
      {claim.note && <div className="text-muted-foreground italic">"{claim.note}"</div>}
      {claim.proofDataUrl && (
        <a href={claim.proofDataUrl} download={claim.proofName} className="inline-flex items-center gap-1 text-tenant hover:underline w-fit">
          <FileText className="h-3 w-3" /><span className="font-mono">{claim.proofName}</span>
        </a>
      )}
      <div className="rounded border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
        If approved → To interest <span className="text-warning font-semibold">${toInterest.toFixed(2)}</span>
        {" · "}To principal <span className="text-tenant font-semibold">${toPrincipal.toFixed(2)}</span>
        {" · "}New balance <span className="font-semibold">${projected.toFixed(2)}</span>
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Finance notes (required to reject)" rows={2}
        className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-xs outline-none" />
      <div className="flex items-center gap-2">
        <button onClick={() => onApprove(notes)}
          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md bg-success text-success-foreground text-xs font-semibold">
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve & post payment
        </button>
        <button onClick={() => onReject(notes)}
          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-semibold">
          <XCircle className="h-3.5 w-3.5" /> Reject claim
        </button>
      </div>
    </li>
  );
}
