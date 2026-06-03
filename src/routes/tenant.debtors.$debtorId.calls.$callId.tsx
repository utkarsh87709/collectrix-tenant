import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import {
  ChevronLeft, Play, Pause, Download, Flag, Sparkles, ShieldCheck,
  CheckCircle2, ArrowRight, Bot, User, Phone, Volume2, FileText, AlertTriangle,
} from "lucide-react";
import { useCall, toggleCallFlag, appendAudit } from "@/lib/calls-store";
import { debtors } from "@/lib/intake-mock";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/debtors/$debtorId/calls/$callId")({
  head: () => ({ meta: [{ title: "Call recording · Debtor profile" }] }),
  component: CallDetailPage,
  notFoundComponent: () => (
    <Shell>
      <div className="px-10 py-20 text-center">
        <h2 className="font-display text-2xl font-bold">Call not found</h2>
      </div>
    </Shell>
  ),
});

function fmtDur(s: number) { return `${Math.floor(s / 60)}m ${s % 60}s`; }

function CallDetailPage() {
  const { debtorId, callId } = useParams({ from: "/tenant/debtors/$debtorId/calls/$callId" });
  const call = useCall(callId);
  const debtor = debtors.find((d) => d.id === debtorId);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<"summary" | "transcript" | "audit">("summary");

  if (!call) {
    return (
      <Shell>
        <div className="px-10 py-20 text-center">
          <h2 className="font-display text-2xl font-bold">Call not found</h2>
          <Link to="/tenant/debtors/$debtorId" params={{ debtorId }} className="text-tenant hover:underline text-sm mt-2 inline-block">
            ← Back to debtor
          </Link>
        </div>
      </Shell>
    );
  }

  const sentimentTone = call.summary.sentimentOverall === "positive"
    ? "success" : call.summary.sentimentOverall === "negative" ? "danger" : "muted";

  return (
    <Shell>
      <Topbar
        title={`Call · ${call.debtorName}`}
        subtitle={`${call.id} · ${call.startedAt} · ${fmtDur(call.durationSec)} · ${call.channel === "ai_voice" ? "AI Voice" : "Human Agent"}`}
        action={
          <Link to="/tenant/debtors/$debtorId" params={{ debtorId }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
            <ChevronLeft className="h-4 w-4" /> Back to debtor
          </Link>
        }
      />

      {/* Player + meta */}
      <section className="px-6 lg:px-10 pt-6">
        <PageCard>
          <div className="px-6 py-5 flex flex-wrap items-center gap-4">
            <button
              onClick={() => { setPlaying((p) => !p); toast.message(playing ? "Paused" : `Streaming ${call.id}`); }}
              className="h-14 w-14 rounded-full bg-gradient-tenant text-white flex items-center justify-center shadow-tenant hover:opacity-90 shrink-0"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
            </button>
            <div className="flex-1 min-w-[260px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display text-lg font-bold">{call.debtorName}</span>
                <Pill tone="muted"><Phone className="h-3 w-3" /> {call.phone}</Pill>
                <Pill tone={call.channel === "ai_voice" ? "tenant" : "info"}>
                  {call.channel === "ai_voice" ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  {call.agentName}
                </Pill>
                <Pill tone={call.outcome === "payment" ? "success" : call.outcome === "cease" ? "danger" : "muted"}>
                  {call.outcome.replace("_", " ")}
                </Pill>
                {call.flagged && (
                  <Pill tone="warning"><AlertTriangle className="h-3 w-3" /> {call.flagReason ?? "Flagged"}</Pill>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {call.startedAt} · {fmtDur(call.durationSec)} · {call.language} · {call.recordingSizeMb} MB · retention {call.retentionUntil === "legal_hold" ? "legal hold" : `until ${call.retentionUntil}`}
              </div>
              {/* fake waveform */}
              <div className="mt-3 h-10 bg-muted/40 rounded-lg p-1.5 flex items-center gap-px">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-tenant/60 rounded-sm"
                    style={{ height: `${20 + Math.abs(Math.sin(i + call.durationSec / 10)) * 80}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { toast.success("Download started"); appendAudit(call.id, "Recording downloaded"); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
              >
                <Download className="h-4 w-4" /> Download
              </button>
              <button
                onClick={() => { toggleCallFlag(call.id); toast.message(call.flagged ? "Flag cleared" : "Flagged for QA"); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
              >
                <Flag className="h-4 w-4" /> {call.flagged ? "Unflag" : "Flag for QA"}
              </button>
            </div>
          </div>
        </PageCard>
      </section>

      {/* Tabs */}
      <section className="px-6 lg:px-10 pt-6">
        <div className="flex items-center gap-1 border-b border-border">
          {[
            { k: "summary", label: "AI summary", icon: Sparkles },
            { k: "transcript", label: "Transcript", icon: FileText },
            { k: "audit", label: "Audit", icon: ShieldCheck },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as typeof tab)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px transition ${
                tab === t.k ? "border-tenant text-tenant font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="px-6 lg:px-10 py-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {tab === "summary" && (
          <>
            <PageCard className="lg:col-span-2">
              <CardHead
                title="AI summary"
                subtitle={`Generated by ${call.summary.generatedBy} · ${call.summary.generatedAt}`}
                action={<Pill tone="tenant"><Sparkles className="h-3 w-3" /> AI-generated</Pill>}
              />
              <div className="px-6 py-5 space-y-5">
                <div className="rounded-xl bg-tenant-soft border border-tenant/20 p-4">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-tenant mb-1">Headline</div>
                  <div className="font-display text-lg font-bold leading-snug">{call.summary.headline}</div>
                  <p className="text-sm text-muted-foreground mt-2">{call.summary.overview}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Key points</div>
                    <ul className="space-y-1.5 text-sm">
                      {call.summary.keyPoints.map((k) => (
                        <li key={k} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                          <span>{k}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Recommended next steps</div>
                    <ul className="space-y-1.5 text-sm">
                      {call.summary.nextSteps.map((k) => (
                        <li key={k} className="flex items-start gap-2">
                          <ArrowRight className="h-4 w-4 text-tenant mt-0.5 shrink-0" />
                          <span>{k}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {(call.summary.promisedAmount || call.summary.promisedDate) && (
                  <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
                    <b>Promise to pay captured:</b> {call.summary.promisedAmount} on {call.summary.promisedDate}
                  </div>
                )}

                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Topics</div>
                  <div className="flex flex-wrap gap-1.5">
                    {call.summary.topics.map((t) => <Pill key={t} tone="muted">{t}</Pill>)}
                  </div>
                </div>
              </div>
            </PageCard>

            <div className="space-y-4">
              <PageCard>
                <CardHead title="Quality" />
                <div className="px-6 py-5 space-y-3 text-sm">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">QA score</div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="font-display text-3xl font-bold">{call.summary.qaScore}</div>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-gradient-tenant" style={{ width: `${call.summary.qaScore}%` }} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Overall sentiment</div>
                    <Pill tone={sentimentTone}>{call.summary.sentimentOverall}</Pill>
                  </div>
                </div>
              </PageCard>

              <PageCard>
                <CardHead title="Compliance" />
                <ul className="px-6 py-4 space-y-1.5 text-sm">
                  {call.summary.complianceFlags.map((c) => (
                    <li key={c} className="flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </PageCard>
            </div>
          </>
        )}

        {tab === "transcript" && (
          <PageCard className="lg:col-span-3">
            <CardHead
              title="Transcript"
              subtitle="Diarized · per-turn sentiment"
              action={<Pill tone="muted"><Volume2 className="h-3 w-3" /> {call.language}</Pill>}
            />
            <div className="px-6 py-5 space-y-3">
              {call.transcript.map((t, i) => {
                const isAgent = t.speaker === "agent";
                return (
                  <div key={i} className={`flex ${isAgent ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm ${isAgent ? "bg-tenant-soft" : "bg-muted"} ${t.flagged ? "ring-2 ring-warning" : ""}`}>
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                          {isAgent ? `Agent · ${call.agentName}` : `Debtor · ${call.debtorName}`} · {t.startSec}s
                        </span>
                        {t.sentiment !== undefined && (
                          <span className={`text-[10px] font-bold ${t.sentiment > 0.2 ? "text-success" : t.sentiment < -0.2 ? "text-destructive" : "text-muted-foreground"}`}>
                            {t.sentiment > 0 ? "+" : ""}{t.sentiment.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <div>{t.text}</div>
                      {t.flagged && (
                        <div className="mt-2 text-[11px] text-warning-foreground bg-warning/15 rounded px-2 py-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {t.flagNote}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </PageCard>
        )}

        {tab === "audit" && (
          <PageCard className="lg:col-span-3">
            <CardHead title="Audit trail" subtitle="Every access and system event for this recording" />
            <ul className="divide-y divide-border">
              {call.audit.map((a, i) => (
                <li key={i} className="px-6 py-3 flex items-start gap-3 text-sm">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold">{a.action}</div>
                    <div className="text-[11px] text-muted-foreground">{a.actor} · {a.ts}</div>
                  </div>
                </li>
              ))}
            </ul>
          </PageCard>
        )}
      </section>

      {debtor && (
        <section className="px-6 lg:px-10 pb-10">
          <Link
            to="/tenant/debtors/$debtorId"
            params={{ debtorId }}
            className="text-xs text-tenant hover:underline"
          >
            ← View all calls for {debtor.name}
          </Link>
        </section>
      )}
    </Shell>
  );
}
