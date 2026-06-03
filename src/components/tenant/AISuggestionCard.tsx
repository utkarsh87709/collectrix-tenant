import { useMemo } from "react";
import { Sparkles, Bot, UserCircle, Users, ShieldCheck, Zap } from "lucide-react";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { getAISuggestions, acceptAISuggestion, useAssignment } from "@/lib/assignment-store";
import { toast } from "sonner";

const ACTOR = "Maya Lindstrom";

export function AISuggestionCard({ debtorId }: { debtorId: string }) {
  const suggestions = useMemo(() => getAISuggestions(debtorId), [debtorId]);
  const current = useAssignment(debtorId);
  if (suggestions.length === 0) return null;
  const top = suggestions[0];
  const alreadyAssigned = current.agentId === top.agentId;

  return (
    <PageCard>
      <CardHead
        title="AI-assisted routing"
        subtitle="Ranked by payment propensity, language, skills, workload, and risk signals"
        action={<Pill tone="info"><Bot className="h-3 w-3" /> AI suggestion</Pill>}
      />
      <div className="px-6 py-4 space-y-3">
        {suggestions.map((s, idx) => (
          <div key={s.agentId} className={`rounded-xl border p-4 ${idx === 0 ? "border-tenant bg-tenant-soft/40" : "border-border"}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {idx === 0 && <Sparkles className="h-4 w-4 text-tenant" />}
                  <span className="font-display font-bold">{s.agentName}</span>
                  {s.teamName && <Pill tone="muted"><Users className="h-3 w-3" /> {s.teamName}</Pill>}
                  {s.managerName && <Pill tone="muted"><ShieldCheck className="h-3 w-3" /> {s.managerName}</Pill>}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {s.reasons.map((r, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-tenant" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Pill tone={s.confidence > 0.7 ? "success" : s.confidence > 0.5 ? "info" : "warning"}>
                  {Math.round(s.confidence * 100)}% confidence
                </Pill>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      acceptAISuggestion(debtorId, s, ACTOR);
                      toast.success(`Assigned to ${s.agentName}`, { description: "Logged to audit trail." });
                    }}
                    disabled={alreadyAssigned && idx === 0}
                    className="px-3 py-1.5 rounded-md bg-gradient-tenant text-white text-xs font-semibold shadow-tenant disabled:opacity-50"
                  >
                    <UserCircle className="h-3.5 w-3.5 inline mr-1" />
                    {alreadyAssigned && idx === 0 ? "Assigned" : "Assign"}
                  </button>
                </div>
              </div>
            </div>
            {idx === 0 && (
              <details className="mt-3">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Score breakdown</summary>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                  {s.factors.map((f, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1 rounded border border-border">
                      <span className={f.positive ? "text-foreground" : "text-muted-foreground line-through"}>{f.label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">+{(f.weight * 100).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
      <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground bg-muted/30">
        Use the assignment panel below to override the AI suggestion. All changes are written to the audit trail.
      </div>
    </PageCard>
  );
}
