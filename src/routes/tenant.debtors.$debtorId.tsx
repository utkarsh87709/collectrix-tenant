import { createFileRoute, Link, useNavigate, useParams, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead } from "@/components/tenant/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoveToTeamDialog } from "@/components/tenant/customers/MoveToTeamDialog";
import { RestoreFileDialog } from "@/components/tenant/customers/RestoreFileDialog";
import { ChangeStatusMenu } from "@/components/tenant/customers/ChangeStatusMenu";
import { FlagsPopover } from "@/components/tenant/customers/FlagsPopover";
import { EditCustomerDialog } from "@/components/tenant/customers/EditCustomerDialog";
import { InitiateCallDialog } from "@/components/tenant/customers/InitiateCallDialog";
import { csvCell, downloadTextFile } from "@/lib/csv";
import {
  ChevronLeft,
  ClipboardList,
  MessageSquare,
  Mail,
  Headphones,
  StickyNote,
  Archive,
  ArrowLeftRight,
  Download,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Send,
  Plus,
  X,
  Loader2,
  Play,
  Trash2,
  Pencil,
  PhoneCall,
  RotateCcw,
} from "lucide-react";
import { useCustomerPermissions, type CustomerPermissions } from "@/lib/customer-permissions";
import {
  getCustomerDetails,
  customerDisplayName,
  formatMoney,
  toMoney,
  fullName,
  getCustomerNotes,
  createCustomerNotes,
  updateCustomerNotes,
  deleteCustomerNotes,
  getCustomerEmail,
  sendCustomerEmail,
  getCustomerSms,
  sendCustomerSms,
  getCustomerCalls,
  getCustomerCallDetails,
  archiveCustomer,
  stopEngagement,
  startEngagement,
  normalizeTags,
  type CustomerDetails,
  type CustomerNote,
  type CustomerEmailMessage,
  type CustomerSmsMessage,
  type CustomerCall,
  type CustomerCallDetails,
} from "@/lib/customers-api";

export const Route = createFileRoute("/tenant/debtors/$debtorId")({
  head: () => ({ meta: [{ title: "Customer profile · Tenant Admin" }] }),
  component: DebtorProfile,
  notFoundComponent: () => (
    <Shell>
      <div className="px-10 py-20 text-center">
        <h2 className="font-display text-2xl font-bold">Customer not found</h2>
        <Link
          to="/tenant/debtors"
          className="text-tenant hover:underline text-sm mt-2 inline-block"
        >
          ← Back to customers
        </Link>
      </div>
    </Shell>
  ),
});

function daysAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  return days === 1 ? "1d ago" : `${days}d ago`;
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* --------------------------------- Page --------------------------------- */

function DebtorProfile() {
  const { debtorId } = useParams({ from: "/tenant/debtors/$debtorId" });
  const id = Number(debtorId);
  if (!Number.isFinite(id)) throw notFound();
  const navigate = useNavigate();

  const perms = useCustomerPermissions();
  const [details, setDetails] = useState<CustomerDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState("dataprofile");
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [engagementBusy, setEngagementBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    setLoadError(null);
    getCustomerDetails(id)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : "Failed to load this customer.");
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);

  if (loadError) {
    return (
      <Shell>
        <Topbar
          action={
            <Link
              to="/tenant/debtors"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Link>
          }
        />
        <div className="px-10 py-20 text-center">
          <p className="text-sm text-destructive font-medium">{loadError}</p>
          <button
            onClick={refresh}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (!details) {
    return (
      <Shell>
        <Topbar
          action={
            <Link
              to="/tenant/debtors"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Link>
          }
        />
        <div className="px-6 lg:px-10 pt-6">
          <div className="h-40 rounded-2xl border border-border bg-card animate-pulse" />
        </div>
      </Shell>
    );
  }

  const balance = toMoney(details.currentOutstandingBalance);
  const principal = toMoney(details.principal);
  const interest = Math.max(balance - principal, 0);
  const assignedAgent = fullName({
    firstName: details.assignedUserFirstName,
    lastName: details.assignedUserLastName,
  });
  const isArchived = details.archivedFlag === 1;
  const isEngaged = details.engagementStatus === 1;
  const tags = normalizeTags(details.customerTags);

  const toggleEngagement = async () => {
    setEngagementBusy(true);
    try {
      if (isEngaged) {
        await stopEngagement(id);
        toast.success("Engagement stopped.");
      } else {
        await startEngagement(id);
        toast.success("Engagement resumed.");
      }
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update engagement.");
    } finally {
      setEngagementBusy(false);
    }
  };

  return (
    <Shell>
      <Topbar
        title={customerDisplayName(details)}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <ManageMenu
              details={details}
              perms={perms}
              isArchived={isArchived}
              isEngaged={isEngaged}
              engagementBusy={engagementBusy}
              onExported={() => toast.success("Customer exported.")}
              onArchive={() => setArchiveConfirmOpen(true)}
              onRestore={() => setRestoreDialogOpen(true)}
              onEdit={() => setEditOpen(true)}
              onMoveToTeam={() => setMoveDialogOpen(true)}
              onToggleEngagement={toggleEngagement}
            />
            <Link
              to="/tenant/debtors"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Link>
          </div>
        }
      />

      <section className="px-6 lg:px-10 pt-6">
        <div className="rounded-2xl border border-border bg-card shadow-elegant px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <h2 className="font-display text-3xl font-bold tracking-tight truncate">
                {customerDisplayName(details)}
              </h2>
              <ChangeStatusMenu
                uploadedDebtorId={id}
                statusId={details.statusId}
                statusCode={details.statusCode}
                statusName={details.status}
                statusColor={details.statusColorCode}
                canChange={perms.canUpdateStatus}
                onChanged={refresh}
              />
              {isArchived && (
                <Link
                  to="/tenant/archive"
                  title="Open the archive"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground"
                >
                  <Archive className="h-3 w-3" /> Archived
                </Link>
              )}
              {!isEngaged && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-warning/20 text-warning-foreground">
                  Engagement stopped
                </span>
              )}
            </div>
            <FlagsPopover
              uploadedDebtorId={id}
              tags={tags}
              canEdit={perms.canManageFlags}
              onChanged={refresh}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {details.ourFileNo} · {details.creditorName} · placed {daysAgo(details.createdAt)}
          </p>

          <SectionLabel>Balance summary</SectionLabel>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
            <SummaryTile label="Principal" value={formatMoney(details.principal)} />
            <SummaryTile label="Interest rate" value={`${details.interestRate}%`} />
            <SummaryTile label="Interest" value={formatMoney(interest)} />
          </div>

          <SectionLabel>Assignment summary</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            <AssignmentPill label={assignedAgent || "Unassigned"} />
            <AssignmentPill label={details.teamName || "Unassigned team"} />
            <AssignmentPill label={`${details.clientName} · ${details.creditorName}`} />
          </div>

          {tags.length > 0 && (
            <>
              <SectionLabel>Flags</SectionLabel>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-warning/20 text-warning-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="px-6 lg:px-10 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="dataprofile">
              <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
              Data profile
            </TabsTrigger>
            <TabsTrigger value="comms">
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Communication
            </TabsTrigger>
            <TabsTrigger value="calls">
              <Headphones className="h-3.5 w-3.5 mr-1.5" />
              Calls
            </TabsTrigger>
            <TabsTrigger value="notes">
              <StickyNote className="h-3.5 w-3.5 mr-1.5" />
              Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dataprofile" className="mt-4">
            <DataProfileTab
              details={details}
              canEdit={perms.canEditDetails}
              onEdit={() => setEditOpen(true)}
            />
          </TabsContent>
          <TabsContent value="comms" className="mt-4">
            <CommunicationTab details={details} />
          </TabsContent>
          <TabsContent value="calls" className="mt-4">
            <CallsTab details={details} />
          </TabsContent>
          <TabsContent value="notes" className="mt-4">
            <NotesTab details={details} />
          </TabsContent>
        </Tabs>
      </section>

      {archiveConfirmOpen && (
        <ArchiveConfirmDialog
          uploadedDebtorId={id}
          onClose={() => setArchiveConfirmOpen(false)}
          onDone={() => {
            setArchiveConfirmOpen(false);
            refresh();
          }}
        />
      )}
      {editOpen && (
        <EditCustomerDialog
          details={details}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            refresh();
          }}
        />
      )}
      {restoreDialogOpen && (
        <RestoreFileDialog
          uploadedDebtorId={id}
          name={customerDisplayName(details)}
          fileRef={details.ourFileNo}
          clientName={details.clientName}
          teamName={details.teamName}
          status={
            details.status
              ? {
                  code: details.statusCode ?? details.status,
                  name: details.status,
                  color: details.statusColorCode ?? "#64748b",
                }
              : null
          }
          onClose={() => setRestoreDialogOpen(false)}
          onRestored={() => {
            setRestoreDialogOpen(false);
            refresh();
          }}
        />
      )}
      {moveDialogOpen && (
        <MoveToTeamDialog
          count={1}
          uploadedDebtorIdList={[id]}
          onClose={() => setMoveDialogOpen(false)}
          onMoved={() => {
            // The file loses its assignment and drops off this agent's book on
            // a successful move — nothing left here to refresh into.
            navigate({ to: "/tenant/debtors" });
          }}
        />
      )}
    </Shell>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
      {children}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
    </div>
  );
}

function AssignmentPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-tenant-soft text-tenant border border-[color:var(--tenant)]/20">
      {label}
    </span>
  );
}

/* ------------------------------ Data profile ------------------------------ */

function DataProfileTab({
  details,
  canEdit,
  onEdit,
}: {
  details: CustomerDetails;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <PageCard>
      <CardHead
        title="Customer profile"
        subtitle={
          canEdit
            ? "File number, client number and creditor come from intake and can't be edited"
            : "File number, client number and creditor come from intake and can't be edited · read-only for your role"
        }
        icon={<ClipboardList className="h-4 w-4" />}
        action={
          canEdit ? (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          ) : undefined
        }
      />
      <div className="p-6 space-y-6">
        <FieldSection title="File / reference">
          <Field label="Our file no." value={details.ourFileNo} />
          <Field label="Client number" value={details.clientNumber} />
        </FieldSection>

        <FieldSection title="Creditor">
          <Field label="Creditor name" value={details.creditorName} />
        </FieldSection>

        <FieldSection title="Primary customer">
          <Field label="First name" value={details.debtorFirstName ?? "—"} />
          <Field label="Middle name" value={details.debtorMiddleName ?? "—"} />
          <Field label="Last name" value={details.debtorLastName ?? "—"} />
          <Field label="Address" value={details.address || "—"} />
          <Field label="Cell no. 1" value={details.cellNo1 || "—"} />
          <Field label="Cell no. 2" value={details.cellNo2 || "—"} />
          <Field label="Date of birth" value={details.dob || "—"} />
          <Field label="Email" value={details.email || "—"} />
        </FieldSection>

        <FieldSection title="Financial / balance">
          <Field label="Principal" value={formatMoney(details.principal)} />
          <Field label="Interest rate" value={`${details.interestRate}%`} />
          <Field label="Interest type" value={details.interestType || "—"} />
          <Field label="Compounding frequency" value={details.compoundingFrequency || "—"} />
          <Field label="Interest start date" value={details.interestStartDate || "—"} />
          <Field
            label="Current outstanding balance"
            value={formatMoney(details.currentOutstandingBalance)}
          />
          <Field label="Currency" value={details.currency || "—"} />
          <Field label="Delinquency date" value={details.delinquencyDate || "—"} />
        </FieldSection>

        <FieldSection title="Payment history">
          <Field label="Date of last payment" value={details.dateOfLastPayment || "—"} />
          <Field label="Last payment amount" value={formatMoney(details.lastPaymentAmount)} />
          <Field label="Last payment method" value={details.lastPaymentMethod || "—"} />
          <Field label="Total paid to date" value={formatMoney(details.totalPaidToDate)} />
        </FieldSection>

        <FieldSection title="Other">
          <Field label="Preferred language" value={details.preferredLanguage || "—"} />
        </FieldSection>

        {details.customFields.length > 0 && (
          <FieldSection title="Additional information">
            {details.customFields.map((f) => (
              <Field key={f.fieldId} label={f.fieldName} value={f.fieldValue || "Empty"} />
            ))}
          </FieldSection>
        )}
      </div>
    </PageCard>
  );
}

function FieldSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-3">
        {title}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5 break-words">{value}</div>
    </div>
  );
}

/* ----------------------------- Communication ------------------------------ */

function CommunicationTab({ details }: { details: CustomerDetails }) {
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  return (
    <PageCard>
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="font-display font-bold text-lg">Communication</div>
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setChannel("sms")}
            className={`px-3 py-1.5 text-sm font-semibold ${channel === "sms" ? "bg-tenant text-white" : "hover:bg-muted"}`}
          >
            SMS
          </button>
          <button
            onClick={() => setChannel("email")}
            className={`px-3 py-1.5 text-sm font-semibold ${channel === "email" ? "bg-tenant text-white" : "hover:bg-muted"}`}
          >
            Email
          </button>
        </div>
      </div>
      {channel === "sms" ? <SmsPanel details={details} /> : <EmailPanel details={details} />}
    </PageCard>
  );
}

/** Oldest first, so the conversation reads top-to-bottom like a chat thread. */
function oldestFirst<T extends { createdAt: string }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function SmsPanel({ details }: { details: CustomerDetails }) {
  const [messages, setMessages] = useState<CustomerSmsMessage[] | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = () =>
    getCustomerSms(details.uploadedDebtorId)
      .then((r) => setMessages(r.smsList))
      .catch(() => setMessages([]));

  useEffect(() => {
    setMessages(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details.uploadedDebtorId]);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await sendCustomerSms({ uploadedDebtorId: details.uploadedDebtorId, body: body.trim() });
      setBody("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that SMS.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="text-sm text-muted-foreground">
        {messages ? `${messages.length} SMS messages` : "Loading…"}
      </div>
      <div className="min-h-72 max-h-96 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-4">
        {messages === null ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageSquare className="h-8 w-8" />
            <p className="text-sm">No messages yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {oldestFirst(messages).map((m) => (
              <MessageBubble
                key={m.id}
                outgoing={m.direction === "outgoing"}
                sender={m.senderName}
                when={m.createdAt}
                body={m.body}
              />
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-border pt-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder={`Type your SMS to ${customerDisplayName(details)}…`}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={send}
            disabled={!body.trim() || sending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tenant text-white text-sm font-semibold disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send SMS
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailPanel({ details }: { details: CustomerDetails }) {
  const [messages, setMessages] = useState<CustomerEmailMessage[] | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [subjectTouched, setSubjectTouched] = useState(false);

  const load = () =>
    getCustomerEmail(details.uploadedDebtorId)
      .then((r) => {
        setMessages(r.emailList);
        // Default to the most recent thread's subject so a reply stays on the same thread.
        if (!subjectTouched) setSubject(r.emailList[0]?.emailSubject ?? "");
      })
      .catch(() => setMessages([]));

  useEffect(() => {
    setMessages(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details.uploadedDebtorId]);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await sendCustomerEmail({
        uploadedDebtorId: details.uploadedDebtorId,
        emailSubject: subject,
        emailBody: body.trim(),
      });
      setBody("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="text-sm text-muted-foreground">
        {messages ? `${messages.length} emails` : "Loading…"}
      </div>
      <div className="min-h-72 max-h-96 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-4">
        {messages === null ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Mail className="h-8 w-8" />
            <p className="text-sm">No emails yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {oldestFirst(messages).map((m) => (
              <MessageBubble
                key={m.id}
                outgoing={m.direction === "outgoing"}
                sender={m.senderName}
                when={m.createdAt}
                body={m.emailBody}
                subject={m.emailSubject}
              />
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-border pt-4 space-y-2">
        <input
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setSubjectTouched(true);
          }}
          placeholder="Subject"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder={`Compose email to ${customerDisplayName(details)}…`}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
        />
        <div className="flex justify-end">
          <button
            onClick={send}
            disabled={!body.trim() || sending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tenant text-white text-sm font-semibold disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send email
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  outgoing,
  sender,
  when,
  body,
  subject,
}: {
  outgoing: boolean;
  sender: string;
  when: string;
  body: string;
  subject?: string;
}) {
  return (
    <div className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${outgoing ? "bg-tenant text-white" : "bg-muted"}`}
      >
        <div className={`text-xs mb-1 ${outgoing ? "text-white/80" : "text-muted-foreground"}`}>
          {sender} · {timeAgo(when)}
        </div>
        {subject && <div className="font-semibold mb-0.5">{subject}</div>}
        <div className="whitespace-pre-wrap">{body}</div>
      </div>
    </div>
  );
}

/* --------------------------------- Calls ---------------------------------- */

function firstSentence(text: string, maxLen = 90): string {
  const clean = text.replace(/[#*]+/g, "").trim();
  const cut = clean.search(/[.\n]/);
  const s = cut > 0 ? clean.slice(0, cut + 1) : clean;
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s || "Call recording";
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function CallsTab({ details }: { details: CustomerDetails }) {
  const [calls, setCalls] = useState<CustomerCall[] | null>(null);
  const [openCall, setOpenCall] = useState<CustomerCall | null>(null);
  const [callDialogOpen, setCallDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCustomerCalls(details.uploadedDebtorId)
      .then((r) => {
        if (!cancelled) setCalls(r.callList);
      })
      .catch(() => {
        if (!cancelled) setCalls([]);
      });
    return () => {
      cancelled = true;
    };
  }, [details.uploadedDebtorId]);

  const totalMinutes = calls
    ? Math.round(calls.reduce((s, c) => s + c.recordingDuration, 0) / 60)
    : 0;

  return (
    <PageCard>
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <div className="font-display font-bold text-lg">Call recordings & transcripts</div>
          <div className="text-sm text-muted-foreground">
            {calls ? `${calls.length} calls · ~${totalMinutes} min recorded` : "Loading…"}
          </div>
        </div>
        <button
          onClick={() => setCallDialogOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tenant text-white text-sm font-semibold"
        >
          <PhoneCall className="h-4 w-4" /> Initiate call
        </button>
      </div>
      <div className="divide-y divide-border">
        {calls?.length === 0 && (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">No calls yet.</div>
        )}
        {calls?.map((c) => (
          <div key={c.id} className="flex items-center gap-4 px-6 py-4">
            <button className="h-9 w-9 rounded-full bg-tenant text-white flex items-center justify-center shrink-0">
              <Play className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">{c.callType}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(c.createdAt).toLocaleString()} · {formatDuration(c.recordingDuration)}
              </div>
            </div>
            <button
              onClick={() => setOpenCall(c)}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted shrink-0"
            >
              Open
            </button>
          </div>
        ))}
      </div>

      {openCall && (
        <CallDetailModal
          uploadedDebtorId={details.uploadedDebtorId}
          call={openCall}
          onClose={() => setOpenCall(null)}
        />
      )}
      {callDialogOpen && (
        <InitiateCallDialog
          uploadedDebtorId={details.uploadedDebtorId}
          defaultTo={details.cellNo1}
          customerName={customerDisplayName(details)}
          onClose={() => setCallDialogOpen(false)}
        />
      )}
    </PageCard>
  );
}

function CallDetailModal({
  uploadedDebtorId,
  call,
  onClose,
}: {
  uploadedDebtorId: number;
  call: CustomerCall;
  onClose: () => void;
}) {
  const [full, setFull] = useState<CustomerCallDetails | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCustomerCallDetails(uploadedDebtorId, call.id)
      .then((d) => {
        if (!cancelled) setFull(d);
      })
      .catch(() => {
        if (!cancelled) setFull(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uploadedDebtorId, call.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="font-display font-bold text-base">
            {firstSentence(full?.callSummary ?? call.callType)}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 text-sm">
          <div className="text-xs text-muted-foreground">
            {new Date(call.createdAt).toLocaleString()} · {formatDuration(call.recordingDuration)}
          </div>
          {!full ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              {call.recordingLink && (
                <audio controls src={call.recordingLink} className="w-full">
                  Your browser doesn't support audio playback.
                </audio>
              )}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
                  Summary
                </div>
                <p className="whitespace-pre-wrap text-sm">{full.callSummary}</p>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2">
                  Transcript
                </div>
                <div className="space-y-2">
                  {full.conversation.map((line, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="font-semibold shrink-0 w-20 text-tenant">
                        {line.speaker}
                      </span>
                      <span>{line.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Notes ----------------------------------- */

function NotesTab({ details }: { details: CustomerDetails }) {
  const perms = useCustomerPermissions();
  const [notes, setNotes] = useState<CustomerNote[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerNote | null>(null);

  const load = () =>
    getCustomerNotes(details.uploadedDebtorId)
      .then((r) => setNotes(r.noteList))
      .catch(() => setNotes([]));

  useEffect(() => {
    setNotes(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details.uploadedDebtorId]);

  const remove = async (n: CustomerNote) => {
    try {
      await deleteCustomerNotes(n.notesId, details.uploadedDebtorId);
      toast.success("Note deleted.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete that note.");
    }
  };

  return (
    <PageCard>
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <div className="font-display font-bold text-lg">Notes & timeline</div>
          <div className="text-sm text-muted-foreground">
            {notes ? `${notes.length} total` : "Loading…"}
          </div>
        </div>
        {perms.canAddNotes && (
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tenant text-white text-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> Add note
          </button>
        )}
      </div>
      <div className="p-6">
        {notes === null && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {notes?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No notes yet.</p>
        )}
        <ul className="space-y-4">
          {notes?.map((n) => (
            <li key={n.notesId} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{n.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {fullName({
                      firstName: n.createUserFirstName,
                      lastName: n.createdUserLastName,
                    })}{" "}
                    · {timeAgo(n.createdAt)}
                  </div>
                </div>
                {perms.canAddNotes && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditing(n)} className="p-1.5 rounded hover:bg-muted">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(n)}
                      className="p-1.5 rounded hover:bg-muted text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap">{n.description}</p>
              {n.files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {n.files.map((f) => (
                    <a
                      key={f}
                      href={f}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-tenant hover:underline truncate max-w-[240px]"
                    >
                      {f.split("/").pop()}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {addOpen && (
        <NoteDialog
          uploadedDebtorId={details.uploadedDebtorId}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            load();
          }}
        />
      )}
      {editing && (
        <NoteDialog
          uploadedDebtorId={details.uploadedDebtorId}
          note={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </PageCard>
  );
}

function NoteDialog({
  uploadedDebtorId,
  note,
  onClose,
  onSaved,
}: {
  uploadedDebtorId: number;
  note?: CustomerNote;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [description, setDescription] = useState(note?.description ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (note) {
        await updateCustomerNotes({
          notesId: note.notesId,
          uploadedDebtorId,
          title: title.trim(),
          description: description.trim(),
          existingFiles: note.files,
          newFiles: files,
        });
      } else {
        await createCustomerNotes({
          uploadedDebtorId,
          title: title.trim(),
          description: description.trim(),
          files,
        });
      }
      toast.success(note ? "Note updated." : "Note added.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that note.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="font-display font-bold text-base">{note ? "Edit note" : "New note"}</div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Title
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title…"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Add details…"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </label>
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm cursor-pointer hover:bg-muted">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            Attach files
          </label>
          {files.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {files.map((f) => f.name).join(", ")}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!title.trim() || saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tenant text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {note ? "Save changes" : "Create note"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Manage menu -------------------------------- */

/** Exports the already-loaded profile as CSV — no backend export endpoint
 *  exists yet, so this reads from what's on screen rather than faking a call. */
function exportCustomerCsv(details: CustomerDetails, isArchived: boolean, isEngaged: boolean) {
  const rows: [string, string][] = [
    ["Our file no.", details.ourFileNo],
    ["Client number", details.clientNumber],
    ["Creditor", details.creditorName],
    ["Debtor name", customerDisplayName(details)],
    ["Address", details.address || ""],
    ["Cell no. 1", details.cellNo1 || ""],
    ["Cell no. 2", details.cellNo2 || ""],
    ["Email", details.email || ""],
    ["Date of birth", details.dob || ""],
    ["Principal", details.principal],
    ["Interest rate", details.interestRate],
    ["Current outstanding balance", details.currentOutstandingBalance],
    ["Delinquency date", details.delinquencyDate || ""],
    ["Status", details.status || ""],
    ["Team", details.teamName || ""],
    [
      "Assigned agent",
      fullName({
        firstName: details.assignedUserFirstName,
        lastName: details.assignedUserLastName,
      }),
    ],
    ["Engagement status", isEngaged ? "Active" : "Stopped"],
    ["Archived", isArchived ? "Yes" : "No"],
    ...details.customFields.map((f): [string, string] => [f.fieldName, f.fieldValue || ""]),
  ];
  const csv = rows.map(([k, v]) => `${csvCell(k)},${csvCell(v)}`).join("\n");
  downloadTextFile(`${details.ourFileNo || "customer"}.csv`, csv, "text/csv;charset=utf-8;");
}

function ManageMenu({
  details,
  perms,
  isArchived,
  isEngaged,
  engagementBusy,
  onExported,
  onArchive,
  onRestore,
  onEdit,
  onMoveToTeam,
  onToggleEngagement,
}: {
  details: CustomerDetails;
  perms: CustomerPermissions;
  isArchived: boolean;
  isEngaged: boolean;
  engagementBusy: boolean;
  onExported: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onEdit: () => void;
  onMoveToTeam: () => void;
  onToggleEngagement: () => void;
}) {
  const showArchive = perms.canArchive && !isArchived;
  // Restoring is the inverse of archiving, so it sits behind the same grant.
  const showRestore = perms.canArchive && isArchived;
  const showEngagementToggle = isEngaged ? perms.canStopEngagement : perms.canResumeEngagement;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
          <MoreHorizontal className="h-4 w-4" /> Manage
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>
          <div className="text-sm font-bold font-display">Manage customer</div>
          <div className="mt-1 text-xs font-normal leading-snug text-muted-foreground">
            Manual lifecycle actions — all changes are recorded in the audit trail.
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            exportCustomerCsv(details, isArchived, isEngaged);
            onExported();
          }}
        >
          <Download className="h-4 w-4" /> Export
        </DropdownMenuItem>
        {perms.canEditDetails && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil className="h-4 w-4" /> Edit details
          </DropdownMenuItem>
        )}
        {perms.canMoveTeam && (
          <DropdownMenuItem onSelect={onMoveToTeam}>
            <ArrowLeftRight className="h-4 w-4" /> Move to team
          </DropdownMenuItem>
        )}
        {showArchive && (
          <DropdownMenuItem onSelect={onArchive}>
            <Archive className="h-4 w-4" /> Archive
          </DropdownMenuItem>
        )}
        {showRestore && (
          <DropdownMenuItem onSelect={onRestore}>
            <RotateCcw className="h-4 w-4" /> Restore from archive
          </DropdownMenuItem>
        )}
        {showEngagementToggle && (
          <DropdownMenuItem disabled={engagementBusy} onSelect={onToggleEngagement}>
            {engagementBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEngaged ? (
              <PauseCircle className="h-4 w-4" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            {isEngaged ? "Stop engagement" : "Resume engagement"}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled
          title="Not available yet — there is no delete API for customer files."
          className="text-destructive"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ArchiveConfirmDialog({
  uploadedDebtorId,
  onClose,
  onDone,
}: {
  uploadedDebtorId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await archiveCustomer(uploadedDebtorId);
      toast.success("Customer archived.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't archive this customer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-sm">
        <div className="px-5 py-4 border-b border-border font-display font-bold text-base">
          Archive this customer?
        </div>
        <div className="px-5 py-4 text-sm text-muted-foreground">
          The file leaves the active workload and is parked under Case Files → Archive, where it can
          be restored at any time. Nothing is deleted.
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}
