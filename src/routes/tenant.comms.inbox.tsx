import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { ArrowLeft, MessageSquare, Mail, Send, Filter, X, Phone, PauseCircle, CheckCheck, PanelRightOpen, PanelRightClose, User, FileText, Clock, StickyNote, Plus, Trash2 } from "lucide-react";
import { replies as initialReplies, type ReplyLeadStatus, type ReplyFlag } from "@/lib/comms-mock";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const AGENTS = ["Unassigned", "J. Owens", "M. Lindstrom", "A. Patel", "R. Bhandarkar"] as const;

export const Route = createFileRoute("/tenant/comms/inbox")({
  head: () => ({ meta: [{ title: "Inbound Inbox · Communications" }] }),
  component: InboxPage,
});

const INTENT_TONE: Record<string, "muted"|"tenant"|"success"|"warning"|"danger"|"info"> = {
  ptp: "success", dispute: "warning", callback: "tenant", stop: "danger", question: "info", payment_made: "success",
};

const STATUS_TONE: Record<ReplyLeadStatus, "muted"|"tenant"|"success"|"warning"|"danger"|"info"> = {
  new: "info", active: "tenant", ptp: "success", paid: "success", legal: "danger", uncollectable: "muted",
};

const TIME_RANGES = [
  { id: "all", label: "Any time", ms: Infinity },
  { id: "1h", label: "Last hour", ms: 3600 * 1000 },
  { id: "24h", label: "Last 24 hours", ms: 24 * 3600 * 1000 },
  { id: "7d", label: "Last 7 days", ms: 7 * 24 * 3600 * 1000 },
] as const;

const ALL_STATUSES: ReplyLeadStatus[] = ["new","active","ptp","paid","legal","uncollectable"];
const ALL_FLAGS: ReplyFlag[] = ["high-value","disputed","legal-hold","vip"];

function InboxPage() {
  const [replies, setReplies] = useState(initialReplies);
  const [selectedId, setSelectedId] = useState(initialReplies[0].id);
  const [draft, setDraft] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [fCreditor, setFCreditor] = useState<string>("all");
  const [fStatus, setFStatus] = useState<ReplyLeadStatus | "all">("all");
  const [fFlag, setFFlag] = useState<ReplyFlag | "all">("all");
  const [fTime, setFTime] = useState<typeof TIME_RANGES[number]["id"]>("all");
  const [channel, setChannel] = useState<"email" | "sms">(initialReplies[0].channel);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [assignee, setAssignee] = useState<Record<string, string>>({});
  const [notesByCase, setNotesByCase] = useState<Record<string, { id: string; text: string; author: string; ts: string }[]>>({});
  const [newNote, setNewNote] = useState("");

  const creditors = useMemo(() => Array.from(new Set(initialReplies.map((r) => r.creditor))), []);

  const filtered = useMemo(() => {
    const range = TIME_RANGES.find((t) => t.id === fTime)!;
    const cutoff = Date.now() - range.ms;
    return replies.filter((r) => {
      if (fCreditor !== "all" && r.creditor !== fCreditor) return false;
      if (fStatus !== "all" && r.status !== fStatus) return false;
      if (fFlag !== "all" && !r.flags.includes(fFlag)) return false;
      if (range.ms !== Infinity && r.timestamp < cutoff) return false;
      return true;
    });
  }, [replies, fCreditor, fStatus, fFlag, fTime]);

  const activeFilters = (fCreditor !== "all" ? 1 : 0) + (fStatus !== "all" ? 1 : 0) + (fFlag !== "all" ? 1 : 0) + (fTime !== "all" ? 1 : 0);
  const selected = replies.find((r) => r.id === selectedId) ?? replies[0];
  const isRead = !selected.unread;

  const toggleRead = () => {
    const newRead = !isRead;
    setReplies((rs) => rs.map((r) => r.id === selected.id ? { ...r, unread: !newRead, unreadCount: newRead ? 0 : Math.max(r.unreadCount, 1) } : r));
    toast.success(newRead ? "Marked as read" : "Marked as unread");
  };

  return (
    <Shell>
      <Topbar
        title="Inbound Inbox"
        subtitle="US-052 · SMS replies + email responses · AI intent classification"
        action={
          <Link to="/tenant/comms" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      <section className={`px-6 lg:px-10 py-6 grid grid-cols-1 gap-4 ${detailsOpen ? "lg:grid-cols-12" : "lg:grid-cols-3"}`}>
        <PageCard className={detailsOpen ? "lg:col-span-3" : "lg:col-span-1"}>
          <CardHead
            title="All conversations"
            subtitle={`${filtered.length} of ${replies.length} · ${filtered.reduce((s, r) => s + r.unreadCount, 0)} unread`}
            action={
              <div className="relative">
                <button
                  onClick={() => setFilterOpen((o) => !o)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${activeFilters > 0 ? "border-tenant text-tenant bg-tenant-soft" : "border-border hover:bg-muted"}`}
                >
                  <Filter className="h-3.5 w-3.5" /> Filter
                  {activeFilters > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-tenant text-white text-[10px]">{activeFilters}</span>}
                </button>
                {filterOpen && (
                  <div className="absolute right-0 top-full mt-2 z-30 w-72 rounded-xl border border-border bg-card shadow-elegant p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filters</div>
                      <button onClick={() => { setFCreditor("all"); setFStatus("all"); setFFlag("all"); setFTime("all"); }} className="text-[10px] font-semibold text-tenant hover:underline">Clear all</button>
                    </div>
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Creditor</span>
                      <select value={fCreditor} onChange={(e) => setFCreditor(e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm">
                        <option value="all">All creditors</option>
                        {creditors.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Lead status</span>
                      <select value={fStatus} onChange={(e) => setFStatus(e.target.value as ReplyLeadStatus | "all")} className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm">
                        <option value="all">All statuses</option>
                        {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Flags</span>
                      <select value={fFlag} onChange={(e) => setFFlag(e.target.value as ReplyFlag | "all")} className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm">
                        <option value="all">All flags</option>
                        {ALL_FLAGS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Time range</span>
                      <select value={fTime} onChange={(e) => setFTime(e.target.value as typeof TIME_RANGES[number]["id"])} className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm">
                        {TIME_RANGES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </label>
                    <button onClick={() => setFilterOpen(false)} className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-tenant text-white text-xs font-semibold">
                      <X className="h-3 w-3" /> Close
                    </button>
                  </div>
                )}
              </div>
            }
          />
          <ul className="divide-y divide-border max-h-[640px] overflow-y-auto">
            {filtered.map((r) => (
              <li key={r.id}>
                <button onClick={() => setSelectedId(r.id)} className={`w-full text-left px-6 py-3 hover:bg-muted/50 ${selectedId === r.id ? "bg-tenant-soft" : ""}`}>
                  <div className="flex items-start gap-2">
                    {r.channel === "sms" ? <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-1 shrink-0" /> : <Mail className="h-3.5 w-3.5 text-muted-foreground mt-1 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{r.debtor}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{r.receivedAt}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">{r.creditor}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1 mt-1">“{r.preview}”</div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
                        {r.unreadCount > 0 && (
                          <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-tenant text-white text-[10px] font-bold">
                            {r.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-6 py-12 text-center text-sm text-muted-foreground">No conversations match your filters</li>
            )}
          </ul>
        </PageCard>

        <PageCard className={detailsOpen ? "lg:col-span-6" : "lg:col-span-2"}>
          <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-lg font-bold tracking-tight">{selected.debtor}</h2>
                <span className="text-xs font-mono text-muted-foreground">{selected.caseId}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <Pill tone={STATUS_TONE[selected.status]}>{selected.status}</Pill>
                {selected.flags.map((f) => (
                  <Pill key={f} tone="muted">{f}</Pill>
                ))}
              </div>
            </div>
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3 h-9 rounded-lg border border-border bg-card">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{isRead ? "Read" : "Unread"}</span>
                  <Switch checked={isRead} onCheckedChange={toggleRead} aria-label="Toggle read status" />
                </div>

                <label className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Channel</span>
                  <select
                    value={channel}
                    onChange={(e) => { const v = e.target.value as "email" | "sms"; setChannel(v); toast.info(`Switched to ${v.toUpperCase()}`); }}
                    className="bg-transparent text-sm font-semibold outline-none cursor-pointer pr-1"
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                  </select>
                </label>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => toast.success("Initiating call…")}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-tenant text-white shadow-tenant"
                    >
                      <Phone className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Initial call</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => toast.warning("All follow-ups paused for this debtor")}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-warning/40 text-warning-foreground bg-warning/10 hover:bg-warning/20"
                    >
                      <PauseCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Pause all follow-up</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setDetailsOpen((o) => !o)}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border hover:bg-muted"
                    >
                      {detailsOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{detailsOpen ? "Hide lead details" : "Show lead details"}</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
          <div className="flex flex-col h-[640px]">
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-muted/20">
              <div className="flex justify-center">
                <span className="px-3 py-1 rounded-full bg-card border border-border text-[11px] text-muted-foreground">{selected.receivedAt}</span>
              </div>

              {/* Outbound (agent) */}
              <div className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-tenant-soft border border-[color:var(--tenant)]/20 px-4 py-3 text-sm text-foreground shadow-sm">
                  <div>Hello {selected.debtor.split(" ")[0]}, this is Apex Recovery regarding case {selected.caseId}. Please reach out to discuss your account.</div>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] text-success font-semibold">
                      <CheckCheck className="h-3 w-3" /> Delivered
                    </span>
                    <span className="text-[10px] text-muted-foreground">{selected.receivedAt}</span>
                  </div>
                </div>
              </div>

              {/* Inbound (debtor) */}
              <div className="flex justify-start">
                <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 text-sm text-foreground shadow-sm">
                  <div>{selected.preview}</div>
                  <div className="mt-2 text-right text-[10px] text-muted-foreground">{selected.receivedAt}</div>
                </div>
              </div>

              {/* AI suggested reply hint */}
              <div className="flex justify-end">
                <div className="max-w-[75%] rounded-xl border border-dashed border-tenant/40 bg-card px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-tenant mb-1">AI suggested reply</div>
                  <div className="text-sm italic text-muted-foreground">
                    {selected.intent === "ptp" && "Thank you. To confirm your promise to pay, I will send a confirmation link. Please complete by Friday."}
                    {selected.intent === "callback" && "Got it — I will call you after 5pm today. If that no longer works, reply with another time."}
                    {selected.intent === "dispute" && "Thank you for letting us know. Please send any proof of payment to disputes@apex-recovery.com and we will pause collection during review."}
                    {selected.intent === "stop" && "Acknowledged — you have been opted out of all SMS. We will continue with mail only as required by law."}
                    {selected.intent === "question" && "This is Apex Recovery calling about an account in your name. For privacy I cannot share details over text — please call (416) 555-0199."}
                    {selected.intent === "payment_made" && "Thank you for confirming. Your receipt will arrive shortly and the account will close once funds clear."}
                  </div>
                  <button onClick={() => setDraft((d) => d || "Got it — I will follow up shortly.")} className="mt-2 text-[11px] font-semibold text-tenant hover:underline">Use suggestion →</button>
                </div>
              </div>
            </div>

            {/* Composer */}
            <div className="border-t border-border bg-card px-4 py-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) { toast.success("Reply sent"); setDraft(""); } }}
                    placeholder={`Type your message via ${channel.toUpperCase()}…`}
                    className="w-full h-11 rounded-full border border-border bg-muted/30 pl-5 pr-12 text-sm outline-none focus:border-tenant focus:bg-card transition-colors"
                  />
                </div>
                <button
                  onClick={() => { if (!draft.trim()) return; toast.success("Reply sent"); setDraft(""); }}
                  disabled={!draft.trim()}
                  className="inline-flex items-center justify-center h-11 w-11 rounded-full bg-gradient-tenant text-white shadow-tenant disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send reply"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1.5 px-2 text-[10px] text-muted-foreground">All replies logged to debtor timeline + audit trail</div>
            </div>
          </div>
        </PageCard>

        {detailsOpen && (
          <PageCard className="lg:col-span-3">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-display text-base font-bold tracking-tight">Lead Details</h3>
              <button
                onClick={() => setDetailsOpen(false)}
                className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
                aria-label="Close lead details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-3 py-2 max-h-[700px] overflow-y-auto">
              <Accordion type="multiple" defaultValue={["case", "additional"]} className="w-full">
                <AccordionItem value="case" className="border-border">
                  <AccordionTrigger className="px-2 hover:no-underline">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <User className="h-4 w-4 text-tenant" /> Case Info
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-2">
                    <dl className="space-y-2.5 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Debtor</dt>
                        <dd className="font-semibold text-right">{selected.debtor}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Creditor</dt>
                        <dd className="font-semibold text-right">{selected.creditor}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Case ID</dt>
                        <dd className="font-mono text-xs text-right">{selected.caseId}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Source</dt>
                        <dd><Pill tone={selected.id.charCodeAt(3) % 2 === 0 ? "tenant" : "info"}>{selected.id.charCodeAt(3) % 2 === 0 ? "CRM" : "CSV"}</Pill></dd>
                      </div>
                      <div className="pt-2 border-t border-border">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Contacts</div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{selected.debtor.toLowerCase().replace(/\s+/g, ".")}@example.com</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>(416) 555-0{(selected.id.charCodeAt(3) % 900 + 100).toString().padStart(3, "0")}</span>
                          </div>
                        </div>
                      </div>
                    </dl>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="additional" className="border-border">
                  <AccordionTrigger className="px-2 hover:no-underline">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <FileText className="h-4 w-4 text-tenant" /> Additional Info
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-2">
                    <div className="space-y-3 text-sm">
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Allocated to</span>
                        <select
                          value={assignee[selected.id] ?? "Unassigned"}
                          onChange={(e) => setAssignee((a) => ({ ...a, [selected.id]: e.target.value }))}
                          className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm"
                        >
                          {AGENTS.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </label>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Status</span>
                        <Pill tone={STATUS_TONE[selected.status]}>{selected.status}</Pill>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1.5">Flags</div>
                        <div className="flex flex-wrap gap-1">
                          {selected.flags.length > 0 ? selected.flags.map((f) => (
                            <Pill key={f} tone="warning">{f}</Pill>
                          )) : <span className="text-xs text-muted-foreground">None</span>}
                        </div>
                      </div>
                      <div className="flex justify-between gap-3 pt-2 border-t border-border">
                        <span className="text-muted-foreground">File received</span>
                        <span className="text-xs text-right">{new Date(selected.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="timeline" className="border-border">
                  <AccordionTrigger className="px-2 hover:no-underline">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <Clock className="h-4 w-4 text-tenant" /> Timeline
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-2">
                    <ol className="relative border-l-2 border-border ml-2 space-y-3">
                      {[
                        { label: "Reply received", ts: selected.receivedAt, tone: "tenant" as const },
                        { label: "Outbound message sent", ts: "Yesterday 10:14", tone: "muted" as const },
                        { label: `Status set to ${selected.status}`, ts: "2 days ago", tone: "info" as const },
                        { label: "File ingested", ts: new Date(selected.timestamp).toLocaleDateString(), tone: "muted" as const },
                      ].map((e, i) => (
                        <li key={i} className="ml-3">
                          <span className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-tenant" />
                          <div className="text-sm font-semibold">{e.label}</div>
                          <div className="text-[11px] text-muted-foreground">{e.ts}</div>
                        </li>
                      ))}
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="notes" className="border-border border-b-0">
                  <AccordionTrigger className="px-2 hover:no-underline">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <StickyNote className="h-4 w-4 text-tenant" /> Notes
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-2">
                    <div className="space-y-2">
                      {(notesByCase[selected.id] ?? []).map((n) => (
                        <div key={n.id} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-tenant">{n.author}</span>
                            <button
                              onClick={() => setNotesByCase((m) => ({ ...m, [selected.id]: (m[selected.id] ?? []).filter((x) => x.id !== n.id) }))}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="Delete note"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="text-sm mt-0.5">{n.text}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">{n.ts}</div>
                        </div>
                      ))}
                      {(notesByCase[selected.id] ?? []).length === 0 && (
                        <div className="text-xs text-muted-foreground italic px-1 py-2">No notes yet</div>
                      )}
                      <div className="flex items-end gap-2 pt-2">
                        <textarea
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Add a note…"
                          rows={2}
                          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-tenant resize-none"
                        />
                        <button
                          onClick={() => {
                            if (!newNote.trim()) return;
                            const note = { id: `n-${Date.now()}`, text: newNote.trim(), author: "You", ts: new Date().toLocaleString() };
                            setNotesByCase((m) => ({ ...m, [selected.id]: [note, ...(m[selected.id] ?? [])] }));
                            setNewNote("");
                            toast.success("Note added");
                          }}
                          disabled={!newNote.trim()}
                          className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-tenant text-white shadow-tenant disabled:opacity-40"
                          aria-label="Add note"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </PageCard>
        )}
      </section>
    </Shell>
  );
}
