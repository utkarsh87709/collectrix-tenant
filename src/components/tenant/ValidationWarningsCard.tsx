import { useState } from "react";
import { AlertTriangle, CheckCircle, History, ChevronDown, ChevronRight } from "lucide-react";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { useValidationIssues, setIssueStatus, type ValidationIssue } from "@/lib/validation-issues-store";
import { toast } from "sonner";

export function ValidationWarningsCard({ debtorId }: { debtorId: string }) {
  const issues = useValidationIssues(debtorId);
  if (issues.length === 0) return null;

  const pending = issues.filter((i) => i.status === "pending").length;

  return (
    <PageCard>
      <CardHead
        title="Validation Warnings"
        subtitle={`${issues.length} field${issues.length === 1 ? "" : "s"} flagged during import · ${pending} pending review`}
        action={<Pill tone={pending > 0 ? "warning" : "success"}>{pending > 0 ? `${pending} pending` : "All resolved"}</Pill>}
      />
      <ul className="divide-y divide-border">
        {issues.map((i) => <IssueItem key={i.id} issue={i} />)}
      </ul>
      <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground">
        <AlertTriangle className="h-3 w-3 inline mr-1.5 text-warning" />
        Valid communication channels remain usable — AI agents will skip invalid fields and use the next available contact.
      </div>
    </PageCard>
  );
}

function IssueItem({ issue }: { issue: ValidationIssue }) {
  const [showHistory, setShowHistory] = useState(false);

  const tone = issue.status === "pending" ? "warning" : issue.status === "fixed" ? "success" : "muted";

  return (
    <li className="px-6 py-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${issue.status === "pending" ? "text-warning" : "text-muted-foreground"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm capitalize">{issue.field.replace(/_/g, " ")}</span>
            <Pill tone={tone as "warning" | "success" | "muted"}>
              {issue.status === "pending" ? "Pending Review" : issue.status === "fixed" ? "Fixed" : "Ignored"}
            </Pill>
            <span className="text-xs text-muted-foreground">· row {issue.rowNumber} of {issue.fileName}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">{issue.reason}</div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {issue.status !== "fixed" && (
              <button onClick={() => { setIssueStatus(issue.id, "fixed"); toast.success("Marked fixed"); }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border text-xs font-semibold hover:bg-muted text-success">
                <CheckCircle className="h-3 w-3" /> Mark
              </button>
            )}
            <button onClick={() => setShowHistory((v) => !v)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-muted-foreground hover:text-foreground">
              {showHistory ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <History className="h-3 w-3" /> View
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
