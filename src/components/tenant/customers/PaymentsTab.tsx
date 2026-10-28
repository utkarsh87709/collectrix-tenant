import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  FileText,
  Handshake,
  Info,
  Loader2,
  Lock,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageCard, CardHead, Pill, NativeSelect } from "@/components/tenant/ui";
import { documentFileName, formatMoney, toMoney } from "@/lib/customers-api";
import {
  getPaymentAgreementDetails,
  createPaymentAgreement,
  cancelPaymentAgreement,
  uploadPaymentFile,
  submitForVerification,
  postPaymentReceived,
  approvePayment,
  rejectPayment,
  inputDateToPaymentDate,
  paymentDateLabel,
  AGREEMENT_TYPE_LABEL,
  PAYMENT_METHODS,
  type CreatePaymentAgreementInput,
  type PaymentAgreement,
  type PaymentAgreementDetails,
  type PaymentAgreementFields,
  type PaymentAgreementType,
  type PaymentInput,
  type PaymentRecord,
} from "@/lib/payments-api";

/**
 * The customer profile's Payments tab. Everything comes from one
 * paymentAgreementDetails call: the agreement card shows the four agreement
 * types or the active agreement (activeAgreementExist), the left card lets an
 * agent submit a payment the customer reports for finance to verify, and the
 * right card is finance's side — post a payment directly, approve or reject
 * pending claims, and the verified/rejected history.
 */
export function PaymentsTab({
  uploadedDebtorId,
  canManageAgreements,
  canSubmitClaim,
  canVerify,
  onBalanceChanged,
}: {
  uploadedDebtorId: number;
  /** customers.payments.manageAgreements — create / cancel agreements. */
  canManageAgreements: boolean;
  /** customers.payments.submitClaim */
  canSubmitClaim: boolean;
  /** customers.payments.verify — post, approve, reject. */
  canVerify: boolean;
  /** A verified payment lowers the file's balance, so the profile reloads. */
  onBalanceChanged: () => void;
}) {
  const [data, setData] = useState<PaymentAgreementDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      getPaymentAgreementDetails(uploadedDebtorId)
        .then((d) => {
          setData(d);
          setLoadError(null);
        })
        .catch((err) =>
          setLoadError(err instanceof Error ? err.message : "Couldn't load payments."),
        ),
    [uploadedDebtorId],
  );

  useEffect(() => {
    setData(null);
    setLoadError(null);
    load();
  }, [load]);

  if (loadError && !data) {
    return (
      <PageCard>
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-destructive font-medium">{loadError}</p>
          <button
            onClick={load}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Try again
          </button>
        </div>
      </PageCard>
    );
  }

  if (!data) {
    return (
      <PageCard>
        <div className="px-6 py-10 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </PageCard>
    );
  }

  const balance = toMoney(data.debtorDetails.currentOutstandingBalance);

  return (
    <div className="space-y-4">
      <AgreementCard
        data={data}
        balance={balance}
        canManage={canManageAgreements}
        onChanged={load}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <VerificationRequestCard
          uploadedDebtorId={uploadedDebtorId}
          payments={data.paymentVerificationList}
          canSubmit={canSubmitClaim}
          onSubmitted={load}
        />
        <FinancePostedCard
          uploadedDebtorId={uploadedDebtorId}
          balance={balance}
          pending={data.paymentPendingList}
          history={data.paymentHistoryList}
          canVerify={canVerify}
          onRejected={load}
          onBalanceChanged={onBalanceChanged}
        />
      </div>
    </div>
  );
}

/* ------------------------------- Helpers -------------------------------- */

const TYPE_META: Record<PaymentAgreementType, { icon: ReactNode; desc: string; tone: string }> = {
  paymentInFull: {
    icon: <CircleDollarSign className="h-5 w-5" />,
    desc: "Customer agrees to pay the full outstanding balance in one payment, including applicable interest.",
    tone: "from-emerald-500/15 to-emerald-500/0 border-emerald-500/30",
  },
  settlementInFull: {
    icon: <Handshake className="h-5 w-5" />,
    desc: "Agent and customer agree on a reduced settlement amount that is less than the total balance. Interest amount is still captured.",
    tone: "from-blue-500/15 to-blue-500/0 border-blue-500/30",
  },
  paymentPlanAgreed: {
    icon: <CalendarClock className="h-5 w-5" />,
    desc: "Customer agrees to pay the outstanding amount through scheduled installments, with applicable interest.",
    tone: "from-violet-500/15 to-violet-500/0 border-violet-500/30",
  },
  promiseToPay: {
    icon: <ScrollText className="h-5 w-5" />,
    desc: "Customer promises to make a payment by a specific date, but no detailed plan has been finalized.",
    tone: "from-amber-500/15 to-amber-500/0 border-amber-500/30",
  },
};

const AGREEMENT_TYPES = Object.keys(TYPE_META) as PaymentAgreementType[];

/** Today as yyyy-mm-dd in local time, for native date inputs. */
function todayInput(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** dd/mm/yyyy in local time, for createdAt / updatedAt timestamps. */
function timestampDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function newestFirst<T extends { id: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => b.id - a.id);
}

function sumAmounts(list: PaymentRecord[]): number {
  return list.reduce((sum, p) => sum + toMoney(p.paymentAmountReceived), 0);
}

/** One-line summary of an agreement's terms, for the history list. */
function agreementHeadline(a: PaymentAgreementFields): string {
  switch (a.paymentAgreementType) {
    case "paymentInFull":
      return `Interest ${formatMoney(a.paymentInterestAmount)} · due ${paymentDateLabel(a.paymentDueDate)}`;
    case "settlementInFull":
      return `${formatMoney(a.paymentSettlementAmount)} settlement · due ${paymentDateLabel(a.paymentDueDate)}`;
    case "paymentPlanAgreed":
      return `${formatMoney(a.paymentInstallmentAmount)} × ${a.paymentNoOfInstallments ?? "—"} ${a.paymentFrequency ?? ""} from ${paymentDateLabel(a.paymentFirstPaymentDate)}`;
    case "promiseToPay":
      return `${formatMoney(a.paymentPromisedAmount)} by ${paymentDateLabel(a.paymentPromisedDate)}`;
    default:
      return "";
  }
}

/** Every term the agreement stores, for the active-agreement card. */
function agreementFacts(a: PaymentAgreementFields): { label: string; value: string }[] {
  const facts: { label: string; value: string | null | undefined }[] = [];
  switch (a.paymentAgreementType) {
    case "paymentInFull":
      facts.push(
        { label: "Interest", value: formatMoney(a.paymentInterestAmount) },
        { label: "Due date", value: paymentDateLabel(a.paymentDueDate) },
      );
      break;
    case "settlementInFull":
      facts.push(
        { label: "Settlement", value: formatMoney(a.paymentSettlementAmount) },
        { label: "Interest", value: formatMoney(a.paymentInterestAmount) },
        { label: "Due date", value: paymentDateLabel(a.paymentDueDate) },
        { label: "Approved by", value: a.paymentApprovedBy },
      );
      break;
    case "paymentPlanAgreed":
      facts.push(
        {
          label: "Installments",
          value: `${formatMoney(a.paymentInstallmentAmount)} × ${a.paymentNoOfInstallments ?? "—"}`,
        },
        { label: "Frequency", value: a.paymentFrequency },
        { label: "First payment", value: paymentDateLabel(a.paymentFirstPaymentDate) },
        { label: "Interest", value: formatMoney(a.paymentInterestAmount) },
      );
      break;
    case "promiseToPay":
      facts.push(
        { label: "Promised", value: formatMoney(a.paymentPromisedAmount) },
        { label: "Promise date", value: paymentDateLabel(a.paymentPromisedDate) },
      );
      break;
  }
  facts.push(
    { label: "Method", value: a.paymentMethod },
    { label: "Reference", value: a.paymentReferenceNumber },
  );
  return facts.filter((f): f is { label: string; value: string } => !!f.value);
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
      {children}
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </label>
  );
}

const INPUT = "w-full px-3 py-2 rounded-lg bg-background border border-border text-sm";

function MethodSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
      {PAYMENT_METHODS.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </NativeSelect>
  );
}

function ProofPicker({
  file,
  onChange,
  label,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:bg-muted text-xs cursor-pointer text-muted-foreground">
        <FileText className="h-3.5 w-3.5 shrink-0" />
        {file ? <span className="font-mono truncate">{file.name}</span> : <span>{label}</span>}
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            onChange(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </label>
      {file && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-muted-foreground hover:text-destructive px-2"
        >
          Remove
        </button>
      )}
    </div>
  );
}

function ProofLink({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-tenant hover:underline w-fit max-w-full"
    >
      <FileText className="h-3 w-3 shrink-0" />
      <span className="font-mono truncate">{documentFileName(url)}</span>
    </a>
  );
}

/* --------------------------- Payment agreement --------------------------- */

function AgreementCard({
  data,
  balance,
  canManage,
  onChanged,
}: {
  data: PaymentAgreementDetails;
  balance: number;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [openType, setOpenType] = useState<PaymentAgreementType | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const history = useMemo(() => newestFirst(data.agreementHistory), [data.agreementHistory]);
  const activeRow = history.find((a) => a.status === "active");
  const active = data.activeAgreementExist ? data.debtorDetails : null;

  return (
    <PageCard>
      <CardHead title="Payment Agreement" subtitle="Record how the customer has agreed to pay." />
      <div className="px-6 py-5 space-y-5">
        {active?.paymentAgreementType ? (
          <ActiveAgreement
            agreement={active}
            createdAt={activeRow?.createdAt}
            canManage={canManage}
            onCancel={() => setCancelOpen(true)}
          />
        ) : canManage ? (
          <div>
            <SectionLabel>Select an agreement type</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AGREEMENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOpenType(t)}
                  className={`text-left rounded-xl border bg-gradient-to-br ${TYPE_META[t].tone} p-4 transition hover:shadow-md`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-background/80 border border-border flex items-center justify-center shrink-0">
                      {TYPE_META[t].icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-sm">
                        {AGREEMENT_TYPE_LABEL[t]}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 leading-snug">
                        {TYPE_META[t].desc}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active agreement on this file.</p>
        )}

        {history.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground flex items-center gap-2">
            <Info className="h-3.5 w-3.5" /> No payment agreements recorded yet.
          </div>
        ) : (
          <div>
            <SectionLabel>Agreement history</SectionLabel>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {history.map((a) => (
                <AgreementHistoryRow key={a.id} agreement={a} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {openType && (
        <AgreementDialog
          type={openType}
          uploadedDebtorId={data.debtorDetails.uploadedDebtorId}
          balance={balance}
          onClose={() => setOpenType(null)}
          onCreated={() => {
            setOpenType(null);
            onChanged();
          }}
        />
      )}
      {cancelOpen && active?.paymentAgreementType && (
        <CancelAgreementDialog
          uploadedDebtorId={data.debtorDetails.uploadedDebtorId}
          typeLabel={AGREEMENT_TYPE_LABEL[active.paymentAgreementType]}
          onClose={() => setCancelOpen(false)}
          onCancelled={() => {
            setCancelOpen(false);
            onChanged();
          }}
        />
      )}
    </PageCard>
  );
}

function ActiveAgreement({
  agreement,
  createdAt,
  canManage,
  onCancel,
}: {
  agreement: PaymentAgreementFields;
  createdAt: string | undefined;
  canManage: boolean;
  onCancel: () => void;
}) {
  const type = agreement.paymentAgreementType!;
  return (
    <div className="rounded-xl border-2 border-[color:var(--tenant)]/30 bg-[color:var(--tenant)]/5 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
          {TYPE_META[type].icon}
        </div>
        {/* min width lets the Cancel button wrap below on a phone instead of squeezing this. */}
        <div className="flex-1 min-w-[12rem]">
          <div className="text-[10px] uppercase tracking-wider font-bold text-tenant">
            Active agreement
            {createdAt && (
              <span className="ml-2 font-semibold text-muted-foreground normal-case tracking-normal">
                since {timestampDateLabel(createdAt)}
              </span>
            )}
          </div>
          <div className="font-display font-bold text-base mt-0.5">
            {AGREEMENT_TYPE_LABEL[type]}
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {agreementFacts(agreement).map((f) => (
              <div key={f.label} className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </div>
                <div className="text-sm truncate">{f.value}</div>
              </div>
            ))}
          </div>
          {agreement.paymentNotes && (
            <div className="mt-2 text-xs italic text-muted-foreground">
              "{agreement.paymentNotes}"
            </div>
          )}
          {agreement.paymentUploadProof && (
            <div className="mt-2 text-xs">
              <ProofLink url={agreement.paymentUploadProof} />
            </div>
          )}
        </div>
        {canManage && (
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted shrink-0"
          >
            Cancel agreement
          </button>
        )}
      </div>
    </div>
  );
}

function AgreementHistoryRow({ agreement }: { agreement: PaymentAgreement }) {
  const isActive = agreement.status === "active";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
      <span className="font-semibold">
        {agreement.paymentAgreementType
          ? AGREEMENT_TYPE_LABEL[agreement.paymentAgreementType]
          : "Agreement"}
      </span>
      <span className="text-muted-foreground">{agreementHeadline(agreement)}</span>
      <Pill tone={isActive ? "success" : "muted"}>{agreement.status}</Pill>
      <span className="ml-auto text-muted-foreground">
        {isActive
          ? `Created ${timestampDateLabel(agreement.createdAt)}`
          : `Cancelled ${timestampDateLabel(agreement.updatedAt)}`}
      </span>
    </li>
  );
}

function CancelAgreementDialog({
  uploadedDebtorId,
  typeLabel,
  onClose,
  onCancelled,
}: {
  uploadedDebtorId: number;
  typeLabel: string;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await cancelPaymentAgreement(uploadedDebtorId);
      toast.success("Agreement cancelled.");
      onCancelled();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel the agreement.");
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="font-display font-bold text-base">Cancel agreement</div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="px-5 py-4 text-sm text-muted-foreground">
          Cancel the active {typeLabel} agreement? It stays in the agreement history as cancelled,
          and you can record a new agreement afterwards.
        </p>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Keep it
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Cancel agreement
          </button>
        </div>
      </div>
    </div>
  );
}

// Backend values for the plan fields. "monthly amount" and "monthly" are the
// ones in the backend's Postman example; the rest follow the same style.
const COMPUTE_BY_AMOUNT = "monthly amount";
const COMPUTE_BY_COUNT = "number of installments";
const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "weekly", label: "Weekly" },
];

function AgreementDialog({
  type,
  uploadedDebtorId,
  balance,
  onClose,
  onCreated,
}: {
  type: PaymentAgreementType;
  uploadedDebtorId: number;
  balance: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [interest, setInterest] = useState("0");
  const [dueDate, setDueDate] = useState(todayInput());
  const [method, setMethod] = useState<string>("Bank Transfer");
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [settlement, setSettlement] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [computeBy, setComputeBy] = useState(COMPUTE_BY_AMOUNT);
  const [installment, setInstallment] = useState("");
  const [count, setCount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [firstDate, setFirstDate] = useState(todayInput());
  const [promised, setPromised] = useState("");
  const [promiseDate, setPromiseDate] = useState(todayInput());
  const [busy, setBusy] = useState(false);

  const interestN = toMoney(interest);
  const settlementN = toMoney(settlement);
  const totalPayable = type === "settlementInFull" ? settlementN + interestN : balance + interestN;

  // A plan is entered as an installment amount or a count; the other is derived.
  const plan = useMemo(() => {
    if (computeBy === COMPUTE_BY_AMOUNT) {
      const amount = toMoney(installment);
      return { amount, count: amount > 0 ? Math.ceil(totalPayable / amount) : 0 };
    }
    const c = Math.floor(toMoney(count));
    return { amount: c > 0 ? Math.round((totalPayable / c) * 100) / 100 : 0, count: c };
  }, [computeBy, installment, count, totalPayable]);

  const hasProof = type === "paymentInFull" || type === "settlementInFull";

  const validate = (): string | null => {
    if (interestN < 0) return "Interest can't be negative.";
    if (type === "paymentInFull" || type === "settlementInFull") {
      if (!dueDate) return "Due date is required.";
      if (dueDate < todayInput()) return "Due date can't be in the past.";
    }
    if (type === "settlementInFull") {
      if (settlementN <= 0) return "Settlement amount is required.";
      if (settlementN >= balance) return "Settlement amount must be less than the balance.";
      if (!approvedBy.trim()) return "Record who approved this settlement.";
    }
    if (type === "paymentPlanAgreed") {
      if (plan.amount <= 0 || plan.count <= 0) return "Enter an installment amount or count.";
      if (!firstDate) return "First payment date is required.";
    }
    if (type === "promiseToPay") {
      if (toMoney(promised) <= 0) return "Promised amount is required.";
      if (!promiseDate) return "Promise date is required.";
      if (promiseDate < todayInput()) return "Promise date can't be in the past.";
    }
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      const proofUrl = hasProof && proof ? await uploadPaymentFile(proof) : null;
      const common = { uploadedDebtorId, paymentMethod: method, paymentNotes: notes.trim() };
      let input: CreatePaymentAgreementInput;
      switch (type) {
        case "paymentInFull":
          input = {
            ...common,
            paymentAgreementType: type,
            paymentInterestAmount: interestN.toFixed(2),
            paymentDueDate: inputDateToPaymentDate(dueDate),
            paymentReferenceNumber: reference.trim(),
            paymentUploadProof: proofUrl,
          };
          break;
        case "settlementInFull":
          input = {
            ...common,
            paymentAgreementType: type,
            paymentSettlementAmount: settlementN.toFixed(2),
            paymentInterestAmount: interestN.toFixed(2),
            paymentDueDate: inputDateToPaymentDate(dueDate),
            paymentReferenceNumber: reference.trim(),
            paymentApprovedBy: approvedBy.trim(),
            paymentUploadProof: proofUrl,
          };
          break;
        case "paymentPlanAgreed":
          input = {
            ...common,
            paymentAgreementType: type,
            paymentInterestAmount: interestN.toFixed(2),
            paymentComputeBy: computeBy,
            paymentFrequency: frequency,
            paymentInstallmentAmount: plan.amount.toFixed(2),
            paymentNoOfInstallments: String(plan.count),
            paymentFirstPaymentDate: inputDateToPaymentDate(firstDate),
          };
          break;
        case "promiseToPay":
          input = {
            ...common,
            paymentAgreementType: type,
            paymentPromisedAmount: toMoney(promised).toFixed(2),
            paymentPromisedDate: inputDateToPaymentDate(promiseDate),
          };
          break;
      }
      await createPaymentAgreement(input);
      toast.success(`${AGREEMENT_TYPE_LABEL[type]} agreement recorded.`);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't record the agreement.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted border border-border flex items-center justify-center">
              {TYPE_META[type].icon}
            </div>
            <div className="font-display font-bold text-base">{AGREEMENT_TYPE_LABEL[type]}</div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          {type !== "promiseToPay" && (
            <FormField label="Current balance">
              <input value={formatMoney(balance)} readOnly className={`${INPUT} bg-muted`} />
            </FormField>
          )}

          {type === "settlementInFull" && (
            <FormField label="Settlement amount" hint="Must be less than the current balance.">
              <input
                type="number"
                min="0"
                step="0.01"
                value={settlement}
                onChange={(e) => setSettlement(e.target.value)}
                placeholder="$"
                className={INPUT}
              />
            </FormField>
          )}

          {type !== "promiseToPay" && (
            <FormField label="Interest amount">
              <input
                type="number"
                min="0"
                step="0.01"
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                placeholder="$"
                className={INPUT}
              />
            </FormField>
          )}

          {type === "promiseToPay" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Promised amount">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={promised}
                  onChange={(e) => setPromised(e.target.value)}
                  placeholder="$"
                  className={INPUT}
                />
              </FormField>
              <FormField label="Promise date">
                <input
                  type="date"
                  value={promiseDate}
                  onChange={(e) => setPromiseDate(e.target.value)}
                  className={INPUT}
                />
              </FormField>
            </div>
          )}

          {type !== "promiseToPay" && (
            <div className="rounded-lg border border-[color:var(--tenant)]/30 bg-[color:var(--tenant)]/5 p-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                {type === "settlementInFull" ? "Total settlement payable" : "Total payable"}
              </span>
              <span className="font-display font-bold text-base">{formatMoney(totalPayable)}</span>
            </div>
          )}

          {type === "paymentPlanAgreed" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Compute by">
                  <NativeSelect value={computeBy} onChange={(e) => setComputeBy(e.target.value)}>
                    <option value={COMPUTE_BY_AMOUNT}>Installment amount → count</option>
                    <option value={COMPUTE_BY_COUNT}>Installment count → amount</option>
                  </NativeSelect>
                </FormField>
                <FormField label="Frequency">
                  <NativeSelect value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Installment amount">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={computeBy !== COMPUTE_BY_AMOUNT}
                    value={computeBy === COMPUTE_BY_AMOUNT ? installment : plan.amount || ""}
                    onChange={(e) => setInstallment(e.target.value)}
                    placeholder="$"
                    className={`${INPUT} disabled:opacity-60`}
                  />
                </FormField>
                <FormField label="Number of installments">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    disabled={computeBy !== COMPUTE_BY_COUNT}
                    value={computeBy === COMPUTE_BY_COUNT ? count : plan.count || ""}
                    onChange={(e) => setCount(e.target.value)}
                    placeholder="e.g. 12"
                    className={`${INPUT} disabled:opacity-60`}
                  />
                </FormField>
              </div>
              <FormField label="First payment date">
                <input
                  type="date"
                  value={firstDate}
                  onChange={(e) => setFirstDate(e.target.value)}
                  className={INPUT}
                />
              </FormField>
            </>
          )}

          {(type === "paymentInFull" || type === "settlementInFull") && (
            <FormField label="Due date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={INPUT}
              />
            </FormField>
          )}

          <FormField label="Payment method">
            <MethodSelect value={method} onChange={setMethod} />
          </FormField>

          {type === "settlementInFull" && (
            <FormField label="Approved by" hint="The manager who approved the reduced settlement.">
              <input
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                placeholder="Manager name"
                className={INPUT}
              />
            </FormField>
          )}

          {hasProof && (
            <>
              <FormField
                label="Reference number"
                hint="Optional — transaction ID, cheque number, etc."
              >
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. TXN-12345"
                  className={INPUT}
                />
              </FormField>
              <ProofPicker
                file={proof}
                onChange={setProof}
                label="Upload proof — receipt, screenshot, bank confirmation (optional)"
              />
            </>
          )}

          <FormField label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={INPUT}
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tenant text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Record agreement
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Payment form ----------------------------- */

/** The payment entry form, shared by the agent's claim and finance's direct post. */
function PaymentEntryForm({
  uploadedDebtorId,
  copy,
  defaultMethod,
  submitIcon,
  preview,
  onSubmit,
}: {
  uploadedDebtorId: number;
  copy: {
    amount: string;
    date: string;
    reference: string;
    referencePlaceholder: string;
    notesPlaceholder: string;
    proof: string;
    submit: string;
  };
  defaultMethod: string;
  submitIcon?: ReactNode;
  /** Extra line under the fields, given the entered amount. */
  preview?: (amount: number) => ReactNode;
  onSubmit: (input: PaymentInput) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(defaultMethod);
  const [date, setDate] = useState(todayInput());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const amountN = toMoney(amount);

  const submit = async () => {
    if (amountN <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (!date) {
      toast.error("Pick the payment date.");
      return;
    }
    setBusy(true);
    try {
      const proofUrl = proof ? await uploadPaymentFile(proof) : null;
      await onSubmit({
        uploadedDebtorId,
        paymentAmountReceived: amountN,
        paymentMethod: method,
        paymentDate: inputDateToPaymentDate(date),
        paymentReferenceNumber: reference.trim(),
        paymentNotes: notes.trim(),
        paymentUploadProof: proofUrl,
      });
      setAmount("");
      setReference("");
      setNotes("");
      setProof(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that payment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <FormField label={copy.amount}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="$"
            className={INPUT}
          />
        </FormField>
        <FormField label="Payment method">
          <MethodSelect value={method} onChange={setMethod} />
        </FormField>
        <FormField label={copy.date}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={INPUT}
          />
        </FormField>
      </div>
      <FormField label={copy.reference}>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={copy.referencePlaceholder}
          className={INPUT}
        />
      </FormField>
      <FormField label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={copy.notesPlaceholder}
          rows={2}
          className={INPUT}
        />
      </FormField>
      <ProofPicker file={proof} onChange={setProof} label={copy.proof} />
      {preview?.(amountN)}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : submitIcon}
        {copy.submit}
      </button>
    </div>
  );
}

const STATUS_PILL: Record<
  string,
  {
    tone: Parameters<typeof Pill>[0]["tone"];
    icon: ReactNode;
    label: string;
    /** Pill's warning text is unreadable on its dark-mode background. */
    className?: string;
  }
> = {
  pending: {
    tone: "warning",
    icon: <Clock className="h-3 w-3" />,
    label: "Pending finance review",
    className: "dark:text-warning",
  },
  verified: { tone: "success", icon: <ShieldCheck className="h-3 w-3" />, label: "Verified" },
  rejected: { tone: "danger", icon: <XCircle className="h-3 w-3" />, label: "Rejected" },
};

function PaymentRow({ payment, children }: { payment: PaymentRecord; children?: ReactNode }) {
  const pill = STATUS_PILL[payment.status] ?? {
    tone: "muted" as const,
    icon: null,
    label: payment.status,
  };
  return (
    <li className="py-3 space-y-1 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold">{formatMoney(payment.paymentAmountReceived)}</span>
        <span className="text-muted-foreground">
          {payment.paymentMethod} · paid {paymentDateLabel(payment.paymentDate)}
        </span>
        <Pill tone={pill.tone}>
          <span className={`inline-flex items-center gap-1 ${pill.className ?? ""}`}>
            {pill.icon} {pill.label}
          </span>
        </Pill>
        {payment.createdUserName && (
          <span className="ml-auto text-muted-foreground">By {payment.createdUserName}</span>
        )}
      </div>
      {payment.paymentReferenceNumber && (
        <div className="text-muted-foreground font-mono">Ref: {payment.paymentReferenceNumber}</div>
      )}
      {payment.paymentNotes && (
        <div className="text-muted-foreground italic">"{payment.paymentNotes}"</div>
      )}
      <ProofLink url={payment.paymentUploadProof} />
      {children}
    </li>
  );
}

/* ------------------------ Payment verification request ------------------- */

function VerificationRequestCard({
  uploadedDebtorId,
  payments,
  canSubmit,
  onSubmitted,
}: {
  uploadedDebtorId: number;
  payments: PaymentRecord[];
  canSubmit: boolean;
  onSubmitted: () => void;
}) {
  const rows = useMemo(() => newestFirst(payments), [payments]);
  return (
    <PageCard>
      <CardHead
        title="Payment Verification Request"
        subtitle="Agent submits a payment claim — Finance verifies before the balance is updated"
      />
      <div className="px-6 py-5 space-y-4 text-sm">
        {canSubmit && (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 p-2.5 text-xs">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-info" />
              <div>
                You are <span className="font-semibold">not posting a payment</span>. You are
                submitting a claim for the Finance team to verify and post.
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5 text-destructive" />
              <div>
                <span className="font-semibold text-destructive">
                  Never collect card numbers, CVV, or expiry dates.
                </span>{" "}
                Agents are not authorised to handle sensitive cardholder data. Record only what the
                customer reports.
              </div>
            </div>
            <div>
              <SectionLabel>Submit payment claim</SectionLabel>
              <PaymentEntryForm
                uploadedDebtorId={uploadedDebtorId}
                defaultMethod="Card"
                copy={{
                  amount: "Amount customer claims",
                  date: "Payment date",
                  reference: "Reference number (if available)",
                  referencePlaceholder: "e.g. confirmation #, last-4, transaction id",
                  notesPlaceholder: "What did the customer say? Any context for finance?",
                  proof: "Upload proof / confirmation (optional)",
                  submit: "Submit for finance verification",
                }}
                onSubmit={async (input) => {
                  await submitForVerification(input);
                  toast.success("Payment claim submitted for finance verification.");
                  onSubmitted();
                }}
              />
            </div>
          </>
        )}

        <div>
          <SectionLabel>Claims & payments</SectionLabel>
          {rows.length === 0 ? (
            <div className="text-xs text-muted-foreground">No payment claims yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((p) => (
                <PaymentRow key={p.id} payment={p} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageCard>
  );
}

/* ------------------------- Finance posted payments ----------------------- */

function FinancePostedCard({
  uploadedDebtorId,
  balance,
  pending,
  history,
  canVerify,
  onRejected,
  onBalanceChanged,
}: {
  uploadedDebtorId: number;
  balance: number;
  pending: PaymentRecord[];
  history: PaymentRecord[];
  canVerify: boolean;
  onRejected: () => void;
  onBalanceChanged: () => void;
}) {
  const [actingId, setActingId] = useState<number | null>(null);
  const pendingRows = useMemo(() => newestFirst(pending), [pending]);
  const historyRows = useMemo(() => newestFirst(history), [history]);
  const posted = sumAmounts(history.filter((p) => p.status === "verified"));

  const act = async (payment: PaymentRecord, action: "approve" | "reject") => {
    setActingId(payment.id);
    try {
      if (action === "approve") {
        await approvePayment(uploadedDebtorId, payment.id);
        toast.success(`Approved ${formatMoney(payment.paymentAmountReceived)}.`);
        onBalanceChanged();
      } else {
        await rejectPayment(uploadedDebtorId, payment.id);
        toast.success("Claim rejected — balance unchanged.");
        onRejected();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Couldn't ${action} that claim.`);
    } finally {
      setActingId(null);
    }
  };

  return (
    <PageCard>
      <CardHead
        title="Finance Posted Payments"
        subtitle="Verified payments — updates the actual outstanding balance"
      />
      <div className="px-6 py-5 space-y-4 text-sm">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Pending
            </div>
            <div className="font-display font-bold text-warning">
              {formatMoney(sumAmounts(pending))}
            </div>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/5 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Posted</div>
            <div className="font-display font-bold text-success">{formatMoney(posted)}</div>
          </div>
          <div className="rounded-lg border border-[color:var(--tenant)]/30 bg-[color:var(--tenant)]/5 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Outstanding
            </div>
            <div className="font-display font-bold text-tenant">{formatMoney(balance)}</div>
          </div>
        </div>

        {canVerify ? (
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Post verified payment
            </div>
            <PaymentEntryForm
              uploadedDebtorId={uploadedDebtorId}
              defaultMethod="Bank Transfer"
              submitIcon={<Banknote className="h-4 w-4" />}
              copy={{
                amount: "Amount received",
                date: "Received date",
                reference: "Bank reference",
                referencePlaceholder: "e.g. bank transaction id",
                notesPlaceholder: "Notes",
                proof: "Upload bank statement / proof",
                submit: "Post payment & update balance",
              }}
              preview={(amount) =>
                amount > 0 && (
                  <div className="text-xs text-muted-foreground">
                    New balance after posting{" "}
                    <span className="font-semibold text-foreground">
                      {formatMoney(Math.max(balance - amount, 0))}
                    </span>
                  </div>
                )
              }
              onSubmit={async (input) => {
                await postPaymentReceived(input);
                toast.success(`Posted ${formatMoney(input.paymentAmountReceived)}.`);
                onBalanceChanged();
              }}
            />
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-2.5 text-xs">
            <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
            <div>
              <span className="font-semibold">Read-only.</span> Posting payments and verifying
              claims needs the Payments "Verify & post" permission.
            </div>
          </div>
        )}

        {canVerify && (
          <div>
            <SectionLabel>Pending verification requests ({pendingRows.length})</SectionLabel>
            {pendingRows.length === 0 ? (
              <div className="text-xs text-muted-foreground">No agent claims awaiting review.</div>
            ) : (
              <ul className="divide-y divide-border">
                {pendingRows.map((p) => (
                  <PaymentRow key={p.id} payment={p}>
                    <div className="rounded border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
                      If approved, the balance becomes{" "}
                      <span className="font-semibold text-foreground">
                        {formatMoney(Math.max(balance - toMoney(p.paymentAmountReceived), 0))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => act(p, "approve")}
                        disabled={actingId !== null}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md bg-success text-success-foreground text-xs font-semibold disabled:opacity-50"
                      >
                        {actingId === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Approve & post payment
                      </button>
                      <button
                        onClick={() => act(p, "reject")}
                        disabled={actingId !== null}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-semibold disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject claim
                      </button>
                    </div>
                  </PaymentRow>
                ))}
              </ul>
            )}
          </div>
        )}

        <div>
          <SectionLabel>Payment history</SectionLabel>
          {historyRows.length === 0 ? (
            <div className="text-xs text-muted-foreground">No posted payments yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {historyRows.map((p) => (
                <PaymentRow key={p.id} payment={p} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageCard>
  );
}
