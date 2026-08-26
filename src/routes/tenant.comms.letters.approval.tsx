import { createFileRoute } from "@tanstack/react-router";
import { PageCard, CardHead, StatTile, Pill } from "@/components/tenant/ui";
import { APPROVAL_ITEMS, type ApprovalItem } from "@/lib/letters-mock";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Check, X, Eye, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/tenant/comms/letters/approval")({
  head: () => ({ meta: [{ title: "Approval Queue · Letters" }] }),
  component: ApprovalPage,
});

const QUEUE_LABEL: Record<ApprovalItem["queue"], string> = { attorney: "Attorney", supervisor: "Supervisor", team_lead: "Team Lead" };

function ApprovalPage() {
  const [items, setItems] = useState<ApprovalItem[]>(APPROVAL_ITEMS);
  const [filter, setFilter] = useState<"all" | ApprovalItem["queue"]>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = items.filter((i) => i.status === "pending" && (filter === "all" || i.queue === filter));
  const counts = {
    pending: items.filter((i) => i.status === "pending").length,
    attorney: items.filter((i) => i.status === "pending" && i.queue === "attorney").length,
    urgent: items.filter((i) => i.status === "pending" && i.priority === "urgent").length,
    approved24h: items.filter((i) => i.status === "approved").length,
  };

  const decide = (id: string, decision: "approved" | "rejected", reason?: string) => {
    setItems((p) => p.map((it) => it.id === id ? { ...it, status: decision, rejectionReason: reason } : it));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    toast.success(`Letter ${id} ${decision}${decision === "rejected" ? " — generator notified" : " — moved to send queue"}`);
  };

  const bulkDecide = (decision: "approved" | "rejected") => {
    if (selected.size === 0) { toast.error("Select at least one letter"); return; }
    setItems((p) => p.map((it) => selected.has(it.id) ? { ...it, status: decision, rejectionReason: decision === "rejected" ? "Bulk rejection — see batch notes" : undefined } : it));
    toast.success(`${selected.size} letters ${decision}`);
    setSelected(new Set());
  };

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <>
      <section className="px-6 lg:px-10 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Pending approval" value={counts.pending} delta="awaiting decision" icon={<ShieldCheck className="h-4 w-4" />} tone="warning" />
        <StatTile label="Attorney queue" value={counts.attorney} delta="legal review required" tone="tenant" />
        <StatTile label="Urgent" value={counts.urgent} delta="SLA: same-day" tone="danger" />
        <StatTile label="Approved · 24h" value={counts.approved24h} delta="moved to send queue" tone="success" />
      </section>

      <section className="px-6 lg:px-10 pb-10">
        <PageCard>
          <CardHead
            title="Approval queue"
            subtitle="US-087 · attorney sign-off · digital signature applied on approve"
            action={
              <div className="flex items-center gap-2">
                <button onClick={() => bulkDecide("approved")} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-success/15 text-success text-sm font-semibold hover:bg-success/25">
                  <Check className="h-4 w-4" /> Approve selected
                </button>
                <button onClick={() => bulkDecide("rejected")} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/15 text-destructive text-sm font-semibold hover:bg-destructive/25">
                  <X className="h-4 w-4" /> Reject selected
                </button>
              </div>
            }
          />
          <div className="px-6 py-3 border-b border-border flex items-center gap-2">
            {(["all", "attorney", "supervisor", "team_lead"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${filter === f ? "bg-gradient-tenant text-white shadow-tenant" : "bg-muted text-muted-foreground hover:bg-tenant-soft hover:text-tenant"}`}>
                {f === "all" ? "All queues" : QUEUE_LABEL[f as ApprovalItem["queue"]]}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">{selected.size} selected</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
                <tr>
                  <th className="px-4 py-3 w-8"></th>
                  <th className="text-left px-3 py-3">Customer</th>
                  <th className="text-left px-3 py-3">Template</th>
                  <th className="text-left px-3 py-3">Balance</th>
                  <th className="text-left px-3 py-3">Queue</th>
                  <th className="text-left px-3 py-3">Generated</th>
                  <th className="text-left px-3 py-3">Priority</th>
                  <th className="text-left px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} /></td>
                    <td className="px-3 py-3 font-semibold">{it.debtor}</td>
                    <td className="px-3 py-3 text-xs">{it.template}</td>
                    <td className="px-3 py-3 font-mono text-xs">${it.balance.toLocaleString()}</td>
                    <td className="px-3 py-3"><Pill tone={it.queue === "attorney" ? "danger" : it.queue === "supervisor" ? "warning" : "muted"}>{QUEUE_LABEL[it.queue]}</Pill></td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{it.generatedAt}<div>{it.generatedBy}</div></td>
                    <td className="px-3 py-3"><Pill tone={it.priority === "urgent" ? "danger" : "muted"}>{it.priority}</Pill></td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => toast.message(`Preview ${it.id}`)} className="px-2 py-1 rounded border border-border text-xs hover:bg-muted inline-flex items-center gap-1"><Eye className="h-3 w-3" /></button>
                        <button onClick={() => decide(it.id, "approved")} className="px-2 py-1 rounded bg-success/15 text-success text-xs font-semibold hover:bg-success/25 inline-flex items-center gap-1"><Check className="h-3 w-3" /> Approve</button>
                        <button onClick={() => decide(it.id, "rejected", "Manual rejection — please revise")} className="px-2 py-1 rounded bg-destructive/15 text-destructive text-xs font-semibold hover:bg-destructive/25 inline-flex items-center gap-1"><X className="h-3 w-3" /> Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-muted-foreground">No pending letters in this queue</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </PageCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <PageCard>
            <CardHead title="Approval rules" subtitle="Configurable per letter type" />
            <ul className="p-6 space-y-2 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-warning mt-0.5" /><span>All legal demand letters → <b>Attorney review</b></span></li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-warning mt-0.5" /><span>Letters over $5,000 balance → <b>Supervisor review</b></span></li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-warning mt-0.5" /><span>Settlement &gt;50% discount → <b>Manager approval</b></span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-success mt-0.5" /><span>Standard payment reminders → <b>auto-approved</b></span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-success mt-0.5" /><span>Receipt confirmations → <b>auto-approved</b></span></li>
            </ul>
          </PageCard>
          <PageCard>
            <CardHead title="Recent decisions" subtitle="7-year audit retention" />
            <ul className="divide-y divide-border text-sm">
              {items.filter((i) => i.status !== "pending").slice(0, 6).map((i) => (
                <li key={i.id} className="px-6 py-3 flex items-center gap-2">
                  {i.status === "approved" ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />}
                  <div className="flex-1">
                    <div className="font-semibold text-xs">{i.debtor}</div>
                    <div className="text-[11px] text-muted-foreground">{i.template}{i.rejectionReason && ` · ${i.rejectionReason}`}</div>
                  </div>
                  <Pill tone={i.status === "approved" ? "success" : "danger"}>{i.status}</Pill>
                </li>
              ))}
            </ul>
          </PageCard>
        </div>
      </section>
    </>
  );
}
