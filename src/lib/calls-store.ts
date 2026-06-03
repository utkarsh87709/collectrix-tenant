// Epic 11 — Call Recording & Transcription, scoped per debtor.
// Every recording belongs to a debtor (debtorId). Includes transcript + AI summary.

import { useSyncExternalStore } from "react";
import { debtors } from "@/lib/intake-mock";

export type CallDirection = "outbound" | "inbound";
export type CallChannel = "ai_voice" | "human_agent";
export type CallOutcome =
  | "payment"
  | "promise"
  | "rpc"
  | "voicemail"
  | "no_answer"
  | "wrong_number"
  | "disconnected"
  | "cease"
  | "dispute";

export type TranscriptTurn = {
  speaker: "agent" | "debtor";
  speakerName?: string;
  text: string;
  startSec: number;
  endSec?: number;
  sentiment?: number; // -1..1
  flagged?: boolean;
  flagNote?: string;
};

export type CallAISummary = {
  headline: string;            // 1-line summary
  overview: string;            // 2-3 sentence narrative
  keyPoints: string[];         // bullet highlights
  nextSteps: string[];         // recommended actions
  sentimentOverall: "positive" | "neutral" | "negative";
  topics: string[];            // detected topics e.g. "Payment plan", "Hardship"
  complianceFlags: string[];   // e.g. "Mini-Miranda delivered", "Cease request"
  qaScore: number;             // 0–100
  promisedAmount?: string;
  promisedDate?: string;
  generatedBy: string;         // model name
  generatedAt: string;
};

export type CallRecord = {
  id: string;
  debtorId: string;
  debtorName: string;
  direction: CallDirection;
  channel: CallChannel;
  agentName: string;        // AI voice or human
  phone: string;
  startedAt: string;        // ISO-ish display string
  durationSec: number;
  language: string;
  outcome: CallOutcome;
  recordingUrl: string;
  recordingSizeMb: number;
  retentionUntil: string;
  legalHold: boolean;
  flagged: boolean;
  flagReason?: string;
  campaign?: string;
  transcript: TranscriptTurn[];
  summary: CallAISummary;
  audit: { ts: string; actor: string; action: string }[];
};

// ── Seed helpers ──────────────────────────────────────────────────────────────

function fmt(d: Date) {
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function daysAgo(n: number, hour = 10, min = 30) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, min, 0, 0);
  return fmt(d);
}

function makeSeed(): CallRecord[] {
  const out: CallRecord[] = [];
  let counter = 9000;

  // Build 2-4 calls per debtor with varied outcomes + transcripts.
  for (const d of debtors) {
    const calls = 2 + (d.id.charCodeAt(d.id.length - 1) % 3);
    for (let i = 0; i < calls; i++) {
      counter += 1;
      const id = `cr-${counter}`;
      const isAi = i % 2 === 0;
      const isPaid = d.status === "paid" && i === 0;
      const isLegal = d.legalHold;

      const outcome: CallOutcome = isLegal
        ? "cease"
        : isPaid
        ? "payment"
        : i === 0
        ? "promise"
        : i === 1
        ? "rpc"
        : "voicemail";

      const transcript = buildTranscript(d.name, outcome);
      const summary = buildSummary(d.name, outcome, d.balance);
      const dur = transcript.reduce((m, t) => Math.max(m, (t.endSec ?? t.startSec) + 4), 0);

      out.push({
        id,
        debtorId: d.id,
        debtorName: d.name,
        direction: "outbound",
        channel: isAi ? "ai_voice" : "human_agent",
        agentName: isAi ? "Aria · AI Voice" : i === 1 ? "M. Lindstrom" : "J. Owens",
        phone: "+1 (416) 555-" + String(1000 + (counter % 9000)).padStart(4, "0"),
        startedAt: daysAgo(i * 3 + (counter % 3), 9 + (i % 6), (counter * 7) % 60),
        durationSec: dur,
        language: "en-US",
        outcome,
        recordingUrl: `/mock/${id}.mp3`,
        recordingSizeMb: Math.round((dur / 60) * 0.95 * 10) / 10,
        retentionUntil: isLegal ? "legal_hold" : "2033-04-01",
        legalHold: isLegal,
        flagged: outcome === "cease",
        flagReason: outcome === "cease" ? "Cease request — auto-DNC applied" : undefined,
        campaign: isAi ? "May Statement Cycle" : undefined,
        transcript,
        summary,
        audit: [
          { ts: daysAgo(i * 3, 9, 0), actor: "system", action: "Recording stored (AES-256)" },
          { ts: daysAgo(i * 3, 9, 1), actor: "system", action: "Transcript generated · diarized" },
          { ts: daysAgo(i * 3, 9, 2), actor: "openai/gpt-5-mini", action: "AI summary generated" },
        ],
      });
    }
  }
  return out;
}

function buildTranscript(debtorName: string, outcome: CallOutcome): TranscriptTurn[] {
  const first = debtorName.split(" ")[0];
  if (outcome === "cease") {
    return [
      { speaker: "agent", text: `Hello, this is Aria from Apex Recovery. Am I speaking with ${debtorName}?`, startSec: 0, endSec: 5 },
      { speaker: "debtor", text: "Yes — please stop calling me about this account.", startSec: 6, endSec: 11, sentiment: -0.7, flagged: true, flagNote: "Cease request detected" },
      { speaker: "agent", text: "I understand. I am noting your cease request now. You will not receive further calls.", startSec: 12, endSec: 19 },
      { speaker: "debtor", text: "Thank you. Goodbye.", startSec: 20, endSec: 22, sentiment: -0.2 },
    ];
  }
  if (outcome === "payment") {
    return [
      { speaker: "agent", text: `Hello ${first}, this is Aria from Apex Recovery regarding your account. This call is being recorded.`, startSec: 0, endSec: 7 },
      { speaker: "debtor", text: "Hi, yes that's me.", startSec: 8, endSec: 11, sentiment: 0.1 },
      { speaker: "agent", text: "Your balance is the amount on file. Would you like to pay in full today?", startSec: 12, endSec: 19 },
      { speaker: "debtor", text: "Yes, I can pay it in full right now.", startSec: 20, endSec: 24, sentiment: 0.6 },
      { speaker: "agent", text: "Wonderful. I will collect your card information securely.", startSec: 25, endSec: 31 },
      { speaker: "debtor", text: "Okay one moment.", startSec: 32, endSec: 35, sentiment: 0.4 },
    ];
  }
  if (outcome === "promise") {
    return [
      { speaker: "agent", text: `Hi ${first}, Aria from Apex Recovery. This call may be recorded.`, startSec: 0, endSec: 5 },
      { speaker: "debtor", text: "Hi.", startSec: 6, endSec: 7, sentiment: 0.0 },
      { speaker: "agent", text: "We have options to resolve your account. Can you make a payment this week?", startSec: 8, endSec: 14 },
      { speaker: "debtor", text: "I get paid Friday — I can pay $200 then.", startSec: 15, endSec: 21, sentiment: 0.3 },
      { speaker: "agent", text: "Great, I'll set up a promise-to-pay for $200 on Friday. Confirmation will be texted.", startSec: 22, endSec: 30 },
      { speaker: "debtor", text: "Sounds good, thanks.", startSec: 31, endSec: 33, sentiment: 0.4 },
    ];
  }
  if (outcome === "voicemail") {
    return [
      { speaker: "agent", text: `Hello, this message is for ${debtorName}. Please call Apex Recovery back at your earliest convenience. Thank you.`, startSec: 0, endSec: 12 },
    ];
  }
  // rpc / default
  return [
    { speaker: "agent", text: `Hi, may I speak with ${debtorName}?`, startSec: 0, endSec: 3 },
    { speaker: "debtor", text: "Speaking.", startSec: 4, endSec: 5, sentiment: 0.0 },
    { speaker: "agent", text: "Thank you. This call is being recorded. I'm calling regarding your account — is now a good time?", startSec: 6, endSec: 13 },
    { speaker: "debtor", text: "Not really, can you call tomorrow afternoon?", startSec: 14, endSec: 18, sentiment: 0.1 },
    { speaker: "agent", text: "Absolutely. I'll schedule a callback for tomorrow at 2pm.", startSec: 19, endSec: 24 },
  ];
}

function buildSummary(debtorName: string, outcome: CallOutcome, balance: number): CallAISummary {
  const first = debtorName.split(" ")[0];
  const bal = `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const base: CallAISummary = {
    headline: "",
    overview: "",
    keyPoints: [],
    nextSteps: [],
    sentimentOverall: "neutral",
    topics: [],
    complianceFlags: ["Mini-Miranda delivered", "Recording disclosure given"],
    qaScore: 88,
    generatedBy: "openai/gpt-5-mini",
    generatedAt: daysAgo(0, 9, 5),
  };
  switch (outcome) {
    case "payment":
      return {
        ...base,
        headline: `${first} paid balance in full (${bal}).`,
        overview: `${debtorName} confirmed identity, accepted recording disclosure, and elected to pay the full balance of ${bal} on the call. Card payment processed securely with no friction.`,
        keyPoints: [
          "Identity confirmed",
          "Mini-Miranda delivered",
          `Paid in full: ${bal}`,
          "Card-on-file authorized for payment",
        ],
        nextSteps: ["Send paid-in-full receipt", "Update status → PAID", "Close account in 7 days"],
        sentimentOverall: "positive",
        topics: ["Pay in full", "Card payment"],
        qaScore: 96,
      };
    case "promise":
      return {
        ...base,
        headline: `${first} committed to PTP for $200 on Friday.`,
        overview: `${debtorName} acknowledged the debt and agreed to a promise-to-pay of $200 once paid on Friday. Tone was cooperative throughout.`,
        keyPoints: ["Identity confirmed", "PTP captured: $200 · Friday", "Confirmation SMS scheduled"],
        nextSteps: ["Confirm PTP via SMS", "Add follow-up reminder D-1", "Re-attempt if missed by 24h"],
        sentimentOverall: "positive",
        topics: ["Promise to pay", "Hardship awareness"],
        promisedAmount: "$200.00",
        promisedDate: "This Friday",
        qaScore: 92,
      };
    case "cease":
      return {
        ...base,
        headline: "Debtor requested cease — DNC applied automatically.",
        overview: `${debtorName} requested that contact stop. The agent acknowledged immediately and ended the call respectfully. DNC flag has been applied to all channels.`,
        keyPoints: ["Cease request detected", "Auto-DNC applied", "Call ended respectfully"],
        nextSteps: ["Verify DNC propagated to dialer", "Notify creditor of cease status", "Compliance review queued"],
        sentimentOverall: "negative",
        topics: ["Cease & desist"],
        complianceFlags: ["Cease request honored", "DNC applied"],
        qaScore: 100,
      };
    case "voicemail":
      return {
        ...base,
        headline: "Voicemail left — compliant message.",
        overview: "No live contact. Compliant voicemail script delivered including callback number; no third-party disclosure.",
        keyPoints: ["Voicemail left", "No 3rd-party disclosure"],
        nextSteps: ["Re-attempt in 48h", "Try alternate channel (SMS)"],
        sentimentOverall: "neutral",
        topics: ["Voicemail"],
        qaScore: 90,
      };
    default:
      return {
        ...base,
        headline: "Right-party contact · callback scheduled.",
        overview: `Reached ${debtorName}. Not a good time to discuss; agent scheduled callback for next afternoon.`,
        keyPoints: ["RPC confirmed", "Callback scheduled"],
        nextSteps: ["Auto-call tomorrow 2pm", "Send SMS reminder 1h prior"],
        sentimentOverall: "neutral",
        topics: ["Callback"],
        qaScore: 85,
      };
  }
}

// ── Reactive store ────────────────────────────────────────────────────────────

let state: CallRecord[] = makeSeed();
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const emit = () => listeners.forEach((l) => l());
const getSnapshot = () => state;

export function useDebtorCalls(debtorId: string): CallRecord[] {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return all
    .filter((c) => c.debtorId === debtorId)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export function useCall(id: string): CallRecord | undefined {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return all.find((c) => c.id === id);
}

export function useAllCalls(): CallRecord[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function toggleCallFlag(id: string, reason?: string) {
  state = state.map((c) =>
    c.id === id
      ? { ...c, flagged: !c.flagged, flagReason: !c.flagged ? reason ?? "Manually flagged for QA" : undefined }
      : c
  );
  emit();
}

export function appendAudit(id: string, action: string, actor = "Maya Lindstrom") {
  state = state.map((c) =>
    c.id === id
      ? { ...c, audit: [{ ts: fmt(new Date()), actor, action }, ...c.audit] }
      : c
  );
  emit();
}
