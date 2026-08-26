// Payment Verification Request — agent submits a claim, finance verifies.
// Agents never collect card numbers, CVV, or expiry.

import { useState } from "react";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { FileText, Info, ShieldAlert, ShieldCheck, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  useReportedPayments, addReportedPayment, removeReportedPayment,
  type PaymentMethod, type VerificationStatus,
} from "@/lib/payments-split-store";

const V_TONE: Record<VerificationStatus, Parameters<typeof Pill>[0]["tone"]> = {
  pending_verification: "warning",
  verified: "success",
  rejected: "danger",
};
const V_ICON: Record<VerificationStatus, React.ReactNode> = {
  pending_verification: <Clock className="h-3 w-3" />,
  verified: <ShieldCheck className="h-3 w-3" />,
  rejected: <XCircle className="h-3 w-3" />,
};
const V_LABEL: Record<VerificationStatus, string> = {
  pending_verification: "Pending finance review",
  verified: "Verified by finance",
  rejected: "Rejected by finance",
};

export function AgentReportedPaymentsCard({ debtorId }: { debtorId: string }) {
  const items = useReportedPayments(debtorId);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<{ name: string; dataUrl: string } | null>(null);

  const handleProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File exceeds 10MB"); return; }
    const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result ?? "")); r.readAsDataURL(file); });
    setProof({ name: file.name, dataUrl });
  };

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    addReportedPayment({
      debtorId, amount: amt, method, paymentDate, reference: reference || undefined,
      proofName: proof?.name, proofDataUrl: proof?.dataUrl, note: note || undefined,
      status: "reported", reportedBy: "Current Agent",
      verificationStatus: "pending_verification",
    });
    setAmount(""); setReference(""); setNote(""); setProof(null);
    toast.success("Payment claim submitted for finance verification");
  };

  return (
    <PageCard>
      <CardHead
        title="Payment Verification Request"
        subtitle="Agent submits a payment claim — Finance verifies before the balance is updated"
      />
      <div className="px-6 py-4 space-y-4 text-sm">
        <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 p-2.5 text-xs text-info-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>You are <span className="font-semibold">not posting a payment</span>. You are submitting a claim/request for the Finance team to verify and post.</div>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5 text-destructive" />
          <div>
            <span className="font-semibold text-destructive">Never collect card numbers, CVV, or expiry dates.</span>{" "}
            Agents are not authorised to handle sensitive cardholder data. Record only what the customer reports.
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Submit payment claim</div>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount customer claims
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$"
                className="w-full mt-1 px-2 py-1.5 rounded-md bg-muted border border-border text-sm outline-none focus:ring-2 ring-tenant" />
            </label>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Payment method
              <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full mt-1 px-2 py-1.5 rounded-md bg-muted border border-border text-sm outline-none">
                <option value="card">Card</option><option value="bank_transfer">Bank transfer</option>
                <option value="cheque">Cheque</option><option value="cash">Cash</option>
                <option value="money_order">Money order</option><option value="wire">Wire</option><option value="ach">ACH</option>
              </select>
            </label>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Payment date
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 rounded-md bg-muted border border-border text-sm outline-none" />
            </label>
          </div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground">Reference number (if available)
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. confirmation #, last-4, transaction id"
              className="w-full mt-1 px-2 py-1.5 rounded-md bg-muted border border-border text-sm outline-none" />
          </label>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground">Notes
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did the customer say? Any context for finance?" rows={2}
              className="w-full mt-1 px-2 py-1.5 rounded-md bg-muted border border-border text-sm outline-none" />
          </label>
          <div className="flex items-center gap-2">
            <label className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-dashed border-border hover:bg-muted text-xs cursor-pointer text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              {proof ? <span className="font-mono truncate">{proof.name}</span> : <span>Upload proof / confirmation (optional)</span>}
              <input type="file" className="hidden" onChange={handleProof} />
            </label>
            {proof && <button onClick={() => setProof(null)} className="text-xs text-muted-foreground hover:text-destructive px-2">Remove</button>}
          </div>
          <button onClick={submit} className="w-full px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
            Submit for finance verification
          </button>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Submitted claims</div>
          {items.length === 0 ? (
            <div className="text-xs text-muted-foreground">No payment claims yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((r) => (
                <li key={r.id} className="py-2 space-y-1 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">${r.amount.toFixed(2)}</span>
                    <span className="text-muted-foreground">{r.method.replace("_", " ")} · {r.paymentDate}</span>
                    <Pill tone={V_TONE[r.verificationStatus]}>
                      {V_ICON[r.verificationStatus]} {V_LABEL[r.verificationStatus]}
                    </Pill>
                    <span className="ml-auto text-muted-foreground">Submitted by {r.reportedBy}</span>
                    <button onClick={() => removeReportedPayment(r.id)} className="text-muted-foreground hover:text-destructive" title="Withdraw claim">×</button>
                  </div>
                  {r.reference && <div className="text-muted-foreground font-mono">Ref: {r.reference}</div>}
                  {r.note && <div className="text-muted-foreground italic">"{r.note}"</div>}
                  {r.proofDataUrl && (
                    <a href={r.proofDataUrl} download={r.proofName} className="inline-flex items-center gap-1 text-tenant hover:underline w-fit">
                      <FileText className="h-3 w-3" /><span className="font-mono">{r.proofName}</span>
                    </a>
                  )}
                  {r.financeNotes && (
                    <div className="rounded border border-border bg-muted/40 p-2 text-muted-foreground">
                      <span className="font-semibold">Finance note:</span> {r.financeNotes}
                      {r.verifiedBy && <span className="ml-1">— {r.verifiedBy}</span>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageCard>
  );
}
