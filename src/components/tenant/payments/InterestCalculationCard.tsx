// Interest calculation card — debtor profile, Payments tab.
// Permission-gated: view / edit / approve.

import { useMemo, useState } from "react";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { Percent, Lock, ShieldCheck, Pencil, Save, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

// TODO: replace with real RBAC from auth/permissions store.
// Demo role toggle keeps the UI explorable without a backend.
type InterestPerm = "view" | "edit" | "approve";
const DEMO_PERMS: InterestPerm[] = ["view", "edit", "approve"];

type InterestType = "simple" | "compound";
type CompoundFreq = "monthly" | "annually" | "custom";

type InterestModel = {
  principal: number;
  interestBefore: number;
  rate: number;            // annual %
  type: InterestType;
  frequency: CompoundFreq;
  customFreqDays?: number;
  assignmentDate: string;  // ISO date
  interestAfter: number;
};

function deriveFromDebtor(debtorId: string, balance: number): InterestModel {
  const seed = Array.from(debtorId).reduce((a, c) => a + c.charCodeAt(0), 0);
  const jitter = (n: number) => 0.85 + ((seed * n) % 30) / 100;
  const principal = Math.round(balance * 0.72 * jitter(3) * 100) / 100;
  const interestBefore = Math.round(balance * 0.11 * jitter(5) * 100) / 100;
  const interestAfter = Math.round(balance * 0.13 * jitter(7) * 100) / 100;
  const rate = Math.round((6 + (seed % 9)) * 10) / 10;
  const type: InterestType = seed % 2 === 0 ? "compound" : "simple";
  const frequency: CompoundFreq = seed % 3 === 0 ? "annually" : "monthly";
  const assignmentDate = new Date(Date.now() - ((seed % 200) + 60) * 86400000)
    .toISOString().slice(0, 10);
  return { principal, interestBefore, rate, type, frequency, assignmentDate, interestAfter };
}

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function InterestCalculationCard({ debtorId, balance }: { debtorId: string; balance: number }) {
  const [perms] = useState<InterestPerm[]>(DEMO_PERMS);
  const can = (p: InterestPerm) => perms.includes(p);

  const [model, setModel] = useState<InterestModel>(() => deriveFromDebtor(debtorId, balance));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<InterestModel>(model);
  const [pendingApproval, setPendingApproval] = useState<InterestModel | null>(null);

  const outstanding = useMemo(
    () => Math.round((model.principal + model.interestBefore + model.interestAfter) * 100) / 100,
    [model]
  );

  if (!can("view")) {
    return (
      <PageCard>
        <CardHead title="Interest calculation" subtitle="Restricted" />
        <div className="px-6 py-8 text-sm text-muted-foreground flex items-center gap-2">
          <Lock className="h-4 w-4" /> You do not have permission to view interest details.
        </div>
      </PageCard>
    );
  }

  const startEdit = () => { setDraft(model); setEditing(true); };
  const cancelEdit = () => { setEditing(false); };

  const saveOrRequest = () => {
    const materialChange =
      Math.abs(draft.rate - model.rate) > 0.5 ||
      draft.type !== model.type ||
      draft.frequency !== model.frequency;
    if (materialChange && !can("approve")) {
      setPendingApproval(draft);
      setEditing(false);
      toast.success("Adjustment submitted for approval");
      return;
    }
    setModel(draft);
    setEditing(false);
    toast.success("Interest settings updated");
  };

  const approve = () => {
    if (!pendingApproval) return;
    setModel(pendingApproval);
    setPendingApproval(null);
    toast.success("Interest adjustment approved");
  };

  const view = editing ? draft : model;
  const setF = <K extends keyof InterestModel>(k: K, v: InterestModel[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <PageCard>
      <CardHead
        title="Interest calculation"
        subtitle="Principal, accrued interest, rate & method"
        action={
          <div className="flex items-center gap-2">
            <Pill tone={can("approve") ? "tenant" : can("edit") ? "info" : "muted"}>
              <ShieldCheck className="h-3 w-3" />
              {can("approve") ? "Approver" : can("edit") ? "Editor" : "Viewer"}
            </Pill>
            {!editing && can("edit") && (
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-xs font-semibold hover:bg-muted"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
          </div>
        }
      />

      {pendingApproval && (
        <div className="px-6 py-3 border-b border-border bg-warning/10 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div className="text-xs flex-1">
            <div className="font-semibold">Adjustment pending approval</div>
            <div className="text-muted-foreground">
              Rate {pendingApproval.rate}% · {pendingApproval.type} · {pendingApproval.frequency}
            </div>
          </div>
          {can("approve") && (
            <button
              onClick={approve}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-success text-white text-xs font-semibold"
            >
              <CheckCircle2 className="h-3 w-3" /> Approve
            </button>
          )}
          <button
            onClick={() => setPendingApproval(null)}
            className="px-2 py-1 rounded-md border border-border text-xs hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label="Principal amount">
          {editing
            ? <NumInput value={view.principal} onChange={(v) => setF("principal", v)} prefix="$" />
            : <Val>{money(view.principal)}</Val>}
        </Field>

        <Field label="Interest rate (annual)">
          {editing
            ? <NumInput value={view.rate} onChange={(v) => setF("rate", v)} suffix="%" step={0.1} />
            : <Val><Percent className="h-3 w-3 inline mr-1" />{view.rate}%</Val>}
        </Field>

        <Field label="Accrued interest before assignment">
          {editing
            ? <NumInput value={view.interestBefore} onChange={(v) => setF("interestBefore", v)} prefix="$" />
            : <Val>{money(view.interestBefore)}</Val>}
        </Field>

        <Field label="Accrued interest after assignment">
          {editing
            ? <NumInput value={view.interestAfter} onChange={(v) => setF("interestAfter", v)} prefix="$" />
            : <Val>{money(view.interestAfter)}</Val>}
        </Field>

        <Field label="Interest type">
          {editing ? (
            <select
              value={view.type}
              onChange={(e) => setF("type", e.target.value as InterestType)}
              className="px-2 py-1.5 rounded-md bg-background border border-border text-sm w-full"
            >
              <option value="simple">Simple interest</option>
              <option value="compound">Compound interest</option>
            </select>
          ) : (
            <Val className="capitalize">{view.type} interest</Val>
          )}
        </Field>

        <Field label="Compounding frequency">
          {editing ? (
            <div className="flex gap-2">
              <select
                value={view.frequency}
                onChange={(e) => setF("frequency", e.target.value as CompoundFreq)}
                disabled={view.type === "simple"}
                className="px-2 py-1.5 rounded-md bg-background border border-border text-sm flex-1 disabled:opacity-50"
              >
                <option value="monthly">Monthly</option>
                <option value="annually">Annually</option>
                <option value="custom">Custom</option>
              </select>
              {view.frequency === "custom" && view.type === "compound" && (
                <NumInput
                  value={view.customFreqDays ?? 30}
                  onChange={(v) => setF("customFreqDays", v)}
                  suffix="d"
                />
              )}
            </div>
          ) : (
            <Val className="capitalize">
              {view.type === "simple"
                ? "—"
                : view.frequency === "custom"
                  ? `Every ${view.customFreqDays ?? 30} days`
                  : view.frequency}
            </Val>
          )}
        </Field>

        <Field label="Assignment date">
          {editing ? (
            <input
              type="date"
              value={view.assignmentDate}
              onChange={(e) => setF("assignmentDate", e.target.value)}
              className="px-2 py-1.5 rounded-md bg-background border border-border text-sm w-full"
            />
          ) : (
            <Val>{new Date(view.assignmentDate).toLocaleDateString()}</Val>
          )}
        </Field>

        <Field label="Total outstanding balance">
          <Val className="text-tenant font-bold text-base">
            {money(
              editing
                ? Math.round((draft.principal + draft.interestBefore + draft.interestAfter) * 100) / 100
                : outstanding
            )}
          </Val>
        </Field>
      </div>

      {editing && (
        <div className="px-6 py-3 border-t border-border flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {can("approve")
              ? "Changes apply immediately."
              : "Material changes (rate / type / frequency) require approver sign-off."}
          </div>
          <div className="flex gap-2">
            <button onClick={cancelEdit} className="px-3 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted">
              Cancel
            </button>
            <button onClick={saveOrRequest} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-gradient-tenant text-white text-xs font-semibold shadow-tenant">
              <Save className="h-3 w-3" /> {can("approve") ? "Save" : "Submit for approval"}
            </button>
          </div>
        </div>
      )}
    </PageCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</div>
      {children}
    </div>
  );
}

function Val({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`font-display tabular-nums text-sm font-semibold ${className}`}>{children}</div>;
}

function NumInput({
  value, onChange, prefix, suffix, step = 0.01,
}: { value: number; onChange: (v: number) => void; prefix?: string; suffix?: string; step?: number }) {
  return (
    <div className="relative">
      {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`w-full py-1.5 rounded-md bg-background border border-border text-sm tabular-nums ${prefix ? "pl-6" : "pl-2"} ${suffix ? "pr-7" : "pr-2"}`}
      />
      {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}
