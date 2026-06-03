// Payment Agreement Section — Debtor Details page.
// Four system-defined agreement types: PIF, SIF, PPA, PTP.
// Tenant-scoped via debtorId. Status connection drives debtor lifecycle.

import { useMemo, useState } from "react";
import {
  CircleDollarSign, Handshake, CalendarClock, ScrollText, CheckCircle2,
  AlertTriangle, Info, X, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import {
  useAgreements, useInstallments, activeAgreement,
  createAgreement, cancelAgreement, markInstallmentPaid, markInstallmentMissed,
  setPromiseOutcome,
  AGREEMENT_LABEL, AGREEMENT_TO_STATUS,
  type AgreementType, type PaymentMethod, type Frequency, type PaymentAgreement,
} from "@/lib/payment-agreements-store";
import { logAudit } from "@/lib/audit-timeline-store";
import { addReportedPayment } from "@/lib/payments-split-store";

type Props = {
  debtorId: string;
  balance: number;
  currentStatusCode: string;
  bumpStatus: (toCode: string, reason: string) => void;
  canManage?: boolean;
};

const TYPE_META: Record<AgreementType, {
  icon: React.ReactNode; desc: string; tone: string; targetStatus: string;
  targetStatusName: string; cta: string;
}> = {
  PIF: { icon: <CircleDollarSign className="h-5 w-5" />, desc: "Debtor agrees to pay the full outstanding balance in one payment, including applicable interest.", tone: "from-emerald-500/15 to-emerald-500/0 border-emerald-500/30", targetStatus: "PIF", targetStatusName: "Promised Paid In Full", cta: "Create Payment In Full" },
  SIF: { icon: <Handshake className="h-5 w-5" />, desc: "Agent and debtor agree on a reduced settlement amount that is less than the total balance. Interest amount is still captured.", tone: "from-blue-500/15 to-blue-500/0 border-blue-500/30", targetStatus: "SIF", targetStatusName: "Settled In Full", cta: "Create Settlement Agreement" },
  PPA: { icon: <CalendarClock className="h-5 w-5" />, desc: "Debtor agrees to pay the outstanding amount through scheduled installments, with applicable interest.", tone: "from-violet-500/15 to-violet-500/0 border-violet-500/30", targetStatus: "PPA", targetStatusName: "Payment Plan Agreed", cta: "Create Payment Plan" },
  PTP: { icon: <ScrollText className="h-5 w-5" />, desc: "Debtor promises to make a payment by a specific date, but no detailed plan has been finalized.", tone: "from-amber-500/15 to-amber-500/0 border-amber-500/30", targetStatus: "PTP", targetStatusName: "Promised To Pay", cta: "Create Promise To Pay" },
};

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PaymentAgreementSection({ debtorId, balance, currentStatusCode, bumpStatus, canManage = true }: Props) {
  const agreements = useAgreements(debtorId);
  const active = activeAgreement(agreements);
  const [openType, setOpenType] = useState<AgreementType | null>(null);
  void currentStatusCode;

  const handleCreate = (agr: PaymentAgreement, extras: { reference?: string; proofName?: string; proofDataUrl?: string }) => {
    logAudit({
      debtorId, actor: "Current Agent", actorKind: "human",
      category: "payment_reported",
      action: `${AGREEMENT_LABEL[agr.type]} created`,
      summary: `${AGREEMENT_LABEL[agr.type]} created for ${fmt(agr.totalPayable)} by Current Agent.`,
      meta: { agreementId: agr.id, type: agr.type, amount: agr.totalPayable },
    });

    // Expected amount surfaced for finance, by agreement type
    const expectedAmount =
      agr.type === "SIF" ? (agr.settlementAmount ?? agr.totalPayable) :
      agr.type === "PTP" ? (agr.promisedAmount ?? agr.totalPayable) :
      agr.type === "PPA" ? (agr.monthlyAmount ?? agr.totalPayable) :
      agr.totalPayable; // PIF
    const expectedDate =
      agr.dueDate ?? agr.promiseDate ?? agr.firstPaymentDate ?? today();

    // Surface under "Finance Posted Payments" pending queue for finance approval
    addReportedPayment({
      debtorId,
      amount: expectedAmount,
      method: agr.paymentMethod,
      paymentDate: expectedDate,
      reference: extras.reference?.trim() ? extras.reference.trim() : `${agr.type}-${agr.id}`,
      proofName: extras.proofName,
      proofDataUrl: extras.proofDataUrl,
      note: `${AGREEMENT_LABEL[agr.type]} agreement — pending finance verification`,
      status: "reported",
      reportedBy: "Current Agent",
      verificationStatus: "pending_verification",
    });

    bumpStatus(AGREEMENT_TO_STATUS[agr.type], `${AGREEMENT_LABEL[agr.type]} agreement created (${fmt(agr.totalPayable)})`);
    toast.success(`${AGREEMENT_LABEL[agr.type]} created — sent to finance`);
    setOpenType(null);
  };

  return (
    <PageCard>
      <CardHead
        title="Payment Agreement"
        subtitle="Record how the debtor has agreed to pay. Drives debtor status and verification workflow."
      />
      <div className="px-6 py-5 space-y-5">
        {active && (
          <ActiveAgreementSummary
            agreement={active}
            debtorId={debtorId}
            canManage={canManage}
            onCancel={() => {
              cancelAgreement(active.id);
              logAudit({ debtorId, actor: "Current Agent", actorKind: "human", category: "payment_reported", action: `${AGREEMENT_LABEL[active.type]} cancelled`, meta: { agreementId: active.id } });
              toast.success("Agreement cancelled");
            }}
          />
        )}

        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
            {active ? "Other agreement types (cancel current to switch)" : "Select an agreement type"}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(Object.keys(TYPE_META) as AgreementType[]).map((t) => {
              const meta = TYPE_META[t];
              const disabled = !canManage || (!!active && active.type !== t);
              return (
                <button
                  key={t}
                  type="button"
                  disabled={disabled}
                  onClick={() => setOpenType(t)}
                  className={`text-left rounded-xl border bg-gradient-to-br ${meta.tone} p-4 transition hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-background/80 border border-border flex items-center justify-center shrink-0">
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-sm">{AGREEMENT_LABEL[t]}</div>
                      <div className="text-xs text-muted-foreground mt-1 leading-snug">{meta.desc}</div>
                      <div className="mt-2 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        Status on create <ChevronRight className="h-3 w-3" />
                        <span className="font-semibold text-foreground">{meta.targetStatusName} ({meta.targetStatus})</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {active?.type === "PPA" && <PaymentPlanSchedule agreementId={active.id} debtorId={debtorId} canManage={canManage} />}


        <AgreementHistory agreements={agreements} />
      </div>

      {openType && (
        <AgreementDialog
          type={openType}
          debtorId={debtorId}
          balance={balance}
          onClose={() => setOpenType(null)}
          onCreate={handleCreate}
        />
      )}
    </PageCard>
  );
}

// ──────────────────────────────────────────────────────────────────────────
function ActiveAgreementSummary({
  agreement, debtorId, canManage, onCancel,
}: { agreement: PaymentAgreement; debtorId: string; canManage: boolean; onCancel: () => void }) {
  const meta = TYPE_META[agreement.type];

  const tone: Parameters<typeof Pill>[0]["tone"] =
    agreement.status === "delinquent" ? "danger" :
    agreement.status === "pending_verification" ? "warning" :
    agreement.status === "broken" ? "danger" :
    agreement.status === "kept" ? "success" : "success";




  return (
    <div className="rounded-xl border-2 border-tenant/30 bg-tenant/5 p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-bold text-tenant">Active agreement</span>
            <Pill tone={tone}>{agreement.status.replace("_", " ")}</Pill>
          </div>
          <div className="font-display font-bold text-base mt-0.5">{AGREEMENT_LABEL[agreement.type]}</div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Stat label="Total payable" value={fmt(agreement.totalPayable)} strong />
            {agreement.interestAmount > 0 && <Stat label="Interest" value={fmt(agreement.interestAmount)} />}
            {agreement.type === "SIF" && <Stat label="Settlement" value={fmt(agreement.settlementAmount ?? 0)} />}
            {agreement.type === "PPA" && <Stat label="Installment" value={`${fmt(agreement.monthlyAmount ?? 0)} × ${agreement.installmentCount}`} />}
            {agreement.type === "PTP" && <Stat label="Promise" value={fmt(agreement.promisedAmount ?? 0)} />}
            {agreement.dueDate && <Stat label="Due date" value={agreement.dueDate} />}
            {agreement.promiseDate && <Stat label="Promise date" value={agreement.promiseDate} />}
            {agreement.firstPaymentDate && <Stat label="First payment" value={agreement.firstPaymentDate} />}
            <Stat label="Method" value={agreement.paymentMethod.replace("_", " ")} />
          </div>
          {agreement.type === "SIF" && agreement.approvalRequired && (
            <div className={`mt-3 flex items-center gap-2 text-xs rounded-md border px-2.5 py-1.5 ${agreement.approvedBy ? "border-success/40 bg-success/5 text-success" : "border-warning/40 bg-warning/5 text-warning-foreground"}`}>
              {agreement.approvedBy
                ? <><CheckCircle2 className="h-3.5 w-3.5" /> Approval received from {agreement.approvedBy}</>
                : <><AlertTriangle className="h-3.5 w-3.5" /> Manager approval required (settlement below balance)</>}
            </div>
          )}
          {agreement.note && <div className="mt-2 text-xs italic text-muted-foreground">"{agreement.note}"</div>}

          {agreement.type === "PTP" && (
            <PromiseOutcomeControls agreement={agreement} debtorId={debtorId} canManage={canManage} />
          )}


        </div>
        {canManage && (
          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={onCancel} className="px-3 py-1.5 rounded-md border border-border text-xs hover:bg-muted">
              Cancel agreement
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={strong ? "font-display font-bold text-sm" : "text-sm"}>{value}</div>
    </div>
  );
}

function PromiseOutcomeControls({ agreement, debtorId, canManage }: { agreement: PaymentAgreement; debtorId: string; canManage: boolean }) {
  const isOverdue = agreement.promiseDate && agreement.promiseDate < today() && agreement.status !== "kept";
  const set = (o: "kept" | "broken" | "cancelled") => {
    setPromiseOutcome(agreement.id, o);
    logAudit({
      debtorId, actor: "Current Agent", actorKind: "human", category: "payment_reported",
      action: `Payment promise ${o}`,
      summary: `Promise to pay ${fmt(agreement.promisedAmount ?? 0)} on ${agreement.promiseDate} marked ${o}.`,
      meta: { agreementId: agreement.id },
    });
    toast.success(`Promise marked ${o}`);
  };
  return (
    <div className="mt-3 space-y-2">
      {isOverdue && (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/5 px-2.5 py-1.5 text-xs text-warning-foreground">
          <AlertTriangle className="h-3.5 w-3.5" /> Promise date has passed without recorded payment.
        </div>
      )}
      {canManage && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Update outcome:</span>
          <button onClick={() => set("kept")} className="px-2 py-1 rounded border border-success/40 text-success text-xs hover:bg-success/10">Kept</button>
          <button onClick={() => set("broken")} className="px-2 py-1 rounded border border-destructive/40 text-destructive text-xs hover:bg-destructive/10">Broken</button>
          <button onClick={() => set("cancelled")} className="px-2 py-1 rounded border border-border text-xs hover:bg-muted">Cancelled</button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
function PaymentPlanSchedule({ agreementId, debtorId, canManage }: { agreementId: string; debtorId: string; canManage: boolean }) {
  const ins = useInstallments(agreementId).slice().sort((a, b) => a.seq - b.seq);
  if (ins.length === 0) return null;

  const onPaid = (id: string, seq: number) => {
    markInstallmentPaid(id);
    logAudit({ debtorId, actor: "Current Agent", actorKind: "human", category: "payment_posted", action: `Installment #${seq} paid`, meta: { agreementId } });
    toast.success(`Installment #${seq} marked paid`);
  };
  const onMissed = (id: string, seq: number) => {
    markInstallmentMissed(id);
    logAudit({ debtorId, actor: "Current Agent", actorKind: "human", category: "payment_reported", action: `Installment #${seq} missed`, summary: "Payment plan marked delinquent.", meta: { agreementId } });
    toast.error(`Installment #${seq} marked missed — plan is delinquent`);
  };

  return (
    <div className="rounded-xl border border-border">
      <div className="px-4 py-3 border-b border-border">
        <div className="font-display font-bold text-sm">Payment schedule</div>
        <div className="text-xs text-muted-foreground">Track each installment. Missed installments move the plan to delinquent.</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Due date</th>
              <th className="text-right px-3 py-2">Amount</th>
              <th className="text-right px-3 py-2">Interest</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Paid date</th>
              {canManage && <th className="text-right px-3 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {ins.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="px-3 py-2 font-semibold">{i.seq}</td>
                <td className="px-3 py-2">{i.dueDate}</td>
                <td className="px-3 py-2 text-right">{fmt(i.amount)}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{i.interestPortion ? fmt(i.interestPortion) : "—"}</td>
                <td className="px-3 py-2">
                  <Pill tone={i.status === "paid" ? "success" : i.status === "missed" || i.status === "failed" ? "danger" : i.status === "due" ? "warning" : "muted"}>
                    {i.status}
                  </Pill>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{i.paidDate ?? "—"}</td>
                {canManage && (
                  <td className="px-3 py-2 text-right">
                    {i.status !== "paid" && (
                      <div className="inline-flex gap-1">
                        <button onClick={() => onPaid(i.id, i.seq)} className="px-2 py-1 rounded border border-success/40 text-success hover:bg-success/10">Paid</button>
                        {i.status !== "missed" && (
                          <button onClick={() => onMissed(i.id, i.seq)} className="px-2 py-1 rounded border border-destructive/40 text-destructive hover:bg-destructive/10">Missed</button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function AgreementHistory({ agreements }: { agreements: PaymentAgreement[] }) {
  if (agreements.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground flex items-center gap-2">
        <Info className="h-3.5 w-3.5" /> No payment agreements recorded yet.
      </div>
    );
  }
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Agreement history</div>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {agreements.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-xs">
            <span className="font-semibold">{AGREEMENT_LABEL[a.type]}</span>
            <span className="text-muted-foreground">{fmt(a.totalPayable)}</span>
            <Pill tone={a.status === "cancelled" || a.status === "broken" ? "danger" : a.status === "kept" || a.status === "completed" ? "success" : a.status === "delinquent" ? "warning" : "info"}>{a.status.replace("_", " ")}</Pill>
            <span className="ml-auto text-muted-foreground">{a.createdBy} · {new Date(a.createdAt).toLocaleDateString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Create dialog
function AgreementDialog({
  type, debtorId, balance, onClose, onCreate,
}: { type: AgreementType; debtorId: string; balance: number; onClose: () => void; onCreate: (a: PaymentAgreement, extras: { reference?: string; proofName?: string; proofDataUrl?: string }) => void }) {
  void debtorId;
  const meta = TYPE_META[type];
  const [interest, setInterest] = useState<string>("0");
  const [dueDate, setDueDate] = useState<string>(today());
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [note, setNote] = useState("");
  // PIF/SIF extras
  const [reference, setReference] = useState("");
  const [proofName, setProofName] = useState<string | undefined>();
  const [proofDataUrl, setProofDataUrl] = useState<string | undefined>();
  // SIF
  const [settlement, setSettlement] = useState<string>("");
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [approvedBy, setApprovedBy] = useState("");
  // PPA
  const [computeBy, setComputeBy] = useState<"amount" | "count">("amount");
  const [monthly, setMonthly] = useState<string>("");
  const [count, setCount] = useState<string>("");
  const [firstDate, setFirstDate] = useState<string>(today());
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  // PTP
  const [promisedAmount, setPromisedAmount] = useState<string>("");
  const [promiseDate, setPromiseDate] = useState<string>(today());

  const onProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setProofName(undefined); setProofDataUrl(undefined); return; }
    setProofName(file.name);
    const reader = new FileReader();
    reader.onload = () => setProofDataUrl(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(file);
  };

  const interestN = Number(interest) || 0;
  const settlementN = Number(settlement) || 0;
  const promisedN = Number(promisedAmount) || 0;
  const monthlyN = Number(monthly) || 0;
  const countN = Number(count) || 0;

  const totals = useMemo(() => {
    if (type === "PIF") return { totalPayable: balance + interestN, base: balance };
    if (type === "SIF") return { totalPayable: settlementN + interestN, base: settlementN };
    if (type === "PPA") {
      const totalPayable = balance + interestN;
      let m = monthlyN; let c = countN;
      if (computeBy === "amount" && m > 0) c = Math.ceil(totalPayable / m);
      else if (computeBy === "count" && c > 0) m = Math.round((totalPayable / c) * 100) / 100;
      return { totalPayable, monthly: m, count: c };
    }
    return { totalPayable: promisedN };
  }, [type, balance, interestN, settlementN, monthlyN, countN, computeBy, promisedN]);

  const validate = (): string | null => {
    if (dueDate && dueDate < today() && type !== "PPA") return "Due date cannot be in the past.";
    if (type === "SIF") {
      if (!settlementN) return "Settlement amount is required.";
      if (settlementN >= balance) return "Settlement amount must be less than total balance.";
      if (approvalRequired && !approvedBy.trim()) return "Record the manager who approved this settlement.";
    }
    if (type === "PPA") {
      const c = (totals as { count?: number }).count ?? 0;
      const m = (totals as { monthly?: number }).monthly ?? 0;
      if (!m || !c) return "Enter a valid installment amount or count.";
      if (!firstDate) return "First payment date is required.";
    }
    if (type === "PTP") {
      if (!promisedN) return "Promised amount is required.";
      if (!promiseDate) return "Promise date is required.";
    }
    return null;
  };

  const submit = () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    const base: Parameters<typeof createAgreement>[0] = {
      debtorId, type,
      totalBalance: balance,
      interestAmount: interestN,
      totalPayable: totals.totalPayable,
      paymentMethod: method,
      dueDate: type === "PPA" ? undefined : dueDate,
      note: note || undefined,
      createdBy: "Current Agent",
    };
    if (type === "SIF") Object.assign(base, { settlementAmount: settlementN, approvalRequired, approvedBy: approvedBy || undefined });
    if (type === "PPA") Object.assign(base, {
      monthlyAmount: (totals as { monthly?: number }).monthly,
      installmentCount: (totals as { count?: number }).count,
      firstPaymentDate: firstDate,
      frequency,
    });
    if (type === "PTP") Object.assign(base, { promisedAmount: promisedN, promiseDate, promiseOutcome: "active" });
    const created = createAgreement(base);
    onCreate(created, { reference, proofName, proofDataUrl });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-elegant border border-border w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted border border-border flex items-center justify-center">{meta.icon}</div>
            <div>
              <div className="font-display font-bold">{AGREEMENT_LABEL[type]}</div>
              <div className="text-xs text-muted-foreground">Status on create: {meta.targetStatusName} ({meta.targetStatus})</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm overflow-y-auto">
          {type !== "PTP" && (
            <Field label="Total balance">
              <input value={fmt(balance)} readOnly className="w-full px-2 py-1.5 rounded-md bg-muted border border-border text-sm" />
            </Field>
          )}

          {type === "SIF" && (
            <Field label="Settlement amount" hint="Must be less than total balance.">
              <input type="number" value={settlement} onChange={(e) => setSettlement(e.target.value)} placeholder="$" className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm" />
            </Field>
          )}

          {type !== "PTP" && (
            <Field label="Interest amount">
              <input type="number" value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="$" className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm" />
            </Field>
          )}

          {type === "PTP" && (
            <>
              <Field label="Promised amount">
                <input type="number" value={promisedAmount} onChange={(e) => setPromisedAmount(e.target.value)} placeholder="$" className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm" />
              </Field>
              <Field label="Promise date">
                <input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm" />
              </Field>
            </>
          )}

          {type !== "PTP" && (
            <div className="rounded-md border border-tenant/30 bg-tenant/5 p-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                {type === "SIF" ? "Total settlement payable" : "Total payable"}
              </span>
              <span className="font-display font-bold text-base">{fmt(totals.totalPayable)}</span>
            </div>
          )}

          {type === "PPA" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Compute by">
                  <select value={computeBy} onChange={(e) => setComputeBy(e.target.value as "amount" | "count")} className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm">
                    <option value="amount">Monthly amount → count</option>
                    <option value="count">Installment count → amount</option>
                  </select>
                </Field>
                <Field label="Frequency">
                  <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm">
                    <option value="monthly">Monthly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Installment amount">
                  <input type="number" disabled={computeBy === "count"} value={computeBy === "amount" ? monthly : ((totals as { monthly?: number }).monthly ?? "")} onChange={(e) => setMonthly(e.target.value)} placeholder="$" className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm disabled:opacity-60" />
                </Field>
                <Field label="Number of installments">
                  <input type="number" disabled={computeBy === "amount"} value={computeBy === "count" ? count : ((totals as { count?: number }).count ?? "")} onChange={(e) => setCount(e.target.value)} placeholder="e.g. 12" className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm disabled:opacity-60" />
                </Field>
              </div>
              <Field label="First payment date">
                <input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm" />
              </Field>
            </>
          )}

          {type !== "PPA" && type !== "PTP" && (
            <Field label="Due date">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm" />
            </Field>
          )}

          <Field label="Payment method">
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm">
              <option value="bank_transfer">Bank transfer</option>
              <option value="ach">ACH</option>
              <option value="wire">Wire</option>
              <option value="card">Card</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="money_order">Money order</option>
            </select>
          </Field>

          {type === "SIF" && (
            <div className="rounded-md border border-warning/40 bg-warning/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-warning-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Settlement is below total balance — internal approval indicator.</div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={approvalRequired} onChange={(e) => setApprovalRequired(e.target.checked)} />
                Approval required
              </label>
              {approvalRequired && (
                <Field label="Approved by">
                  <input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="Manager name" className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm" />
                </Field>
              )}
            </div>
          )}

          {(type === "PIF" || type === "SIF") && (
            <>
              <Field label="Reference number" hint="Optional — transaction ID, cheque number, etc.">
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. TXN-12345" className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm" />
              </Field>
              <Field label="Upload proof" hint="Optional — receipt, screenshot, bank confirmation.">
                <input type="file" accept="image/*,application/pdf" onChange={onProofChange} className="w-full text-xs file:mr-2 file:px-2 file:py-1 file:rounded file:border file:border-border file:bg-muted file:text-xs file:font-semibold" />
                {proofName && <div className="mt-1 text-[11px] text-muted-foreground">Attached: {proofName}</div>}
              </Field>
            </>
          )}

          <Field label="Optional note">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm" />
          </Field>
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted">Cancel</button>
          <button onClick={submit} className="px-4 py-1.5 rounded-md bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">{meta.cta}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</div>
      {children}
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </label>
  );
}
