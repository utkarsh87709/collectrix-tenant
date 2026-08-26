import { useMemo, useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  EyeOff,
  Pencil,
  History,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import {
  useValidationIssues,
  setIssueStatus,
  useValidationPolicy,
  type ValidationIssue,
  type IssueSeverity,
} from "@/lib/validation-issues-store";
import { toast } from "sonner";

// In a real build the role would come from the auth context. For now the
// tenant admin policy editor is gated by a simple flag derived from local
// preview state. Non-admins still see the policy in read-only form.
const IS_TENANT_ADMIN = true;

const SEVERITY_RANK: Record<IssueSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function DataValidationCard({ debtorId }: { debtorId: string }) {
  const issues = useValidationIssues(debtorId);
  const [filter, setFilter] = useState<"all" | IssueSeverity | "open">("open");

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, info: 0, open: 0, fixed: 0, ignored: 0, acknowledged: 0 };
    for (const i of issues) {
      c[i.severity]++;
      if (i.status === "pending") c.open++;
      else if (i.status === "fixed") c.fixed++;
      else if (i.status === "ignored") c.ignored++;
      else if (i.status === "acknowledged") c.acknowledged++;
    }
    return c;
  }, [issues]);

  const visible = useMemo(() => {
    const list = issues.filter((i) => {
      if (filter === "all") return true;
      if (filter === "open") return i.status === "pending";
      return i.severity === filter;
    });
    return [...list].sort(
      (a, b) =>
        (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) ||
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
    );
  }, [issues, filter]);

  return (
    <PageCard>
      <CardHead
        title="Data Validation"
        subtitle="Issues detected during intake — separate from RPV. Fix, acknowledge, or ignore each finding to clear the record."
        action={
          <div className="flex items-center gap-1.5">
            <Pill tone={counts.critical > 0 ? "danger" : "muted"}>{counts.critical} critical</Pill>
            <Pill tone={counts.warning > 0 ? "warning" : "muted"}>{counts.warning} warning</Pill>
            <Pill tone="info">{counts.info} info</Pill>
          </div>
        }
      />

      <TenantPolicyBanner />

      {issues.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="px-6 pt-4 flex items-center gap-2 flex-wrap">
            <FilterChip active={filter === "open"} onClick={() => setFilter("open")}>
              Open ({counts.open})
            </FilterChip>
            <FilterChip active={filter === "critical"} onClick={() => setFilter("critical")}>
              Critical ({counts.critical})
            </FilterChip>
            <FilterChip active={filter === "warning"} onClick={() => setFilter("warning")}>
              Warning ({counts.warning})
            </FilterChip>
            <FilterChip active={filter === "info"} onClick={() => setFilter("info")}>
              Info ({counts.info})
            </FilterChip>
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All ({issues.length})
            </FilterChip>
          </div>

          <ul className="divide-y divide-border mt-3">
            {visible.map((i) => (
              <IssueRow key={i.id} issue={i} />
            ))}
          </ul>
        </>
      )}
    </PageCard>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-10 text-center">
      <ShieldCheck className="h-7 w-7 mx-auto text-success" />
      <p className="mt-2 text-sm font-semibold">No validation issues for this customer</p>
      <p className="text-xs text-muted-foreground">
        Intake completed without flagging any fields. New issues will appear here automatically.
      </p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
        active
          ? "bg-foreground text-background border-foreground"
          : "border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

// ── Tenant policy ──────────────────────────────────────────────────────────

function TenantPolicyBanner() {
  const [policy, setPolicy] = useValidationPolicy();
  const [open, setOpen] = useState(false);

  const labelByValue = {
    yes: "Allowed — users may proceed",
    no: "Blocked — critical must be resolved",
    manager_approval: "Manager approval required",
    reason_required: "Acknowledgement reason required",
  } as const;

  return (
    <div className="mx-6 mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 mt-0.5 text-tenant" />
          <div className="text-xs">
            <div className="font-semibold text-foreground">Tenant policy · critical issues</div>
            <div className="text-muted-foreground">
              {labelByValue[policy.proceedOnCritical]}
            </div>
          </div>
        </div>
        {IS_TENANT_ADMIN && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs font-semibold text-tenant hover:underline"
          >
            {open ? "Hide settings" : "Edit policy"}
          </button>
        )}
      </div>

      {open && IS_TENANT_ADMIN && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(labelByValue) as Array<keyof typeof labelByValue>).map((key) => (
            <label
              key={key}
              className={`flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer ${
                policy.proceedOnCritical === key
                  ? "border-tenant bg-tenant-soft"
                  : "border-border hover:bg-muted"
              }`}
            >
              <input
                type="radio"
                name="proceedOnCritical"
                className="mt-0.5"
                checked={policy.proceedOnCritical === key}
                onChange={() => {
                  setPolicy({ ...policy, proceedOnCritical: key });
                  toast.success("Validation policy updated");
                }}
              />
              <span className="text-xs">
                <span className="block font-semibold capitalize">{key.replace(/_/g, " ")}</span>
                <span className="block text-muted-foreground">{labelByValue[key]}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Issue row ──────────────────────────────────────────────────────────────

function severityVisual(s: IssueSeverity) {
  switch (s) {
    case "critical":
      return { icon: AlertCircle, tone: "danger" as const, text: "text-destructive", label: "Critical" };
    case "warning":
      return { icon: AlertTriangle, tone: "warning" as const, text: "text-warning", label: "Warning" };
    case "info":
      return { icon: Info, tone: "info" as const, text: "text-info-foreground", label: "Info" };
  }
}

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(issue.recommendedFix ? "" : issue.currentValue ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const [ignoreReason, setIgnoreReason] = useState("");
  const [showIgnoreInput, setShowIgnoreInput] = useState(false);

  const { policy } = { policy: useValidationPolicy()[0] };
  const sv = severityVisual(issue.severity);
  const Icon = sv.icon;
  const isDone = issue.status !== "pending";

  const handleApplyFix = () => {
    const v = value.trim();
    if (!v) return toast.error("Enter a corrected value");
    setIssueStatus(issue.id, "fixed", "You", `Updated to "${v}"`);
    setEditing(false);
    toast.success("Field updated and marked fixed");
  };

  const handleIgnore = () => {
    if (issue.severity === "critical") {
      // Policy gating
      if (policy.proceedOnCritical === "no") {
        return toast.error("Tenant policy blocks ignoring critical issues. Fix or escalate to a manager.");
      }
      if (!showIgnoreInput) {
        setShowIgnoreInput(true);
        return;
      }
      if (!ignoreReason.trim()) {
        return toast.error("A reason is required to ignore a critical issue");
      }
      const note =
        policy.proceedOnCritical === "manager_approval"
          ? `Ignored (pending manager approval): ${ignoreReason.trim()}`
          : `Ignored: ${ignoreReason.trim()}`;
      setIssueStatus(issue.id, "ignored", "You", note);
      setShowIgnoreInput(false);
      setIgnoreReason("");
      toast.success(
        policy.proceedOnCritical === "manager_approval"
          ? "Ignored — flagged for manager approval"
          : "Issue ignored with reason recorded",
      );
      return;
    }
    setIssueStatus(issue.id, "ignored", "You");
    toast.success("Issue ignored");
  };

  const statusTone =
    issue.status === "fixed" ? "success" :
    issue.status === "acknowledged" ? "info" :
    issue.status === "ignored" ? "muted" : sv.tone;

  return (
    <li className="px-6 py-4">
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${isDone ? "text-muted-foreground" : sv.text}`} />
        <div className="flex-1 min-w-0">
          {/* header */}
          <div className="flex items-center gap-2 flex-wrap">
            <Pill tone={statusTone}>{sv.label}</Pill>
            <span className="font-semibold text-sm capitalize">
              {issue.field.replace(/_/g, " ")}
            </span>
            {issue.issueType && (
              <span className="text-xs text-muted-foreground">· {issue.issueType}</span>
            )}
            <Pill tone={statusTone}>
              {issue.status === "pending" ? "Pending review" :
               issue.status === "fixed" ? "Fixed" :
               issue.status === "acknowledged" ? "Acknowledged" : "Ignored"}
            </Pill>
            <span className="ml-auto text-[11px] text-muted-foreground">
              row {issue.rowNumber} · {issue.fileName}
            </span>
          </div>

          {/* details */}
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
            <DetailCell label="Issue">
              <span className="text-foreground">{issue.reason}</span>
            </DetailCell>
            <DetailCell label="Current value">
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                {issue.currentValue ?? "—"}
              </code>
            </DetailCell>
            <DetailCell label="Recommended fix">
              {issue.recommendedFix ? (
                <span className="text-foreground inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-tenant" />
                  {issue.recommendedFix}
                </span>
              ) : (
                <span className="text-muted-foreground italic">No suggestion available</span>
              )}
            </DetailCell>
          </div>

          {/* fix editor */}
          {editing && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={`Enter corrected ${issue.field.replace(/_/g, " ")}`}
                className="flex-1 min-w-[200px] px-2.5 py-1.5 rounded-md border border-border bg-background text-sm"
              />
              {issue.recommendedFix && (
                <button
                  onClick={() => setValue(issue.recommendedFix ?? "")}
                  className="text-xs font-semibold text-tenant hover:underline"
                  title="Use recommended fix as starting point"
                >
                  Use suggestion
                </button>
              )}
              <button
                onClick={handleApplyFix}
                className="px-3 py-1.5 rounded-md bg-gradient-tenant text-white text-xs font-semibold"
              >
                Save fix
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          )}

          {/* ignore reason editor */}
          {showIgnoreInput && (
            <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
                <ShieldAlert className="h-3.5 w-3.5" />
                Reason required for ignoring a critical issue
              </div>
              <textarea
                autoFocus
                value={ignoreReason}
                onChange={(e) => setIgnoreReason(e.target.value)}
                rows={2}
                placeholder="Explain why this critical issue can be ignored (audited)…"
                className="mt-2 w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-sm"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={handleIgnore}
                  className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-semibold"
                >
                  Confirm ignore
                </button>
                <button
                  onClick={() => { setShowIgnoreInput(false); setIgnoreReason(""); }}
                  className="px-3 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* actions */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {!isDone && !editing && (
              <ActionBtn onClick={() => setEditing(true)} icon={Pencil}>
                Fix
              </ActionBtn>
            )}
            {!isDone && (
              <ActionBtn
                onClick={() => {
                  setIssueStatus(issue.id, "fixed", "You", "Marked as fixed without inline edit");
                  toast.success("Marked as fixed");
                }}
                icon={CheckCircle}
                tone="success"
              >
                Mark as Fixed
              </ActionBtn>
            )}
            {!isDone && issue.severity === "info" && (
              <ActionBtn
                onClick={() => {
                  setIssueStatus(issue.id, "acknowledged", "You");
                  toast.success("Acknowledged");
                }}
                icon={CheckCircle}
              >
                Acknowledge
              </ActionBtn>
            )}
            {!isDone && issue.severity !== "info" && (
              <ActionBtn onClick={handleIgnore} icon={EyeOff}>
                Ignore
              </ActionBtn>
            )}
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {showHistory ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <History className="h-3 w-3" /> History ({issue.history.length})
            </button>
          </div>

          {showHistory && (
            <ol className="mt-3 pl-4 border-l border-border space-y-1.5 text-xs">
              {issue.history.map((h, idx) => (
                <li key={idx} className="text-muted-foreground">
                  <span className="text-foreground font-medium">{h.action}</span>
                  {" by "}<span className="text-foreground">{h.actor}</span>
                  {" · "}{h.at}
                  {h.note && <div className="text-muted-foreground/80 italic">{h.note}</div>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </li>
  );
}

function DetailCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="truncate">{children}</div>
    </div>
  );
}

function ActionBtn({
  onClick,
  icon: Icon,
  tone = "default",
  children,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success";
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "text-success border-success/30 hover:bg-success/10"
      : "text-foreground border-border hover:bg-muted";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-semibold ${cls}`}
    >
      <Icon className="h-3 w-3" />
      {children}
    </button>
  );
}
