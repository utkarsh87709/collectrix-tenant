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
//   POST /tenant/getTeamDeckAssignUserList { teamId }                  (team-deck-api)
//
// Backend behaviour worth knowing (all confirmed by probing devapi):
//   • Every duration on the wire is in MINUTES.
//   • There is no initialCallMsgSource — a call is always placed by an AI
//     agent, so the voice channel has no template/AI choice.
//   • The backend does NOT validate that a templateId belongs to the client, or
//     that a channel is one the client has switched on. Both are enforced here.
//   • An invalid assignUserId comes back as meta.status false "Server Error".
//   • enabledFlag 0 with a full config is a valid saved row, so switching a
//     status off preserves everything that was configured.
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

export type ChannelKey = "email" | "sms" | "call";

/**
 * Where an outbound message's body comes from:
 *   "template" — a fixed body from the Template Library (email/sms type).
 *   "ai"       — generated at send time from an aiPrompt library entry.
 * The voice channel has neither choice nor field: a call is always placed by an
 * agent, and initialCallTemplateId points at a `call` library entry (the agent's
 * greeting + prompt).
 */
export type MessageSource = "template" | "ai";

/** One follow-up as stored by the backend. Times are minutes. */
export type AutomationFollowup = {
  followupId?: number;
  automationId?: number;
  followupChannel: ChannelKey;
  followupTime: number;
  /** Always "ai" when followupChannel is "call". */
  followupMsgSource: MessageSource;
  followupTemplateId: number | null;
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

  initialCallEnabled: number;
  initialCallFollowupTime: number | null;
  /** A `call` library entry — the AI voice agent. No MsgSource counterpart. */
  initialCallTemplateId: number | null;

  /** null when auto-assignment is off. */
  assignUserId: number | null;
  generateDocumentEnabled: number;

  autoArchiveEnabled: number;
  /** Minutes in the status before archiving. */
  autoArchiveDuration: number | null;

  inactiveStatusTransitionEnabled: number;
  /** Minutes without activity before the transition fires. */
  inactiveStatusDuration: number | null;
  inactiveStatusDestinationStatusId: number | null;

  followupList: AutomationFollowup[];
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
  initialCallEnabled: number;
  initialCallFollowupTime: number | null;
  initialCallTemplateId: number | null;
  assignUserId: number | null;
  generateDocumentEnabled: number;
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
};

/** Loads one status' saved configuration. Only call this when the list row's
 *  automationId is non-null. */
export function getStatusAutomationDetails(automationId: number): Promise<AutomationDetails> {
  return apiPost<AutomationDetails>("/tenant/getStatusAutomationDetails", { automationId });
}

export function updateAutomation(payload: AutomationPayload): Promise<unknown> {
  return apiPost("/tenant/updateAutomation", { ...payload });
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
  /** Always "ai" for the voice channel (the wire has no field for it). */
  messageSource: MessageSource;
  /**
   * Template Library id. Which library it points into depends on the channel
   * and source: an email/sms template when source is "template", the aiPrompt
   * agent when it is "ai", and for voice the `call` agent.
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

export type StatusAutomationConfig = {
  statusId: number;
  /** Non-null once saved; carried so the caller knows whether details exist. */
  automationId: number | null;
  enabled: boolean;
  channels: Record<ChannelKey, ChannelConfig>;
  /** UI-only: the wire simply has an empty followupList. */
  followUpsEnabled: boolean;
  followUps: FollowUp[];
  /** Auto-assign the file to one team member on entering this status. */
  assignMember: { enabled: boolean; userId: number | null };
  /** Generate documents on entering this status (a flag only — the backend
   *  takes no document template ids). */
  generateDocuments: boolean;
  /** Drop the file out of active workload/aging (recoverable, records kept). */
  autoArchive: { enabled: boolean; after: Duration };
  /** Move the file to another status after a period of no activity. */
  inactivity: { enabled: boolean; after: Duration; toStatusId: number | null };
};

export const CHANNEL_LABEL: Record<ChannelKey, string> = {
  email: "Email",
  sms: "SMS",
  call: "AI Voice Call",
};

export const CHANNEL_ORDER: ChannelKey[] = ["email", "sms", "call"];

/** Voice is always AI-driven — there is no fixed-template option for a call. */
export function isAiOnlyChannel(channel: ChannelKey): boolean {
  return channel === "call";
}

/**
 * Which Template Library list a channel picks from, per message source.
 * "ai" resolves to the aiPrompt library (the agents), except for voice, whose
 * agents live in the `call` library (greeting + prompt per agent).
 */
export function templateTypeFor(
  channel: ChannelKey,
  source: MessageSource,
): "email" | "sms" | "call" | "aiPrompt" {
  if (channel === "call") return "call";
  if (source === "ai") return "aiPrompt";
  return channel;
}

/** Channels the selected client permits (per its *Enabled flags). */
export function allowedChannels(client: AutomationClient | null): ChannelKey[] {
  if (!client) return [];
  return CHANNEL_ORDER.filter((c) =>
    c === "email" ? client.emailEnabled : c === "sms" ? client.smsEnabled : client.callEnabled,
  );
}

const DEFAULT_START: Duration = { value: 1, unit: "days" };
const DEFAULT_FOLLOWUP: Duration = { value: 3, unit: "days" };
const DEFAULT_ARCHIVE: Duration = { value: 30, unit: "days" };
const DEFAULT_INACTIVITY: Duration = { value: 30, unit: "days" };

export function emptyChannel(channel: ChannelKey = "email"): ChannelConfig {
  return {
    enabled: false,
    startAfter: { ...DEFAULT_START },
    messageSource: isAiOnlyChannel(channel) ? "ai" : "template",
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
      email: emptyChannel("email"),
      sms: emptyChannel("sms"),
      call: emptyChannel("call"),
    },
    followUpsEnabled: false,
    followUps: [],
    assignMember: { enabled: false, userId: null },
    generateDocuments: false,
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
    messageSource: isAiOnlyChannel(channel) ? "ai" : "template",
    templateId: null,
  };
}

/* -------------------------------- mapping -------------------------------- */

/** Saved row → editor model. */
export function configFromDetails(d: AutomationDetails): StatusAutomationConfig {
  const base = emptyAutomationConfig(d.statusId);
  const followUps = (d.followupList ?? []).map((f) => {
    followUpSeq += 1;
    return {
      key: `fu-${followUpSeq}`,
      channel: f.followupChannel,
      after: fromMinutes(f.followupTime, { ...DEFAULT_FOLLOWUP }),
      messageSource: isAiOnlyChannel(f.followupChannel)
        ? ("ai" as MessageSource)
        : (f.followupMsgSource ?? "template"),
      templateId: f.followupTemplateId ?? null,
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
        messageSource: d.initialEmailMsgSource ?? "template",
        templateId: d.initialEmailTemplateId ?? null,
      },
      sms: {
        enabled: d.initialSmsEnabled === 1,
        startAfter: fromMinutes(d.initialSmsFollowupTime, base.channels.sms.startAfter),
        messageSource: d.initialSmsMsgSource ?? "template",
        templateId: d.initialSmsTemplateId ?? null,
      },
      call: {
        enabled: d.initialCallEnabled === 1,
        startAfter: fromMinutes(d.initialCallFollowupTime, base.channels.call.startAfter),
        messageSource: "ai",
        templateId: d.initialCallTemplateId ?? null,
      },
    },
    followUpsEnabled: followUps.length > 0,
    followUps,
    assignMember: { enabled: d.assignUserId != null, userId: d.assignUserId ?? null },
    generateDocuments: d.generateDocumentEnabled === 1,
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

/**
 * Editor model → updateAutomation body.
 *
 * `allowed` is the client's permitted channel set. The backend accepts a
 * channel the client has switched off, so anything outside `allowed` is written
 * as disabled here and its follow-ups dropped — otherwise a client-level change
 * would leave invisible automation running.
 */
export function payloadFromConfig(
  cfg: StatusAutomationConfig,
  ctx: { clientId: number; teamId: number; allowed: ChannelKey[]; documentsAllowed: boolean },
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

    initialCallEnabled: flag(on("call")),
    initialCallFollowupTime: minutes("call"),
    // No initialCallMsgSource on the wire — a call is always agent-driven.
    initialCallTemplateId: tmpl("call"),

    assignUserId: cfg.assignMember.enabled ? cfg.assignMember.userId : null,
    generateDocumentEnabled: flag(cfg.generateDocuments && ctx.documentsAllowed),

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
            followupMsgSource: isAiOnlyChannel(f.channel) ? "ai" : f.messageSource,
            followupTemplateId: f.templateId,
          }))
      : [],
  };
}

/* ------------------------------- validation ------------------------------ */

/**
 * Whether a channel's template id is mandatory.
 *
 * A call cannot be placed without a script, so the voice channel always needs
 * its `call` agent. For email/SMS a fixed template is likewise mandatory, but an
 * AI-written message is allowed to go out with no aiPrompt attached — the
 * backend stores initialXMsgSource "ai" with a null templateId happily, and the
 * aiPrompt library has no management screen yet, so requiring one here would
 * lock the AI option out entirely.
 */
export function templateRequired(channel: ChannelKey, source: MessageSource): boolean {
  return channel === "call" || source === "template";
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
): string | null {
  if (!cfg.enabled) return null;

  const activeChannels = allowed.filter((c) => cfg.channels[c].enabled);
  const hasBehavior =
    activeChannels.length > 0 ||
    cfg.assignMember.enabled ||
    cfg.generateDocuments ||
    cfg.autoArchive.enabled ||
    cfg.inactivity.enabled;
  if (!hasBehavior) {
    return "Turn on at least one behaviour (channel, member, document, archive, or inactivity).";
  }

  for (const c of activeChannels) {
    const ch = cfg.channels[c];
    if (templateRequired(c, ch.messageSource) && !ch.templateId) {
      return c === "call"
        ? "Select the AI agent that places the call."
        : `Select a template for ${CHANNEL_LABEL[c]}.`;
    }
  }

  if (cfg.followUpsEnabled) {
    if (cfg.followUps.length === 0) return "Add a follow-up, or switch follow-ups off.";
    for (const [i, fu] of cfg.followUps.entries()) {
      if (!allowed.includes(fu.channel)) {
        return `Follow-up #${i + 1} uses a channel this client has switched off.`;
      }
      if (templateRequired(fu.channel, fu.messageSource) && !fu.templateId) {
        return fu.channel === "call"
          ? `Select the AI agent for follow-up #${i + 1}.`
          : `Select a template for follow-up #${i + 1}.`;
      }
      if (toMinutes(fu.after) <= 0) return `Set when follow-up #${i + 1} should send.`;
    }
  }

  if (cfg.assignMember.enabled && !cfg.assignMember.userId) {
    return "Pick the team member files should be assigned to.";
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
  const followUps = cfg.followUpsEnabled ? cfg.followUps.length : 0;
  if (followUps) parts.push(`${followUps} follow-up${followUps === 1 ? "" : "s"}`);
  if (cfg.assignMember.enabled) parts.push("Auto-assign");
  if (cfg.generateDocuments) parts.push("Documents");
  if (cfg.autoArchive.enabled) parts.push(`Archive after ${formatDuration(cfg.autoArchive.after)}`);
  if (cfg.inactivity.enabled) {
    parts.push(`Inactive ${formatDuration(cfg.inactivity.after)}`);
  }
  return parts.length ? parts.join(" · ") : "On — no behaviours yet";
}
