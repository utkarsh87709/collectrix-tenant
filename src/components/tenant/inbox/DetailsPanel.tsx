import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  ArrowRightLeft,
  ArrowUpRight,
  Briefcase,
  CalendarX2,
  Check,
  ChevronDown,
  Copy,
  FileInput,
  History,
  Loader2,
  Mail,
  PauseCircle,
  Phone,
  PlayCircle,
  Plus,
  Receipt,
  StickyNote,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NativeSelect } from "@/components/tenant/ui";
import { ChangeStatusMenu } from "@/components/tenant/customers/ChangeStatusMenu";
import type { CustomerPermissions } from "@/lib/customer-permissions";
import {
  assignCustomerTag,
  createCustomerNotes,
  customerDisplayName,
  deleteCustomerTag,
  formatMoney,
  fullName,
  getCustomerNotes,
  getTagList,
  normalizeTags,
  parseBackendDate,
  toMoney,
  type CustomerDetails,
  type CustomerNote,
} from "@/lib/customers-api";
import { inboxAssignUser } from "@/lib/inbox-api";
import { getTeamDeckAssignUserList, memberName, type AssignableMember } from "@/lib/team-deck-api";
import { Avatar, TagChip } from "./InboxBits";
import { formatDateTime, timeAgo } from "./inbox-utils";

export function DetailsPanel({
  details,
  loading,
  perms,
  onClose,
  onChanged,
  onToggleEngagement,
  engagementBusy,
}: {
  details: CustomerDetails | null;
  loading: boolean;
  perms: CustomerPermissions;
  onClose: () => void;
  /** Something on the file changed — the caller refetches details + list. */
  onChanged: () => void;
  onToggleEngagement: () => void;
  engagementBusy: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader details={details} loading={loading} onClose={onClose} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!details ? (
          loading ? (
            <PanelSkeleton />
          ) : (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              Select a conversation to see the customer's file.
            </p>
          )
        ) : (
          <div key={details.uploadedDebtorId} className="divide-y divide-border">
            <CaseSection details={details} />
            <AssignmentSection
              details={details}
              perms={perms}
              onChanged={onChanged}
              onToggleEngagement={onToggleEngagement}
              engagementBusy={engagementBusy}
            />
            <TagsSection details={details} canEdit={perms.canManageFlags} onChanged={onChanged} />
            <TimelineSection details={details} />
            <NotesSection details={details} canAdd={perms.canAddNotes} />
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Header --------------------------------- */

function PanelHeader({
  details,
  loading,
  onClose,
}: {
  details: CustomerDetails | null;
  loading: boolean;
  onClose: () => void;
}) {
  const lastPaid = details ? parseBackendDate(details.dateOfLastPayment) : null;
  const delinquent = details ? parseBackendDate(details.delinquencyDate) : null;
  const daysDelinquent = delinquent ? differenceInCalendarDays(new Date(), delinquent) : null;
  const lastPaidAmount = details ? toMoney(details.lastPaymentAmount) : 0;

  return (
    <div className="relative shrink-0 overflow-hidden border-b border-border">
      <div
        className="absolute inset-0 bg-gradient-to-br from-tenant/20 via-tenant-soft/70 to-card"
        aria-hidden
      />
      <div
        className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-tenant/20 blur-2xl"
        aria-hidden
      />
      <div className="relative px-4 pb-4 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Customer file
          </span>
          <div className="flex items-center gap-1">
            {details && (
              <Link
                to="/tenant/debtors/$debtorId"
                params={{ debtorId: String(details.uploadedDebtorId) }}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-tenant hover:bg-tenant/10"
              >
                Full profile <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
            <button
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-tenant/10 hover:text-foreground"
              aria-label="Close details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {details ? (
          <>
            <div className="mt-2 flex items-center gap-3">
              <Avatar
                name={customerDisplayName(details)}
                seed={details.uploadedDebtorId}
                size="lg"
              />
              <div className="min-w-0">
                <div className="truncate font-display text-base font-bold tracking-tight">
                  {customerDisplayName(details)}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-mono">{details.ourFileNo}</span>
                  <span aria-hidden>·</span>
                  <span className="truncate">{details.creditorName}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat
                label="Outstanding"
                value={formatMoney(details.currentOutstandingBalance)}
                sub={details.currency || undefined}
                tone="tenant"
              />
              <Stat
                label="Last paid"
                value={lastPaidAmount > 0 ? formatMoney(lastPaidAmount) : "—"}
                sub={lastPaid ? format(lastPaid, "d MMM yyyy") : "No payments"}
              />
              <Stat
                label="Delinquent"
                value={daysDelinquent != null ? `${Math.max(daysDelinquent, 0)}d` : "—"}
                sub={delinquent ? `since ${format(delinquent, "d MMM")}` : "No date"}
                tone={
                  daysDelinquent == null ? "default" : daysDelinquent > 90 ? "danger" : "warning"
                }
              />
            </div>
          </>
        ) : loading ? (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-36 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "tenant" | "warning" | "danger";
}) {
  const toneCls = {
    default: "text-foreground",
    tenant: "text-tenant",
    warning: "text-warning-foreground",
    danger: "text-destructive",
  }[tone];
  return (
    <div className="min-w-0 rounded-xl border border-border/70 bg-card/80 px-2.5 py-2 shadow-sm backdrop-blur">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 truncate font-display text-sm font-bold ${toneCls}`}>{value}</div>
      {sub && <div className="truncate text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/* -------------------------------- Sections -------------------------------- */

function Section({
  icon,
  title,
  action,
  children,
  defaultOpen = true,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-tenant/10 text-tenant">
            {icon}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <ChevronDown
            className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </button>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}

/* ---------------------------------- Case ---------------------------------- */

function CaseSection({ details }: { details: CustomerDetails }) {
  const leader = fullName({ firstName: details.leaderFirstName, lastName: details.leaderLastName });
  const contacts = [
    {
      icon: <Mail className="h-3.5 w-3.5" />,
      value: details.email,
      href: "mailto:",
      hint: "Email",
    },
    {
      icon: <Phone className="h-3.5 w-3.5" />,
      value: details.cellNo1,
      href: "tel:",
      hint: "Mobile",
    },
    {
      icon: <Phone className="h-3.5 w-3.5" />,
      value: details.cellNo2,
      href: "tel:",
      hint: "Alt mobile",
    },
    { icon: <Phone className="h-3.5 w-3.5" />, value: details.homeNo, href: "tel:", hint: "Home" },
  ].filter((c) => !!c.value);

  return (
    <Section icon={<Briefcase className="h-3.5 w-3.5" />} title="Case">
      <dl className="space-y-2">
        <Row label="Client">
          <span className="truncate">
            {details.clientName || "—"}
            {details.clientNumber ? (
              <span className="text-muted-foreground"> · {details.clientNumber}</span>
            ) : null}
          </span>
        </Row>
        <Row label="Creditor">{details.creditorName || "—"}</Row>
        <Row label="Team">
          {details.teamName || <span className="text-muted-foreground">Unassigned</span>}
          {leader ? <span className="text-muted-foreground"> · led by {leader}</span> : null}
        </Row>
        {details.preferredLanguage && <Row label="Language">{details.preferredLanguage}</Row>}
        <Row label="Received">
          <span className="text-xs">{formatDateTime(details.createdAt)}</span>
        </Row>
      </dl>

      <div className="mt-3 border-t border-border/60 pt-3">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Contacts
        </div>
        {contacts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No contact details on file.</p>
        ) : (
          <div className="-mx-2 space-y-0.5">
            {contacts.map((c) => (
              <ContactRow key={c.hint} icon={c.icon} value={c.value!} href={c.href} hint={c.hint} />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

function ContactRow({
  icon,
  value,
  href,
  hint,
}: {
  icon: React.ReactNode;
  value: string;
  href: string;
  hint: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  };
  return (
    <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted/60">
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-tenant/10 group-hover:text-tenant">
        {icon}
      </span>
      <a href={`${href}${value}`} className="min-w-0 flex-1 truncate font-medium hover:text-tenant">
        {value}
      </a>
      <span className="text-[10px] text-muted-foreground group-hover:hidden">{hint}</span>
      <button
        onClick={copy}
        className="hidden h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-tenant group-hover:inline-flex"
        aria-label={`Copy ${hint.toLowerCase()}`}
        title="Copy"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/* ------------------------------- Assignment ------------------------------- */

function AssignmentSection({
  details,
  perms,
  onChanged,
  onToggleEngagement,
  engagementBusy,
}: {
  details: CustomerDetails;
  perms: CustomerPermissions;
  onChanged: () => void;
  onToggleEngagement: () => void;
  engagementBusy: boolean;
}) {
  const teamId = details.assignedTeamId;
  const [members, setMembers] = useState<AssignableMember[] | null>(null);
  const [busy, setBusy] = useState(false);
  const currentName = fullName({
    firstName: details.assignedUserFirstName,
    lastName: details.assignedUserLastName,
  });
  const isEngaged = details.engagementStatus === 1;
  const canToggle = isEngaged ? perms.canStopEngagement : perms.canResumeEngagement;

  useEffect(() => {
    if (teamId == null || !perms.canAssignUser) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    setMembers(null);
    getTeamDeckAssignUserList(teamId)
      .then((r) => {
        if (!cancelled) setMembers(r.assignUserList);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, perms.canAssignUser]);

  // If the current assignee isn't on the team list any more, still show them.
  const options = useMemo(() => {
    const list = members ?? [];
    if (details.assignedTo != null && !list.some((m) => m.userId === details.assignedTo)) {
      return [
        {
          userId: details.assignedTo,
          firstName: currentName || `User #${details.assignedTo}`,
          lastName: "",
          emailId: "",
          role: "",
        } as AssignableMember,
        ...list,
      ];
    }
    return list;
  }, [members, details.assignedTo, currentName]);

  const assign = async (userId: number) => {
    const member = options.find((m) => m.userId === userId);
    setBusy(true);
    try {
      await inboxAssignUser({ uploadedDebtorId: details.uploadedDebtorId, userId });
      toast.success(`Assigned to ${member ? memberName(member) : "the selected member"}.`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reassign this file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section icon={<UserRound className="h-3.5 w-3.5" />} title="Assignment">
      <div className="space-y-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Allocated to
            </span>
            {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-2">
            {currentName ? (
              <Avatar name={currentName} seed={`u${details.assignedTo}`} size="sm" />
            ) : (
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                <UserRound className="h-3.5 w-3.5" />
              </span>
            )}
            {perms.canAssignUser && teamId != null ? (
              <NativeSelect
                size="sm"
                className="min-w-0 flex-1"
                value={details.assignedTo == null ? "" : String(details.assignedTo)}
                disabled={busy || members === null}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v && Number(v) !== details.assignedTo) assign(Number(v));
                }}
              >
                {members === null && <option value="">Loading members…</option>}
                {members !== null && details.assignedTo == null && (
                  <option value="">Unassigned — pick a member</option>
                )}
                {options.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {memberName(m)}
                    {m.role ? ` · ${m.role}` : ""}
                  </option>
                ))}
                {members?.length === 0 && details.assignedTo == null && (
                  <option value="" disabled>
                    No members on this team
                  </option>
                )}
              </NativeSelect>
            ) : (
              <div className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                {currentName || <span className="text-muted-foreground">Unassigned</span>}
              </div>
            )}
          </div>
          {teamId == null && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              This file isn't on a team yet. Move it to a team from the full profile to hand it to a
              member.
            </p>
          )}
        </div>

        <dl className="space-y-2.5">
          <Row label="Status">
            <ChangeStatusMenu
              uploadedDebtorId={details.uploadedDebtorId}
              statusId={details.statusId}
              statusCode={details.statusCode}
              statusName={details.status}
              statusColor={details.statusColorCode}
              canChange={perms.canUpdateStatus}
              onChanged={onChanged}
            />
          </Row>
          <Row label="Engagement">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                  isEngaged ? "bg-success/15 text-success" : "bg-warning/20 text-warning-foreground"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isEngaged ? "bg-success" : "bg-warning"}`}
                  aria-hidden
                />
                {isEngaged ? "Active" : "Stopped"}
              </span>
              {canToggle && (
                <button
                  onClick={onToggleEngagement}
                  disabled={engagementBusy}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-semibold hover:bg-muted disabled:opacity-60"
                >
                  {engagementBusy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isEngaged ? (
                    <PauseCircle className="h-3 w-3" />
                  ) : (
                    <PlayCircle className="h-3 w-3" />
                  )}
                  {isEngaged ? "Stop" : "Resume"}
                </button>
              )}
            </span>
          </Row>
        </dl>
      </div>
    </Section>
  );
}

/* ---------------------------------- Tags ---------------------------------- */

const SUGGESTED_TAGS = [
  "high-value",
  "disputed",
  "skip-trace",
  "hardship",
  "do-not-contact",
  "legal-hold",
];

function TagsSection({
  details,
  canEdit,
  onChanged,
}: {
  details: CustomerDetails;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const id = details.uploadedDebtorId;
  const tags = useMemo(() => normalizeTags(details.customerTags), [details.customerTags]);
  const [open, setOpen] = useState(false);
  const [known, setKnown] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getTagList(id)
      .then((list) => {
        if (!cancelled) setKnown(list);
      })
      .catch(() => {
        /* suggestions only */
      });
    return () => {
      cancelled = true;
    };
  }, [open, id]);

  const active = useMemo(() => new Set(tags.map((t) => t.toLowerCase())), [tags]);
  const candidates = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of [...known, ...SUGGESTED_TAGS]) {
      const k = t.toLowerCase();
      if (active.has(k) || seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    const q = custom.trim().toLowerCase();
    return q ? out.filter((t) => t.toLowerCase().includes(q)) : out;
  }, [known, active, custom]);

  const add = async (name: string) => {
    const n = name.trim();
    if (!n) return;
    if (active.has(n.toLowerCase())) {
      toast.message(`"${n}" is already on this file.`);
      return;
    }
    setBusy(n);
    try {
      await assignCustomerTag(id, n);
      toast.success(`Tag "${n}" added.`);
      setCustom("");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that tag.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (name: string) => {
    setBusy(name);
    try {
      await deleteCustomerTag(id, name);
      toast.success(`Tag "${name}" removed.`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that tag.");
    } finally {
      setBusy(null);
    }
  };

  const showCreate =
    !!custom.trim() &&
    !active.has(custom.trim().toLowerCase()) &&
    !candidates.some((c) => c.toLowerCase() === custom.trim().toLowerCase());

  return (
    <Section
      icon={<Tag className="h-3.5 w-3.5" />}
      title={tags.length ? `Tags · ${tags.length}` : "Tags"}
      action={
        canEdit ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted">
                <Plus className="h-3 w-3" /> Add
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-0">
              <div className="border-b border-border p-2">
                <input
                  autoFocus
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      add(custom);
                    }
                  }}
                  placeholder="Search or type a new tag…"
                  className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-tenant"
                />
              </div>
              <ul className="max-h-56 overflow-y-auto py-1">
                {showCreate && (
                  <li>
                    <button
                      onClick={() => add(custom)}
                      disabled={busy !== null}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <Plus className="h-3.5 w-3.5 text-tenant" />
                      Create “{custom.trim()}”
                    </button>
                  </li>
                )}
                {candidates.map((t) => (
                  <li key={t}>
                    <button
                      onClick={() => add(t)}
                      disabled={busy !== null}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-60"
                    >
                      {busy === t ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate">{t}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {known.some((k) => k.toLowerCase() === t.toLowerCase())
                          ? "In use"
                          : "Suggested"}
                      </span>
                    </button>
                  </li>
                ))}
                {candidates.length === 0 && !custom.trim() && (
                  <li className="px-3 py-3 text-xs text-muted-foreground">
                    Every known tag is already on this file — type to create one.
                  </li>
                )}
              </ul>
            </PopoverContent>
          </Popover>
        ) : undefined
      }
    >
      {tags.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {canEdit ? "No tags yet — add one to flag this file." : "No tags on this file."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <TagChip key={t} onRemove={canEdit ? () => remove(t) : undefined} removing={busy === t}>
              {t}
            </TagChip>
          ))}
        </div>
      )}
    </Section>
  );
}

/* -------------------------------- Timeline -------------------------------- */

type TimelineEvent = {
  key: string;
  label: string;
  detail?: string;
  at: Date;
  icon: React.ReactNode;
};

/** Milestones the file already carries as dates — no extra endpoint needed. */
function buildTimeline(d: CustomerDetails): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const push = (
    key: string,
    at: Date | null,
    label: string,
    icon: React.ReactNode,
    detail?: string,
  ) => {
    if (at && !Number.isNaN(at.getTime())) events.push({ key, at, label, icon, detail });
  };
  const iso = (s: string | null | undefined) => (s ? new Date(s) : null);

  push("archived", iso(d.archivedAt), "Archived", <Archive className="h-3 w-3" />);
  push(
    "moved",
    iso(d.movedAt),
    d.teamName ? `Moved to ${d.teamName}` : "Moved between teams",
    <ArrowRightLeft className="h-3 w-3" />,
  );
  const lastPaid = toMoney(d.lastPaymentAmount);
  push(
    "lastPayment",
    parseBackendDate(d.dateOfLastPayment),
    "Last payment",
    <Receipt className="h-3 w-3" />,
    [lastPaid > 0 ? formatMoney(lastPaid) : null, d.lastPaymentMethod]
      .filter(Boolean)
      .join(" · ") || undefined,
  );
  push(
    "delinquent",
    parseBackendDate(d.delinquencyDate),
    "Delinquent since",
    <CalendarX2 className="h-3 w-3" />,
  );
  push(
    "received",
    iso(d.createdAt),
    "File received",
    <FileInput className="h-3 w-3" />,
    d.clientName ? `from ${d.clientName}` : undefined,
  );
  return events.sort((a, b) => b.at.getTime() - a.at.getTime());
}

function TimelineSection({ details }: { details: CustomerDetails }) {
  const events = useMemo(() => buildTimeline(details), [details]);
  return (
    <Section icon={<History className="h-3.5 w-3.5" />} title="Timeline">
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing dated on this file yet.</p>
      ) : (
        <ol className="relative ml-3 space-y-3 border-l border-border pl-5">
          {events.map((e, i) => (
            <li key={e.key} className="relative">
              <span
                className={`absolute -left-[31px] top-0 inline-flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-card ${
                  i === 0 ? "bg-tenant text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {e.icon}
              </span>
              <div className="text-sm font-semibold leading-6">{e.label}</div>
              <div className="text-[11px] text-muted-foreground">
                {e.detail ? `${e.detail} · ` : ""}
                {format(e.at, "d MMM yyyy")}
                <span className="opacity-70"> · {timeAgo(e.at.toISOString())}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

/* ---------------------------------- Notes --------------------------------- */

function NotesSection({ details, canAdd }: { details: CustomerDetails; canAdd: boolean }) {
  const id = details.uploadedDebtorId;
  const [notes, setNotes] = useState<CustomerNote[] | null>(null);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    getCustomerNotes(id)
      .then((r) => setNotes(r.noteList))
      .catch(() => setNotes([]));

  useEffect(() => {
    setNotes(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const newest = useMemo(
    () =>
      notes
        ? [...notes]
            .filter((n) => n.deletedFlag !== 1)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        : [],
    [notes],
  );

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createCustomerNotes({
        uploadedDebtorId: id,
        title: title.trim(),
        description: description.trim(),
      });
      toast.success("Note added.");
      setTitle("");
      setDescription("");
      setComposing(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that note.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      icon={<StickyNote className="h-3.5 w-3.5" />}
      title={notes ? `Notes · ${newest.length}` : "Notes"}
      action={
        canAdd && !composing ? (
          <button
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        ) : undefined
      }
    >
      {composing && (
        <div className="mb-3 space-y-2 rounded-xl border border-tenant/30 bg-tenant-soft/40 p-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-tenant"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What happened?"
            className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-tenant"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setComposing(false);
                setTitle("");
                setDescription("");
              }}
              className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!title.trim() || saving}
              className="inline-flex items-center gap-1 rounded-md bg-tenant px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />} Save note
            </button>
          </div>
        </div>
      )}

      {notes === null ? (
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-lg bg-muted" />
          <div className="h-12 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : newest.length === 0 ? (
        <p className="text-xs text-muted-foreground">No notes on this file yet.</p>
      ) : (
        <ul className="space-y-2">
          {newest.slice(0, 4).map((n) => (
            <li
              key={n.notesId}
              className="rounded-xl border border-border/70 bg-muted/20 p-2.5 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="truncate text-sm font-semibold">{n.title}</div>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {timeAgo(n.createdAt)}
                </span>
              </div>
              {n.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.description}</p>
              )}
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Avatar
                  name={
                    fullName({
                      firstName: n.createUserFirstName,
                      lastName: n.createdUserLastName,
                    }) || "?"
                  }
                  seed={`u${n.createdBy}`}
                  size="xs"
                />
                {fullName({ firstName: n.createUserFirstName, lastName: n.createdUserLastName }) ||
                  "—"}
              </div>
            </li>
          ))}
        </ul>
      )}
      {newest.length > 4 && (
        <Link
          to="/tenant/debtors/$debtorId"
          params={{ debtorId: String(id) }}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-tenant hover:underline"
        >
          All {newest.length} notes <ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </Section>
  );
}

/* -------------------------------- Skeleton -------------------------------- */

function PanelSkeleton() {
  return (
    <div className="space-y-5 px-4 py-4">
      {[4, 3, 2].map((n, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          {Array.from({ length: n }).map((_, j) => (
            <div key={j} className="flex justify-between gap-3">
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
