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
  answeringDeviceFromWire,
  callPatchingFromWire,
  callPatchingToWire,
  newCallPatching,
  validateCallPatching,
  type AnsweringDevice,
  type CallMode,
  type CallPatching,
  type CallPatchingWire,
} from "./status-automation-api";

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
