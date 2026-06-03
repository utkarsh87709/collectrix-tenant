import { useMemo, useState } from "react";
import { Users, Bot, Briefcase, Shuffle, UserCircle, ShieldCheck, History as HistoryIcon, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import {
  agents, managers, getTeams, creditors, aiAgents,
  agentName, managerName, teamName, creditorName, aiAgentName,
  useAssignment, useAssignmentHistory, updateAssignment, reassignViaRoundRobin,
  type Assignment,
} from "@/lib/assignment-store";
import { toast } from "sonner";

const ACTOR = "Maya Lindstrom"; // TODO: from auth session

type Props = {
  debtorId: string;
  canReassign?: boolean;
  canReassignCreditor?: boolean; // admin-only — creditor/creditor reassignment is restricted
  compact?: boolean; // header summary chip
};

export function AssignmentSummary({ debtorId }: { debtorId: string }) {
  const a = useAssignment(debtorId);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {a.agentId
        ? <Pill tone="tenant"><UserCircle className="h-3 w-3" /> {agentName(a.agentId)}</Pill>
        : <Pill tone="warning"><AlertTriangle className="h-3 w-3" /> Unassigned</Pill>}
      {a.teamId && <Pill tone="muted"><Users className="h-3 w-3" /> {teamName(a.teamId)}</Pill>}
      {a.creditorId && <Pill tone="muted"><Briefcase className="h-3 w-3" /> {creditorName(a.creditorId)}</Pill>}
      {a.aiAgentId && <Pill tone="info"><Bot className="h-3 w-3" /> {aiAgentName(a.aiAgentId)}</Pill>}
    </div>
  );
}

export function AssignmentCard({ debtorId, canReassign = true, canReassignCreditor = false }: Props) {
  const a = useAssignment(debtorId);
  const history = useAssignmentHistory(debtorId);
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<Assignment>(a);
  const [showHistory, setShowHistory] = useState(false);

  // re-sync draft if external assignment changes
  useMemo(() => { setDraft(a); }, [a]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(a);

  const save = () => {
    if (!canReassign) return;
    if (!dirty) return;
    updateAssignment(debtorId, draft, { actor: ACTOR, reason: reason.trim() || undefined, source: "manual" });
    setReason("");
    toast.success("Assignment updated", { description: "Logged to audit trail." });
  };

  const rollRoundRobin = () => {
    if (!canReassign) return;
    reassignViaRoundRobin(debtorId, ACTOR);
    toast.success("Re-rolled via round-robin");
  };

  return (
    <PageCard>
      <CardHead
        title="Assignment & ownership"
        subtitle="Who is responsible for this debtor — agent, manager, team, creditor, and AI agent"
        action={
          <div className="flex items-center gap-2">
            {!a.agentId && <Pill tone="warning">Unassigned</Pill>}
            {canReassign && (
              <button
                onClick={rollRoundRobin}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted"
                title="Reassign using tenant round-robin rules"
              >
                <Shuffle className="h-3.5 w-3.5" /> Round-robin
              </button>
            )}
          </div>
        }
      />
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField label="Assigned Agent" icon={<UserCircle className="h-3.5 w-3.5" />}
          value={draft.agentId ?? ""} onChange={(v) => setDraft((d) => ({ ...d, agentId: v || null }))}
          options={[{ value: "", label: "— Unassigned —" }, ...agents.map((x) => ({ value: x.id, label: x.name }))]}
          disabled={!canReassign}
        />
        <SelectField label="Assigned Manager" icon={<ShieldCheck className="h-3.5 w-3.5" />}
          value={draft.managerId ?? ""} onChange={(v) => setDraft((d) => ({ ...d, managerId: v || null }))}
          options={[{ value: "", label: "— None —" }, ...managers.map((x) => ({ value: x.id, label: x.name }))]}
          disabled={!canReassign}
        />
        <SelectField label="Team" icon={<Users className="h-3.5 w-3.5" />}
          value={draft.teamId ?? ""} onChange={(v) => setDraft((d) => ({ ...d, teamId: v || null }))}
          options={[{ value: "", label: "— None —" }, ...getTeams().map((x) => ({ value: x.id, label: x.name }))]}
          disabled={!canReassign}
        />
        <SelectField label="AI Agent (optional)" icon={<Bot className="h-3.5 w-3.5" />}
          value={draft.aiAgentId ?? ""} onChange={(v) => setDraft((d) => ({ ...d, aiAgentId: v || null }))}
          options={[{ value: "", label: "— None —" }, ...aiAgents.map((x) => ({ value: x.id, label: x.name }))]}
          disabled={!canReassign}
        />
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Reason / note (optional)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={!canReassign}
            placeholder="e.g. Escalating to legal queue"
            className="mt-1 w-full px-2.5 py-2 rounded-md border border-border bg-background text-sm disabled:opacity-60"
          />
        </div>
      </div>

      <div className="px-6 py-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {showHistory ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <HistoryIcon className="h-3.5 w-3.5" /> Assignment history ({history.length})
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDraft(a)}
            disabled={!dirty}
            className="px-3 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted disabled:opacity-40"
          >
            Reset
          </button>
          <button
            onClick={save}
            disabled={!canReassign || !dirty}
            className="px-3 py-1.5 rounded-md bg-gradient-tenant text-white text-xs font-semibold shadow-tenant disabled:opacity-40"
          >
            Save assignment
          </button>
        </div>
      </div>

      {showHistory && (
        <ol className="px-6 py-3 border-t border-border space-y-2 text-xs">
          {history.length === 0 && <li className="text-muted-foreground py-2">No assignment changes yet.</li>}
          {history.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-1.5">
              <Pill tone={h.source === "round-robin" ? "info" : h.source === "import" ? "muted" : "tenant"}>{h.source}</Pill>
              <span className="font-semibold capitalize">{labelForField(h.field)}</span>
              <span className="text-muted-foreground">{prettyValue(h.field, h.from) ?? "—"}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-foreground">{prettyValue(h.field, h.to) ?? "—"}</span>
              <span className="text-muted-foreground">· by {h.actor}</span>
              <span className="text-muted-foreground ml-auto">{h.when}</span>
              {h.reason && <div className="basis-full text-muted-foreground/80 italic pl-1">“{h.reason}”</div>}
            </li>
          ))}
        </ol>
      )}
    </PageCard>
  );
}

function labelForField(f: keyof Assignment) {
  switch (f) {
    case "agentId": return "Agent";
    case "managerId": return "Manager";
    case "teamId": return "Team";
    case "creditorId": return "Creditor";
    case "aiAgentId": return "AI agent";
  }
}
function prettyValue(f: keyof Assignment, v: string | null) {
  if (!v) return null;
  switch (f) {
    case "agentId": return agentName(v);
    case "managerId": return managerName(v);
    case "teamId": return teamName(v);
    case "creditorId": return creditorName(v);
    case "aiAgentId": return aiAgentName(v);
  }
}

function SelectField({
  label, icon, value, onChange, options, disabled,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
        {icon} {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1 w-full px-2.5 py-2 rounded-md border border-border bg-background text-sm disabled:opacity-60"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
