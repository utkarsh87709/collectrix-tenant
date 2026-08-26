// Right Party Verification (RPV) — Phase 1
// Reference / training aid + lightweight tracking. Not tenant-configurable yet.
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Bot, User, RefreshCw, AlertTriangle, CheckCircle2, XCircle, ArrowRightLeft, Clock, Info } from "lucide-react";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// ── Reference fields (fixed defaults for Phase 1) ────────────────────────────
const RPV_REFERENCE_FIELDS: { key: string; label: string; hint: string; aiCapable: boolean }[] = [
  { key: "date_of_birth",  label: "Date of birth",   hint: "DD / MM / YYYY", aiCapable: true },
  { key: "postal_code",    label: "Postal code",     hint: "On file address", aiCapable: true },
  { key: "address",        label: "Address",         hint: "Street + city",  aiCapable: true },
  { key: "last_name",      label: "Last name",       hint: "Full legal",     aiCapable: true },
  { key: "account_number", label: "Account number",  hint: "Last 4 digits",  aiCapable: true },
  { key: "phone_number",   label: "Phone number",    hint: "Primary on file", aiCapable: true },
  { key: "email",          label: "Email",           hint: "Primary on file", aiCapable: true },
];

// ── Persisted state ──────────────────────────────────────────────────────────
type Verifier = "ai" | "human";
type Outcome = "verified" | "failed" | "refused" | "transferred" | "pending";

type RPVAttempt = {
  at: string;
  verifier: Verifier;
  field: string;
  ok: boolean;
  note?: string;
  method?: string;
  question?: string;
  answer?: string;
};


type RPVState = {
  status: Outcome;
  verifiedBy?: Verifier;
  verifiedFields: string[];
  failedAttempts: number;
  finalOutcome?: Outcome;
  transferReason?: string;
  otherMethod?: string;     // "Other" manual verification method used by agent
  otherMethodNote?: string;
  lastUpdated?: string;
  attempts: RPVAttempt[];
};

const LS_PREFIX = "collectrix.rpv.v1.";
const EMPTY: RPVState = {
  status: "pending",
  verifiedFields: [],
  failedAttempts: 0,
  attempts: [],
};

function load(debtorId: string): RPVState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(LS_PREFIX + debtorId);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch { /* noop */ }
  return EMPTY;
}
function save(debtorId: string, s: RPVState) {
  try { localStorage.setItem(LS_PREFIX + debtorId, JSON.stringify(s)); } catch { /* noop */ }
}

const TONE: Record<Outcome, "muted" | "tenant" | "success" | "warning" | "danger" | "info"> = {
  pending: "muted",
  verified: "success",
  failed: "danger",
  refused: "warning",
  transferred: "info",
};

export function RPVCard({ debtorId }: { debtorId: string }) {
  const [state, setState] = useState<RPVState>(EMPTY);
  useEffect(() => { setState(load(debtorId)); }, [debtorId]);

  const update = (next: RPVState) => {
    next.lastUpdated = new Date().toISOString();
    setState(next);
    save(debtorId, next);
  };

  // ── AI attempt simulation ─────────────────────────────────────────────────
  const [aiRunning, setAiRunning] = useState(false);
  const runAI = async () => {
    setAiRunning(true);
    await new Promise((r) => setTimeout(r, 700));
    // Phase 1 stub: AI verifies a subset of fixed/default fields.
    const aiFields = ["date_of_birth", "postal_code", "last_name"];
    const success = Math.random() > 0.35;
    const now = new Date().toISOString();
    const attempts: RPVAttempt[] = aiFields.map((f) => ({
      at: now, verifier: "ai", field: f, ok: success,
    }));
    if (success) {
      update({
        ...state,
        status: "verified",
        verifiedBy: "ai",
        verifiedFields: Array.from(new Set([...state.verifiedFields, ...aiFields])),
        finalOutcome: "verified",
        attempts: [...state.attempts, ...attempts],
      });
      toast.success("AI verification successful");
    } else {
      update({
        ...state,
        status: "transferred",
        failedAttempts: state.failedAttempts + 1,
        transferReason: "AI could not confirm identity on default fields — transferred to human agent",
        attempts: [...state.attempts, ...attempts],
      });
      toast.warning("AI verification failed — transferred to human agent");
    }
    setAiRunning(false);
  };

  // ── Human manual verification form ─────────────────────────────────────────
  const [picked, setPicked] = useState<string[]>([]);
  const [method, setMethod] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [otherNote, setOtherNote] = useState("");
  const togglePick = (k: string) =>
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const resetForm = () => {
    setPicked([]); setMethod(""); setQuestion(""); setAnswer(""); setOtherNote("");
  };

  const confirmHuman = () => {
    if (picked.length === 0 && !method.trim() && !question.trim()) {
      toast.error("Select a verified field or fill in the verification method / question");
      return;
    }
    const now = new Date().toISOString();
    const attempts: RPVAttempt[] = picked.map((f) => ({
      at: now, verifier: "human", field: f, ok: true,
      method: method.trim() || undefined,
      question: question.trim() || undefined,
      answer: answer.trim() || undefined,
      note: otherNote.trim() || undefined,
    }));
    if (method.trim() || question.trim() || answer.trim()) {
      attempts.push({
        at: now,
        verifier: "human",
        field: method.trim() ? `method:${method.trim()}` : "manual",
        ok: true,
        method: method.trim() || undefined,
        question: question.trim() || undefined,
        answer: answer.trim() || undefined,
        note: otherNote.trim() || undefined,
      });
    }
    update({
      ...state,
      status: "verified",
      verifiedBy: "human",
      verifiedFields: Array.from(new Set([...state.verifiedFields, ...picked])),
      finalOutcome: "verified",
      otherMethod: method.trim() || state.otherMethod,
      otherMethodNote: otherNote.trim() || state.otherMethodNote,
      attempts: [...state.attempts, ...attempts],
    });
    resetForm();
    toast.success("Identity verified by agent");
  };

  const recordFailure = () => {
    const now = new Date().toISOString();
    update({
      ...state,
      status: "failed",
      failedAttempts: state.failedAttempts + 1,
      finalOutcome: "failed",
      attempts: [...state.attempts, {
        at: now,
        verifier: "human",
        field: method.trim() ? `method:${method.trim()}` : "—",
        ok: false,
        method: method.trim() || undefined,
        question: question.trim() || undefined,
        answer: answer.trim() || undefined,
        note: otherNote.trim() || "Agent could not verify identity",
      }],
    });
    resetForm();
    toast.error("Marked as failed");
  };


  const reset = () => {
    update({ ...EMPTY });
    toast.message("RPV reset");
  };

  const recent = useMemo(() => [...state.attempts].reverse().slice(0, 6), [state.attempts]);

  return (
    <PageCard>
      <CardHead
        title="Right Party Verification (RPV)"
        subtitle="Phase 1 reference guide — AI attempts first, human agent confirms if AI fails."
        action={
          <div className="flex items-center gap-2">
            <Pill tone={TONE[state.status]}>
              <ShieldCheck className="h-3 w-3" />
              {state.status.toUpperCase()}
            </Pill>
            {state.verifiedBy && (
              <Pill tone="muted">
                {state.verifiedBy === "ai" ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                {state.verifiedBy === "ai" ? "AI" : "Human agent"}
              </Pill>
            )}
            <Button variant="ghost" size="sm" onClick={reset} className="text-xs">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Reset
            </Button>
          </div>
        }
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: reference fields + AI */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              <Info className="h-3.5 w-3.5" /> Acceptable verification fields
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RPV_REFERENCE_FIELDS.map((f) => {
                const done = state.verifiedFields.includes(f.key);
                return (
                  <li key={f.key} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        {f.label}
                        {f.aiCapable && <Pill tone="info"><Bot className="h-3 w-3" />AI</Pill>}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{f.hint}</div>
                    </div>
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Checkbox checked={picked.includes(f.key)} onCheckedChange={() => togglePick(f.key)} />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2"><Bot className="h-4 w-4 text-info" />AI verification</div>
                <div className="text-xs text-muted-foreground">Attempts default fields. On failure, transfers to a human agent.</div>
              </div>
              <Button size="sm" onClick={runAI} disabled={aiRunning}>
                {aiRunning ? "Running…" : "Run AI verification"}
              </Button>
            </div>
            {state.transferReason && (
              <div className="flex items-start gap-2 rounded-md bg-warning/10 border border-warning/30 p-2 text-xs text-warning-foreground">
                <ArrowRightLeft className="h-3.5 w-3.5 mt-0.5" />
                <span>{state.transferReason}</span>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4 text-tenant" />Human agent — manual verification</div>
            <p className="text-xs text-muted-foreground">Tick the fields you confirmed and/or record the verification question you asked and the answer the customer gave.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rpv-method" className="text-xs">Verification method</Label>
                <Input id="rpv-method" placeholder="e.g. Security question, mother's maiden name…"
                  value={method} onChange={(e) => setMethod(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rpv-question" className="text-xs">Verification question</Label>
                <Input id="rpv-question" placeholder="e.g. What is your date of birth?"
                  value={question} onChange={(e) => setQuestion(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rpv-answer" className="text-xs">Answer provided by customer</Label>
                <Input id="rpv-answer" placeholder="Customer's response"
                  value={answer} onChange={(e) => setAnswer(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rpv-other-note" className="text-xs">Additional notes</Label>
                <Textarea id="rpv-other-note" rows={1} placeholder="Optional details"
                  value={otherNote} onChange={(e) => setOtherNote(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={confirmHuman}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Mark verified
              </Button>
              <Button size="sm" variant="outline" onClick={recordFailure}>
                <XCircle className="h-3.5 w-3.5 mr-1.5" />Record failure
              </Button>
            </div>
          </div>

        </div>

        {/* Right: tracking summary */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Tracking</div>
            <Row label="Verification status" value={<Pill tone={TONE[state.status]}>{state.status}</Pill>} />
            <Row label="Verified by" value={state.verifiedBy ? (state.verifiedBy === "ai" ? "AI" : "Human agent") : "—"} />
            <Row label="Fields verified" value={state.verifiedFields.length ? state.verifiedFields.join(", ") : "—"} />
            <Row label="Failed attempts" value={
              <span className={state.failedAttempts > 0 ? "text-destructive font-semibold" : ""}>
                {state.failedAttempts}
              </span>
            } />
            <Row label="Final outcome" value={state.finalOutcome ?? "—"} />
            <Row label="Transfer reason" value={state.transferReason ?? "—"} />
            <Row label="Other method" value={state.otherMethod ? `${state.otherMethod}${state.otherMethodNote ? ` — ${state.otherMethodNote}` : ""}` : "—"} />
            <Row label="Last updated" value={state.lastUpdated ? new Date(state.lastUpdated).toLocaleString() : "—"} />
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Recent attempts
            </div>
            {recent.length === 0 ? (
              <p className="text-xs text-muted-foreground">No attempts yet.</p>
            ) : (
              <ul className="space-y-2">
                {recent.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    {a.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5" /> : <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5" />}
                    <div className="flex-1">
                      <div className="font-medium">
                        {a.verifier === "ai" ? "AI" : "Agent"} • {a.method ?? a.field} • {a.ok ? "Verified" : "Not verified"}
                      </div>
                      {a.question && <div className="text-muted-foreground"><span className="font-semibold">Q:</span> {a.question}</div>}
                      {a.answer && <div className="text-muted-foreground"><span className="font-semibold">A:</span> {a.answer}</div>}
                      <div className="text-muted-foreground">{new Date(a.at).toLocaleString()}{a.note ? ` — ${a.note}` : ""}</div>
                    </div>
                  </li>
                ))}

              </ul>
            )}
          </div>

          <Separator />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Phase 1: RPV is a reference/training aid with fixed default fields. Full tenant-configurable RPV rules will be introduced in a later phase.
          </p>
        </div>
      </div>
    </PageCard>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-right text-sm font-medium max-w-[60%] break-words">{value}</span>
    </div>
  );
}
