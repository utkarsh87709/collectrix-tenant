// Call Configuration (Tenant Settings → Call Configuration): how inbound calls
// to a team's numbers are answered. Numbers belong to teams, so the setting is
// per TEAM — one for inside business hours and one for outside them. Explained
// by the backend dev on 2026-10-12; verified against devapi on 2026-10-23:
//   POST /tenant/getIncomingCallSetting    { teamId }                       -> { incomingCallSetting[] }
//     At most one row per settingType; [] until the team has been configured.
//   POST /tenant/updateIncomingCallSetting { ...IncomingCallSettingPayload } -> {}
//     Upsert keyed on (teamId, settingType) — the row keeps its id. A FULL
//     replace, so always send the complete setting.
//
// Backend behaviour worth knowing (all confirmed by probing devapi):
//   • callMode takes "ai" or "directPatch". "human" — the name used in the
//     meeting — is silently stored as "", like any value it doesn't know, so the
//     design's "A human" is sent as "directPatch": the same value an outbound
//     call step uses for a call that goes straight to a person.
//   • answeringDevice and callTransferToHumanEnabled are mandatory ("Parameter
//     X is mandatory"); callTemplateId and noAnswerMessage may be null.
//   • The patching fields are an outbound call step's (status-automation-api)
//     and behave the same: ring durations are seconds, only the chosen method's
//     settings need values.
//
// Supporting lookups: teams (getTeamList), the team's numbers
// (getTeamPhoneNumber) and members (getTeamDeckAssignUserList), who holds each
// number (getUsers phoneNoList), and the AI voice agents — the `call` templates
// of every client that has one (getTemplateClients → getClientTemplate), since
// this setting belongs to a team, not a client.
import { apiPost } from "./api-client";
import {
  newCallPatching,
  ringFrom,
  validateCallPatching,
  type AnsweringDevice,
  type AssignedPatchMethod,
  type CallMode,
  type CallPatching,
  type UnassignedPatchMethod,
} from "./status-automation-api";

/** The flat patching fields this API's rows carry. (Status Automation's
 *  outbound call has moved to the nested callSetting shape.) */
type CallPatchingWire = {
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
};

/** An unrecognised device was stored as "" — treat it as the default. */
function answeringDeviceFromWire(device: string | null | undefined): AnsweringDevice {
  return device?.toLowerCase() === "browser" ? "browser" : "phone";
}

/** These rows have no call forwarding or "assign to me" flag, so those keep
 *  their defaults. */
function callPatchingFromWire(s: CallPatchingWire): CallPatching {
  const base = newCallPatching([]);
  return {
    assigned: {
      ...base.assigned,
      method: s.assignedFileCallPatchMethod ?? "exactMatch",
      exactMatch: ringFrom(s.assignedExactMatchRingDuration, s.assignedExactMatchRingTimes),
      roundRobin: {
        ...ringFrom(s.assignedRoundRobinRingDuration, s.assignedRoundRobinRingCycleTimes),
        userIds: s.assignedRoundRobinUserId ?? [],
      },
      ringAll: ringFrom(s.assignedRingAllDuration, s.assignedRingAllTimes),
    },
    unassigned: {
      ...base.unassigned,
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

/** Only the chosen patch method's settings are sent; the rest go as null. */
function callPatchingToWire(p: CallPatching): CallPatchingWire {
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

export type SettingType = "insideBusinessHr" | "outsideBusinessHr";

export const SETTING_TYPES: SettingType[] = ["insideBusinessHr", "outsideBusinessHr"];

/** updateIncomingCallSetting request body. */
export type IncomingCallSettingPayload = CallPatchingWire & {
  teamId: number;
  settingType: SettingType;
  callMode: CallMode;
  /** The AI voice agent (a `call` template). Null unless callMode is "ai". */
  callTemplateId: number | null;
  /** 1 = the AI may hand the call to a person. Only meaningful in "ai" mode. */
  callTransferToHumanEnabled: number;
  /** Said to the caller when nobody picks up. */
  noAnswerMessage: string | null;
  answeringDevice: AnsweringDevice;
};

/** One getIncomingCallSetting row — the saved setting, flat. */
export type IncomingCallSetting = Omit<
  IncomingCallSettingPayload,
  "callMode" | "answeringDevice"
> & {
  id: number;
  /** "" when the backend didn't recognise what was sent. */
  callMode: string;
  answeringDevice: string;
};

export async function getIncomingCallSettings(teamId: number): Promise<IncomingCallSetting[]> {
  const res = await apiPost<{ incomingCallSetting: IncomingCallSetting[] }>(
    "/tenant/getIncomingCallSetting",
    { teamId },
  );
  return res?.incomingCallSetting ?? [];
}

export function updateIncomingCallSetting(payload: IncomingCallSettingPayload): Promise<unknown> {
  return apiPost("/tenant/updateIncomingCallSetting", { ...payload });
}

/* ------------------------------- UI model -------------------------------- */

export type IncomingCallConfig = CallPatching & {
  /** Who answers: "ai" or "directPatch" (a person). Null until someone picks —
   *  a team that was never configured has no answer mode, and it can't be
   *  saved without one. */
  mode: CallMode | null;
  /** The AI voice agent. Only sent in "ai" mode. */
  agentId: number | null;
  /** AI mode only: the caller can be handed to a person. */
  transferToHuman: boolean;
  answeringDevice: AnsweringDevice;
  noAnswerMessage: string;
};

/** A setting that has never been saved. */
export function emptyIncomingConfig(memberIds: number[]): IncomingCallConfig {
  return {
    mode: null,
    agentId: null,
    transferToHuman: true,
    answeringDevice: "phone",
    noAnswerMessage: "",
    ...newCallPatching(memberIds),
  };
}

/** Saved row → editor model. */
export function incomingConfigFromWire(s: IncomingCallSetting): IncomingCallConfig {
  return {
    mode: s.callMode === "ai" || s.callMode === "directPatch" ? s.callMode : null,
    agentId: s.callTemplateId ?? null,
    transferToHuman: s.callTransferToHumanEnabled === 1,
    answeringDevice: answeringDeviceFromWire(s.answeringDevice),
    noAnswerMessage: s.noAnswerMessage ?? "",
    ...callPatchingFromWire(s),
  };
}

/** Editor model → updateIncomingCallSetting body. Only call with a valid config
 *  (validateIncomingConfig), which guarantees a mode. */
export function incomingPayload(
  teamId: number,
  settingType: SettingType,
  cfg: IncomingCallConfig,
): IncomingCallSettingPayload {
  const ai = cfg.mode === "ai";
  return {
    teamId,
    settingType,
    callMode: cfg.mode ?? "directPatch",
    callTemplateId: ai ? cfg.agentId : null,
    callTransferToHumanEnabled: ai && cfg.transferToHuman ? 1 : 0,
    // The patching is sent even when the AI can't transfer, so switching the
    // transfer back on finds it as it was.
    ...callPatchingToWire(cfg),
    noAnswerMessage: cfg.noAnswerMessage.trim() || null,
    answeringDevice: cfg.answeringDevice,
  };
}

/** Whether calls under this config ever ring a person. */
export function reachesPeople(cfg: IncomingCallConfig): boolean {
  return cfg.mode === "directPatch" || (cfg.mode === "ai" && cfg.transferToHuman);
}

/** What a config is missing before it can be saved, or null. */
export function validateIncomingConfig(cfg: IncomingCallConfig): string | null {
  if (!cfg.mode) return "pick who answers inbound calls.";
  if (cfg.mode === "ai" && !cfg.agentId) return "choose the AI agent that answers.";
  if (reachesPeople(cfg)) return validateCallPatching(cfg);
  return null;
}
