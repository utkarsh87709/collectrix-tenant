// Status Automation calls to the separately-hosted backend.
//
// Automation is scoped to a TEAM + CLIENT pair (not client alone): different
// teams working the same client can need different initial statuses and
// different behaviour per status. Within a pair, every status gets its own
// automation row.
//
// Screen flow (each step verified against devapi on 2026-07-30):
//   1. POST /tenant/getclientList           {}                             -> { clientList[] }   client dropdown (+ channel gates)
//      POST /tenant/getTeamList             {}                             -> { teamList[] }     team dropdown (teams-api)
//   2. POST /tenant/getClientTeamStatusList { clientId, teamId }           -> { statusList[] }   initial-status picker
//   3. POST /tenant/checkInitialStatusUsed  { clientId, teamId, statusId } -> soft warning
//      POST /tenant/changeInitialStatus     { clientId, teamId, statusId } -> commits the pick
//   4. POST /tenant/getStatusAutomationList { clientId, teamId }           -> { statusList[] }   one row per status
//   5. POST /tenant/getStatusAutomationDetails { automationId }            -> the saved config
//      Called ONLY for rows whose automationId is non-null; a null automationId
//      means this status has never been configured for the pair.
//   6. POST /tenant/updateAutomation        { ...AutomationPayload }       -> upsert
//      Keyed on (clientId, teamId, statusId) — no automationId is sent. It is a
//      FULL replace, including followupList (rows are deleted and re-inserted),
//      so always send the complete config, never a patch.
//
// Supporting lookups:
//   POST /tenant/getClientTemplate         { clientId, templateType }  (template-library-api)
//   POST /tenant/getClientTemplate         { clientId, templateType: "document" }
//      -> the client's document templates, picked when "Generate documents" is
//      on and saved as documentTemplateId (getDocumentTemplates below).
//
// Backend behaviour worth knowing (all confirmed by probing devapi):
//   • Every duration on the wire is in MINUTES.
//   • The backend does NOT validate that a templateId belongs to the client, or
//     that a channel is one the client has switched on. Both are enforced here.
//   • enabledFlag 0 with a full config is a valid saved row, so switching a
//     status off preserves everything that was configured.
//
// Removed from Status Automation (2026-10-07): the AI voice call channel
// (initialCall* fields, "call" follow-ups) and auto-assign to a team member
// (assignUserId). Neither is read nor sent any more.
//
// Outbound calls: outboundCallEnabled + callSetting, ONE call setup per status
// (reworked 2026-10-31; the earlier list of call steps, callFollowupList, is
// gone and the backend dropped the saved steps). callSetting holds the call
// mode, AI-agent routing per business-hours window, direct-patch routing,
// timing, numbers and weekly limits — see CallSettingWire. Probed against
// devapi on 2026-11-01:
//   • The backend stores callSetting exactly as sent and validates nothing:
//     unknown keys, callMode "human", callPatchMethod "bogus" and a weekly
//     limit of "abc" were all saved. Everything is checked here.
//   • Leaving callSetting out, or sending null, wipes it (it then reads back
//     as {}), so every save sends the full setup — even with calling off.
//   • Setups saved before the rework come back as null or {}.
//   • The AI voice agent (callTemplateId) and an on/off flag (enabledFlag) sit
//     on each of assigned / unassigned files, per window — the backend dev
//     chose that over the design's one agent per window.
//   • aiAgent.afterBusiness has the same routing as duringBusiness (patch method,
//     forwarding, ring lists, assignUserFlag), saved separately per window.
//   • Ring durations are seconds; placeCallAfterMins is minutes.
//   • The retry interval travels inside callSetting as retryWholeSetupAfter
//     (minutes), the key the old call steps used. It isn't in the backend dev's
//     payload: the backend stores and returns it (verified 2026-11-03; at the
//     top level it's dropped), but whether the calling side reads it is not
//     confirmed. A saved setup without it shows an error in the Retry section.
// Supporting lookups: AI voice agents are the client's "call" templates
// (getClientTemplate), ring lists come from the team's members
// (getTeamDeckAssignUserList) and caller ids from the team's numbers
// (getTeamPhoneNumber).
import { apiFetch, apiPost } from "./api-client";

/* ------------------------------- lookups -------------------------------- */

/** A client as returned by getclientList — carries the per-client channel gates. */
export type AutomationClient = {
  clientId: number;
  clientName: string;
  clientNumber: string;
  /** 1 when the client permits this channel. Channels the client disallows
   *  cannot be automated, so the UI locks them. */
  smsEnabled: number;
  emailEnabled: number;
  callEnabled: number;
  documentEnabled: number;
};

export async function getClientList(): Promise<AutomationClient[]> {
  const res = await apiPost<{ clientList: AutomationClient[] }>("/tenant/getclientList");
  return res?.clientList ?? [];
}

/** A status in the initial-status picker for one client+team pair. */
export type ClientTeamStatus = {
  statusId: number;
  status: string;
  statusCode: string;
  statusColorCode: string;
  /** 1 on the single status new files land in for this client+team. */
  initialStatus: number;
};

export async function getClientTeamStatusList(input: {
  clientId: number;
  teamId: number;
}): Promise<ClientTeamStatus[]> {
  const res = await apiPost<{ statusList: ClientTeamStatus[] }>("/tenant/getClientTeamStatusList", {
    ...input,
  });
  return res?.statusList ?? [];
}

/** The initial status currently set for a pair, or null when unconfigured. */
export function findInitialStatus(list: ClientTeamStatus[]): ClientTeamStatus | null {
  return list.find((s) => s.initialStatus === 1) ?? null;
}

/* -------------------------- initial status change ----------------------- */

export type InitialStatusCheck = {
  /** True when the backend returned a warning to show before proceeding. */
  inUse: boolean;
  message: string;
};

/**
 * Soft pre-flight for an initial-status change, called with the status the user
 * just picked. A false meta.status carries a human-readable warning (e.g.
 * "Current Status is already assgined to 8 debtor(s) for this client and team.
 * changing the status will not change the initial status for those debtors. Do
 * you want to proceed?") — advisory, not a block, so this resolves instead of
 * throwing and the caller offers a confirm. Genuine transport failures throw.
 */
export async function checkInitialStatusUsed(input: {
  clientId: number;
  teamId: number;
  statusId: number;
}): Promise<InitialStatusCheck> {
  const res = await apiFetch<{ meta?: { status?: boolean; message?: string } }>(
    "/tenant/checkInitialStatusUsed",
    { method: "POST", body: JSON.stringify(input) },
  );
  const ok = res?.meta?.status === true;
  return { inUse: !ok, message: res?.meta?.message ?? "" };
}

/**
 * Commits the initial status for a client+team. Exclusive: the previously
 * flagged status drops back to initialStatus 0. Applies to files assigned from
 * now on — debtors already on the old status keep it.
 */
export function changeInitialStatus(input: {
  clientId: number;
  teamId: number;
  statusId: number;
}): Promise<unknown> {
  return apiPost("/tenant/changeInitialStatus", { ...input });
}

/* ---------------------------- automation list --------------------------- */

/** One row of the per-status automation table for a client+team pair. */
export type StatusAutomationRow = {
  /** null until this status has been saved once for the pair. When non-null it
   *  is the handle getStatusAutomationDetails takes. */
  automationId: number | null;
  statusId: number;
  status: string;
  statusCode: string;
  statusColorCode: string;
  /** 1 when this status has automation switched on. */
  enabledFlag: number;
};

export async function getStatusAutomationList(input: {
  clientId: number;
  teamId: number;
}): Promise<StatusAutomationRow[]> {
  const res = await apiPost<{ statusList: StatusAutomationRow[] }>(
    "/tenant/getStatusAutomationList",
    { ...input },
  );
  return res?.statusList ?? [];
}

/* ------------------------------- wire types ----------------------------- */

export type ChannelKey = "email" | "sms";

/**
 * Where an outbound message's body comes from:
 *   "template" — a fixed body from the Template Library (email/sms type).
 *   "ai"       — generated at send time from an aiPrompt library entry.
 */
export type MessageSource = "template" | "ai";

/** One follow-up as stored by the backend. Times are minutes. */
export type AutomationFollowup = {
  followupId?: number;
  automationId?: number;
  followupChannel: ChannelKey;
  followupTime: number;
  followupMsgSource: MessageSource;
  followupTemplateId: number | null;
};

/** "ai": an AI voice agent places the call and can hand it to a person.
 *  "directPatch": the call goes straight to a person — no agent. */
export type CallMode = "ai" | "directPatch";
/** Who is rung when the customer's file already sits with a team member. */
export type AssignedPatchMethod = "exactMatch" | "roundRobin" | "ringAll";
/** Who is rung when the file is with the team but not with a member yet. */
export type UnassignedPatchMethod = "roundRobin" | "ringAll" | "manual";
/** Where the member who is patched in picks up. */
export type AnsweringDevice = "phone" | "browser";

/** Customer phone fields a call can dial, by data-field name. */
export const CUSTOMER_NUMBER_FIELDS = ["Mobile number 1", "Mobile number 2", "Home Number"];

/** A ring setting as it travels; null for a method that isn't chosen. */
export type RingWire = { ringDuration: number | null; ringTimes: number | null };
export type RoundRobinWire = RingWire & { userIdList: number[] };
export type ManualDialWire = { userId: number; dialDuration: number; dialTimes: number };

/** Who is rung when the assigned member doesn't pick up (exact match only). */
export type CallForwardingWire = {
  callPatchMethod: UnassignedPatchMethod;
  roundRobin: RoundRobinWire;
  ringAll: RingWire;
  manual: ManualDialWire[];
};

export type AssignedFilesWire = {
  /** 1 = calls are placed for files that sit with a team member. */
  enabledFlag: number;
  callPatchMethod: AssignedPatchMethod;
  exactMatch: RingWire & { callForwarding: CallForwardingWire };
  roundRobin: RoundRobinWire;
  ringAll: RingWire;
  /** AI agent mode only: the `call` template that places the call. */
  callTemplateId?: number | null;
};

export type UnassignedFilesWire = {
  /** 1 = calls are placed for files with the team but no member yet. */
  enabledFlag: number;
  /** 1 = the member who answers is offered "assign this file to me". */
  assignUserFlag: number;
  callPatchMethod: UnassignedPatchMethod;
  roundRobin: RoundRobinWire;
  ringAll: RingWire;
  manual: ManualDialWire[];
  /** AI agent mode only. */
  callTemplateId?: number | null;
};

export type FilesWire = { assignedFiles: AssignedFilesWire; unAssignedFiles: UnassignedFilesWire };

/** A status' outbound call setup, as sent in updateAutomation and returned by
 *  getStatusAutomationDetails. */
export type CallSettingWire = {
  callMode: CallMode;
  aiAgent: { duringBusiness: FilesWire; afterBusiness: FilesWire };
  directPatch: FilesWire & { greetingMessage: string | null; noAnswerMessage: string | null };
  placeCallAfterMins: number;
  /** Minutes before the next attempt when a call doesn't reach a conversation. */
  retryWholeSetupAfter: number | null;
  /** Caller ids (phoneNoId); calls are spread across them. */
  phoneIdList: number[];
  /** CUSTOMER_NUMBER_FIELDS, in dialling order. */
  customerCallNumbers: string[];
  /** Calls per customer file in a rolling 7 days, before / after Right Party
   *  Verification. The after-RPV limit is fixed (WEEKLY_MAX_AFTER_RPV). */
  weeklyMaxCallBeforeRpv: number;
  weeklyMaxCallAfterRpv: number;
};

/** What a saved callSetting may actually hold: the backend keeps whatever was
 *  sent, so any part can be missing or null. */
export type Loose<T> = T extends (infer U)[]
  ? Loose<U>[]
  : T extends object
    ? { [K in keyof T]?: Loose<T[K]> | null }
    : T;

/** getStatusAutomationDetails response — the saved row, flat. */
export type AutomationDetails = {
  automationId: number;
  createdAt: string;
  updatedAt: string;
  statusId: number;
  clientId: number;
  teamId: number;
  enabledFlag: number;

  initialEmailEnabled: number;
  /** Minutes after entering the status. */
  initialEmailFollowupTime: number | null;
  initialEmailMsgSource: MessageSource | null;
  initialEmailTemplateId: number | null;

  initialSmsEnabled: number;
  initialSmsFollowupTime: number | null;
  initialSmsMsgSource: MessageSource | null;
  initialSmsTemplateId: number | null;

  generateDocumentEnabled: number;
  /** The document template generated on entry; null when generation is off. */
  documentTemplateId?: number | null;

  autoArchiveEnabled: number;
  /** Minutes in the status before archiving. */
  autoArchiveDuration: number | null;

  inactiveStatusTransitionEnabled: number;
  /** Minutes without activity before the transition fires. */
  inactiveStatusDuration: number | null;
  inactiveStatusDestinationStatusId: number | null;

  followupList: AutomationFollowup[];

  outboundCallEnabled: number;
  /** null or {} when no call setup has been saved. */
  callSetting?: Loose<CallSettingWire> | null;
};

/** updateAutomation request body. Identical to the stored row minus its ids. */
export type AutomationPayload = {
  clientId: number;
  teamId: number;
  statusId: number;
  enabledFlag: number;
  initialEmailEnabled: number;
  initialEmailFollowupTime: number | null;
  initialEmailMsgSource: MessageSource | null;
  initialEmailTemplateId: number | null;
  initialSmsEnabled: number;
  initialSmsFollowupTime: number | null;
  initialSmsMsgSource: MessageSource | null;
  initialSmsTemplateId: number | null;
  generateDocumentEnabled: number;
  documentTemplateId: number | null;
  autoArchiveEnabled: number;
  autoArchiveDuration: number | null;
  inactiveStatusTransitionEnabled: number;
  inactiveStatusDuration: number | null;
  inactiveStatusDestinationStatusId: number | null;
  followupList: {
    followupChannel: ChannelKey;
    followupTime: number;
    followupMsgSource: MessageSource;
    followupTemplateId: number | null;
  }[];
  outboundCallEnabled: number;
  /** Always sent: leaving it out wipes the saved setup. */
  callSetting: CallSettingWire | null;
};

/** Loads one status' saved configuration. Only call this when the list row's
 *  automationId is non-null. */
export function getStatusAutomationDetails(automationId: number): Promise<AutomationDetails> {
  return apiPost<AutomationDetails>("/tenant/getStatusAutomationDetails", { automationId });
}

export function updateAutomation(payload: AutomationPayload): Promise<unknown> {
  return apiPost("/tenant/updateAutomation", { ...payload });
}

/** A document template from the client's library (getClientTemplate "document"). */
export type DocumentTemplateOption = { id: number; name: string };

export async function getDocumentTemplates(clientId: number): Promise<DocumentTemplateOption[]> {
  const res = await apiPost<{
    templateList?: { templateId: number; templateName: string }[];
  }>("/tenant/getClientTemplate", { clientId, templateType: "document" });
  return (res?.templateList ?? []).map((t) => ({ id: t.templateId, name: t.templateName }));
}

/* -------------------------------- durations ------------------------------ */
// The wire is minutes; the UI offers a value + unit so "3 days" doesn't have to
// be typed as 4320.

export type DurationUnit = "minutes" | "hours" | "days";
export type Duration = { value: number; unit: DurationUnit };

const MINUTES_IN: Record<DurationUnit, number> = { minutes: 1, hours: 60, days: 1440 };

export const DURATION_UNIT_LABEL: Record<DurationUnit, string> = {
  minutes: "Minutes",
  hours: "Hours",
  days: "Days",
};

export function toMinutes(d: Duration): number {
  return Math.max(0, Math.round(d.value * MINUTES_IN[d.unit]));
}

/** Renders stored minutes back in the largest unit that divides exactly, so a
 *  value saved as "3 days" comes back as days rather than 4320 minutes. */
export function fromMinutes(minutes: number | null | undefined, fallback: Duration): Duration {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return fallback;
  if (minutes === 0) return { value: 0, unit: "minutes" };
  if (minutes % MINUTES_IN.days === 0) return { value: minutes / MINUTES_IN.days, unit: "days" };
  if (minutes % MINUTES_IN.hours === 0) return { value: minutes / MINUTES_IN.hours, unit: "hours" };
  return { value: minutes, unit: "minutes" };
}

export function formatDuration(d: Duration): string {
  const unit = d.unit === "minutes" ? "min" : d.unit === "hours" ? "hr" : "day";
  return `${d.value} ${unit}${d.value === 1 ? "" : "s"}`;
}

/* ------------------------------- UI model -------------------------------- */

export type ChannelConfig = {
  enabled: boolean;
  /** Wait this long after the file enters the status before the first send. */
  startAfter: Duration;
  messageSource: MessageSource;
  /**
   * Template Library id. Which library it points into depends on the channel
   * and source: an email/sms template when source is "template", the aiPrompt
   * agent when it is "ai".
   */
  templateId: number | null;
};

export type FollowUp = {
  /** Client-side key only — the backend re-creates rows on every save. */
  key: string;
  channel: ChannelKey;
  /** Measured from entering the status, same anchor as the first send. */
  after: Duration;
  messageSource: MessageSource;
  templateId: number | null;
};

/** Ring for `seconds`, `times` over. In a round robin `times` is how often the
 *  whole list is cycled. */
export type Ring = { seconds: number; times: number };
export type RingOrder = Ring & { userIds: number[] };
export type ManualDial = { userId: number; seconds: number; times: number };

/** A ring chain for files without a member to match: unassigned files, and an
 *  exact match whose member doesn't pick up. */
export type CallForwarding = {
  method: UnassignedPatchMethod;
  roundRobin: RingOrder;
  ringAll: Ring;
  manual: ManualDial[];
};

/** Who is rung once a call reaches a person — the same fields on a status'
 *  outbound call and on a team's incoming call setting (call-configuration-api).
 *  Every setting is kept per patch method so switching methods back and forth
 *  doesn't lose input; only the chosen one is sent. */
export type CallPatching = {
  assigned: {
    method: AssignedPatchMethod;
    exactMatch: Ring;
    /** Exact match only: who is rung when the assigned member doesn't answer. */
    forwarding: CallForwarding;
    roundRobin: RingOrder;
    ringAll: Ring;
  };
  unassigned: CallForwarding & {
    /** The member who answers is offered "assign this file to me". */
    assignUser: boolean;
  };
};

/** Routing for one mode (or one business-hours window), with calls switched on
 *  or off separately for assigned and unassigned files. */
export type OutboundRouting = CallPatching & { assignedOn: boolean; unassignedOn: boolean };

export type HoursWindow = "during" | "after";

/** AI agent mode, one business-hours window: an agent per kind of file. */
export type AiWindowSetup = OutboundRouting & {
  assignedAgentId: number | null;
  unassignedAgentId: number | null;
};

/** A status' single outbound call setup (callSetting on the wire). */
export type OutboundCallSetup = {
  mode: CallMode;
  /** AI agent mode. Each business-hours window has its own agents and routing. */
  ai: Record<HoursWindow, AiWindowSetup>;
  /** Direct patch mode — inside business hours only. */
  direct: OutboundRouting & { greeting: string; noAnswerMessage: string };
  /** Measured from entering the status, like every other timing. */
  placeAfter: Duration;
  /** Wait before the next attempt when a call doesn't reach a conversation. */
  retryAfter: Duration;
  /** A saved setup came back without a retry interval. */
  retryMissing: boolean;
  callerIds: number[];
  customerNumbers: string[];
  /** Calls per customer file in a rolling 7 days until the debtor is verified. */
  weeklyMaxBeforeRpv: number;
};

/** Contacts per 7 days once the debtor is verified — fixed, not editable. */
export const WEEKLY_MAX_AFTER_RPV = 3;

export type StatusAutomationConfig = {
  statusId: number;
  /** Non-null once saved; carried so the caller knows whether details exist. */
  automationId: number | null;
  enabled: boolean;
  channels: Record<ChannelKey, ChannelConfig>;
  /** UI-only: the wire simply has an empty followupList. */
  followUpsEnabled: boolean;
  followUps: FollowUp[];
  /** setup is null until one has been saved or the call is switched on. */
  outboundCall: { enabled: boolean; setup: OutboundCallSetup | null };
  /** Generate a document on entering this status, from documentTemplateId. */
  generateDocuments: boolean;
  documentTemplateId: number | null;
  /** Drop the file out of active workload/aging (recoverable, records kept). */
  autoArchive: { enabled: boolean; after: Duration };
  /** Move the file to another status after a period of no activity. */
  inactivity: { enabled: boolean; after: Duration; toStatusId: number | null };
};

export const CHANNEL_LABEL: Record<ChannelKey, string> = {
  email: "Email",
  sms: "SMS",
};

export const CHANNEL_ORDER: ChannelKey[] = ["email", "sms"];

/**
 * Which Template Library list a channel picks from, per message source.
 * "ai" resolves to the aiPrompt library (the agents).
 */
export function templateTypeFor(
  channel: ChannelKey,
  source: MessageSource,
): "email" | "sms" | "aiPrompt" {
  if (source === "ai") return "aiPrompt";
  return channel;
}

/** Channels the selected client permits (per its *Enabled flags). */
export function allowedChannels(client: AutomationClient | null): ChannelKey[] {
  if (!client) return [];
  return CHANNEL_ORDER.filter((c) => (c === "email" ? client.emailEnabled : client.smsEnabled));
}

const DEFAULT_START: Duration = { value: 1, unit: "days" };
const DEFAULT_FOLLOWUP: Duration = { value: 3, unit: "days" };
const DEFAULT_ARCHIVE: Duration = { value: 30, unit: "days" };
const DEFAULT_INACTIVITY: Duration = { value: 30, unit: "days" };

export function emptyChannel(): ChannelConfig {
  return {
    enabled: false,
    startAfter: { ...DEFAULT_START },
    messageSource: "template",
    templateId: null,
  };
}

/** A status with automation off and nothing configured yet. */
export function emptyAutomationConfig(statusId: number): StatusAutomationConfig {
  return {
    statusId,
    automationId: null,
    enabled: false,
    channels: {
      email: emptyChannel(),
      sms: emptyChannel(),
    },
    followUpsEnabled: false,
    followUps: [],
    outboundCall: { enabled: false, setup: null },
    generateDocuments: false,
    documentTemplateId: null,
    autoArchive: { enabled: false, after: { ...DEFAULT_ARCHIVE } },
    inactivity: { enabled: false, after: { ...DEFAULT_INACTIVITY }, toStatusId: null },
  };
}

/** Stable-enough follow-up keys without reaching for a clock or RNG. */
let followUpSeq = 0;
export function newFollowUp(channel: ChannelKey): FollowUp {
  followUpSeq += 1;
  return {
    key: `fu-${followUpSeq}`,
    channel,
    after: { ...DEFAULT_FOLLOWUP },
    messageSource: "template",
    templateId: null,
  };
}

const DEFAULT_RING: Ring = { seconds: 20, times: 1 };
const DEFAULT_PLACE_CALL: Duration = { value: 1, unit: "days" };
const DEFAULT_RETRY: Duration = { value: 4, unit: "hours" };
const DEFAULT_WEEKLY_MAX_BEFORE_RPV = 5;

function newForwarding(memberIds: number[]): CallForwarding {
  return {
    method: "roundRobin",
    roundRobin: { ...DEFAULT_RING, userIds: [...memberIds] },
    ringAll: { ...DEFAULT_RING },
    manual: memberIds.map((userId) => ({ userId, ...DEFAULT_RING })),
  };
}

/** Fresh patching. `memberIds` (the team, in list order) seed every ring list,
 *  so a member is taken out of the rotation rather than added to it. */
export function newCallPatching(memberIds: number[]): CallPatching {
  return {
    assigned: {
      method: "exactMatch",
      exactMatch: { ...DEFAULT_RING },
      forwarding: newForwarding(memberIds),
      roundRobin: { ...DEFAULT_RING, userIds: [...memberIds] },
      ringAll: { ...DEFAULT_RING },
    },
    unassigned: { ...newForwarding(memberIds), assignUser: true },
  };
}

export function newRouting(memberIds: number[]): OutboundRouting {
  return { ...newCallPatching(memberIds), assignedOn: true, unassignedOn: true };
}

export function newAiWindow(memberIds: number[]): AiWindowSetup {
  return { ...newRouting(memberIds), assignedAgentId: null, unassignedAgentId: null };
}

/** A fresh outbound call setup, its ring lists seeded from `memberIds`. */
export function newOutboundSetup(memberIds: number[]): OutboundCallSetup {
  return {
    mode: "ai",
    ai: { during: newAiWindow(memberIds), after: newAiWindow(memberIds) },
    direct: { ...newRouting(memberIds), greeting: "", noAnswerMessage: "" },
    placeAfter: { ...DEFAULT_PLACE_CALL },
    retryAfter: { ...DEFAULT_RETRY },
    retryMissing: false,
    callerIds: [],
    customerNumbers: [],
    weeklyMaxBeforeRpv: DEFAULT_WEEKLY_MAX_BEFORE_RPV,
  };
}

/* -------------------------------- mapping -------------------------------- */

/**
 * Outreach (initial-contact) channels only: "ai" is hidden in that part of the
 * UI for now, so a row saved as "ai" loads as "template". Its templateId
 * pointed at the aiPrompt library, not the channel's template library, so it
 * can't carry over. Follow-ups support "ai" directly and skip this conversion
 * — see configFromDetails.
 */
function textChannelSource(
  saved: MessageSource | null,
  templateId: number | null,
): { messageSource: MessageSource; templateId: number | null } {
  if (saved === "ai") return { messageSource: "template", templateId: null };
  return { messageSource: saved ?? "template", templateId };
}

/** A stored ring setting, with defaults for whatever is null (an unused method). */
export const ringFrom = (
  seconds: number | null | undefined,
  times: number | null | undefined,
): Ring => ({
  seconds: seconds ?? DEFAULT_RING.seconds,
  times: times ?? DEFAULT_RING.times,
});

const ASSIGNED_METHODS: AssignedPatchMethod[] = ["exactMatch", "roundRobin", "ringAll"];
const UNASSIGNED_METHODS: UnassignedPatchMethod[] = ["roundRobin", "ringAll", "manual"];

/** `value` when it is one of `list`, else `fallback` (the backend stores any string). */
const oneOf = <T extends string>(list: T[], value: unknown, fallback: T): T =>
  list.includes(value as T) ? (value as T) : fallback;
const numberOrNull = (v: unknown): number | null => (typeof v === "number" ? v : null);
const numbers = (v: unknown): number[] =>
  Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : [];

const ringFromWire = (r: Loose<RingWire> | null | undefined): Ring =>
  ringFrom(r?.ringDuration, r?.ringTimes);

export const orderFromWire = (r: Loose<RoundRobinWire> | null | undefined): RingOrder => ({
  ...ringFromWire(r),
  userIds: numbers(r?.userIdList),
});

function forwardingFromWire(f: Loose<CallForwardingWire> | null | undefined): CallForwarding {
  return {
    method: oneOf(UNASSIGNED_METHODS, f?.callPatchMethod, "roundRobin"),
    roundRobin: orderFromWire(f?.roundRobin),
    ringAll: ringFromWire(f?.ringAll),
    manual: (f?.manual ?? []).flatMap((m) =>
      typeof m?.userId === "number"
        ? [{ userId: m.userId, ...ringFrom(m.dialDuration, m.dialTimes) }]
        : [],
    ),
  };
}

export function routingFromWire(f: Loose<FilesWire> | null | undefined): OutboundRouting {
  const a = f?.assignedFiles;
  const u = f?.unAssignedFiles;
  return {
    assigned: {
      method: oneOf(ASSIGNED_METHODS, a?.callPatchMethod, "exactMatch"),
      exactMatch: ringFromWire(a?.exactMatch),
      forwarding: forwardingFromWire(a?.exactMatch?.callForwarding),
      roundRobin: orderFromWire(a?.roundRobin),
      ringAll: ringFromWire(a?.ringAll),
    },
    unassigned: { ...forwardingFromWire(u), assignUser: u?.assignUserFlag === 1 },
    assignedOn: a?.enabledFlag === 1,
    unassignedOn: u?.enabledFlag === 1,
  };
}

export function aiWindowFromWire(f: Loose<FilesWire> | null | undefined): AiWindowSetup {
  return {
    ...routingFromWire(f),
    assignedAgentId: numberOrNull(f?.assignedFiles?.callTemplateId),
    unassignedAgentId: numberOrNull(f?.unAssignedFiles?.callTemplateId),
  };
}

/** Saved callSetting → editor model. null when none was saved (null or {}). */
export function outboundSetupFromWire(
  cs: Loose<CallSettingWire> | null | undefined,
): OutboundCallSetup | null {
  if (!cs?.callMode) return null;
  const weekly = cs.weeklyMaxCallBeforeRpv;
  const retry = cs.retryWholeSetupAfter;
  const hasRetry = typeof retry === "number" && retry > 0;
  return {
    mode: cs.callMode === "directPatch" ? "directPatch" : "ai",
    ai: {
      during: aiWindowFromWire(cs.aiAgent?.duringBusiness),
      after: aiWindowFromWire(cs.aiAgent?.afterBusiness),
    },
    direct: {
      ...routingFromWire(cs.directPatch),
      greeting: cs.directPatch?.greetingMessage ?? "",
      noAnswerMessage: cs.directPatch?.noAnswerMessage ?? "",
    },
    placeAfter: fromMinutes(cs.placeCallAfterMins, { ...DEFAULT_PLACE_CALL }),
    // Left empty when missing rather than defaulted, so nobody saves an interval
    // they never chose.
    retryAfter: hasRetry ? fromMinutes(retry, DEFAULT_RETRY) : { value: 0, unit: "hours" },
    retryMissing: !hasRetry,
    callerIds: numbers(cs.phoneIdList),
    customerNumbers: (cs.customerCallNumbers ?? []).filter(
      (n): n is string => typeof n === "string",
    ),
    weeklyMaxBeforeRpv:
      typeof weekly === "number" && weekly > 0 ? weekly : DEFAULT_WEEKLY_MAX_BEFORE_RPV,
  };
}

/** Saved row → editor model. */
export function configFromDetails(d: AutomationDetails): StatusAutomationConfig {
  const base = emptyAutomationConfig(d.statusId);
  // Rows saved while the voice channel existed may still hold "call"
  // follow-ups; they are dropped here and disappear on the next save.
  const followUps = (d.followupList ?? [])
    .filter((f) => CHANNEL_ORDER.includes(f.followupChannel))
    .map((f) => {
      followUpSeq += 1;
      return {
        key: `fu-${followUpSeq}`,
        channel: f.followupChannel,
        after: fromMinutes(f.followupTime, { ...DEFAULT_FOLLOWUP }),
        messageSource: f.followupMsgSource ?? "template",
        // AI-generated follow-ups no longer pick an aiPrompt (the field is
        // hidden), so one saved before that is dropped on the next save.
        templateId: f.followupMsgSource === "ai" ? null : (f.followupTemplateId ?? null),
      };
    });

  return {
    statusId: d.statusId,
    automationId: d.automationId,
    enabled: d.enabledFlag === 1,
    channels: {
      email: {
        enabled: d.initialEmailEnabled === 1,
        startAfter: fromMinutes(d.initialEmailFollowupTime, base.channels.email.startAfter),
        ...textChannelSource(d.initialEmailMsgSource, d.initialEmailTemplateId ?? null),
      },
      sms: {
        enabled: d.initialSmsEnabled === 1,
        startAfter: fromMinutes(d.initialSmsFollowupTime, base.channels.sms.startAfter),
        ...textChannelSource(d.initialSmsMsgSource, d.initialSmsTemplateId ?? null),
      },
    },
    followUpsEnabled: followUps.length > 0,
    followUps,
    outboundCall: {
      enabled: d.outboundCallEnabled === 1,
      setup: outboundSetupFromWire(d.callSetting),
    },
    generateDocuments: d.generateDocumentEnabled === 1,
    documentTemplateId: d.documentTemplateId ?? null,
    autoArchive: {
      enabled: d.autoArchiveEnabled === 1,
      after: fromMinutes(d.autoArchiveDuration, base.autoArchive.after),
    },
    inactivity: {
      enabled: d.inactiveStatusTransitionEnabled === 1,
      after: fromMinutes(d.inactiveStatusDuration, base.inactivity.after),
      toStatusId: d.inactiveStatusDestinationStatusId ?? null,
    },
  };
}

const flag = (b: boolean) => (b ? 1 : 0);

const NO_RING: RingWire = { ringDuration: null, ringTimes: null };
const ringToWire = (r: Ring): RingWire => ({ ringDuration: r.seconds, ringTimes: r.times });
export const orderToWire = (r: RingOrder | null): RoundRobinWire =>
  r ? { ...ringToWire(r), userIdList: r.userIds } : { ...NO_RING, userIdList: [] };

/** Only the chosen method's settings carry values; the others go as nulls. */
function forwardingToWire(f: CallForwarding, used = true): CallForwardingWire {
  return {
    callPatchMethod: f.method,
    roundRobin: orderToWire(used && f.method === "roundRobin" ? f.roundRobin : null),
    ringAll: used && f.method === "ringAll" ? ringToWire(f.ringAll) : NO_RING,
    manual:
      used && f.method === "manual"
        ? f.manual.map((m) => ({ userId: m.userId, dialDuration: m.seconds, dialTimes: m.times }))
        : [],
  };
}

export function filesToWire(
  r: OutboundRouting,
  agents?: { assigned: number | null; unassigned: number | null },
): FilesWire {
  const a = r.assigned;
  const exact = a.method === "exactMatch";
  const assignedFiles: AssignedFilesWire = {
    enabledFlag: flag(r.assignedOn),
    callPatchMethod: a.method,
    exactMatch: {
      ...(exact ? ringToWire(a.exactMatch) : NO_RING),
      callForwarding: forwardingToWire(a.forwarding, exact),
    },
    roundRobin: orderToWire(a.method === "roundRobin" ? a.roundRobin : null),
    ringAll: a.method === "ringAll" ? ringToWire(a.ringAll) : NO_RING,
  };
  const unAssignedFiles: UnassignedFilesWire = {
    enabledFlag: flag(r.unassignedOn),
    assignUserFlag: flag(r.unassigned.assignUser),
    ...forwardingToWire(r.unassigned),
  };
  if (agents) {
    assignedFiles.callTemplateId = agents.assigned;
    unAssignedFiles.callTemplateId = agents.unassigned;
  }
  return { assignedFiles, unAssignedFiles };
}

/** Editor model → callSetting. Both modes are sent so switching back finds the
 *  other one as it was; callMode says which one runs. */
export function outboundSetupToWire(s: OutboundCallSetup): CallSettingWire {
  const ai = (w: HoursWindow) =>
    filesToWire(s.ai[w], {
      assigned: s.ai[w].assignedAgentId,
      unassigned: s.ai[w].unassignedAgentId,
    });
  return {
    callMode: s.mode,
    aiAgent: { duringBusiness: ai("during"), afterBusiness: ai("after") },
    directPatch: {
      greetingMessage: s.direct.greeting.trim() || null,
      noAnswerMessage: s.direct.noAnswerMessage.trim() || null,
      ...filesToWire(s.direct),
    },
    placeCallAfterMins: toMinutes(s.placeAfter),
    retryWholeSetupAfter: toMinutes(s.retryAfter) || null,
    phoneIdList: s.callerIds,
    customerCallNumbers: s.customerNumbers,
    weeklyMaxCallBeforeRpv: s.weeklyMaxBeforeRpv,
    weeklyMaxCallAfterRpv: WEEKLY_MAX_AFTER_RPV,
  };
}

/**
 * Editor model → updateAutomation body.
 *
 * `allowed` is the client's permitted channel set. The backend accepts a
 * channel the client has switched off, so anything outside `allowed` is written
 * as disabled here and its follow-ups dropped — otherwise a client-level change
 * would leave invisible automation running. Calling works the same way through
 * `callAllowed`, except the steps are kept: the backend holds them switched off.
 */
export function payloadFromConfig(
  cfg: StatusAutomationConfig,
  ctx: {
    clientId: number;
    teamId: number;
    allowed: ChannelKey[];
    documentsAllowed: boolean;
    callAllowed: boolean;
  },
): AutomationPayload {
  const on = (c: ChannelKey) => ctx.allowed.includes(c) && cfg.channels[c].enabled;
  const minutes = (c: ChannelKey) => (on(c) ? toMinutes(cfg.channels[c].startAfter) : null);
  const tmpl = (c: ChannelKey) => (on(c) ? cfg.channels[c].templateId : null);
  const source = (c: ChannelKey) => (on(c) ? cfg.channels[c].messageSource : null);

  return {
    clientId: ctx.clientId,
    teamId: ctx.teamId,
    statusId: cfg.statusId,
    enabledFlag: flag(cfg.enabled),

    initialEmailEnabled: flag(on("email")),
    initialEmailFollowupTime: minutes("email"),
    initialEmailMsgSource: source("email"),
    initialEmailTemplateId: tmpl("email"),

    initialSmsEnabled: flag(on("sms")),
    initialSmsFollowupTime: minutes("sms"),
    initialSmsMsgSource: source("sms"),
    initialSmsTemplateId: tmpl("sms"),

    generateDocumentEnabled: flag(cfg.generateDocuments && ctx.documentsAllowed),
    documentTemplateId:
      cfg.generateDocuments && ctx.documentsAllowed ? cfg.documentTemplateId : null,

    autoArchiveEnabled: flag(cfg.autoArchive.enabled),
    autoArchiveDuration: cfg.autoArchive.enabled ? toMinutes(cfg.autoArchive.after) : null,

    inactiveStatusTransitionEnabled: flag(cfg.inactivity.enabled),
    inactiveStatusDuration: cfg.inactivity.enabled ? toMinutes(cfg.inactivity.after) : null,
    inactiveStatusDestinationStatusId: cfg.inactivity.enabled ? cfg.inactivity.toStatusId : null,

    followupList: cfg.followUpsEnabled
      ? cfg.followUps
          .filter((f) => ctx.allowed.includes(f.channel))
          .map((f) => ({
            followupChannel: f.channel,
            followupTime: toMinutes(f.after),
            followupMsgSource: f.messageSource,
            followupTemplateId: f.templateId,
          }))
      : [],

    // Always sent, even while calling is off — leaving it out wipes the saved
    // setup.
    outboundCallEnabled: flag(cfg.outboundCall.enabled && ctx.callAllowed),
    callSetting: cfg.outboundCall.setup ? outboundSetupToWire(cfg.outboundCall.setup) : null,
  };
}

/* ------------------------------- validation ------------------------------ */

/**
 * Whether a channel's template id is mandatory.
 *
 * A fixed template is mandatory, but an AI-written message is allowed to go out with no aiPrompt attached — the
 * backend stores initialXMsgSource "ai" with a null templateId happily, and the
 * aiPrompt library has no management screen yet, so requiring one here would
 * lock the AI option out entirely.
 */
export function templateRequired(source: MessageSource): boolean {
  return source === "template";
}

const ringValid = (r: Ring) => r.seconds > 0 && r.times > 0;

/** What a ring chain is missing, or null. `who` names the calls it rings for. */
function validateForwarding(f: CallForwarding, who: string): string | null {
  if (f.method === "manual") {
    if (f.manual.length === 0) return `pick who is rung for ${who}.`;
    if (f.manual.some((m) => !ringValid(m))) {
      return `give every member rung for ${who} a ring time and count.`;
    }
    return null;
  }
  if (!ringValid(f[f.method])) return `set how long and how many times ${who} ring.`;
  if (f.method === "roundRobin" && f.roundRobin.userIds.length === 0) {
    return `put at least one member in the round robin for ${who}.`;
  }
  return null;
}

function validateAssigned(a: CallPatching["assigned"], forwarding: boolean): string | null {
  if (!ringValid(a[a.method])) {
    return "set how long and how many times assigned files ring.";
  }
  if (a.method === "roundRobin" && a.roundRobin.userIds.length === 0) {
    return "put at least one member in the assigned-files round robin.";
  }
  if (forwarding && a.method === "exactMatch") {
    return validateForwarding(a.forwarding, "calls the assigned member misses");
  }
  return null;
}

/** What the patching is missing, or null. Phrased to follow "<label>: ". */
export function validateCallPatching(p: CallPatching): string | null {
  return (
    validateAssigned(p.assigned, false) ?? validateForwarding(p.unassigned, "unassigned files")
  );
}

/** Only the kinds of file that are switched on need their routing filled in. */
export function validateRouting(r: OutboundRouting): string | null {
  return (
    (r.assignedOn ? validateAssigned(r.assigned, true) : null) ??
    (r.unassignedOn ? validateForwarding(r.unassigned, "unassigned files") : null)
  );
}

const WINDOW_LABEL: Record<HoursWindow, string> = {
  during: "during business hours",
  after: "after business hours",
};

/** What an outbound call setup is missing before it can run, or null. */
export function validateOutboundCall(s: OutboundCallSetup): string | null {
  const label = "Outbound call";
  if (s.mode === "ai") {
    const windows: HoursWindow[] = ["during", "after"];
    if (!windows.some((w) => s.ai[w].assignedOn || s.ai[w].unassignedOn)) {
      return `${label}: switch on calls for assigned or unassigned files.`;
    }
    for (const w of windows) {
      const x = s.ai[w];
      const where = `${label} ${WINDOW_LABEL[w]}`;
      if (x.assignedOn && !x.assignedAgentId) {
        return `${where}: choose the AI voice agent for assigned files.`;
      }
      if (x.unassignedOn && !x.unassignedAgentId) {
        return `${where}: choose the AI voice agent for unassigned files.`;
      }
      const routingError = validateRouting(x);
      if (routingError) return `${where}: ${routingError}`;
    }
  } else {
    if (!s.direct.assignedOn && !s.direct.unassignedOn) {
      return `${label}: switch on calls for assigned or unassigned files.`;
    }
    const routingError = validateRouting(s.direct);
    if (routingError) return `${label}: ${routingError}`;
  }

  if (s.callerIds.length === 0) return `${label}: pick at least one outbound caller ID.`;
  if (s.customerNumbers.length === 0) return `${label}: pick at least one customer number to call.`;
  if (toMinutes(s.retryAfter) <= 0) return `${label}: set the retry interval.`;
  if (!(s.weeklyMaxBeforeRpv >= 1)) {
    return `${label}: set the maximum calls per week before Right Party Verification.`;
  }
  return null;
}

/**
 * A status must do *something* to be worth enabling, and every switched-on
 * behaviour needs its settings filled in. Returns null when the config is
 * valid. Only enforced for enabled statuses — a switched-off status is allowed
 * to hold a half-finished draft.
 */
export function validateAutomation(
  cfg: StatusAutomationConfig,
  allowed: ChannelKey[],
  documentsAllowed = true,
  callAllowed = true,
): string | null {
  if (!cfg.enabled) return null;

  const activeChannels = allowed.filter((c) => cfg.channels[c].enabled);
  // Switched off at client level, the flag is saved as off (payloadFromConfig),
  // so it neither counts as a behaviour nor needs a template.
  const documentsOn = cfg.generateDocuments && documentsAllowed;
  const callsOn = cfg.outboundCall.enabled && callAllowed;
  const hasBehavior =
    activeChannels.length > 0 ||
    callsOn ||
    documentsOn ||
    cfg.autoArchive.enabled ||
    cfg.inactivity.enabled;
  if (!hasBehavior) {
    return "Turn on at least one behaviour (channel, outbound call, document, archive, or inactivity).";
  }

  for (const c of activeChannels) {
    const ch = cfg.channels[c];
    if (templateRequired(ch.messageSource) && !ch.templateId) {
      return `Select a template for ${CHANNEL_LABEL[c]}.`;
    }
  }

  if (callsOn) {
    // With nothing saved yet the card shows a fresh setup, so check that.
    const err = validateOutboundCall(cfg.outboundCall.setup ?? newOutboundSetup([]));
    if (err) return err;
  }

  if (cfg.followUpsEnabled) {
    if (cfg.followUps.length === 0) return "Add a follow-up, or switch follow-ups off.";
    for (const [i, fu] of cfg.followUps.entries()) {
      if (!allowed.includes(fu.channel)) {
        return `Follow-up #${i + 1} uses a channel this client has switched off.`;
      }
      if (templateRequired(fu.messageSource) && !fu.templateId) {
        return `Select a template for follow-up #${i + 1}.`;
      }
      if (toMinutes(fu.after) <= 0) return `Set when follow-up #${i + 1} should send.`;
    }
  }

  if (documentsOn && !cfg.documentTemplateId) {
    return "Select the document template to generate.";
  }
  if (cfg.autoArchive.enabled && toMinutes(cfg.autoArchive.after) <= 0) {
    return "Set how long a file waits in this status before it is archived.";
  }
  if (cfg.inactivity.enabled) {
    if (toMinutes(cfg.inactivity.after) <= 0) return "Set the inactivity period.";
    if (!cfg.inactivity.toStatusId) return "Pick the status inactive files should move to.";
  }
  return null;
}

/**
 * Channels enabled in a saved config that the client no longer permits. Saving
 * switches them off, so the card warns first.
 */
export function conflictingChannels(
  cfg: StatusAutomationConfig,
  allowed: ChannelKey[],
): ChannelKey[] {
  return CHANNEL_ORDER.filter(
    (c) =>
      !allowed.includes(c) &&
      (cfg.channels[c].enabled || cfg.followUps.some((f) => f.channel === c)),
  );
}

/** One-line summary of what a status does, for the collapsed card header. */
export function summarizeAutomation(
  cfg: StatusAutomationConfig,
  allowed: ChannelKey[],
  templateName: (id: number | null) => string,
  callAllowed = true,
): string {
  if (!cfg.enabled) return cfg.automationId == null ? "Not configured" : "Off";
  const parts: string[] = [];
  for (const c of allowed) {
    const ch = cfg.channels[c];
    if (!ch.enabled) continue;
    const src = ch.messageSource === "ai" ? "AI" : "Template";
    // An AI channel may legitimately carry no prompt — don't print a dash for it.
    const named = ch.templateId != null ? ` · ${templateName(ch.templateId)}` : "";
    parts.push(`${CHANNEL_LABEL[c]} (${src}${named} · after ${formatDuration(ch.startAfter)})`);
  }
  if (cfg.outboundCall.enabled && callAllowed) {
    const direct = cfg.outboundCall.setup?.mode === "directPatch";
    parts.push(`Outbound call (${direct ? "Direct Patch" : "AI Agent"})`);
  }
  const followUps = cfg.followUpsEnabled ? cfg.followUps.length : 0;
  if (followUps) parts.push(`${followUps} follow-up${followUps === 1 ? "" : "s"}`);
  if (cfg.generateDocuments) parts.push("Documents");
  if (cfg.autoArchive.enabled) parts.push(`Archive after ${formatDuration(cfg.autoArchive.after)}`);
  if (cfg.inactivity.enabled) {
    parts.push(`Inactive ${formatDuration(cfg.inactivity.after)}`);
  }
  return parts.length ? parts.join(" · ") : "On — no behaviours yet";
}
