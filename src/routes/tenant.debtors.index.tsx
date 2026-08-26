import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill, StatTile } from "@/components/tenant/ui";
import { useState, useMemo } from "react";
import { Search, Filter, Download, Plus, Lock, TrendingUp, ShieldCheck, AlertTriangle } from "lucide-react";
import { debtors } from "@/lib/intake-mock";
import {
  agents, managers, getTeams,
  agentName, managerName, teamName, creditorName,
  getAssignment, getAssignmentStatus, isVisibleTo, currentViewer,
} from "@/lib/assignment-store";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export const Route = createFileRoute("/tenant/debtors/")({
  head: () => ({ meta: [{ title: "Customers · Tenant Admin" }] }),
  component: DebtorsPage,
});

const STATUSES = ["active_only", "new", "active", "ptp", "paid", "legal", "uncollectable", "engagement_stopped", "archived", "deleted", "all"] as const;
const STATUS_LABEL: Record<typeof STATUSES[number], string> = {
  active_only: "Active (hide archived)",
  new: "New", active: "Active", ptp: "PTP", paid: "Paid", legal: "Legal",
  uncollectable: "Uncollectable",
  engagement_stopped: "Engagement stopped",
  archived: "Archived",
  deleted: "Deleted / Scheduled for deletion",
  all: "All (incl. archived & deleted)",
};

type AssignmentFilter = "all" | "assigned" | "unassigned" | "assignment_issue";
type PaymentStatus = "all" | "paid" | "unpaid" | "ptp";
type EngagementStatus = "all" | "active" | "stopped";
type ArchivedFilter = "exclude" | "only" | "all";
type DateBucket = "any" | "1" | "7" | "30" | "90" | "180" | "older";

const DATE_LABEL: Record<DateBucket, string> = {
  any: "any time",
  "1": "last 24h",
  "7": "last 7 days",
  "30": "last 30 days",
  "90": "last 90 days",
  "180": "last 180 days",
  older: "older than 180 days",
};

// Parse strings like "12d ago", "2h ago", "180d ago", "—" into days.
function agoToDays(s: string): number | null {
  if (!s || s === "—") return null;
  const m = s.match(/^(\d+)\s*([hdm])/i);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (u === "h") return n / 24;
  if (u === "m") return n / (24 * 60);
  return n;
}

function inDateBucket(s: string, bucket: DateBucket): boolean {
  if (bucket === "any") return true;
  const d = agoToDays(s);
  if (d === null) return false;
  if (bucket === "older") return d > 180;
  return d <= Number(bucket);
}

function DebtorsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<typeof STATUSES[number]>("active_only");
  const [creditorFilter, setCreditorFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
  const [balanceMin, setBalanceMin] = useState("");
  const [balanceMax, setBalanceMax] = useState("");
  const [contactMin, setContactMin] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("all");
  const [engagementStatus, setEngagementStatus] = useState<EngagementStatus>("all");
  const [archivedFilter, setArchivedFilter] = useState<ArchivedFilter>("exclude");
  const [flagFilter, setFlagFilter] = useState("all");
  const [placedWithin, setPlacedWithin] = useState<DateBucket>("any");
  const [activityWithin, setActivityWithin] = useState<DateBucket>("any");
  const [showFilters, setShowFilters] = useState(false);

  const creditors = useMemo(() => Array.from(new Set(debtors.map((d) => d.creditor))).sort(), []);
  const allFlags = useMemo(() => Array.from(new Set(debtors.flatMap((d) => d.flags))).sort(), []);

  const filtered = useMemo(() => debtors.filter((d) => {
    // Archived gate
    if (archivedFilter === "exclude" && d.status === "archived") return false;
    if (archivedFilter === "only" && d.status !== "archived") return false;

    if (status === "active_only") { if (d.status === "archived") return false; }
    else if (status !== "all" && d.status !== status) return false;

    if (q && !d.name.toLowerCase().includes(q.toLowerCase()) && !d.external.toLowerCase().includes(q.toLowerCase())) return false;
    if (creditorFilter !== "all" && d.creditor !== creditorFilter) return false;

    const a = getAssignment(d.id);
    if (agentFilter !== "all" && a.agentId !== agentFilter) return false;
    if (managerFilter !== "all" && a.managerId !== managerFilter) return false;
    if (teamFilter !== "all" && a.teamId !== teamFilter) return false;
    
    if (assignmentFilter !== "all" && getAssignmentStatus(d.id) !== assignmentFilter) return false;

    const min = balanceMin ? Number(balanceMin) : null;
    const max = balanceMax ? Number(balanceMax) : null;
    if (min !== null && !Number.isNaN(min) && d.balance < min) return false;
    if (max !== null && !Number.isNaN(max) && d.balance > max) return false;

    const cMin = contactMin ? Number(contactMin) : null;
    if (cMin !== null && !Number.isNaN(cMin) && d.contactability < cMin) return false;

    if (paymentStatus === "paid" && d.status !== "paid") return false;
    if (paymentStatus === "ptp" && d.status !== "ptp") return false;
    if (paymentStatus === "unpaid" && (d.status === "paid" || d.status === "ptp")) return false;

    if (engagementStatus === "stopped" && d.status !== "uncollectable") return false;
    if (engagementStatus === "active" && (d.status === "uncollectable" || d.status === "archived")) return false;

    if (flagFilter !== "all") {
      if (flagFilter === "legal-hold") { if (!d.legalHold) return false; }
      else if (!d.flags.includes(flagFilter)) return false;
    }

    if (!inDateBucket(d.placedAt, placedWithin)) return false;
    if (!inDateBucket(d.lastActivity, activityWithin)) return false;

    // Access-control scope (UI mock — mirrors RLS intent)
    if (!isVisibleTo(d.id, currentViewer, d.creditor)) return false;

    return true;
  }), [q, status, creditorFilter, agentFilter, managerFilter, teamFilter, assignmentFilter, balanceMin, balanceMax, contactMin, paymentStatus, engagementStatus, archivedFilter, flagFilter, placedWithin, activityWithin]);

  const totalBalance = filtered.reduce((s, d) => s + d.balance, 0);
  const unassignedCount = filtered.filter((d) => getAssignmentStatus(d.id) === "unassigned").length;
  const issueCount = filtered.filter((d) => getAssignmentStatus(d.id) === "assignment_issue").length;

  const activeCount =
    (status !== "active_only" ? 1 : 0) +
    (creditorFilter !== "all" ? 1 : 0) +
    (agentFilter !== "all" ? 1 : 0) +
    (managerFilter !== "all" ? 1 : 0) +
    (teamFilter !== "all" ? 1 : 0) +
    (assignmentFilter !== "all" ? 1 : 0) +
    (balanceMin ? 1 : 0) + (balanceMax ? 1 : 0) +
    (contactMin ? 1 : 0) +
    (paymentStatus !== "all" ? 1 : 0) +
    (engagementStatus !== "all" ? 1 : 0) +
    (archivedFilter !== "exclude" ? 1 : 0) +
    (flagFilter !== "all" ? 1 : 0) +
    (placedWithin !== "any" ? 1 : 0) +
    (activityWithin !== "any" ? 1 : 0);

  return (
    <Shell>
      <Topbar
        title="Customers"
        subtitle="Search, filter and manage customer records"
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => toast.message("CSV exported")} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
              <Download className="h-4 w-4" /> Export
            </button>
            <button onClick={() => toast.message("Manual entry coming")} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
              <Plus className="h-4 w-4" /> Add customer
            </button>
          </div>
        }
      />

      <section className="px-6 lg:px-10 pt-6">
        <ScopeBanner />
      </section>

      <section className="px-6 lg:px-10 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-elegant flex flex-col">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Matching customers</span>
          <div className="mt-3 font-display text-3xl font-bold text-tenant">{filtered.length.toLocaleString()}</div>
          <div className="mt-1 text-xs text-muted-foreground">of {debtors.length} total</div>
          <Link
            to="/tenant/intake/dedupe"
            className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-tenant-soft text-tenant text-xs font-semibold border border-[color:var(--tenant)]/20 hover:bg-tenant hover:text-white transition-colors"
          >
            Review Matching Customers →
          </Link>
        </div>
        <StatTile label="Total balance" value={`$${(totalBalance / 1000).toFixed(1)}k`} delta="across filter" />
        <StatTile label="Contact Success Rate" value={`${Math.round(filtered.reduce((s, d) => s + d.contactability, 0) / Math.max(filtered.length, 1))}%`} icon={<TrendingUp className="h-4 w-4" />} tone="success" />
        <StatTile label="Unassigned / Issues" value={`${unassignedCount} / ${issueCount}`} icon={<AlertTriangle className="h-4 w-4" />} tone={(unassignedCount + issueCount) > 0 ? "warning" : "default"} />
      </section>

      <section className="px-6 lg:px-10 pb-8">
        <PageCard>
          <div className="flex flex-col gap-3 px-6 py-4 border-b border-border">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, external ID, account…" className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm" />
              </div>
              <button
                onClick={() => setShowFilters((s) => !s)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition ${
                  activeCount > 0 || showFilters
                    ? "border-tenant bg-tenant-soft text-tenant"
                    : "border-border hover:bg-muted"
                }`}
              >
                <Filter className="h-4 w-4" /> More filters
                {activeCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-tenant text-white text-[10px] font-bold">
                    {activeCount}
                  </span>
                )}
              </button>
            </div>
            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>More filters</SheetTitle>
                  <SheetDescription>Refine the customer list by status, ownership, financials and timeline.</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-4">
                  <FilterGroup label="Status & lifecycle">
                    <LabeledSelect label="Status" value={status} onChange={(v) => setStatus(v as typeof STATUSES[number])}
                      options={STATUSES.map((s) => ({ v: s, label: STATUS_LABEL[s] }))} />
                    <LabeledSelect label="Payment status" value={paymentStatus} onChange={(v) => setPaymentStatus(v as PaymentStatus)}
                      options={[{ v: "all", label: "Any" }, { v: "paid", label: "Paid" }, { v: "unpaid", label: "Unpaid" }, { v: "ptp", label: "Promise to pay" }]} />
                    <LabeledSelect label="Engagement status" value={engagementStatus} onChange={(v) => setEngagementStatus(v as EngagementStatus)}
                      options={[{ v: "all", label: "Any" }, { v: "active", label: "Active engagement" }, { v: "stopped", label: "Engagement stopped" }]} />
                    <LabeledSelect label="Archived" value={archivedFilter} onChange={(v) => setArchivedFilter(v as ArchivedFilter)}
                      options={[{ v: "exclude", label: "Hide archived" }, { v: "only", label: "Archived only" }, { v: "all", label: "Include archived" }]} />
                  </FilterGroup>

                  <FilterGroup label="Ownership & assignment">
                    <LabeledSelect label="Creditor" value={creditorFilter} onChange={setCreditorFilter}
                      options={[{ v: "all", label: "All creditors" }, ...creditors.map((c) => ({ v: c, label: c }))]} />
                    <LabeledSelect label="Assigned agent" value={agentFilter} onChange={setAgentFilter}
                      options={[{ v: "all", label: "All agents" }, ...agents.map((a) => ({ v: a.id, label: a.name }))]} />
                    <LabeledSelect label="Assigned manager" value={managerFilter} onChange={setManagerFilter}
                      options={[{ v: "all", label: "All managers" }, ...managers.map((m) => ({ v: m.id, label: m.name }))]} />
                    <LabeledSelect label="Team" value={teamFilter} onChange={setTeamFilter}
                      options={[{ v: "all", label: "All teams" }, ...getTeams().map((t) => ({ v: t.id, label: t.name }))]} />
                    <LabeledSelect label="Assignment status" value={assignmentFilter} onChange={(v) => setAssignmentFilter(v as AssignmentFilter)}
                      options={[{ v: "all", label: "All" }, { v: "assigned", label: "Assigned" }, { v: "unassigned", label: "Unassigned" }, { v: "assignment_issue", label: "Assignment Issue" }]} />
                  </FilterGroup>

                  <FilterGroup label="Financials & performance">
                    <Labeled label="Balance min">
                      <input type="number" inputMode="decimal" value={balanceMin} onChange={(e) => setBalanceMin(e.target.value)} placeholder="0"
                        className="px-3 py-2 rounded-lg border border-border bg-background text-sm w-full" />
                    </Labeled>
                    <Labeled label="Balance max">
                      <input type="number" inputMode="decimal" value={balanceMax} onChange={(e) => setBalanceMax(e.target.value)} placeholder="No limit"
                        className="px-3 py-2 rounded-lg border border-border bg-background text-sm w-full" />
                    </Labeled>
                    <Labeled label="Contact Success Rate ≥">
                      <input type="number" min={0} max={100} value={contactMin} onChange={(e) => setContactMin(e.target.value)} placeholder="0–100"
                        className="px-3 py-2 rounded-lg border border-border bg-background text-sm w-full" />
                    </Labeled>
                  </FilterGroup>

                  <FilterGroup label="Tags & timeline">
                    <LabeledSelect label="Flag / tag" value={flagFilter} onChange={setFlagFilter}
                      options={[{ v: "all", label: "Any" }, { v: "legal-hold", label: "Legal hold" }, ...allFlags.map((f) => ({ v: f, label: f }))]} />
                    <LabeledSelect label="Date placed" value={placedWithin} onChange={(v) => setPlacedWithin(v as DateBucket)}
                      options={(Object.keys(DATE_LABEL) as DateBucket[]).map((k) => ({ v: k, label: DATE_LABEL[k] }))} />
                    <LabeledSelect label="Last activity" value={activityWithin} onChange={(v) => setActivityWithin(v as DateBucket)}
                      options={(Object.keys(DATE_LABEL) as DateBucket[]).map((k) => ({ v: k, label: DATE_LABEL[k] }))} />
                  </FilterGroup>

                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <button
                      onClick={() => {
                        setStatus("active_only");
                        setCreditorFilter("all");
                        setAgentFilter("all");
                        setManagerFilter("all");
                        setTeamFilter("all");
                        setAssignmentFilter("all");
                        setBalanceMin(""); setBalanceMax(""); setContactMin("");
                        setPaymentStatus("all"); setEngagementStatus("all");
                        setArchivedFilter("exclude"); setFlagFilter("all");
                        setPlacedWithin("any"); setActivityWithin("any");
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground font-semibold"
                    >
                      Reset filters
                    </button>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold">Customer</th>
                  <th className="text-left px-3 py-3 font-semibold">External ID</th>
                  <th className="text-left px-3 py-3 font-semibold">Creditor / Creditor</th>
                  <th className="text-right px-3 py-3 font-semibold">Balance</th>
                  <th className="text-left px-3 py-3 font-semibold">Status</th>
                  <th className="text-left px-3 py-3 font-semibold">Assigned Agent</th>
                  <th className="text-left px-3 py-3 font-semibold">Manager</th>
                  <th className="text-left px-3 py-3 font-semibold">Team</th>
                  <th className="text-left px-6 py-3 font-semibold">Flags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const a = getAssignment(d.id);
                  const aStatus = getAssignmentStatus(d.id);
                  return (
                    <tr key={d.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="px-6 py-3">
                        <Link to="/tenant/debtors/$debtorId" params={{ debtorId: d.id }} className="font-semibold hover:text-tenant hover:underline">{d.name}</Link>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{d.external}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{d.creditor}</div>
                        {a.creditorId && <div className="text-xs text-muted-foreground">{creditorName(a.creditorId)}</div>}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">${d.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3"><Pill tone={statusTone(d.status)}>{d.status}</Pill></td>
                      <td className="px-3 py-3">
                        {aStatus === "assigned"
                          ? <span className="text-foreground">{agentName(a.agentId)}</span>
                          : aStatus === "assignment_issue"
                            ? <Pill tone="danger">Assignment Issue</Pill>
                            : <Pill tone="warning">Unassigned</Pill>}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{managerName(a.managerId) ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{teamName(a.teamId) ?? "—"}</td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {d.legalHold && <Pill tone="warning">legal hold</Pill>}
                          {d.flags.map((f) => <Pill key={f} tone={f === "high-value" ? "tenant" : f === "disputed" ? "danger" : "muted"}>{f}</Pill>)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">No customers match your filter</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground">
            Assignment is read-only here. Open a customer to reassign agent, manager, team, creditor or AI agent.
          </div>
        </PageCard>
      </section>
    </Shell>
  );
}

function ScopeBanner() {
  const labelByRole: Record<typeof currentViewer.role, string> = {
    tenant_admin: "Tenant Admin — all customer records in this tenant",
    manager: "Manager — assigned teams, creditors or creditors",
    agent: "Agent — only customers assigned to you",
    client_account_manager: "Client Account Manager — assigned creditors/creditors only",
  };
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-xs flex items-center gap-2 flex-wrap">
      <ShieldCheck className="h-3.5 w-3.5 text-tenant" />
      <span className="font-semibold">Visibility scope:</span>
      <span className="text-muted-foreground">{labelByRole[currentViewer.role]}</span>
      <Link to="/tenant/roles" className="ml-auto text-tenant font-semibold hover:underline">
        Configure tenant access rules →
      </Link>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">{label}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground font-semibold">{label}</span>
      {children}
    </label>
  );
}

function LabeledSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <Labeled label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
        {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </Labeled>
  );
}

function statusTone(s: string): "muted" | "tenant" | "success" | "warning" | "danger" | "info" {
  if (s === "paid") return "success";
  if (s === "ptp") return "info";
  if (s === "legal") return "danger";
  if (s === "active") return "tenant";
  if (s === "uncollectable" || s === "archived") return "muted";
  return "warning";
}
