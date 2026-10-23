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
// Outbound calls (added 2026-10-22) replace that channel: outboundCallEnabled +
// callFollowupList, one row per call step, on both updateAutomation and
// getStatusAutomationDetails. Probed against devapi on 2026-10-22:
//   • answeringDevice is REQUIRED although the Postman body omits it — leaving
//     it out fails with "Server Error". Only "phone" and "browser" are kept;
//     anything else is stored as "".
//   • callMode, placeCallAfterMins and both *HrFlag fields must be non-null.
//   • assignedRoundRobinUserId / unAssignedRoundRobinUserId (also missing from
//     Postman) are the round-robin ring order: arrays of userIds.
//   • Ring durations are seconds; placeCallAfterMins and retryWholeSetupAfter
//     are minutes. retryWholeSetupMaxTry (added 2026-10-23) caps how many
//     times the step is retried; both are null when retry is off.
//   • Steps come back in the order they were sent.
//   • outboundCallEnabled 0 keeps the steps; omitting callFollowupList deletes
//     them, so every save must send the full list.
//   • Not transactional: a step that fails leaves the earlier ones saved, so
//     the payload must never carry the null values above.
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
 *  "directPatch": the call goes straight to a person — no agent, no greeting. */
export type CallMode = "ai" | "directPatch";
/** Who is rung when the customer's file already sits with a team member. */
export type AssignedPatchMethod = "exactMatch" | "roundRobin" | "ringAll";
/** Who is rung when the file is with the team but not with a member yet. */
export type UnassignedPatchMethod = "roundRobin" | "ringAll" | "manual";
/** Where the member who is patched in picks up. */
export type AnsweringDevice = "phone" | "browser";

/** Customer phone fields a step can dial, by data-field name. */
export const CUSTOMER_NUMBER_FIELDS = ["Mobile number 1", "Mobile number 2", "Home Number"];

/** Call outcomes that move a step on to the customer's next number. */
export const TRY_NEXT_REASONS = [
  "No answer",
  "Busy",
  "Failed / unreachable",
  "Disconnected / invalid",
  "Voicemail detected",
];

/** One outbound call step as stored. Ring durations are seconds. */
export type AutomationCallStep = {
  callFollowupId?: number;
  automationId?: number;
  callStepName: string | null;
  callStepDescription: string | null;
  callMode: CallMode;
  /** A `call` library entry (AI voice agent); null in directPatch mode. */
  callTemplateId: number | null;
  assignedFileCallPatchMethod: AssignedPatchMethod | null;
  assignedExactMatchRingDuration: number | null;
  assignedExactMatchRingTimes: number | null;
  assignedRoundRobinRingDuration: number | null;
  assignedRoundRobinRingCycleTimes: number | null;
  /** Ring order, first to last. */
  assignedRoundRobinUserId: number[] | null;
  assignedRingAllDuration: number | null;
  assignedRingAllTimes: number | null;
  unAssignedFileCallPatchMethod: UnassignedPatchMethod | null;
  unAssignedRoundRobinRingDuration: number | null;
  unAssignedRoundRobinRingCycleTimes: number | null;
  unAssignedRoundRobinUserId: number[] | null;
  unAssignedRingAllDuration: number | null;
  unAssignedRingAllTimes: number | null;
  /** Ring order, first to last, each member with their own timing. */
  unAssignedManualConfiguration:
    | { userId: number; dialDuration: number; dialTimes: number }[]
    | null;
  /** Said to the customer when nobody picks up. */
  noAnswerMessage: string | null;
  placeCallAfterMins: number;
  /** 1 = only inside the tenant's business hours (General Settings → Hours). */
  callDuringTenantHrFlag: number;
  /** 1 = read those hours in the customer's time zone. */
  callDuringLeadHrFlag: number;
  /** Caller ids (phoneNoId); calls are spread across them. */
  phoneIdList: number[] | null;
  /** CUSTOMER_NUMBER_FIELDS, in dialling order. */
  customerCallNumbers: string[] | null;
  /** TRY_NEXT_REASONS. */
  tryNextWhen: string[] | null;
  /** Minutes before the whole step runs again; null = no retry. */
  retryWholeSetupAfter: number | null;
  /** How many times the step is retried at most; null = no retry. */
  retryWholeSetupMaxTry: number | null;
  answeringDevice: string;
};

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
  callFollowupList: AutomationCallStep[];
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
  callFollowupList: Omit<AutomationCallStep, "callFollowupId" | "automationId">[];
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

/** Who is rung once a call reaches a person — the same fields on an outbound
 *  call step and on a team's incoming call setting (call-configuration-api).
 *  Every setting is kept per patch method so switching methods back and forth
 *  doesn't lose input; only the chosen one is sent. */
export type CallPatching = {
  assigned: {
    method: AssignedPatchMethod;
    exactMatch: Ring;
    roundRobin: RingOrder;
    ringAll: Ring;
  };
  unassigned: {
    method: UnassignedPatchMethod;
    roundRobin: RingOrder;
    ringAll: Ring;
    manual: ManualDial[];
  };
};

/** One outbound call step. */
export type CallStep = CallPatching & {
  /** Client-side key only — the backend re-creates rows on every save. */
  key: string;
  name: string;
  description: string;
  mode: CallMode;
  /** The AI voice agent (`call` library). Only sent in "ai" mode. */
  agentId: number | null;
  answeringDevice: AnsweringDevice;
  noAnswerMessage: string;
  /** Measured from entering the status, like every other timing. */
  placeAfter: Duration;
  businessHoursOnly: boolean;
  /** Only applies with businessHoursOnly. */
  customerTimeZone: boolean;
  callerIds: number[];
  customerNumbers: string[];
  tryNextWhen: string[];
  retry: { enabled: boolean; after: Duration; maxTries: number };
};

export type StatusAutomationConfig = {
  statusId: number;
  /** Non-null once saved; carried so the caller knows whether details exist. */
  automationId: number | null;
  enabled: boolean;
  channels: Record<ChannelKey, ChannelConfig>;
  /** UI-only: the wire simply has an empty followupList. */
  followUpsEnabled: boolean;
  followUps: FollowUp[];
  outboundCall: { enabled: boolean; steps: CallStep[] };
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
    outboundCall: { enabled: false, steps: [] },
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
const DEFAULT_RETRY: Duration = { value: 1, unit: "hours" };
const DEFAULT_RETRY_TRIES = 1;

let callStepSeq = 0;
const nextCallStepKey = () => `cs-${++callStepSeq}`;

/** Fresh patching. `memberIds` (the team, in list order) seed every ring list,
 *  so a member is taken out of the rotation rather than added to it. */
export function newCallPatching(memberIds: number[]): CallPatching {
  return {
    assigned: {
      method: "exactMatch",
      exactMatch: { ...DEFAULT_RING },
      roundRobin: { ...DEFAULT_RING, userIds: [...memberIds] },
      ringAll: { ...DEFAULT_RING },
    },
    unassigned: {
      method: "roundRobin",
      roundRobin: { ...DEFAULT_RING, userIds: [...memberIds] },
      ringAll: { ...DEFAULT_RING },
      manual: memberIds.map((userId) => ({ userId, ...DEFAULT_RING })),
    },
  };
}

/** A fresh call step, its ring lists seeded from `memberIds`. */
export function newCallStep(memberIds: number[]): CallStep {
  return {
    key: nextCallStepKey(),
    name: "",
    description: "",
    mode: "ai",
    agentId: null,
    answeringDevice: "phone",
    ...newCallPatching(memberIds),
    noAnswerMessage: "",
    placeAfter: { ...DEFAULT_PLACE_CALL },
    businessHoursOnly: true,
    customerTimeZone: false,
    callerIds: [],
    customerNumbers: [],
    tryNextWhen: TRY_NEXT_REASONS.filter((r) => r !== "Voicemail detected"),
    retry: { enabled: false, after: { ...DEFAULT_RETRY }, maxTries: DEFAULT_RETRY_TRIES },
  };
}

/** A copy of a step with its own key, for "duplicate". */
export function copyCallStep(step: CallStep): CallStep {
  return { ...structuredClone(step), key: nextCallStepKey() };
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
const ringFrom = (seconds: number | null, times: number | null): Ring => ({
  seconds: seconds ?? DEFAULT_RING.seconds,
  times: times ?? DEFAULT_RING.times,
});

/** The patching fields as they travel, on a call step or an incoming setting. */
export type CallPatchingWire = Pick<
  AutomationCallStep,
  | "assignedFileCallPatchMethod"
  | "assignedExactMatchRingDuration"
  | "assignedExactMatchRingTimes"
  | "assignedRoundRobinRingDuration"
  | "assignedRoundRobinRingCycleTimes"
  | "assignedRoundRobinUserId"
  | "assignedRingAllDuration"
  | "assignedRingAllTimes"
  | "unAssignedFileCallPatchMethod"
  | "unAssignedRoundRobinRingDuration"
  | "unAssignedRoundRobinRingCycleTimes"
  | "unAssignedRoundRobinUserId"
  | "unAssignedRingAllDuration"
  | "unAssignedRingAllTimes"
  | "unAssignedManualConfiguration"
>;

/** An unrecognised device was stored as "" — treat it as the default. */
export function answeringDeviceFromWire(device: string | null | undefined): AnsweringDevice {
  return device?.toLowerCase() === "browser" ? "browser" : "phone";
}

export function callPatchingFromWire(s: CallPatchingWire): CallPatching {
  return {
    assigned: {
      method: s.assignedFileCallPatchMethod ?? "exactMatch",
      exactMatch: ringFrom(s.assignedExactMatchRingDuration, s.assignedExactMatchRingTimes),
      roundRobin: {
        ...ringFrom(s.assignedRoundRobinRingDuration, s.assignedRoundRobinRingCycleTimes),
        userIds: s.assignedRoundRobinUserId ?? [],
      },
      ringAll: ringFrom(s.assignedRingAllDuration, s.assignedRingAllTimes),
    },
    unassigned: {
      method: s.unAssignedFileCallPatchMethod ?? "roundRobin",
      roundRobin: {
        ...ringFrom(s.unAssignedRoundRobinRingDuration, s.unAssignedRoundRobinRingCycleTimes),
        userIds: s.unAssignedRoundRobinUserId ?? [],
      },
      ringAll: ringFrom(s.unAssignedRingAllDuration, s.unAssignedRingAllTimes),
      manual: (s.unAssignedManualConfiguration ?? []).map((m) => ({
        userId: m.userId,
        ...ringFrom(m.dialDuration, m.dialTimes),
      })),
    },
  };
}

function callStepFromWire(s: AutomationCallStep): CallStep {
  const retryMinutes = s.retryWholeSetupAfter ?? 0;
  return {
    key: nextCallStepKey(),
    name: s.callStepName ?? "",
    description: s.callStepDescription ?? "",
    mode: s.callMode === "directPatch" ? "directPatch" : "ai",
    agentId: s.callTemplateId ?? null,
    answeringDevice: answeringDeviceFromWire(s.answeringDevice),
    ...callPatchingFromWire(s),
    noAnswerMessage: s.noAnswerMessage ?? "",
    placeAfter: fromMinutes(s.placeCallAfterMins, { ...DEFAULT_PLACE_CALL }),
    businessHoursOnly: s.callDuringTenantHrFlag === 1,
    customerTimeZone: s.callDuringLeadHrFlag === 1,
    callerIds: s.phoneIdList ?? [],
    customerNumbers: s.customerCallNumbers ?? [],
    tryNextWhen: s.tryNextWhen ?? [],
    retry: {
      enabled: retryMinutes > 0,
      after:
        retryMinutes > 0 ? fromMinutes(retryMinutes, { ...DEFAULT_RETRY }) : { ...DEFAULT_RETRY },
      // Steps saved before the key existed come back null.
      maxTries: s.retryWholeSetupMaxTry ?? DEFAULT_RETRY_TRIES,
    },
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
      steps: (d.callFollowupList ?? []).map(callStepFromWire),
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

/** Only the chosen patch method's settings are sent; the rest go as null. */
export function callPatchingToWire(p: CallPatching): CallPatchingWire {
  const a = p.assigned;
  const u = p.unassigned;
  const aExact = a.method === "exactMatch";
  const aRobin = a.method === "roundRobin";
  const aAll = a.method === "ringAll";
  const uRobin = u.method === "roundRobin";
  const uAll = u.method === "ringAll";
  return {
    assignedFileCallPatchMethod: a.method,
    assignedExactMatchRingDuration: aExact ? a.exactMatch.seconds : null,
    assignedExactMatchRingTimes: aExact ? a.exactMatch.times : null,
    assignedRoundRobinRingDuration: aRobin ? a.roundRobin.seconds : null,
    assignedRoundRobinRingCycleTimes: aRobin ? a.roundRobin.times : null,
    assignedRoundRobinUserId: aRobin ? a.roundRobin.userIds : null,
    assignedRingAllDuration: aAll ? a.ringAll.seconds : null,
    assignedRingAllTimes: aAll ? a.ringAll.times : null,
    unAssignedFileCallPatchMethod: u.method,
    unAssignedRoundRobinRingDuration: uRobin ? u.roundRobin.seconds : null,
    unAssignedRoundRobinRingCycleTimes: uRobin ? u.roundRobin.times : null,
    unAssignedRoundRobinUserId: uRobin ? u.roundRobin.userIds : null,
    unAssignedRingAllDuration: uAll ? u.ringAll.seconds : null,
    unAssignedRingAllTimes: uAll ? u.ringAll.times : null,
    unAssignedManualConfiguration:
      u.method === "manual"
        ? u.manual.map((m) => ({ userId: m.userId, dialDuration: m.seconds, dialTimes: m.times }))
        : [],
  };
}

function callStepToWire(s: CallStep): AutomationPayload["callFollowupList"][number] {
  return {
    callStepName: s.name.trim(),
    callStepDescription: s.description.trim() || null,
    callMode: s.mode,
    callTemplateId: s.mode === "ai" ? s.agentId : null,
    ...callPatchingToWire(s),
    noAnswerMessage: s.noAnswerMessage.trim() || null,
    placeCallAfterMins: toMinutes(s.placeAfter),
    callDuringTenantHrFlag: flag(s.businessHoursOnly),
    callDuringLeadHrFlag: flag(s.businessHoursOnly && s.customerTimeZone),
    phoneIdList: s.callerIds,
    customerCallNumbers: s.customerNumbers,
    tryNextWhen: s.tryNextWhen,
    retryWholeSetupAfter: s.retry.enabled ? toMinutes(s.retry.after) : null,
    retryWholeSetupMaxTry: s.retry.enabled ? s.retry.maxTries : null,
    answeringDevice: s.answeringDevice,
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

    // Always the full list, even while calling is off — leaving it out deletes
    // the saved steps.
    outboundCallEnabled: flag(cfg.outboundCall.enabled && ctx.callAllowed),
    callFollowupList: cfg.outboundCall.steps.map(callStepToWire),
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

/** What the patching is missing, or null. Phrased to follow "<label>: ". */
export function validateCallPatching(p: CallPatching): string | null {
  const a = p.assigned;
  if (!ringValid(a[a.method])) {
    return "set how long and how many times assigned files ring.";
  }
  if (a.method === "roundRobin" && a.roundRobin.userIds.length === 0) {
    return "put at least one member in the assigned-files round robin.";
  }

  const u = p.unassigned;
  if (u.method === "manual") {
    if (u.manual.length === 0) return "pick who is rung for unassigned files.";
    if (u.manual.some((m) => !ringValid(m))) {
      return "give every member rung for unassigned files a ring time and count.";
    }
  } else {
    if (!ringValid(u[u.method])) {
      return "set how long and how many times unassigned files ring.";
    }
    if (u.method === "roundRobin" && u.roundRobin.userIds.length === 0) {
      return "put at least one member in the unassigned-files round robin.";
    }
  }
  return null;
}

/** What a call step is missing before it can run, or null. */
export function validateCallStep(s: CallStep, index: number): string | null {
  const name = s.name.trim();
  if (!name) return `Name call step #${index + 1}.`;
  const label = `Call step "${name}"`;
  if (s.mode === "ai" && !s.agentId) {
    return `${label}: choose the AI voice agent that places the call.`;
  }

  const patchError = validateCallPatching(s);
  if (patchError) return `${label}: ${patchError}`;

  if (s.callerIds.length === 0) return `${label}: pick at least one outbound caller ID.`;
  if (s.customerNumbers.length === 0) return `${label}: pick at least one customer number to call.`;
  if (s.retry.enabled && toMinutes(s.retry.after) <= 0) {
    return `${label}: set when the step is retried.`;
  }
  if (s.retry.enabled && s.retry.maxTries < 1) {
    return `${label}: set how many times the step is retried.`;
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
    if (cfg.outboundCall.steps.length === 0)
      return "Add a call step, or switch outbound calls off.";
    for (const [i, step] of cfg.outboundCall.steps.entries()) {
      const err = validateCallStep(step, i);
      if (err) return err;
    }
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
  const calls = cfg.outboundCall.enabled && callAllowed ? cfg.outboundCall.steps.length : 0;
  if (calls) parts.push(`${calls} call step${calls === 1 ? "" : "s"}`);
  const followUps = cfg.followUpsEnabled ? cfg.followUps.length : 0;
  if (followUps) parts.push(`${followUps} follow-up${followUps === 1 ? "" : "s"}`);
  if (cfg.generateDocuments) parts.push("Documents");
  if (cfg.autoArchive.enabled) parts.push(`Archive after ${formatDuration(cfg.autoArchive.after)}`);
  if (cfg.inactivity.enabled) {
    parts.push(`Inactive ${formatDuration(cfg.inactivity.after)}`);
  }
  return parts.length ? parts.join(" · ") : "On — no behaviours yet";
}
