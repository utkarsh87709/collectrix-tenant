import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  CheckCheck,
  Loader2,
  Mail,
  MessageSquare,
  MessagesSquare,
  PanelRightClose,
  PanelRightOpen,
  PauseCircle,
  PhoneCall,
  PlayCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChangeStatusMenu } from "@/components/tenant/customers/ChangeStatusMenu";
import type { CustomerPermissions } from "@/lib/customer-permissions";
import {
  customerDisplayName,
  getCustomerEmail,
  getCustomerSms,
  normalizeTags,
  sendCustomerEmail,
  sendCustomerSms,
  type CustomerDetails,
} from "@/lib/customers-api";
import type { InboxChannel } from "@/lib/inbox-api";
import { Avatar, TagChip } from "./InboxBits";
import {
  dayLabel,
  formatClock,
  isSameDay,
  oldestFirst,
  plainText,
  smsSegments,
} from "./inbox-utils";

/** One rendered message, whichever channel it came from. */
type ThreadMessage = {
  id: number;
  createdAt: string;
  direction: "incoming" | "outgoing";
  sender: string;
  body: string;
  subject?: string;
  from?: string;
  to?: string;
};

const GROUP_WINDOW_MS = 5 * 60_000;

export function ConversationThread({
  details,
  loading,
  error,
  onRetry,
  channel,
  onChannelChange,
  perms,
  onCall,
  onToggleEngagement,
  engagementBusy,
  detailsOpen,
  onToggleDetails,
  onStatusChanged,
  onSent,
}: {
  details: CustomerDetails | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  channel: InboxChannel;
  onChannelChange: (c: InboxChannel) => void;
  perms: CustomerPermissions;
  onCall: () => void;
  onToggleEngagement: () => void;
  engagementBusy: boolean;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onStatusChanged: () => void;
  /** Fired after a message goes out so the caller can refresh the list. */
  onSent: () => void;
}) {
  if (!details && !loading && !error) return <NoSelection />;

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-medium text-destructive">{error}</p>
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!details) return <ThreadSkeleton />;

  return (
    <ThreadBody
      key={details.uploadedDebtorId}
      details={details}
      channel={channel}
      onChannelChange={onChannelChange}
      perms={perms}
      onCall={onCall}
      onToggleEngagement={onToggleEngagement}
      engagementBusy={engagementBusy}
      detailsOpen={detailsOpen}
      onToggleDetails={onToggleDetails}
      onStatusChanged={onStatusChanged}
      onSent={onSent}
    />
  );
}

/* --------------------------------- Body ---------------------------------- */

function ThreadBody({
  details,
  channel,
  onChannelChange,
  perms,
  onCall,
  onToggleEngagement,
  engagementBusy,
  detailsOpen,
  onToggleDetails,
  onStatusChanged,
  onSent,
}: {
  details: CustomerDetails;
  channel: InboxChannel;
  onChannelChange: (c: InboxChannel) => void;
  perms: CustomerPermissions;
  onCall: () => void;
  onToggleEngagement: () => void;
  engagementBusy: boolean;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onStatusChanged: () => void;
  onSent: () => void;
}) {
  const id = details.uploadedDebtorId;
  const name = customerDisplayName(details);
  const isEngaged = details.engagementStatus === 1;
  const isArchived = details.archivedFlag === 1;
  const tags = normalizeTags(details.customerTags);

  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setMessages(null);
        setThreadError(null);
      }
      try {
        if (channel === "sms") {
          const r = await getCustomerSms(id);
          setMessages(
            r.smsList.map((m) => ({
              id: m.id,
              createdAt: m.createdAt,
              direction: m.direction,
              sender: m.senderName,
              body: m.body,
              from: m.fromPhoneNo,
              to: m.toPhoneNo,
            })),
          );
        } else {
          const r = await getCustomerEmail(id);
          const list = r.emailList.map((m) => ({
            id: m.id,
            createdAt: m.createdAt,
            direction: m.direction,
            sender: m.senderName,
            body: m.emailBody,
            subject: m.emailSubject,
            from: m.fromEmail,
            to: m.toEmail,
          }));
          setMessages(list);
          // Reply on the most recent thread by default so it stays threaded.
          if (!subjectTouched) {
            const newest = oldestFirst(list).at(-1);
            setSubject(newest?.subject ?? "");
          }
        }
      } catch (err) {
        setThreadError(err instanceof Error ? err.message : "Couldn't load this conversation.");
        setMessages([]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, channel],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Keep the newest message in view whenever the thread changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length, channel]);

  const ordered = useMemo(() => (messages ? oldestFirst(messages) : []), [messages]);

  const canSend = perms.canSendComms;
  const trimmed = body.trim();
  const needsSubject = channel === "email" && !subject.trim();
  const sms = smsSegments(body);

  const send = async () => {
    if (!trimmed || sending || needsSubject) return;
    setSending(true);
    try {
      if (channel === "sms") {
        await sendCustomerSms({ uploadedDebtorId: id, body: trimmed });
      } else {
        await sendCustomerEmail({
          uploadedDebtorId: id,
          emailSubject: subject.trim(),
          emailBody: trimmed,
        });
      }
      setBody("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      toast.success(channel === "sms" ? "SMS sent." : "Email sent.");
      await load(true);
      onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that message.");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // SMS: Enter sends, Shift+Enter breaks a line. Email: ⌘/Ctrl+Enter sends.
    if (e.key !== "Enter") return;
    if (channel === "sms" ? !e.shiftKey : e.metaKey || e.ctrlKey) {
      e.preventDefault();
      send();
    }
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ------------------------------ Header ------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} seed={id} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                to="/tenant/debtors/$debtorId"
                params={{ debtorId: String(id) }}
                className="truncate font-display text-lg font-bold tracking-tight hover:text-tenant"
                title="Open full profile"
              >
                {name}
              </Link>
              <span className="font-mono text-xs text-muted-foreground">{details.ourFileNo}</span>
              <ChangeStatusMenu
                uploadedDebtorId={id}
                statusId={details.statusId}
                statusCode={details.statusCode}
                statusName={details.status}
                statusColor={details.statusColorCode}
                canChange={perms.canUpdateStatus}
                onChanged={onStatusChanged}
              />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">
                {details.creditorName}
                {details.clientName ? ` · ${details.clientName}` : ""}
              </span>
              {isArchived && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                  <Archive className="h-3 w-3" /> Archived
                </span>
              )}
              {!isEngaged && (
                <span className="inline-flex items-center gap-1 rounded-md bg-warning/20 px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground">
                  <PauseCircle className="h-3 w-3" /> Engagement stopped
                </span>
              )}
              {tags.map((t) => (
                <TagChip key={t}>{t}</TagChip>
              ))}
            </div>
          </div>
        </div>

        <TooltipProvider delayDuration={150}>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs font-semibold">
              <ChannelButton
                active={channel === "sms"}
                onClick={() => onChannelChange("sms")}
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                label="SMS"
              />
              <ChannelButton
                active={channel === "email"}
                onClick={() => onChannelChange("email")}
                icon={<Mail className="h-3.5 w-3.5" />}
                label="Email"
              />
            </div>

            {perms.canMakeCalls && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onCall}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-tenant text-white shadow-tenant transition hover:opacity-90"
                    aria-label="Call customer"
                  >
                    <PhoneCall className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Call {name.split(" ")[0]}</TooltipContent>
              </Tooltip>
            )}

            {(isEngaged ? perms.canStopEngagement : perms.canResumeEngagement) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleEngagement}
                    disabled={engagementBusy}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition disabled:opacity-60 ${
                      isEngaged
                        ? "border-warning/40 bg-warning/10 text-warning-foreground hover:bg-warning/20"
                        : "border-success/40 bg-success/10 text-success hover:bg-success/20"
                    }`}
                    aria-label={isEngaged ? "Stop engagement" : "Resume engagement"}
                  >
                    {engagementBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isEngaged ? (
                      <PauseCircle className="h-4 w-4" />
                    ) : (
                      <PlayCircle className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isEngaged ? "Stop engagement" : "Resume engagement"}
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleDetails}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                    detailsOpen
                      ? "border-tenant/40 bg-tenant-soft text-tenant"
                      : "border-border hover:bg-muted"
                  }`}
                  aria-label={detailsOpen ? "Hide details" : "Show details"}
                >
                  {detailsOpen ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {detailsOpen ? "Hide details" : "Show details"}
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* ------------------------------ Thread ------------------------------ */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-muted/40 to-muted/10 px-5 py-5"
      >
        {messages === null ? (
          <BubbleSkeletons />
        ) : threadError ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-destructive">{threadError}</p>
            <button
              onClick={() => load()}
              className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Try again
            </button>
          </div>
        ) : ordered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-sm">
              {channel === "sms" ? (
                <MessageSquare className="h-5 w-5 text-tenant" />
              ) : (
                <Mail className="h-5 w-5 text-tenant" />
              )}
            </span>
            <p className="mt-3 text-sm font-semibold text-foreground">
              No {channel === "sms" ? "SMS" : "email"} history yet
            </p>
            <p className="mt-1 max-w-xs text-xs">
              {canSend
                ? `Start the conversation below — it'll be logged on ${name.split(" ")[0]}'s file.`
                : "Messages exchanged with this customer will show up here."}
            </p>
          </div>
        ) : (
          ordered.map((m, i) => {
            const prev = ordered[i - 1];
            const newDay = !prev || !isSameDay(prev.createdAt, m.createdAt);
            const grouped =
              !!prev &&
              !newDay &&
              prev.direction === m.direction &&
              new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() <
                GROUP_WINDOW_MS;
            return (
              <Fragment key={m.id}>
                {newDay && <DayDivider label={dayLabel(m.createdAt)} />}
                <Bubble message={m} channel={channel} grouped={grouped} />
              </Fragment>
            );
          })
        )}
      </div>

      {/* ----------------------------- Composer ----------------------------- */}
      <div className="border-t border-border bg-card px-4 py-3">
        {!canSend ? (
          <p className="py-1 text-center text-xs text-muted-foreground">
            Your role can't send SMS or email. You can still read the conversation.
          </p>
        ) : (
          <>
            {!isEngaged && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-1.5 text-[11px] text-warning-foreground">
                <PauseCircle className="h-3.5 w-3.5 shrink-0" />
                Engagement is stopped on this file — automated outreach is paused. Manual replies
                still send.
              </div>
            )}
            {channel === "email" && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 focus-within:border-tenant focus-within:bg-background">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Subject
                </span>
                <input
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setSubjectTouched(true);
                  }}
                  placeholder="Add a subject"
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            )}
            <div className="relative rounded-2xl border border-border bg-muted/30 transition-colors focus-within:border-tenant focus-within:bg-background">
              <textarea
                ref={textareaRef}
                value={body}
                rows={1}
                onChange={(e) => {
                  setBody(e.target.value);
                  autoGrow(e.currentTarget);
                }}
                onKeyDown={onKeyDown}
                placeholder={
                  channel === "sms"
                    ? `Text ${name.split(" ")[0]}…`
                    : `Write to ${name.split(" ")[0]}…`
                }
                className="block max-h-[168px] w-full resize-none bg-transparent px-4 pb-11 pt-3 text-sm leading-relaxed outline-none"
              />
              <div className="absolute inset-x-3 bottom-2 flex items-center justify-between gap-3">
                <span className="truncate text-[10px] text-muted-foreground">
                  {channel === "sms"
                    ? sms.chars > 0
                      ? `${sms.chars} chars · ${sms.segments} segment${sms.segments === 1 ? "" : "s"} · Enter to send`
                      : "Enter to send · Shift+Enter for a new line"
                    : needsSubject && trimmed
                      ? "Add a subject to send"
                      : "⌘/Ctrl+Enter to send"}
                </span>
                <button
                  onClick={send}
                  disabled={!trimmed || sending || needsSubject}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-tenant text-white shadow-tenant transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  aria-label={channel === "sms" ? "Send SMS" : "Send email"}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Bits ---------------------------------- */

function ChannelButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
        active ? "bg-card text-tenant shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-3 first:mt-0">
      <span className="h-px flex-1 bg-border/70" />
      <span className="rounded-full border border-border bg-card px-3 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm">
        {label}
      </span>
      <span className="h-px flex-1 bg-border/70" />
    </div>
  );
}

function Bubble({
  message: m,
  channel,
  grouped,
}: {
  message: ThreadMessage;
  channel: InboxChannel;
  grouped: boolean;
}) {
  const out = m.direction === "outgoing";
  const label = m.sender || (out ? "You" : "Customer");
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"} ${grouped ? "mt-1" : "mt-3"}`}>
      <div className="min-w-0 max-w-[78%]">
        {!grouped && (
          <div
            className={`mb-1 px-1 text-[10px] font-semibold text-muted-foreground ${out ? "text-right" : ""}`}
          >
            {label}
            {channel === "email" && m.from ? (
              <span className="font-normal opacity-80"> · {out ? m.to : m.from}</span>
            ) : null}
          </div>
        )}
        <div
          className={`px-4 py-2.5 text-sm shadow-sm ${
            out
              ? "rounded-2xl rounded-br-md bg-gradient-tenant text-white"
              : "rounded-2xl rounded-bl-md border border-border bg-card"
          }`}
        >
          {m.subject && <div className="mb-1 font-semibold leading-snug">{m.subject}</div>}
          <div className="whitespace-pre-wrap break-words leading-relaxed">{plainText(m.body)}</div>
          <div
            className={`mt-1.5 flex items-center gap-1 text-[10px] ${
              out ? "justify-end text-white/75" : "text-muted-foreground"
            }`}
          >
            {out && <CheckCheck className="h-3 w-3" />}
            {formatClock(m.createdAt)}
          </div>
        </div>
      </div>
    </div>
  );
}

function NoSelection() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-tenant/10 text-tenant">
        <MessagesSquare className="h-7 w-7" />
      </span>
      <h3 className="mt-4 font-display text-lg font-bold tracking-tight">Pick a conversation</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Choose a customer on the left to read their replies and respond by SMS or email.
      </p>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <div className="h-11 w-11 animate-pulse rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="flex-1 px-5 py-5">
        <BubbleSkeletons />
      </div>
    </div>
  );
}

function BubbleSkeletons() {
  return (
    <div className="space-y-3">
      {[0, 1, 0, 0, 1].map((side, i) => (
        <div key={i} className={`flex ${side ? "justify-end" : "justify-start"}`}>
          <div
            className={`h-12 animate-pulse rounded-2xl bg-muted ${i % 3 === 0 ? "w-2/3" : "w-2/5"}`}
          />
        </div>
      ))}
    </div>
  );
}
