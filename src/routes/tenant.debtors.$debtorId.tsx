import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill, StatTile } from "@/components/tenant/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronLeft, Phone, ScrollText, Lock, Plus, AlertTriangle, ArrowRight, History as HistoryIcon, Search, Download, StickyNote, Play, Sparkles, FileText, Bot, User, Flag, Headphones, MessageSquare, Mail, Send, ShieldCheck, ShieldAlert, Activity, CreditCard, ClipboardList, LayoutGrid, Archive, Trash2, PauseCircle, PlayCircle, Users } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CommsDialog } from "@/components/tenant/CommsDialog";
import { debtors, debtorAuditTrail } from "@/lib/intake-mock";
import { sampleStatusHistory, type StatusEvent, type StatusCode } from "@/lib/status-mock";
import { useStatusCodes, findManagedStatus } from "@/lib/status-store";
import { useDebtorNotes, togglePin, deleteNote, canEditNote, canDeleteNote } from "@/lib/notes-store";
import { useDemoRole, setDemoRole, type DemoRole } from "@/lib/demo-role";
import { DeleteNoteDialog } from "@/components/tenant/DeleteNoteDialog";
import { AuditTimeline } from "@/components/tenant/AuditTimeline";
import { StopEngagementDialog } from "@/components/tenant/StopEngagementDialog";
import { ReasonDialog } from "@/components/tenant/ReasonDialog";
import { EditFieldDialog, SENSITIVE_FIELD_KEYS } from "@/components/tenant/EditFieldDialog";

import { isAdmin } from "@/lib/demo-role";
import { getDebtorPermissions, lockReason, type DebtorTabKey } from "@/lib/role-permissions";
import { logAudit } from "@/lib/audit-timeline-store";
import { useEngagement, stopEngagement, resumeEngagement } from "@/lib/engagement-store";
import { useDebtorCalls } from "@/lib/calls-store";
import { NoteEditor } from "@/components/tenant/NoteEditor";
import { AssignmentCard, AssignmentSummary } from "@/components/tenant/AssignmentCard";
import { useAssignment, getAssignmentStatus } from "@/lib/assignment-store";

import { CustomFieldsSection } from "@/components/tenant/CustomFieldsSection";
import { NoteCard } from "@/components/tenant/NoteCard";
import type { Note } from "@/lib/notes-store";
import { toast } from "sonner";
import { StatusChangeDialog } from "@/components/tenant/statuses/StatusChangeDialog";

import { ComplianceCard } from "@/components/tenant/compliance/ComplianceCard";

import { InterestCalculationCard } from "@/components/tenant/payments/InterestCalculationCard";
import { AgentReportedPaymentsCard } from "@/components/tenant/payments/AgentReportedPaymentsCard";
import { FinancePostedPaymentsCard } from "@/components/tenant/payments/FinancePostedPaymentsCard";
import { PaymentAgreementSection } from "@/components/tenant/payments/PaymentAgreementSection";
import { totalFinancePosted } from "@/lib/payments-split-store";
import { ValidationWarningsCard } from "@/components/tenant/ValidationWarningsCard";
import { DataValidationCard } from "@/components/tenant/DataValidationCard";
import { RPVCard } from "@/components/tenant/RPVCard";
import { RPVSummary } from "@/components/tenant/RPVSummary";
import { DocumentsTab } from "@/components/tenant/DocumentsTab";
import { useFlagTypes, useFlagHistory, addFlagType, removeFlagType, canManageFlagTypes, recordFlagChange, findFlagType, type FlagType } from "@/lib/flags-store";
import { notify } from "@/lib/notifications-store";


export const Route = createFileRoute("/tenant/debtors/$debtorId")({
  head: () => ({ meta: [{ title: "Debtor profile · Tenant Admin" }] }),
  component: DebtorProfile,
  notFoundComponent: () => (
    <Shell>
      <div className="px-10 py-20 text-center">
        <h2 className="font-display text-2xl font-bold">Debtor not found</h2>
        <Link to="/tenant/debtors" className="text-tenant hover:underline text-sm mt-2 inline-block">← Back to debtors</Link>
      </div>
    </Shell>
  ),
});

const toCode = (s: string) => {
  switch (s.toLowerCase()) {
    case "new": return "NEW";
    case "active": return "ACT";
    case "ptp": return "PTP";
    case "paid": return "PIF";
    case "legal": return "LEG";
    case "uncollectable": return "CLO";
    case "archived": return "CLO";
    default: return "ACT";
  }
};


function toneColor(tone: string): string {
  switch (tone) {
    case "tenant": return "hsl(270 70% 60%)";
    case "success": return "hsl(142 70% 45%)";
    case "warning": return "hsl(38 92% 50%)";
    case "danger": return "hsl(0 72% 51%)";
    case "info": return "hsl(217 91% 60%)";
    default: return "hsl(0 0% 60%)";
  }
}

const ROLE_OPTIONS: { value: DemoRole; label: string; hint: string }[] = [
  { value: "agent", label: "Agent", hint: "Front-line collector — limited edit & no delete." },
  { value: "manager", label: "Manager", hint: "Can edit sensitive fields & archive." },
  { value: "admin", label: "Admin", hint: "Full access — delete, override, audit." },
  { value: "finance", label: "Finance", hint: "Payments & balance focus." },
];

function RoleSlicer({ value, onChange }: { value: DemoRole; onChange: (r: DemoRole) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5" title="Demo: switch role to preview permissions">
      <span className="px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">View as</span>
      {ROLE_OPTIONS.map((r) => {
        const active = r.value === value;
        return (
          <button
            key={r.value}
            type="button"
            onClick={() => onChange(r.value)}
            title={r.hint}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
              active ? "bg-gradient-tenant text-white shadow-tenant" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function DebtorProfile() {
  const { debtorId } = useParams({ from: "/tenant/debtors/$debtorId" });
  const d = debtors.find((x) => x.id === debtorId);
  if (!d) throw notFound();

  const allCodes = useStatusCodes();
  const [statusCode, setStatusCode] = useState<string>(toCode(d.status));
  const fallback: StatusCode = {
    code: statusCode, displayName: statusCode, description: "Unknown stage",
    tone: "muted", icon: "•", category: "collection", isFinal: false,
    requiresApproval: false, countsAsActive: false, allowedNext: [],
  };
  const current: StatusCode = findManagedStatus(statusCode) ?? fallback;
  const [history, setHistory] = useState<StatusEvent[]>(sampleStatusHistory);
  const [pendingNext, setPendingNext] = useState<string | null>(null);

  void allCodes;
  const allowedNext = current.allowedNext.map((c) => findManagedStatus(c)).filter((s): s is StatusCode => Boolean(s));

  const requestChange = (nextCode: string) => {
    if (!current.allowedNext.includes(nextCode)) {
      toast.error("Transition not allowed", { description: `${current.code} → ${nextCode} is not a valid transition in the system workflow.` });
      return;
    }
    setPendingNext(nextCode);
  };

  const confirmChange = (payload: { note: string }) => {
    if (!pendingNext) return;
    const next = findManagedStatus(pendingNext);
    if (!next) { toast.error("Status no longer exists"); setPendingNext(null); return; }
    const fromLabel = `${current.displayName} (${current.code})`;
    const toLabel = `${next.displayName} (${next.code})`;
    const event: StatusEvent = {
      id: `se-${Date.now()}`,
      when: new Date().toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      fromStatus: statusCode,
      toStatus: pendingNext,
      actor: "Maya Lindstrom",
      isSystem: false,
      reason: payload.note || `Status changed from ${fromLabel} to ${toLabel}`,
    };
    setHistory((h) => [event, ...h]);
    setStatusCode(pendingNext);
    setPendingNext(null);
    toast.success("Debtor status updated successfully.", {
      description: `${current.code} → ${next.code}`,
    });
  };

  const bumpStatus = (toCode: string, reason: string) => {
    if (statusCode === toCode) return;
    if (!current.allowedNext.includes(toCode)) {
      toast.info("Agreement saved", { description: `Status stays at ${current.code} — ${current.code} → ${toCode} is not a valid transition.` });
      return;
    }
    const next = findManagedStatus(toCode);
    if (!next) return;
    const event: StatusEvent = {
      id: `se-${Date.now()}`,
      when: new Date().toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      fromStatus: statusCode,
      toStatus: toCode,
      actor: "Maya Lindstrom",
      isSystem: false,
      reason,
    };
    setHistory((h) => [event, ...h]);
    setStatusCode(toCode);
    toast.success(`Status updated to ${next.displayName}`, { description: `${current.code} → ${next.code}` });
  };



  const [flags, setFlags] = useState<string[]>(d.flags);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Lifecycle (manual, permission-gated). Permissions derived from current demo role.
  const role = useDemoRole();
  const perms = getDebtorPermissions(role);
  const canDelete = perms.canDelete;

  // If current tab is not allowed for this role, snap back to overview.
  useEffect(() => {
    if (!perms.allowedTabs.has(activeTab as DebtorTabKey)) {
      setActiveTab("overview");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  
  const [archived, setArchived] = useState<boolean>(d.status === "archived");
  const [deletedAt, setDeletedAt] = useState<string | null>(null);
  const engagement = useEngagement(d.id);
  const engagementStopped = engagement.status === "stopped";
  const lastStop = engagement.history[0];
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [reengageDialogOpen, setReengageDialogOpen] = useState(false);
  const [archiveReasonOpen, setArchiveReasonOpen] = useState(false);
  const [deleteReasonOpen, setDeleteReasonOpen] = useState(false);
  type LifecycleEntry = { id: string; when: string; actor: string; action: string; source: string };
  const [lifecycleAudit, setLifecycleAudit] = useState<LifecycleEntry[]>([]);

  const nowLabel = () => new Date().toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const ACTOR = "Maya Lindstrom"; // TODO: from auth session

  const handleEngagement = () => {
    if (engagementStopped) setReengageDialogOpen(true);
    else setStopDialogOpen(true);
  };

  const confirmStop = (data: { reason: string; duration: "temporary" | "permanent"; channels: ("ai_calls" | "sms" | "email" | "all")[]; effectiveDate: string; note?: string }) => {
    stopEngagement(d.id, { ...data, by: ACTOR }, ACTOR);
    setStopDialogOpen(false);
    setLifecycleAudit((l) => [
      { id: `la-${Date.now()}`, when: nowLabel(), actor: ACTOR, action: `Stopped engagement (${data.duration}) — ${data.channels.join(", ")}`, source: "Web UI" },
      ...l,
    ]);
    toast.success("Engagement stopped", { description: `${data.duration === "permanent" ? "Permanent" : "Temporary"} · effective ${data.effectiveDate}` });
  };

  const confirmReengage = () => {
    resumeEngagement(d.id, ACTOR);
    setReengageDialogOpen(false);
    setLifecycleAudit((l) => [
      { id: `la-${Date.now()}`, when: nowLabel(), actor: ACTOR, action: "Re-engaged debtor", source: "Web UI" },
      ...l,
    ]);
    toast.success("Engagement resumed", { description: "Debtor returned to active outreach." });
  };

  const handleArchive = () => {
    if (archived) {
      // restore — no reason required, but logged
      setArchived(false);
      setLifecycleAudit((l) => [
        { id: `la-${Date.now()}`, when: nowLabel(), actor: ACTOR, action: "Restored from archive", source: "Web UI" },
        ...l,
      ]);
      logAudit({ debtorId: d.id, actor: ACTOR, actorKind: "human", category: "archive", action: "Restored from archive" });
      toast.success("Debtor restored", { description: "Returned to active debtor lists." });
      return;
    }
    setArchiveReasonOpen(true);
  };

  const confirmArchive = (reason: string) => {
    setArchived(true);
    setArchiveReasonOpen(false);
    setLifecycleAudit((l) => [
      { id: `la-${Date.now()}`, when: nowLabel(), actor: ACTOR, action: "Archived debtor", source: "Web UI" },
      ...l,
    ]);
    logAudit({ debtorId: d.id, actor: ACTOR, actorKind: "human", category: "archive", action: "Archived debtor", reason });
    toast.success("Debtor archived", { description: "Hidden from active work views. Recoverable via the Archived filter." });
  };

  const handleExport = () => {
    const rows: [string, string | number][] = [
      ["id", d.id], ["name", d.name], ["external_id", d.external],
      ["creditor", d.creditor], ["balance", d.balance], ["status", archived ? "archived" : d.status],
      ["contactability", d.contactability], ["collectability", d.collectability],
      ["last_activity", d.lastActivity], ["placed_at", d.placedAt],
      ["legal_hold", d.legalHold ? "true" : "false"], ["flags", flags.join("|")],
    ];
    const csv = ["field,value", ...rows.map(([k, v]) => `${k},"${String(v).replace(/"/g, '""')}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `debtor_${d.id}.csv`; a.click();
    URL.revokeObjectURL(url);
    setLifecycleAudit((l) => [
      { id: `la-${Date.now()}`, when: nowLabel(), actor: ACTOR, action: "Exported debtor record", source: "Web UI" },
      ...l,
    ]);
    toast.success("Debtor data exported");
  };

  const handleRequestDelete = () => {
    if (!canDelete) {
      toast.error("Not permitted", { description: "Delete is restricted to admin / tenant admin." });
      return;
    }
    setDeleteReasonOpen(true);
  };

  const confirmDeleteAction = (reason: string) => {
    if (!canDelete) return;
    const stamp = nowLabel();
    setDeletedAt(stamp);
    setDeleteReasonOpen(false);
    setLifecycleAudit((l) => [
      { id: `la-${Date.now()}`, when: stamp, actor: ACTOR, action: "Deleted debtor record (soft)", source: "Web UI" },
      ...l,
    ]);
    logAudit({ debtorId: d.id, actor: ACTOR, actorKind: "human", category: "delete", action: "Deleted debtor record (soft)", reason });
    toast.success("Debtor deleted", { description: "Soft delete — comms, calls, notes and audit are retained." });
  };

  const toggleFlag = (flag: string) => {
    setFlags((prev) => {
      const wasOn = prev.includes(flag);
      const next = wasOn ? prev.filter((f) => f !== flag) : [...prev, flag];
      recordFlagChange({ debtorId: d.id, flag, action: wasOn ? "removed" : "added" });
      toast.success(wasOn ? `Flag "${flag}" removed` : `Flag "${flag}" added`);
      return next;
    });
  };

  const pillToneClass = (tone: string) => {
    switch (tone) {
      case "tenant": return "bg-tenant text-white";
      case "success": return "bg-success/15 text-success border border-success/30";
      case "warning": return "bg-warning/20 text-warning-foreground border border-warning/40";
      case "danger": return "bg-destructive/15 text-destructive border border-destructive/30";
      case "info": return "bg-info/15 text-info-foreground border border-info/30";
      default: return "bg-muted text-foreground border border-border";
    }
  };

  return (
    <Shell>
      <Topbar
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/tenant/debtors" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
              <ChevronLeft className="h-4 w-4" /> Back
            </Link>
          </div>
        }
      />

      <section className="px-6 lg:px-10 pt-6">
        <div className="rounded-2xl border border-border bg-card shadow-elegant">
          {/* Compact header: big name + small status tag */}
          <div className="px-6 py-5 flex flex-wrap items-center gap-3 border-l-8" style={{ borderColor: toneColor(current.tone) }}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="font-display text-3xl font-bold tracking-tight truncate">{d.name}</h2>

                {/* Status tag — click to change */}
                <div className="relative">
                  <button
                    onClick={() => setStatusMenuOpen((o) => !o)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${pillToneClass(current.tone)} hover:opacity-90 transition`}
                    title="Click to change status"
                  >
                    <span>{current.icon}</span>
                    <span>{current.code}</span>
                    <span className="opacity-70">{current.displayName}</span>
                    <ArrowRight className="h-3 w-3 opacity-70" />
                  </button>
                  {statusMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setStatusMenuOpen(false)} />
                      <div className="absolute z-40 mt-1.5 left-0 w-64 rounded-xl border border-border bg-card shadow-tenant overflow-hidden">
                        <div className="px-3 py-2 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Change status
                        </div>
                        {allowedNext.length === 0 ? (
                          <div className="px-3 py-3 text-xs text-muted-foreground italic">Terminal status — no transitions.</div>
                        ) : (
                          <ul className="max-h-72 overflow-y-auto">
                            {allowedNext.map((s) => (
                              <li key={s.code}>
                                <button
                                  onClick={() => { setStatusMenuOpen(false); requestChange(s.code); }}
                                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2"
                                >
                                  <span>{s.icon}</span>
                                  <span className="font-semibold">{s.code}</span>
                                  <span className="text-muted-foreground text-xs truncate flex-1">{s.displayName}</span>
                                  {s.requiresApproval && <AlertTriangle className="h-3 w-3 text-warning" />}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                </div>

                
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {d.external} · {d.creditor} · placed {d.placedAt}
                {current.requiresApproval && <span className="ml-2 text-warning-foreground">· approval-gated</span>}
                {current.isFinal && <span className="ml-2">· FINAL</span>}
              </div>
            </div>

            {/* Flag editor */}
            <FlagEditor flags={flags} onToggle={toggleFlag} />
          </div>

          <StatusChangeDialog
            open={!!pendingNext}
            fromStatus={statusCode}
            toStatus={pendingNext ?? statusCode}
            onClose={() => setPendingNext(null)}
            onConfirm={confirmChange}
          />


          <div className="px-6 py-3 border-t border-border flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
            <span><span className="text-muted-foreground/70">Internal ID:</span> <span className="font-mono text-foreground">{d.id}</span></span>
            <span><span className="text-muted-foreground/70">External ID:</span> <span className="font-mono text-foreground">{d.external}</span></span>
            <span><span className="text-muted-foreground/70">Creditor:</span> <span className="text-foreground">{d.creditor}</span></span>
            <span><span className="text-muted-foreground/70">Created:</span> <span className="text-foreground">{d.placedAt}</span></span>
            <span><span className="text-muted-foreground/70">Balance:</span> <span className="font-semibold text-foreground">${d.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
            <div className="ml-auto flex items-center gap-1.5">
              {perms.canManageCalls && (
                <button onClick={() => setActiveTab("calls")} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted">
                  <Phone className="h-3.5 w-3.5" /> Call
                </button>
              )}
              {perms.canManageComms && (
                <button onClick={() => setActiveTab("comms")} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted">
                  <MessageSquare className="h-3.5 w-3.5" /> Message
                </button>
              )}
              {perms.canManagePayments && (
                <button onClick={() => setActiveTab("payments")} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gradient-tenant text-white text-xs font-semibold shadow-tenant">
                  <CreditCard className="h-3.5 w-3.5" /> Record payment
                </button>
              )}
            </div>

          </div>
        </div>
      </section>

      <section className="px-6 lg:px-10 py-6 space-y-2">
        <SectionLabel>Balance Summary</SectionLabel>
        <BalanceBreakdown debtor={d} statusName={current.displayName} />
      </section>

      <NoOwnerWarning debtorId={d.id} onAssignClick={() => setActiveTab("assignment")} />

      <section className="px-6 lg:px-10 pt-2 space-y-2">
        <SectionLabel>Assignment Summary</SectionLabel>
        <AssignmentSummary debtorId={d.id} />
      </section>

      <section className="px-6 lg:px-10 pt-4 space-y-2">
        <SectionLabel>Validation Warnings</SectionLabel>
        <ValidationWarningsCard debtorId={d.id} />
      </section>

      <section className="px-6 lg:px-10 pt-4 space-y-2">
        <SectionLabel>RPV Summary</SectionLabel>
        <RPVSummary debtorId={d.id} onOpen={() => setActiveTab("rpv")} />
      </section>


      <section className="px-6 lg:px-10 pb-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto flex-wrap gap-1 bg-muted/60 p-1 mb-4">
            {perms.allowedTabs.has("overview") && <TabsTrigger value="overview"><LayoutGrid className="h-3.5 w-3.5 mr-1.5" />Overview</TabsTrigger>}
            {perms.allowedTabs.has("assignment") && <TabsTrigger value="assignment"><Users className="h-3.5 w-3.5 mr-1.5" />Assignment</TabsTrigger>}
            {perms.allowedTabs.has("dataprofile") && <TabsTrigger value="dataprofile"><ClipboardList className="h-3.5 w-3.5 mr-1.5" />Data profile</TabsTrigger>}
            {perms.allowedTabs.has("rpv") && <TabsTrigger value="rpv"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />RPV</TabsTrigger>}
            {perms.allowedTabs.has("comms") && <TabsTrigger value="comms"><MessageSquare className="h-3.5 w-3.5 mr-1.5" />Communication</TabsTrigger>}
            {perms.allowedTabs.has("calls") && <TabsTrigger value="calls"><Headphones className="h-3.5 w-3.5 mr-1.5" />Calls</TabsTrigger>}
            {perms.allowedTabs.has("payments") && <TabsTrigger value="payments"><CreditCard className="h-3.5 w-3.5 mr-1.5" />Payments</TabsTrigger>}
            {perms.allowedTabs.has("documents") && <TabsTrigger value="documents"><FileText className="h-3.5 w-3.5 mr-1.5" />Documents</TabsTrigger>}
            {perms.allowedTabs.has("notes") && <TabsTrigger value="notes"><StickyNote className="h-3.5 w-3.5 mr-1.5" />Notes</TabsTrigger>}
            {perms.allowedTabs.has("timeline") && <TabsTrigger value="timeline"><HistoryIcon className="h-3.5 w-3.5 mr-1.5" />Timeline</TabsTrigger>}
          </TabsList>


          <TabsContent value="overview" className="mt-0 space-y-4">
            <OverviewTab
              debtor={d}
              flags={flags}
              onToggleFlag={toggleFlag}
              currentStatusName={current.displayName}
              history={history}
              onGoToNotes={() => setActiveTab("notes")}
              lifecycleAudit={lifecycleAudit}
              archived={archived}
              engagementStopped={engagementStopped}
              deletedAt={deletedAt}
              canDelete={canDelete}
              canArchive={perms.canArchive}
              canStopEngagement={perms.canStopEngagement}
              roleLockReason={lockReason(role, "This action")}
              onExport={handleExport}
              onArchive={handleArchive}
              onEngagement={handleEngagement}
              onRequestDelete={handleRequestDelete}
            />
            <IdentityValidationCard debtorId={d.id} />
          </TabsContent>

          <TabsContent value="assignment" className="mt-0 space-y-4">
            <AssignmentCard debtorId={d.id} />
          </TabsContent>

          <TabsContent value="dataprofile" className="mt-0 space-y-4">
            <DataValidationCard debtorId={d.id} />
            <DebtorProfileFields debtor={d} />
            <CustomFieldsSection debtorId={d.id} />
          </TabsContent>

          <TabsContent value="rpv" className="mt-0 space-y-4">
            <RPVCard debtorId={d.id} />
          </TabsContent>

          <TabsContent value="comms" className="mt-0">
            <CommunicationSection debtorId={d.id} debtorName={d.name} />
          </TabsContent>

          <TabsContent value="calls" className="mt-0 space-y-4">
            <AICallAnalysisCard debtorId={d.id} />
            <CallsSection debtorId={d.id} />
          </TabsContent>

          <TabsContent value="payments" className="mt-0 space-y-4">
            {role !== "finance" && (
              <PaymentAgreementSection
                debtorId={d.id}
                balance={d.balance}
                currentStatusCode={statusCode}
                bumpStatus={bumpStatus}
              />
            )}
            <div className={`grid grid-cols-1 ${role === "finance" || role === "admin" ? "" : "lg:grid-cols-2"} gap-4`}>
              {role !== "admin" && role !== "finance" && (
                <AgentReportedPaymentsCard debtorId={d.id} />
              )}
              {role !== "admin" && (
                <FinancePostedPaymentsCard
                  debtorId={d.id}
                  originalBalance={d.balance + totalFinancePosted(d.id)}
                  accruedInterest={Math.round(d.balance * 0.05)}
                />
              )}
            </div>
            {role !== "finance" && <InterestCalculationCard debtorId={d.id} balance={d.balance} />}
          </TabsContent>

          <TabsContent value="documents" className="mt-0">
            <DocumentsTab debtorId={d.id} debtorName={d.name} />
          </TabsContent>

          <TabsContent value="notes" className="mt-0">
            <NotesSection debtorId={d.id} debtorName={d.name} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-0 space-y-4">
            <TimelineTab history={history} lifecycleAudit={lifecycleAudit} debtorId={d.id} />
          </TabsContent>
        </Tabs>
      </section>

      <StopEngagementDialog
        open={stopDialogOpen}
        onClose={() => setStopDialogOpen(false)}
        onConfirm={confirmStop}
      />

      <ReasonDialog
        open={archiveReasonOpen}
        onClose={() => setArchiveReasonOpen(false)}
        onConfirm={confirmArchive}
        kind="archive"
        label="Archive debtor"
      />

      <ReasonDialog
        open={deleteReasonOpen}
        onClose={() => setDeleteReasonOpen(false)}
        onConfirm={confirmDeleteAction}
        kind="delete"
        label="Delete debtor"
      />

      <AlertDialog open={reengageDialogOpen} onOpenChange={setReengageDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-engage debtor?</AlertDialogTitle>
            <AlertDialogDescription>
              {lastStop ? (
                <>
                  Previous stop reason: <span className="font-semibold text-foreground">{lastStop.reason}</span>
                  <br />
                  Duration: {lastStop.duration} · Channels: {lastStop.channels.join(", ")} · Effective {lastStop.effectiveDate}
                </>
              ) : (
                "Resume AI calls, SMS, and email outreach for this debtor."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReengage}>Re-engage</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview tab — compact summary, latest 3 notes, latest 3 timeline events
// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab({
  debtor,
  flags,
  onToggleFlag,
  currentStatusName,
  history,
  onGoToNotes,
  lifecycleAudit,
  archived,
  engagementStopped,
  deletedAt,
  canDelete,
  canArchive,
  canStopEngagement,
  roleLockReason,
  onExport,
  onArchive,
  onEngagement,
  onRequestDelete,
}: {
  debtor: typeof debtors[number];
  flags: string[];
  onToggleFlag: (f: string) => void;
  currentStatusName: string;
  history: StatusEvent[];
  onGoToNotes: () => void;
  lifecycleAudit: { id: string; when: string; actor: string; action: string; source: string }[];
  archived: boolean;
  engagementStopped: boolean;
  deletedAt: string | null;
  canDelete: boolean;
  canArchive: boolean;
  canStopEngagement: boolean;
  roleLockReason: string;
  onExport: () => void;
  onArchive: () => void;
  onEngagement: () => void;
  onRequestDelete: () => void;
}) {
  void currentStatusName;
  const notes = useDebtorNotes(debtor.id);
  const latestNotes = notes.slice(0, 3);
  const latestEvents = history.slice(0, 3);
  const nextAction = debtor.legalHold
    ? "Awaiting legal review — no outbound contact"
    : debtor.contactability < 40
      ? "Skip-trace recommended"
      : `Follow up via ${debtor.contactability >= 70 ? "call" : "SMS"}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <PageCard className="lg:col-span-3">
        <CardHead
          title="Manage debtor"
          subtitle="Manual lifecycle actions — all changes are recorded in the audit trail"
        />
        <div className="px-6 py-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={onExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            title="Download debtor data as CSV"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button
            onClick={onArchive}
            disabled={!!deletedAt || !canArchive}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canArchive ? roleLockReason : (archived ? "Restore to active" : "Hide from active work views")}
          >
            {!canArchive && <Lock className="h-3.5 w-3.5" />}
            <Archive className="h-4 w-4" /> {archived ? "Restore" : "Archive"}
          </button>
          <button
            onClick={onEngagement}
            disabled={!!deletedAt || !canStopEngagement}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canStopEngagement ? roleLockReason : (engagementStopped ? "Resume AI/outbound workflows for this debtor" : "Pause AI/outbound workflows for this debtor")}
          >
            {!canStopEngagement && <Lock className="h-3.5 w-3.5" />}
            {engagementStopped
              ? <><PlayCircle className="h-4 w-4" /> Re-engage</>
              : <><PauseCircle className="h-4 w-4" /> Stop Engagement</>}
          </button>
          {canDelete && (
            <button
              onClick={onRequestDelete}
              disabled={!!deletedAt}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/40 text-destructive text-sm hover:bg-destructive/10 disabled:opacity-50"
              title="Permission-controlled. Comms history, calls, notes and audit are retained."
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
          {(archived || engagementStopped || deletedAt) && (
            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              {deletedAt && <Pill tone="danger">Deleted · {deletedAt}</Pill>}
              {archived && !deletedAt && <Pill tone="warning">Archived</Pill>}
              {engagementStopped && !deletedAt && <Pill tone="muted">Engagement stopped</Pill>}
            </div>
          )}
        </div>
      </PageCard>
      <PageCard className="lg:col-span-2">
        <CardHead title="Debtor summary" subtitle="Most important non-financial signals" />
        <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <Field label="Name" value={debtor.name} />
          <Field label="Creditor" value={debtor.creditor} />
          <Field label="Last activity" value={debtor.lastActivity} />
          <Field label="Placed" value={debtor.placedAt} />
          <Field label="Next action" value={nextAction} />
        </div>


        <div className="px-6 pb-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Key flags</div>
          <div className="flex flex-wrap gap-1.5">
            {debtor.legalHold && <Pill tone="warning"><Lock className="h-3 w-3" /> legal hold</Pill>}
            {flags.length === 0 && !debtor.legalHold && <span className="text-xs text-muted-foreground">No flags on file</span>}
            {flags.map((f) => (
              <span key={f} className="inline-flex items-center gap-1 group">
                <Pill tone={findFlagType(f)?.tone ?? "muted"}>{findFlagType(f)?.label ?? f}</Pill>
                <button onClick={() => onToggleFlag(f)} className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive" aria-label={`Remove flag ${f}`}>×</button>
              </span>
            ))}
          </div>
        </div>
      </PageCard>

      <PageCard>
        <CardHead
          title="Latest notes"
          subtitle={`${notes.length} total`}
          action={
            <button onClick={onGoToNotes} className="text-xs font-semibold text-tenant hover:underline">
              View all →
            </button>
          }
        />
        <div className="px-6 py-3 space-y-2">
          {latestNotes.length === 0 && <div className="text-xs text-muted-foreground py-4 text-center">No notes yet.</div>}
          {latestNotes.map((n) => (
            <div key={n.id} className="text-xs border border-border rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                {n.pinned && <Pill tone="warning">pinned</Pill>}
                <span className="font-semibold">{n.createdBy}</span>
                <span className="text-muted-foreground ml-auto">{new Date(n.createdAt).toLocaleDateString()}</span>
                <Link
                  to="/tenant/debtors/$debtorId/notes/$noteId"
                  params={{ debtorId: debtor.id, noteId: n.id }}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-tenant hover:bg-tenant-soft"
                  aria-label="Open note"
                >
                  Open <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: n.bodyHtml }} />
            </div>
          ))}
        </div>
      </PageCard>

      <PageCard className="lg:col-span-3">
        <CardHead title="Latest activity" subtitle="3 most recent events — full audit in Timeline tab" />
        <ol className="px-6 py-3 space-y-2">
          {latestEvents.map((e) => {
            const f = findManagedStatus(e.fromStatus); const t = findManagedStatus(e.toStatus);
            return (
              <li key={e.id} className="flex items-center gap-2 text-xs flex-wrap">
                <span className={`h-2 w-2 rounded-full shrink-0 ${e.isSystem ? "bg-info" : "bg-tenant"}`} />
                {f ? <Pill tone={f.tone}>{f.code}</Pill> : <span className="text-muted-foreground">—</span>}
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                {t && <Pill tone={t.tone}>{t.code}</Pill>}
                <span className="text-muted-foreground truncate flex-1 min-w-[120px]">{e.reason}</span>
                <span className="text-muted-foreground shrink-0">{e.when}</span>
              </li>
            );
          })}
        </ol>
      </PageCard>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-semibold text-sm truncate">{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
      {children}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Timeline tab — full status history + audit trail
// ─────────────────────────────────────────────────────────────────────────────

function TimelineTab({ history, lifecycleAudit, debtorId }: { history: StatusEvent[]; lifecycleAudit: { id: string; when: string; actor: string; action: string; source: string }[]; debtorId: string }) {
  const flagHistory = useFlagHistory(debtorId);
  return (
    <>
      <PageCard>
        <CardHead title="Status history" subtitle={`${history.length} status changes`} />
        <ol className="px-6 py-4 space-y-2">
          {history.map((e) => {
            const f = findManagedStatus(e.fromStatus); const t = findManagedStatus(e.toStatus);
            return (
              <li key={e.id} className="flex items-center gap-2 text-xs flex-wrap">
                <span className={`h-2 w-2 rounded-full shrink-0 ${e.isSystem ? "bg-info" : "bg-tenant"}`} />
                {f ? <Pill tone={f.tone}>{f.code}</Pill> : <span className="text-muted-foreground">—</span>}
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                {t && <Pill tone={t.tone}>{t.code}</Pill>}
                <span className="text-muted-foreground truncate flex-1 min-w-[120px]">{e.reason}</span>
                <span className="text-muted-foreground shrink-0">{e.actor} · {e.when}</span>
              </li>
            );
          })}
        </ol>
      </PageCard>

      <PageCard>
        <CardHead title="Flag history" subtitle={`${flagHistory.length} flag change${flagHistory.length === 1 ? "" : "s"}`} />
        {flagHistory.length === 0 ? (
          <div className="px-6 py-4 text-xs text-muted-foreground">No flag changes recorded.</div>
        ) : (
          <ul className="divide-y divide-border">
            {flagHistory.map((h) => {
              const t = findFlagType(h.flag);
              return (
                <li key={h.id} className="px-6 py-3 flex items-center gap-2 text-xs flex-wrap">
                  <Flag className={`h-3.5 w-3.5 ${h.action === "added" ? "text-success" : "text-destructive"}`} />
                  <span className="font-semibold">{h.action === "added" ? "Added" : "Removed"}</span>
                  <Pill tone={t?.tone ?? "muted"}>{t?.label ?? h.flag}</Pill>
                  <span className="ml-auto text-muted-foreground">{h.actor} · {h.at}</span>
                </li>
              );
            })}
          </ul>
        )}
      </PageCard>

      <PageCard>
        <CardHead title="Audit trail" subtitle="Every change to this debtor — imports, edits, AI actions, CRM sync, payments, communications, archive/delete" action={<Link to="/tenant/intake/audit" className="text-xs font-semibold text-tenant hover:underline">Full log</Link>} />
        <ul className="divide-y divide-border">
          {lifecycleAudit.map((a) => (
            <li key={a.id} className="px-6 py-3 flex items-start gap-3 text-sm bg-warning/5">
              <Archive className="h-4 w-4 text-warning mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold">{a.action}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{a.actor} · {a.source} · {a.when}</div>
              </div>
            </li>
          ))}
          {debtorAuditTrail.map((a) => (
            <li key={a.id} className="px-6 py-3 flex items-start gap-3 text-sm">
              <ScrollText className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold">{a.action}{a.field && <span className="text-muted-foreground font-normal"> · {a.field}</span>}</div>
                {(a.before || a.after) && (
                  <div className="text-xs font-mono mt-0.5">
                    {a.before && <span className="text-destructive">{a.before}</span>}
                    {a.before && a.after && <span className="mx-1.5 text-muted-foreground">→</span>}
                    {a.after && <span className="text-success">{a.after}</span>}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-0.5">{a.actor} · {a.source} · {a.when}</div>
              </div>
            </li>
          ))}
        </ul>
      </PageCard>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Communication tab — separate SMS / Email threads, no all/AI/Agent filters
// ─────────────────────────────────────────────────────────────────────────────

type DeliveryStatus = "sent" | "delivered" | "read" | "failed";
type CommsMessage = {
  id: string;
  channel: "sms" | "email";
  source: "ai" | "human" | "debtor";
  author: string;
  when: string;
  body: string;
  subject?: string;
  delivery?: DeliveryStatus;
};

const SEED_COMMS: CommsMessage[] = [
  { id: "m1", channel: "sms", source: "ai", author: "AI Assistant", when: "2 days ago", body: "Hi Janelle, this is a friendly reminder about your account. You can view your options at the secure link we sent earlier." },
  { id: "m2", channel: "sms", source: "debtor", author: "Debtor", when: "2 days ago", body: "Can I pay half this week and the rest next month?" },
  { id: "m3", channel: "sms", source: "human", author: "Maya Lindstrom", when: "2 days ago", body: "Absolutely — I'll set up a 2-installment plan and email you the details." },
  { id: "m4", channel: "email", source: "human", author: "Maya Lindstrom", when: "2 days ago", subject: "Your payment plan", body: "Hi Janelle, please find attached the agreed 2-installment plan. Reply if any questions." },
  { id: "m5", channel: "email", source: "debtor", author: "Debtor", when: "1 day ago", subject: "Your payment plan", body: "Thanks — confirming receipt. I'll send the first payment Friday." },
  { id: "m6", channel: "email", source: "ai", author: "AI Assistant", when: "5 days ago", subject: "Payment options available", body: "Several flexible payment options are available for your account." },
];

function CommunicationSection({ debtorId, debtorName }: { debtorId: string; debtorName: string }) {
  void debtorId;
  const [view, setView] = useState<"sms" | "email">("sms");
  const [msgs, setMsgs] = useState<CommsMessage[]>(SEED_COMMS);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftSubject, setDraftSubject] = useState("");

  const smsMessages = useMemo(() => msgs.filter((m) => m.channel === "sms"), [msgs]);
  const emailMessages = useMemo(() => msgs.filter((m) => m.channel === "email"), [msgs]);

  // Group emails into threads keyed by subject
  const emailThreads = useMemo(() => {
    const map = new Map<string, CommsMessage[]>();
    for (const m of emailMessages) {
      const key = m.subject || "(no subject)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).map(([subject, messages]) => ({ subject, messages }));
  }, [emailMessages]);

  const sendSms = () => {
    if (!draft.trim()) { toast.error("Message body required"); return; }
    const m: CommsMessage = {
      id: `m_${Date.now()}`, channel: "sms", source: "human", author: "You", when: "just now", body: draft.trim(),
    };
    setMsgs((prev) => [m, ...prev]);
    setDraft("");
    toast.success(`SMS sent to ${debtorName}`);
  };

  const sendEmail = (subject: string) => {
    if (!draft.trim()) { toast.error("Email body required"); return; }
    const m: CommsMessage = {
      id: `m_${Date.now()}`, channel: "email", source: "human", author: "You", when: "just now", body: draft.trim(), subject,
    };
    setMsgs((prev) => [m, ...prev]);
    setDraft("");
    toast.success(`Email sent to ${debtorName}`);
  };

  const startNewThread = () => {
    if (!draft.trim() || !draftSubject.trim()) { toast.error("Subject and body required"); return; }
    sendEmail(draftSubject.trim());
    setDraftSubject("");
    setOpenThread(draftSubject.trim());
  };

  const activeThread = openThread ? emailThreads.find((t) => t.subject === openThread) : null;

  return (
    <PageCard>
      <CardHead
        title="Communication"
        subtitle={view === "sms" ? `${smsMessages.length} SMS messages` : `${emailThreads.length} email thread${emailThreads.length === 1 ? "" : "s"}`}
        action={
          <div className="flex items-center gap-1">
            <button onClick={() => { setView("sms"); setOpenThread(null); setDraft(""); }} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border inline-flex items-center gap-1 ${view === "sms" ? "bg-tenant text-white border-tenant" : "border-border hover:bg-muted"}`}>
              <MessageSquare className="h-3 w-3" /> SMS
            </button>
            <button onClick={() => { setView("email"); setOpenThread(null); setDraft(""); }} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border inline-flex items-center gap-1 ${view === "email" ? "bg-tenant text-white border-tenant" : "border-border hover:bg-muted"}`}>
              <Mail className="h-3 w-3" /> Email
            </button>
          </div>
        }
      />

      {view === "sms" && (
        <>
          <div className="px-6 py-4 space-y-3 max-h-[480px] overflow-y-auto">
            {smsMessages.length === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No SMS messages yet.
              </div>
            )}
            {smsMessages.map((m) => {
              const isInbound = m.source === "debtor";
              return (
                <div key={m.id} className={`flex gap-2 ${isInbound ? "" : "flex-row-reverse"}`}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${m.source === "ai" ? "bg-tenant-soft text-tenant" : m.source === "human" ? "bg-info/20 text-info" : "bg-muted text-muted-foreground"}`}>
                    {m.source === "ai" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${isInbound ? "bg-muted" : "bg-tenant text-white"}`}>
                    <div className={`flex items-center gap-1.5 text-[10px] font-semibold mb-1 ${isInbound ? "text-muted-foreground" : "text-white/70"}`}>
                      <span>{m.author}</span><span>·</span><span>{m.when}</span>
                    </div>
                    <div className={`whitespace-pre-wrap ${isInbound ? "text-foreground" : "text-white"}`}>{m.body}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border px-6 py-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Send SMS</div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Type your SMS to ${debtorName}…`}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm outline-none focus:ring-2 ring-tenant resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">All messages are logged to the audit trail.</span>
              <button onClick={sendSms} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
                <Send className="h-3.5 w-3.5" /> Send SMS
              </button>
            </div>
          </div>
        </>
      )}

      {view === "email" && !activeThread && (
        <>
          <div className="px-6 py-4">
            {emailThreads.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No email threads yet.
              </div>
            ) : (
              <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                {emailThreads.map((t) => {
                  const last = t.messages[0];
                  return (
                    <li key={t.subject}>
                      <button
                        onClick={() => { setOpenThread(t.subject); setDraft(""); }}
                        className="w-full text-left px-4 py-3 hover:bg-muted flex items-start gap-3"
                      >
                        <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate">{t.subject}</span>
                            <span className="text-[11px] text-muted-foreground shrink-0">{t.messages.length} message{t.messages.length === 1 ? "" : "s"}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">{last.author} · {last.when} — {last.body}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-border px-6 py-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Start new email thread</div>
            <input
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              placeholder="Subject"
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm outline-none focus:ring-2 ring-tenant"
            />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Compose email to ${debtorName}…`}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm outline-none focus:ring-2 ring-tenant resize-none"
            />
            <div className="flex items-center justify-end">
              <button onClick={startNewThread} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
                <Send className="h-3.5 w-3.5" /> Send email
              </button>
            </div>
          </div>
        </>
      )}

      {view === "email" && activeThread && (
        <>
          <div className="px-6 py-3 border-b border-border flex items-center gap-2">
            <button onClick={() => setOpenThread(null)} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-3.5 w-3.5" /> Back to threads
            </button>
            <span className="font-semibold text-sm truncate">{activeThread.subject}</span>
          </div>
          <div className="px-6 py-4 space-y-3 max-h-[420px] overflow-y-auto">
            {[...activeThread.messages].reverse().map((m) => {
              const isInbound = m.source === "debtor";
              return (
                <div key={m.id} className={`rounded-lg border p-3 ${isInbound ? "border-border bg-muted" : "border-tenant/30 bg-tenant-soft"}`}>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold mb-1 text-muted-foreground">
                    <span>{m.author}</span><span>·</span><span>{m.when}</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border px-6 py-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Reply</div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Reply to ${debtorName}…`}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm outline-none focus:ring-2 ring-tenant resize-none"
            />
            <div className="flex items-center justify-end">
              <button onClick={() => sendEmail(activeThread.subject)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
                <Send className="h-3.5 w-3.5" /> Send reply
              </button>
            </div>
          </div>
        </>
      )}
    </PageCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Call Analysis — explainable summary of the most recent call
// ─────────────────────────────────────────────────────────────────────────────

function AICallAnalysisCard({ debtorId }: { debtorId: string }) {
  const calls = useDebtorCalls(debtorId);
  const last = calls[0];
  if (!last) return null;
  const sentiment: "Positive" | "Neutral" | "Negative" =
    last.summary.qaScore >= 80 ? "Positive" : last.summary.qaScore >= 55 ? "Neutral" : "Negative";
  const intent =
    last.outcome === "promise" ? "Willing to pay"
    : last.outcome === "cease" ? "Refused"
    : last.outcome === "dispute" ? "Dispute"
    : last.outcome === "rpc" ? "No commitment"
    : "No commitment";
  const outcomeLabel =
    last.outcome === "promise" ? "Payment promised"
    : last.outcome === "rpc" ? "Right party contact"
    : last.outcome === "voicemail" ? "Voicemail left"
    : last.outcome === "no_answer" ? "No answer"
    : last.outcome === "cease" ? "Cease requested"
    : last.outcome === "dispute" ? "Dispute opened"
    : last.outcome === "wrong_number" ? "Wrong number"
    : "No resolution";
  const risk: "Low" | "Medium" | "High" = last.flagged ? "High" : sentiment === "Negative" ? "Medium" : "Low";
  const recommended =
    intent === "Willing to pay" ? "Send payment plan link within 24h"
    : intent === "Dispute" ? "Pause outbound — open dispute case"
    : intent === "Refused" ? "Cease outbound; legal review"
    : "Re-attempt at preferred time";

  return (
    <PageCard>
      <CardHead
        title="AI Call Analysis"
        subtitle={`Latest call · ${last.startedAt} · ${last.summary.headline}`}
        action={
          <Link to="/tenant/debtors/$debtorId/calls/$callId" params={{ debtorId, callId: last.id }} className="text-xs font-semibold text-tenant hover:underline">
            Open call →
          </Link>
        }
      />
      <div className="px-6 py-4 grid grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
        <Analysis label="Sentiment" value={sentiment} tone={sentiment === "Positive" ? "success" : sentiment === "Negative" ? "danger" : "muted"} />
        <Analysis label="Debtor intent" value={intent} tone={intent === "Willing to pay" ? "success" : intent === "Refused" ? "danger" : "warning"} />
        <Analysis label="Outcome" value={outcomeLabel} tone="info" />
        <Analysis label="Compliance risk" value={risk} tone={risk === "High" ? "danger" : risk === "Medium" ? "warning" : "success"} />
        <Analysis label="Recommended next" value={recommended} tone="tenant" />
      </div>
    </PageCard>
  );
}

function Analysis({ label, value, tone }: { label: string; value: string; tone: "success" | "danger" | "warning" | "info" | "muted" | "tenant" }) {
  const cls: Record<string, string> = {
    success: "border-success/30 bg-success/5 text-success",
    danger: "border-destructive/30 bg-destructive/5 text-destructive",
    warning: "border-warning/40 bg-warning/10 text-warning-foreground",
    info: "border-info/30 bg-info/5 text-info-foreground",
    muted: "border-border bg-muted text-muted-foreground",
    tenant: "border-[color:var(--tenant)]/30 bg-tenant-soft text-tenant",
  };
  return (
    <div className={`rounded-lg border p-3 ${cls[tone]}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">{label}</div>
      <div className="mt-1 font-semibold text-sm leading-tight">{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity / debt validation history (replaces simple Active/Not Active)
// ─────────────────────────────────────────────────────────────────────────────

type ValidationAttempt = {
  id: string;
  when: string;
  by: "ai" | "agent";
  actor: string;
  dobVerified: boolean;
  postalVerified: boolean;
  passed: boolean;
};

function IdentityValidationCard({ debtorId }: { debtorId: string }) {
  void debtorId;
  const attempts: ValidationAttempt[] = [
    { id: "v1", when: "Dec 12, 2024 · 14:32", by: "agent", actor: "Maya Lindstrom", dobVerified: true, postalVerified: true, passed: true },
    { id: "v2", when: "Dec 5, 2024 · 09:18", by: "ai", actor: "AI Voice", dobVerified: true, postalVerified: false, passed: false },
    { id: "v3", when: "Nov 28, 2024 · 16:04", by: "ai", actor: "AI Voice", dobVerified: false, postalVerified: false, passed: false },
  ];
  const last = attempts[0];
  const failed = attempts.filter((a) => !a.passed).length;
  const canDiscuss = last.passed;

  return (
    <PageCard>
      <CardHead
        title="Identity & debt validation"
        subtitle="Whether this debtor has been verified before discussing the debt"
      />
      <div className="px-6 py-4 space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <Analysis label="Last verified" value={last.when.split(" · ")[0]} tone={canDiscuss ? "success" : "warning"} />
          <Analysis label="Verified by" value={last.by === "ai" ? "AI Voice" : last.actor} tone="info" />
          <Analysis label="DOB verified" value={last.dobVerified ? "Yes" : "No"} tone={last.dobVerified ? "success" : "danger"} />
          <Analysis label="Postal code verified" value={last.postalVerified ? "Yes" : "No"} tone={last.postalVerified ? "success" : "danger"} />
          <Analysis label="Failed attempts" value={String(failed)} tone={failed >= 2 ? "danger" : failed === 1 ? "warning" : "success"} />
          <Analysis label="Can discuss debt" value={canDiscuss ? "Yes" : "No"} tone={canDiscuss ? "success" : "danger"} />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Verification history</div>
          <ul className="divide-y divide-border border border-border rounded-lg">
            {attempts.map((a) => (
              <li key={a.id} className="px-3 py-2 flex items-center gap-2 text-xs">
                {a.passed ? <ShieldCheck className="h-3.5 w-3.5 text-success" /> : <ShieldAlert className="h-3.5 w-3.5 text-destructive" />}
                <span className="font-semibold">{a.passed ? "Passed" : "Failed"}</span>
                <span className="text-muted-foreground">DOB {a.dobVerified ? "✓" : "✗"} · Postal {a.postalVerified ? "✓" : "✗"}</span>
                <span className="ml-auto text-muted-foreground">{a.by === "ai" ? "AI" : a.actor} · {a.when}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-[11px] text-muted-foreground italic flex items-start gap-1.5">
          <Activity className="h-3 w-3 mt-0.5 shrink-0" />
          Validation cadence (every call vs once) is configured in tenant compliance settings.
        </div>
      </div>
    </PageCard>
  );
}

// Flag editor pill in the header — quick add/remove of flags + custom add
function FlagEditor({ flags, onToggle }: { flags: string[]; onToggle: (f: string) => void }) {
  const types = useFlagTypes();
  const canManage = canManageFlagTypes();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftTone, setDraftTone] = useState<FlagType["tone"]>("muted");
  const [showManage, setShowManage] = useState(false);

  const allKeys = Array.from(new Set([...types.map((t) => t.key), ...flags]));

  const createFlagType = () => {
    const v = draft.trim().toLowerCase().replace(/\s+/g, "-");
    if (!v) return;
    try {
      addFlagType({ key: v, tone: draftTone });
      toast.success(`Flag type "${v}" created`);
      setDraft("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const deleteFlagType = (key: string) => {
    try {
      removeFlagType(key);
      toast.success(`Flag type "${key}" removed`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-muted hover:bg-muted/70 border border-border"
        title="Manage flags"
      >
        <Flag className="h-3 w-3" />
        Flags
        {flags.length > 0 && <span className="ml-1 px-1.5 rounded-full bg-tenant text-white text-[10px]">{flags.length}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setOpen(false); setShowManage(false); }} />
          <div className="absolute right-0 z-40 mt-1.5 w-72 rounded-xl border border-border bg-card shadow-tenant overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                {showManage ? "Manage flag types" : "Toggle flag on debtor"}
              </span>
              {canManage && (
                <button
                  onClick={() => setShowManage((s) => !s)}
                  className="text-[10px] font-semibold text-tenant hover:underline"
                >
                  {showManage ? "← Back" : "Manage types"}
                </button>
              )}
            </div>

            {!showManage && (
              <ul className="max-h-64 overflow-y-auto">
                {allKeys.map((key) => {
                  const t = types.find((x) => x.key === key);
                  const active = flags.includes(key);
                  return (
                    <li key={key}>
                      <button
                        onClick={() => onToggle(key)}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2"
                      >
                        <span className={`h-3.5 w-3.5 rounded border ${active ? "bg-tenant border-tenant" : "border-border"} flex items-center justify-center text-white text-[10px]`}>{active && "✓"}</span>
                        <span className="flex-1">{t?.label ?? key}</span>
                        {t?.system && <span className="text-[9px] text-muted-foreground uppercase">system</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {showManage && canManage && (
              <>
                <ul className="max-h-56 overflow-y-auto">
                  {types.map((t) => (
                    <li key={t.key} className="px-3 py-2 flex items-center gap-2 text-sm border-b border-border last:border-b-0">
                      <span className="flex-1 truncate">{t.label}</span>
                      {t.system ? (
                        <span className="text-[9px] text-muted-foreground uppercase">system</span>
                      ) : (
                        <button
                          onClick={() => deleteFlagType(t.key)}
                          className="text-[10px] text-destructive hover:underline"
                        >
                          delete
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border px-3 py-2 bg-muted/30 space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Create new flag type</div>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") createFlagType(); }}
                      placeholder="flag name"
                      className="flex-1 min-w-0 px-2 py-1 rounded-md bg-background border border-border text-xs outline-none focus:border-tenant"
                      maxLength={40}
                    />
                    <select
                      value={draftTone}
                      onChange={(e) => setDraftTone(e.target.value as FlagType["tone"])}
                      className="px-1.5 py-1 rounded-md bg-background border border-border text-xs"
                    >
                      <option value="muted">grey</option>
                      <option value="tenant">brand</option>
                      <option value="info">info</option>
                      <option value="success">success</option>
                      <option value="warning">warning</option>
                      <option value="danger">danger</option>
                    </select>
                    <button
                      onClick={createFlagType}
                      disabled={!draft.trim()}
                      className="p-1.5 rounded-md bg-gradient-tenant text-white disabled:opacity-50"
                      aria-label="Add flag type"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {showManage && !canManage && (
              <div className="px-3 py-4 text-xs text-muted-foreground">
                You don't have permission to manage flag types. Ask a tenant admin.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


// Inline payment management — record payments, edit method, edit terms
type PaymentEntry = {
  id: string;
  date: string;
  amount: number;
  method: "card" | "bank_transfer" | "cheque" | "cash" | "money_order";
  reference: string;
  proofName?: string;
  proofDataUrl?: string;
};

function PaymentManagementCard({ debtorId, balance }: { debtorId: string; balance: number }) {
  void debtorId;
  const [entries, setEntries] = useState<PaymentEntry[]>([
    { id: "p1", date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 10), amount: 250, method: "card", reference: "STRIPE-9214" },
    { id: "p2", date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10), amount: 500, method: "bank_transfer", reference: "ACH-44120" },
  ]);
  const [method, setMethod] = useState<PaymentEntry["method"]>("card");
  const [amount, setAmount] = useState<string>("");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<{ name: string; dataUrl: string } | null>(null);

  const totalPaid = entries.reduce((s, e) => s + e.amount, 0);
  const remaining = Math.max(balance - totalPaid, 0);

  const handleProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Proof of payment must be a PDF");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("PDF exceeds 10MB");
      return;
    }
    const dataUrl = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result ?? ""));
      r.readAsDataURL(file);
    });
    setProof({ name: file.name, dataUrl });
  };

  const addPayment = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const entry: PaymentEntry = {
      id: `p_${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      amount: amt,
      method,
      reference: reference || "—",
      proofName: proof?.name,
      proofDataUrl: proof?.dataUrl,
    };
    setEntries((prev) => [entry, ...prev]);
    setAmount("");
    setReference("");
    setProof(null);
    toast.success(`Recorded $${amt.toFixed(2)} via ${method.replace("_", " ")}`);
  };

  return (
    <PageCard>
      <CardHead title="Payment management" subtitle="Record payments, attach invoice proof, and track method" />
      <div className="px-6 py-4 space-y-4 text-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-border p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Original</div>
            <div className="font-display font-bold text-base">${balance.toFixed(0)}</div>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/5 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Paid</div>
            <div className="font-display font-bold text-base text-success">${totalPaid.toFixed(0)}</div>
          </div>
          <div className="rounded-lg border border-border p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Remaining</div>
            <div className="font-display font-bold text-base">${remaining.toFixed(0)}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Record payment</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="px-2 py-1.5 rounded-md bg-muted border border-border text-sm outline-none focus:ring-2 ring-tenant"
            />
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentEntry["method"])}
              className="px-2 py-1.5 rounded-md bg-muted border border-border text-sm outline-none"
            >
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="money_order">Money order</option>
            </select>
          </div>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Reference / receipt # (optional)"
            className="w-full px-2 py-1.5 rounded-md bg-muted border border-border text-sm outline-none focus:ring-2 ring-tenant"
          />
          <div className="flex items-center gap-2">
            <label className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-dashed border-border hover:bg-muted text-xs cursor-pointer text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              {proof ? <span className="font-mono truncate">{proof.name}</span> : <span>Attach proof of payment (PDF invoice)</span>}
              <input type="file" accept="application/pdf" className="hidden" onChange={handleProof} />
            </label>
            {proof && (
              <button onClick={() => setProof(null)} className="text-muted-foreground hover:text-destructive text-xs px-2">Remove</button>
            )}
          </div>
          <button
            onClick={addPayment}
            className="w-full px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
          >
            Record payment
          </button>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Payment history</div>
          {entries.length === 0 ? (
            <div className="text-xs text-muted-foreground">No payments recorded yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((e) => (
                <li key={e.id} className="py-2 flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">${e.amount.toFixed(2)}</div>
                      <div className="text-muted-foreground truncate">
                        {e.method.replace("_", " ")} · {e.reference}
                      </div>
                    </div>
                    <span className="text-muted-foreground shrink-0">{e.date}</span>
                    <button
                      onClick={() => setEntries((prev) => prev.filter((x) => x.id !== e.id))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                  {e.proofDataUrl && (
                    <a
                      href={e.proofDataUrl}
                      download={e.proofName}
                      className="ml-0 inline-flex items-center gap-1 text-tenant hover:underline w-fit"
                    >
                      <FileText className="h-3 w-3" />
                      <span className="font-mono truncate max-w-[220px]">{e.proofName}</span>
                      <Download className="h-3 w-3" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageCard>
  );
}



function NotesSection({ debtorId, debtorName }: { debtorId: string; debtorName: string }) {
  const notes = useDebtorNotes(debtorId);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Note | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Note | undefined>();
  const role = useDemoRole();
  const perms = getDebtorPermissions(role);
  const ACTOR = "Maya Lindstrom";

  const pinned = notes.filter((n) => n.pinned);
  const rest = notes.filter((n) => !n.pinned);

  const tryEdit = (n: Note) => {
    if (!perms.canManageNotes) { toast.error("Read-only", { description: lockReason(role, "Editing notes") }); return; }
    if (!canEditNote(n, role, ACTOR)) { toast.error("You cannot edit this note", { description: "Older notes can only be edited by a manager or admin." }); return; }
    setEditing(n); setEditorOpen(true);
  };
  const tryDelete = (n: Note) => {
    if (!perms.canManageNotes) { toast.error("Read-only", { description: lockReason(role, "Deleting notes") }); return; }
    if (!canDeleteNote(n, role, ACTOR)) { toast.error("You cannot delete this note", { description: "Older notes can only be deleted by a manager or admin." }); return; }
    setDeleteTarget(n);
  };

  return (
    <PageCard>
      <CardHead
        title="Notes & Timeline"
        subtitle={`${notes.length} total · viewing as ${role}`}
        action={
          perms.canManageNotes ? (
            <button onClick={() => { setEditing(undefined); setEditorOpen(true); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
              <Plus className="h-4 w-4" /> Add note
            </button>
          ) : (
            <button disabled className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground opacity-60 cursor-not-allowed" title={lockReason(role, "Adding notes")}>
              <Lock className="h-3.5 w-3.5" /> Add note
            </button>
          )
        }
      />


      <div className="px-6 py-4 space-y-3">
        {pinned.length > 0 && (
          <>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Pinned</div>
            {pinned.map((n) => (
              <NoteCard key={n.id} note={n} onPin={() => togglePin(n.id)} onEdit={() => tryEdit(n)} onDelete={() => tryDelete(n)} />
            ))}
            {rest.length > 0 && <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold pt-2">All notes</div>}
          </>
        )}
        {rest.map((n) => (
          <NoteCard key={n.id} note={n} onPin={() => togglePin(n.id)} onEdit={() => tryEdit(n)} onDelete={() => tryDelete(n)} />
        ))}
        {notes.length === 0 && (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No notes yet.
          </div>
        )}
      </div>

      <NoteEditor
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditing(undefined); }}
        debtorId={debtorId}
        debtorName={debtorName}
        existing={editing}
      />

      <DeleteNoteDialog
        open={!!deleteTarget}
        noteTitle={deleteTarget?.title ?? ""}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={(reason) => {
          if (!deleteTarget) return;
          const res = deleteNote(deleteTarget.id, { actor: ACTOR, reason, role });
          if (!res.ok) { toast.error(res.error ?? "Cannot delete"); return; }
          toast.success("Note deleted (soft) — visible in audit trail");
          setDeleteTarget(undefined);
        }}
      />
    </PageCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Epic 11 — Call recordings, transcripts, AI summaries (debtor-scoped)
// ─────────────────────────────────────────────────────────────────────────────

type CallFilter = "all" | "ai_voice" | "human_agent";

function fmtCallDur(s: number) { return `${Math.floor(s / 60)}m ${s % 60}s`; }

type BalanceDebtor = { id: string; balance: number; collectability: number; lastActivity: string; placedAt: string };

function deriveBalanceFigures(d: BalanceDebtor) {
  // Deterministic mock derivation from id hash so numbers are stable per debtor.
  const seed = Array.from(d.id).reduce((a, c) => a + c.charCodeAt(0), 0);
  const jitter = (n: number) => 0.85 + ((seed * n) % 30) / 100; // 0.85–1.15
  const outstanding = d.balance;
  const principal = Math.round(outstanding * 0.72 * jitter(3) * 100) / 100;
  const interestBefore = Math.round(outstanding * 0.11 * jitter(5) * 100) / 100;
  const interestAfter = Math.round(outstanding * 0.13 * jitter(7) * 100) / 100;
  const totalInterest = Math.round((interestBefore + interestAfter) * 100) / 100;
  const recovered = Math.round(outstanding * (d.collectability / 100) * 0.35 * 100) / 100;
  const remaining = Math.max(0, Math.round((outstanding - recovered) * 100) / 100);
  const daysAgo = ((seed % 40) + 5);
  const lastPay = new Date(Date.now() - daysAgo * 86400000).toLocaleDateString();
  return { outstanding, principal, interestBefore, interestAfter, totalInterest, recovered, remaining, lastPay };
}

function money(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function BalanceBreakdown({ debtor, statusName }: { debtor: BalanceDebtor; statusName: string }) {
  const f = deriveBalanceFigures(debtor);
  const [open, setOpen] = useState(false);

  const KPI = ({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) => (
    <div className="flex-1 min-w-[140px] px-4 py-2.5 border-r border-border last:border-r-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={`font-display tabular-nums text-xl font-bold leading-tight ${accent ?? "text-foreground"}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card shadow-elegant overflow-hidden">
      <div className="flex flex-wrap items-stretch">
        <KPI label="Outstanding" value={money(f.outstanding)} accent="text-tenant" sub={`Principal ${money(f.principal)}`} />
        <KPI label="Recovered" value={money(f.recovered)} accent="text-success" sub={`Last pay ${f.lastPay}`} />
        <KPI label="Remaining" value={money(f.remaining)} sub={`of ${money(f.outstanding)} outstanding`} />
        <KPI label="Total interest" value={money(f.totalInterest)} sub={`Before ${money(f.interestBefore)} · After ${money(f.interestAfter)}`} />
        <div className="px-4 py-2.5 flex flex-col justify-between gap-1 min-w-[150px]">
          <div className="text-[11px] text-muted-foreground">{statusName} · {debtor.lastActivity}</div>
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-[11px] font-semibold text-tenant hover:underline self-start"
          >
            {open ? "Hide breakdown" : "Show breakdown"}
          </button>
        </div>
      </div>

      {open && (
        <div className="px-6 py-3 border-t border-border bg-muted/30 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
          <DetailRow label="Principal balance" value={money(f.principal)} />
          <DetailRow label="Interest before assignment" value={money(f.interestBefore)} />
          <DetailRow label="Interest after assignment" value={money(f.interestAfter)} />
          <DetailRow label="Total interest" value={money(f.totalInterest)} bold />
          <DetailRow label="Amount recovered" value={money(f.recovered)} accent="text-success" />
          <DetailRow label="Remaining balance" value={money(f.remaining)} accent="text-tenant" bold />
          <DetailRow label="Last payment date" value={f.lastPay} />
        </div>
      )}
    </div>
  );
}


function DetailRow({ label, value, accent, bold }: { label: string; value: string; accent?: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : "font-semibold"} ${accent ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}


function CallsSection({ debtorId }: { debtorId: string }) {
  const calls = useDebtorCalls(debtorId);
  const [filter, setFilter] = useState<CallFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [openCallId, setOpenCallId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return calls.filter((c) => {
      if (filter === "ai_voice" && c.channel !== "ai_voice") return false;
      if (filter === "human_agent" && c.channel !== "human_agent") return false;
      if (keyword.trim()) {
        const k = keyword.toLowerCase();
        const hay = `${c.id} ${c.outcome} ${c.agentName} ${c.summary.headline} ${c.summary.topics.join(" ")} ${c.transcript.map((t) => t.text).join(" ")}`.toLowerCase();
        if (!hay.includes(k)) return false;
      }
      return true;
    });
  }, [calls, filter, keyword]);

  const counts = {
    total: calls.length,
    ai: calls.filter((c) => c.channel === "ai_voice").length,
    human: calls.filter((c) => c.channel === "human_agent").length,
    minutes: Math.round(calls.reduce((m, c) => m + c.durationSec, 0) / 60),
  };

  const openCall = openCallId ? calls.find((c) => c.id === openCallId) ?? null : null;

  return (
    <PageCard>
      <CardHead
        title="Call Recordings & Transcripts"
        subtitle={`${counts.total} calls · ${counts.ai} AI · ${counts.human} human · ~${counts.minutes} min recorded`}
        action={
          <button
            onClick={() => toast.success("Initiating AI call…")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
          >
            <Phone className="h-4 w-4" /> Initiate call
          </button>
        }
      />

      <div className="px-6 py-3 border-b border-border space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", "ai_voice", "human_agent"] as CallFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${filter === f ? "bg-tenant text-white border-tenant" : "border-border hover:bg-muted"}`}
            >
              {f === "all" ? "All" : f === "ai_voice" ? "AI Voice" : "Human"}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search transcripts, topics, outcomes…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-muted border border-border text-sm"
          />
        </div>
      </div>

      <ul className="divide-y divide-border">
        {filtered.length === 0 ? (
          <li className="px-6 py-12 text-center text-sm text-muted-foreground">
            <Headphones className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No calls match your filters.
          </li>
        ) : filtered.map((c) => (
          <li key={c.id} className="px-6 py-4 flex flex-wrap items-start gap-3 hover:bg-muted/30 transition">
            <button
              onClick={() => setOpenCallId(c.id)}
              className="h-11 w-11 rounded-full bg-gradient-tenant text-white flex items-center justify-center shrink-0 shadow-tenant hover:opacity-90"
              aria-label="Open call"
            >
              <Play className="h-5 w-5 ml-0.5" />
            </button>
            <div className="flex-1 min-w-[260px]">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setOpenCallId(c.id)} className="font-semibold text-sm hover:underline text-left">
                  {c.summary.headline}
                </button>
                <Pill tone={c.outcome === "payment" ? "success" : c.outcome === "cease" ? "danger" : "muted"}>{c.outcome.replace("_", " ")}</Pill>
                <Pill tone={c.channel === "ai_voice" ? "tenant" : "info"}>
                  {c.channel === "ai_voice" ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  {c.agentName}
                </Pill>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {c.startedAt} · {fmtCallDur(c.durationSec)} · {c.language} · {c.recordingSizeMb} MB
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.summary.topics.slice(0, 4).map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-tenant-soft text-tenant font-semibold">{t}</span>
                ))}
              </div>
              <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-tenant shrink-0 mt-0.5" />
                <span className="line-clamp-2">{c.summary.overview}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">QA</div>
              <div className="font-display text-lg font-bold leading-none">{c.summary.qaScore}</div>
              <button
                onClick={() => setOpenCallId(c.id)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-[11px] font-semibold hover:bg-muted"
              >
                <FileText className="h-3 w-3" /> Open
              </button>
            </div>
          </li>
        ))}
      </ul>

      <CommsDialog
        open={!!openCall}
        onClose={() => setOpenCallId(null)}
        title={openCall?.summary.headline ?? "Call"}
        subtitle={openCall ? `${openCall.startedAt} · ${fmtCallDur(openCall.durationSec)} · ${openCall.agentName}` : ""}
        size="lg"
      >
        {openCall && (
          <div className="space-y-5">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Recording</div>
              <audio controls src={openCall.recordingUrl} className="w-full">
                Your browser does not support audio playback.
              </audio>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">AI summary</div>
              <p className="text-sm leading-relaxed">{openCall.summary.overview}</p>
              {openCall.summary.keyPoints.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm space-y-0.5">
                  {openCall.summary.keyPoints.map((kp, i) => <li key={i}>{kp}</li>)}
                </ul>
              )}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Transcript</div>
              <div className="max-h-80 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {openCall.transcript.map((t, i) => (
                  <div key={i} className="px-3 py-2 text-sm flex gap-3">
                    <div className={`font-semibold text-xs shrink-0 w-20 ${t.speaker === "agent" ? "text-tenant" : "text-info"}`}>
                      {t.speakerName ?? (t.speaker === "agent" ? "Agent" : "Debtor")}
                    </div>
                    <div className="flex-1">{t.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CommsDialog>
    </PageCard>
  );
}

// ---------- Full debtor profile fields (CSV-sourced, editable) ----------

import { Pencil, Check as CheckIcon, X as XIcon } from "lucide-react";

type AnyDebtor = (typeof debtors)[number] & {
  custom_fields?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
};

type FieldDef = { label: string; key: string; aliases?: string[] };

const STORAGE_PREFIX = "debtor-profile-overrides:";

function loadOverrides(debtorId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + debtorId);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveOverrides(debtorId: string, data: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + debtorId, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function pickValue(d: AnyDebtor, keys: string[]): string {
  const sources: Record<string, unknown>[] = [
    (d.custom_fields ?? {}) as Record<string, unknown>,
    (d.customFields ?? {}) as Record<string, unknown>,
    d as unknown as Record<string, unknown>,
  ];
  for (const src of sources) {
    for (const k of keys) {
      const v = src[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    }
  }
  return "";
}

// Numeric-ish fields → validated as numbers (allow $, %, comma).
const NUMERIC_FIELD_KEYS = new Set<string>([
  "principal", "current_principal_balance", "current_outstanding_balance",
  "accrued_interest_before_assignment", "interest_rate",
  "last_payment_amount", "total_paid_to_date",
]);

function validateField(key: string, raw: string): string | null {
  if (raw.length > 500) return "Max 500 characters.";
  if (NUMERIC_FIELD_KEYS.has(key) && raw.trim() !== "") {
    const cleaned = raw.replace(/[$,%\s]/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return "Must be a number.";
  }
  if (key === "email" || key === "co_email" || key === "assigned_agent_email") {
    if (raw.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) return "Invalid email.";
  }
  if ((key === "postal_code" || key === "co_postal_code") && raw.trim()) {
    if (raw.trim().length < 3) return "Postal code too short.";
  }
  return null;
}

function EditableField({
  fieldKey,
  label,
  value,
  sensitive,
  canEditSensitive,
  onSave,
}: {
  fieldKey: string;
  label: string;
  value: string;
  sensitive: boolean;
  canEditSensitive: boolean;
  onSave: (next: string, reason?: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const isEmpty = !value || value.trim() === "";

  const commit = () => {
    const trimmed = draft.trim();
    const err = validateField(fieldKey, trimmed);
    if (err) { toast.error("Invalid value", { description: err }); return; }
    if (trimmed === value.trim()) { setEditing(false); return; }
    onSave(trimmed);
    setEditing(false);
  };

  const cancel = () => { setDraft(value); setEditing(false); };

  const startEdit = () => {
    if (sensitive) {
      if (!canEditSensitive) {
        toast.error("Restricted", { description: "Financial / identity / legal fields can only be edited by Admin or Finance." });

        return;
      }
      setDialogOpen(true);
    } else {
      setEditing(true);
    }
  };

  return (
    <div className={`min-w-0 group rounded-md ${sensitive ? "border border-warning/40 bg-warning/5 px-2 py-1.5" : ""}`}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <span>{label}</span>
        {sensitive && <Lock className="h-3 w-3 text-warning" aria-label="Sensitive field" />}
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition text-muted-foreground hover:text-tenant ml-auto"
            aria-label={`Edit ${label}`}
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-1 flex items-center gap-1.5">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
            maxLength={500}
            className="flex-1 min-w-0 px-2 py-1 text-sm rounded-md border border-border bg-background focus:border-tenant focus:ring-1 focus:ring-tenant outline-none"
          />
          <button type="button" onClick={commit} className="p-1 rounded-md text-success hover:bg-success/10" aria-label="Save">
            <CheckIcon className="h-4 w-4" />
          </button>
          <button type="button" onClick={cancel} className="p-1 rounded-md text-muted-foreground hover:bg-muted" aria-label="Cancel">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className={`font-semibold break-words text-sm ${isEmpty ? "text-muted-foreground font-normal italic" : ""}`}>
          {isEmpty ? "N/A" : value}
        </div>
      )}

      <EditFieldDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        label={label}
        before={value}
        sensitive
        onSave={(next, reason) => {
          const err = validateField(fieldKey, next);
          if (err) { toast.error("Invalid value", { description: err }); return; }
          onSave(next, reason);
          setDialogOpen(false);
        }}
      />
    </div>
  );
}

function EditableSection({
  title,
  fields,
  values,
  onChange,
  canEditSensitive,
}: {
  title: string;
  fields: FieldDef[];
  values: Record<string, string>;
  onChange: (key: string, label: string, next: string, reason?: string) => void;
  canEditSensitive: boolean;
}) {
  return (
    <div>
      <div className="px-6 pt-4 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</div>
      <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        {fields.map((f) => (
          <EditableField
            key={f.key}
            fieldKey={f.key}
            label={f.label}
            value={values[f.key] ?? ""}
            sensitive={SENSITIVE_FIELD_KEYS.has(f.key)}
            canEditSensitive={canEditSensitive}
            onSave={(next, reason) => onChange(f.key, f.label, next, reason)}
          />
        ))}
      </div>
    </div>
  );
}

const FILE_FIELDS: FieldDef[] = [
  { label: "Our File No.", key: "our_file_no", aliases: ["ourFileNo", "id"] },
  { label: "Client File No.", key: "client_file_no", aliases: ["clientFileNo", "external"] },
  { label: "Old Counsel File No.", key: "old_counsel_file_no", aliases: ["oldCounselFileNo"] },
  { label: "Old Counsel Name", key: "old_counsel_name", aliases: ["oldCounselName"] },
];

const CREDITOR_FIELDS: FieldDef[] = [
  { label: "Creditor Name", key: "creditor_name", aliases: ["creditor", "creditorName"] },
  { label: "Creditor Number", key: "creditor_number", aliases: ["creditorNumber"] },
  { label: "Client Name", key: "client_name", aliases: ["clientName"] },
  { label: "Client Number", key: "client_number", aliases: ["clientNumber"] },
];

const ASSIGNMENT_FIELDS: FieldDef[] = [
  { label: "Assigned Agent Name", key: "assigned_agent_name", aliases: ["assignedAgentName", "agentName"] },
  { label: "Assigned Agent Email / ID", key: "assigned_agent_email", aliases: ["assignedAgentEmail", "agentEmail", "owner_email"] },
  { label: "Assigned Team", key: "assigned_team", aliases: ["team", "assignedTeam"] },
];

const PRIMARY_FIELDS: FieldDef[] = [
  { label: "Debtor Name (Last, First)", key: "debtor_name_last_first", aliases: ["debtorNameLastFirst", "debtor_name"] },
  { label: "Address", key: "address", aliases: ["street", "address_line1"] },
  { label: "City", key: "city" },
  { label: "Province", key: "province", aliases: ["state", "region"] },
  { label: "Postal Code", key: "postal_code", aliases: ["postalCode", "zip"] },
  { label: "Home No.", key: "home_no", aliases: ["homePhone", "home_phone"] },
  { label: "Cell No.", key: "cell_no", aliases: ["mobile", "cellPhone", "cell_phone"] },
  { label: "POE", key: "poe", aliases: ["employer", "place_of_employment"] },
  { label: "POE No.", key: "poe_no", aliases: ["employer_phone", "poePhone"] },
  { label: "DOB", key: "dob", aliases: ["date_of_birth", "dateOfBirth"] },
  { label: "SIN", key: "sin", aliases: ["ssn", "ssn_last4"] },
  { label: "DL", key: "dl", aliases: ["drivers_license", "driversLicense"] },
  { label: "Email", key: "email" },
];

const CO_FIELDS: FieldDef[] = [
  { label: "Co-Debtor (Last, First)", key: "co_debtor_name", aliases: ["coDebtorName", "co_debtor"] },
  { label: "Address", key: "co_address", aliases: ["coAddress"] },
  { label: "City", key: "co_city", aliases: ["coCity"] },
  { label: "Province", key: "co_province", aliases: ["coProvince"] },
  { label: "Postal Code", key: "co_postal_code", aliases: ["coPostalCode"] },
  { label: "Home No.", key: "co_home_no", aliases: ["coHomeNo"] },
  { label: "Cell No.", key: "co_cell_no", aliases: ["coCellNo"] },
  { label: "POE", key: "co_poe", aliases: ["coPoe"] },
  { label: "POE No.", key: "co_poe_no", aliases: ["coPoeNo"] },
  { label: "DOB", key: "co_dob", aliases: ["coDob"] },
  { label: "SIN", key: "co_sin", aliases: ["coSin"] },
  { label: "DL", key: "co_dl", aliases: ["coDl"] },
  { label: "Email", key: "co_email", aliases: ["coEmail"] },
];

const FINANCIAL_FIELDS: FieldDef[] = [
  { label: "Principal", key: "principal", aliases: ["original_balance", "originalBalance"] },
  { label: "Current Principal Balance", key: "current_principal_balance", aliases: ["currentPrincipalBalance"] },
  { label: "Accrued Interest Before Assignment", key: "accrued_interest_before_assignment", aliases: ["accruedInterestBeforeAssignment"] },
  { label: "Interest Rate", key: "interest_rate", aliases: ["interestRate"] },
  { label: "Interest Type", key: "interest_type", aliases: ["interestType"] },
  { label: "Compounding Frequency", key: "compounding_frequency", aliases: ["compoundingFrequency"] },
  { label: "Interest Start Date", key: "interest_start_date", aliases: ["interestStartDate"] },
  { label: "Current Outstanding Balance", key: "current_outstanding_balance", aliases: ["currentOutstandingBalance", "balance"] },
  { label: "Currency", key: "currency" },
];

const PAYMENT_HISTORY_FIELDS: FieldDef[] = [
  { label: "Date of Last Payment", key: "date_of_last_payment", aliases: ["lastPaymentDate", "last_payment_date"] },
  { label: "Last Payment Amount", key: "last_payment_amount", aliases: ["lastPaymentAmount"] },
  { label: "Last Payment Method", key: "last_payment_method", aliases: ["lastPaymentMethod"] },
  { label: "Last Payment Reference Number", key: "last_payment_reference_number", aliases: ["lastPaymentReferenceNumber"] },
  { label: "Total Paid to Date", key: "total_paid_to_date", aliases: ["totalPaidToDate"] },
];

const COMMUNICATION_FIELDS: FieldDef[] = [
  { label: "Preferred Contact Method", key: "preferred_contact_method", aliases: ["preferredContactMethod"] },
  { label: "Preferred Language", key: "preferred_language", aliases: ["preferredLanguage"] },
  { label: "Do Not Call", key: "do_not_call", aliases: ["doNotCall"] },
  { label: "Do Not Email", key: "do_not_email", aliases: ["doNotEmail"] },
  { label: "Do Not SMS", key: "do_not_sms", aliases: ["doNotSms"] },
];

const VEHICLE_FIELDS: FieldDef[] = [{ label: "VIN", key: "vin" }];

const COURT_FIELDS: FieldDef[] = [
  { label: "Court File No.", key: "court_file_no", aliases: ["courtFileNo"] },
  { label: "Courthouse", key: "courthouse" },
  { label: "Courthouse Address", key: "courthouse_address", aliases: ["courthouseAddress"] },
  { label: "Courthouse City", key: "courthouse_city", aliases: ["courthouseCity"] },
  { label: "Courthouse Province", key: "courthouse_province", aliases: ["courthouseProvince"] },
  { label: "Courthouse Postal Code", key: "courthouse_postal_code", aliases: ["courthousePostalCode"] },
];

function DebtorProfileFields({ debtor }: { debtor: AnyDebtor }) {
  const d = debtor;
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    setOverrides(loadOverrides(d.id));
  }, [d.id]);

  const nameParts = (d.name ?? "").trim().split(/\s+/);
  const derivedName =
    nameParts.length >= 2
      ? `${nameParts.slice(-1).join(" ")}, ${nameParts.slice(0, -1).join(" ")}`
      : d.name ?? "";

  const resolveValue = (field: FieldDef): string => {
    if (overrides[field.key] !== undefined) return overrides[field.key];
    const fromSource = pickValue(d, [field.key, ...(field.aliases ?? [])]);
    if (fromSource) return fromSource;
    if (field.key === "debtor_name_last_first") return derivedName;
    if (field.key === "principal") {
      return `$${(d.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    }
    return "";
  };

  const buildValues = (fields: FieldDef[]): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const f of fields) out[f.key] = resolveValue(f);
    return out;
  };

  const role = useDemoRole();
  const canEditSensitive = isAdmin(role) || role === "finance";

  const handleChange = (key: string, label: string, next: string, reason?: string) => {
    const before = overrides[key] ?? pickValue(d, [key]) ?? "";
    setOverrides((prev) => {
      const updated = { ...prev };
      if (next === "") delete updated[key];
      else updated[key] = next;
      saveOverrides(d.id, updated);
      return updated;
    });
    const sensitive = SENSITIVE_FIELD_KEYS.has(key);
    logAudit({
      debtorId: d.id,
      actor: "Maya Lindstrom",
      actorKind: "human",
      category: "field_edit",
      action: `Edited ${label}${sensitive ? " (restricted)" : ""}`,
      before: before || undefined,
      after: next || undefined,
      reason,
      meta: { role, fieldKey: key, restricted: sensitive },
    });
    toast.success(`${label} updated`, sensitive ? { description: `Restricted change logged with reason (role: ${role}).` } : undefined);
  };

  const sectionProps = { onChange: handleChange, canEditSensitive };

  return (
    <PageCard>
      <CardHead
        title="Debtor profile"
        subtitle={`Click any field to edit · restricted fields (financial / identity / legal) can only be changed by ${canEditSensitive ? "you — a documented reason is required" : "Admin or Finance"} · viewing as ${role}`}
      />

      <div className="divide-y divide-border">
        <EditableSection title="File / Reference" fields={FILE_FIELDS} values={buildValues(FILE_FIELDS)} {...sectionProps} />
        <EditableSection title="Creditor / Client" fields={CREDITOR_FIELDS} values={buildValues(CREDITOR_FIELDS)} {...sectionProps} />
        <EditableSection title="Assignment" fields={ASSIGNMENT_FIELDS} values={buildValues(ASSIGNMENT_FIELDS)} {...sectionProps} />
        <EditableSection title="Primary Debtor" fields={PRIMARY_FIELDS} values={buildValues(PRIMARY_FIELDS)} {...sectionProps} />
        <EditableSection title="Co-Debtor" fields={CO_FIELDS} values={buildValues(CO_FIELDS)} {...sectionProps} />
        <EditableSection title="Financial / Balance" fields={FINANCIAL_FIELDS} values={buildValues(FINANCIAL_FIELDS)} {...sectionProps} />
        <EditableSection title="Payment History" fields={PAYMENT_HISTORY_FIELDS} values={buildValues(PAYMENT_HISTORY_FIELDS)} {...sectionProps} />
        <EditableSection title="Communication Preferences" fields={COMMUNICATION_FIELDS} values={buildValues(COMMUNICATION_FIELDS)} {...sectionProps} />
        <EditableSection title="Vehicle / Asset" fields={VEHICLE_FIELDS} values={buildValues(VEHICLE_FIELDS)} {...sectionProps} />
        <EditableSection title="Court / Courthouse" fields={COURT_FIELDS} values={buildValues(COURT_FIELDS)} {...sectionProps} />
      </div>
    </PageCard>
  );
}

function NoOwnerWarning({ debtorId, onAssignClick }: { debtorId: string; onAssignClick: () => void }) {
  const a = useAssignment(debtorId);
  const status = getAssignmentStatus(debtorId);
  if (status === "assigned") return null;
  const isIssue = status === "assignment_issue";
  return (
    <section className="px-6 lg:px-10 pt-4">
      <div className="rounded-2xl border border-warning/40 bg-warning/5 p-4 flex flex-wrap items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div className="flex-1 min-w-[220px]">
          <div className="font-display font-bold text-sm">
            {isIssue ? "Assignment issue" : "No owner assigned"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isIssue
              ? `This debtor has a ${a.teamId ? "team" : a.managerId ? "manager" : "creditor"} set but no responsible agent. Resolve ownership before active collection work begins.`
              : "This debtor has not been assigned to an agent, team, or desk. Please assign ownership before active collection work begins."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onAssignClick} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-tenant text-white text-xs font-semibold shadow-tenant">
            <User className="h-3.5 w-3.5" /> Assign Agent
          </button>
          <button onClick={onAssignClick} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted">
            <Users className="h-3.5 w-3.5" /> Assign Team
          </button>
          <button onClick={onAssignClick} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted">
            <ShieldCheck className="h-3.5 w-3.5" /> Assign Desk
          </button>
        </div>
      </div>
    </section>
  );
}

