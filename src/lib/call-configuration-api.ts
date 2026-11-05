// Call Configuration (Tenant Settings → Call Configuration): how inbound calls
// are answered. One setup for the whole business for unmatched callers, one per
// team for matched callers, each held for inside and outside business hours.
// Rewritten by the backend on 2026-10-31; shapes from the Postman collection and
// probed live on devapi:
//   POST /tenant/getIncomingCallSetting {} -> { incomingCallSetting: { inboundCallSetting } }
//   POST /tenant/updateIncomingCallSetting { ...InboundCallSettingWire } -> {}
//
// Backend behaviour worth knowing:
//   • It is ONE document for the tenant, stored exactly as sent with no
//     validation. A partial body replaces the whole thing and {} wipes it, so a
//     save re-reads the document and changes only what was edited.
//   • The server adds tokenRole to what it stores; it is stripped before re-sending.
//   • Three things are in the design but not in the backend's payload, so they
//     are saved under keys of ours and calls ignore them until the backend reads
//     them: unMatchedCaller.duringBusiness.directPatch.roundRobin,
//     unMatchedCaller.*.aiAgent.roundRobin, and answeringDevice.
//   • A matched team's unAssignedFiles stays in the API but isn't edited here any
//     more: a saved team's values are sent back as they were, and a new team
//     sends it switched off.
//   • enabledFlag on a matched team's assignedFiles / unAssignedFiles is shown as
//     on/off per kind of file, like Status Automation's outbound setup. What it
//     does on an inbound call is not yet confirmed by the backend.
//   • callTeamId and callUserId are both sent so switching between Team and
//     Individual keeps each value; callType says which one applies.
//
// Supporting lookups: teams (getTeamList), who leads them (getTeamsOrgView), a
// team's numbers (getTeamPhoneNumber) and members (getTeamDeckAssignUserList),
// every user (getUsers, page is 0-based), and the AI voice agents — the `call`
// templates of every client that has one (getTemplateClients → getClientTemplate).
import { apiPost } from "./api-client";
import {
  aiWindowFromWire,
  filesToWire,
  newAiWindow,
  newRouting,
  orderFromWire,
  orderToWire,
  ringFrom,
  routingFromWire,
  validateRouting,
  type AiWindowSetup,
  type AnsweringDevice,
  type CallMode,
  type FilesWire,
  type HoursWindow,
  type Loose,
  type OutboundRouting,
  type RingOrder,
  type RoundRobinWire,
} from "./status-automation-api";

export const INBOUND_MATCHING_HELP =
  "A caller is matched only when their number is on exactly one file. If the number isn’t on any file, or is on more than one file, the call follows the Unmatched Caller settings.";

export const HOURS_WINDOWS: HoursWindow[] = ["during", "after"];

export const HOURS_LABEL: Record<HoursWindow, string> = {
  during: "Inside business hours",
  after: "Outside business hours",
};

const WIRE_WINDOW = { during: "duringBusiness", after: "afterBusiness" } as const;

/** The AI voice agents of one client (its `call` templates). */
export type AgentGroup = {
  clientId: number;
  clientName: string;
  agents: { id: number; name: string }[];
};

/* ---------------------------------- wire ---------------------------------- */

type CallType = "team" | "individual";

type MatchedTeamWire = {
  teamId: number;
  callMode: CallMode;
  aiAgent: FilesWire & { noAnswerMessage: string | null };
  directPatch: FilesWire & { greetingMessage: string | null; noAnswerMessage: string | null };
};

type UnmatchedWindowWire = {
  callMode: CallMode;
  directPatch: {
    enabledFlag: number;
    callType: CallType;
    callTeamId: number | null;
    callUserId: number | null;
    greetingMessage: string | null;
    noAnswerMessage: string | null;
    roundRobin: RoundRobinWire;
  };
  aiAgent: {
    enabledFlag: number;
    callTemplateId: number | null;
    /** 1 = the AI may transfer the caller to a person. */
    patchToAgentFlag: number;
    callType: CallType;
    callTeamId: number | null;
    callUserId: number | null;
    noAnswerMessage: string | null;
    /** Who a transfer to a team rings, in order. */
    roundRobin: RoundRobinWire;
  };
};

type WireWindows<T> = { duringBusiness: T; afterBusiness: T };

type InboundCallSettingWire = {
  matchedCaller: WireWindows<MatchedTeamWire[]>;
  unMatchedCaller: WireWindows<UnmatchedWindowWire>;
  answeringDevice: WireWindows<AnsweringDevice>;
};

/** What a saved document may actually hold: any part can be missing or null. */
export type SavedInboundCallSetting = Loose<InboundCallSettingWire>;

export async function getInboundCallSetting(): Promise<SavedInboundCallSetting> {
  const res = await apiPost<{
    incomingCallSetting?: { inboundCallSetting?: SavedInboundCallSetting | null } | null;
  }>("/tenant/getIncomingCallSetting", {});
  return res?.incomingCallSetting?.inboundCallSetting ?? {};
}

/** Applies `edits` to a fresh copy of the document, so a section someone else
 *  saved since this page loaded isn't overwritten. If the read fails, nothing
 *  is written. */
export async function updateInboundCallSetting(edits: InboundEdits): Promise<void> {
  const doc: SavedInboundCallSetting & { tokenRole?: unknown } = {
    ...(await getInboundCallSetting()),
  };
  delete doc.tokenRole;
  await apiPost("/tenant/updateIncomingCallSetting", applyInboundEdits(doc, edits));
}

/* ----------------------------- matched callers ----------------------------- */

/** One team, one business-hours window. Both modes are held so switching back
 *  finds the other one as it was; callMode says which one runs. */
export type MatchedWindow = {
  /** Null until someone picks: a team never configured has no answer mode. */
  mode: CallMode | null;
  ai: AiWindowSetup & { noAnswerMessage: string };
  direct: OutboundRouting & { greeting: string; noAnswerMessage: string };
};

function newMatchedWindow(memberIds: number[]): MatchedWindow {
  return {
    mode: null,
    ai: { ...newAiWindow(memberIds), unassignedOn: false, noAnswerMessage: "" },
    direct: { ...newRouting(memberIds), unassignedOn: false, greeting: "", noAnswerMessage: "" },
  };
}

/** A team's saved setup, or a fresh one seeded from its members. */
export function matchedWindowFromSaved(
  saved: SavedInboundCallSetting,
  teamId: number,
  window: HoursWindow,
  memberIds: number[],
): MatchedWindow {
  const fresh = newMatchedWindow(memberIds);
  const row = saved.matchedCaller?.[WIRE_WINDOW[window]]?.find((r) => r?.teamId === teamId);
  if (!row) return fresh;
  return {
    mode: row.callMode === "ai" || row.callMode === "directPatch" ? row.callMode : null,
    ai: row.aiAgent
      ? { ...aiWindowFromWire(row.aiAgent), noAnswerMessage: row.aiAgent.noAnswerMessage ?? "" }
      : fresh.ai,
    direct: row.directPatch
      ? {
          ...routingFromWire(row.directPatch),
          greeting: row.directPatch.greetingMessage ?? "",
          noAnswerMessage: row.directPatch.noAnswerMessage ?? "",
        }
      : fresh.direct,
  };
}

function matchedWindowToWire(teamId: number, m: MatchedWindow): MatchedTeamWire {
  return {
    teamId,
    callMode: m.mode ?? "directPatch",
    aiAgent: {
      noAnswerMessage: m.ai.noAnswerMessage.trim() || null,
      ...filesToWire(m.ai, { assigned: m.ai.assignedAgentId, unassigned: m.ai.unassignedAgentId }),
    },
    directPatch: {
      greetingMessage: m.direct.greeting.trim() || null,
      noAnswerMessage: m.direct.noAnswerMessage.trim() || null,
      ...filesToWire(m.direct),
    },
  };
}

/** What a team's setup is missing before it can be saved, or null. Unassigned
 *  files aren't on screen, so a problem there can't be fixed and isn't checked. */
export function validateMatchedWindow(m: MatchedWindow): string | null {
  if (!m.mode) return "pick who answers inbound calls.";
  if (m.mode === "directPatch") return validateRouting({ ...m.direct, unassignedOn: false });
  if (!m.ai.assignedOn && !m.ai.unassignedOn) return "switch on the AI for assigned files.";
  if (m.ai.assignedOn && !m.ai.assignedAgentId) return "choose the AI agent for assigned files.";
  return validateRouting({ ...m.ai, unassignedOn: false });
}

/* ---------------------------- unmatched callers ---------------------------- */

/** Where a call goes. Both ids are kept; `target` says which one applies. */
export type UnmatchedDestination = {
  target: CallType;
  teamId: number | null;
  userId: number | null;
};

export type UnmatchedWindow = {
  /** Outside business hours is always "ai". */
  mode: CallMode;
  direct: UnmatchedDestination & {
    greeting: string;
    noAnswerMessage: string;
    roundRobin: RingOrder;
  };
  ai: UnmatchedDestination & {
    agentId: number | null;
    transfer: boolean;
    noAnswerMessage: string;
    roundRobin: RingOrder;
  };
};

export type UnmatchedConfig = Record<HoursWindow, UnmatchedWindow>;

const idOrNull = (v: unknown): number | null => (typeof v === "number" ? v : null);

function unmatchedWindowFromSaved(
  saved: SavedInboundCallSetting,
  window: HoursWindow,
): UnmatchedWindow {
  const wire = saved.unMatchedCaller?.[WIRE_WINDOW[window]];
  const d = wire?.directPatch;
  const a = wire?.aiAgent;
  return {
    mode: window === "after" || wire?.callMode === "ai" ? "ai" : "directPatch",
    direct: {
      target: d?.callType === "individual" ? "individual" : "team",
      teamId: idOrNull(d?.callTeamId),
      userId: idOrNull(d?.callUserId),
      greeting: d?.greetingMessage ?? "",
      noAnswerMessage: d?.noAnswerMessage ?? "",
      roundRobin: d?.roundRobin
        ? orderFromWire(d.roundRobin)
        : { ...ringFrom(null, null), userIds: [] },
    },
    ai: {
      target: a?.callType === "individual" ? "individual" : "team",
      teamId: idOrNull(a?.callTeamId),
      userId: idOrNull(a?.callUserId),
      agentId: idOrNull(a?.callTemplateId),
      transfer: a?.patchToAgentFlag !== 0,
      noAnswerMessage: a?.noAnswerMessage ?? "",
      roundRobin: a?.roundRobin
        ? orderFromWire(a.roundRobin)
        : { ...ringFrom(null, null), userIds: [] },
    },
  };
}

export function unmatchedConfigFromSaved(saved: SavedInboundCallSetting): UnmatchedConfig {
  return {
    during: unmatchedWindowFromSaved(saved, "during"),
    after: unmatchedWindowFromSaved(saved, "after"),
  };
}

function unmatchedWindowToWire(u: UnmatchedWindow): UnmatchedWindowWire {
  const ai = u.mode === "ai";
  return {
    callMode: u.mode,
    directPatch: {
      enabledFlag: ai ? 0 : 1,
      callType: u.direct.target,
      callTeamId: u.direct.teamId,
      callUserId: u.direct.userId,
      greetingMessage: u.direct.greeting.trim() || null,
      noAnswerMessage: u.direct.noAnswerMessage.trim() || null,
      roundRobin: orderToWire(u.direct.roundRobin),
    },
    aiAgent: {
      enabledFlag: ai ? 1 : 0,
      callTemplateId: u.ai.agentId,
      patchToAgentFlag: u.ai.transfer ? 1 : 0,
      callType: u.ai.target,
      callTeamId: u.ai.teamId,
      callUserId: u.ai.userId,
      noAnswerMessage: u.ai.noAnswerMessage.trim() || null,
      roundRobin: orderToWire(u.ai.roundRobin),
    },
  };
}

/** What exists right now: saved ids are checked against this, not just for being set. */
export type UnmatchedRefs = {
  teamIds: number[];
  activeUserIds: number[];
  agentIds: number[];
  /** Teams whose members have loaded. */
  membersByTeam: Record<number, number[]>;
};

/** What a team destination's rotation is missing, or null. */
function roundRobinProblem(order: RingOrder, teamId: number, refs: UnmatchedRefs): string | null {
  const { userIds, seconds, times } = order;
  const members = refs.membersByTeam[teamId];
  if (userIds.length === 0) return "Put at least one team member in the round robin order.";
  if (new Set(userIds).size !== userIds.length) {
    return "The round robin order lists a member more than once.";
  }
  if (members && userIds.some((id) => !members.includes(id))) {
    return "The round robin order includes someone no longer on this team. Remove them.";
  }
  if (!Number.isInteger(seconds) || seconds < 5 || seconds > 60) {
    return "Ring each member for 5–60 seconds.";
  }
  if (!Number.isInteger(times) || times < 1 || times > 5) {
    return "Cycle the list between 1 and 5 times.";
  }
  return null;
}

/** Only the active choice of Team / Individual and AI / Human is checked. */
function unmatchedWindowProblem(u: UnmatchedWindow, refs: UnmatchedRefs): string | null {
  if (u.mode === "directPatch") {
    const d = u.direct;
    if (d.target === "individual") {
      return d.userId != null && refs.activeUserIds.includes(d.userId)
        ? null
        : "Choose an active user to receive unmatched calls.";
    }
    if (d.teamId == null || !refs.teamIds.includes(d.teamId)) {
      return "Choose an available team to receive unmatched calls.";
    }
    return roundRobinProblem(d.roundRobin, d.teamId, refs);
  }
  const a = u.ai;
  if (a.agentId == null) return "Choose which AI agent takes callers we can't match to a file.";
  if (!refs.agentIds.includes(a.agentId)) {
    return "The AI agent handling unmatched callers no longer exists — choose another.";
  }
  if (!a.transfer) return null;
  if (a.target === "individual") {
    if (a.userId == null || !refs.activeUserIds.includes(a.userId)) {
      return "Choose an available transfer destination for unmatched callers.";
    }
  } else {
    if (a.teamId == null || !refs.teamIds.includes(a.teamId)) {
      return "Choose an available transfer destination for unmatched callers.";
    }
    const rotation = roundRobinProblem(a.roundRobin, a.teamId, refs);
    if (rotation) return rotation;
  }
  if (!a.noAnswerMessage.trim()) {
    return "Write the message played when nobody answers an unmatched-call transfer.";
  }
  return null;
}

/** The first thing stopping the unmatched setup from being saved, or null. */
export function unmatchedProblem(
  config: UnmatchedConfig,
  refs: UnmatchedRefs,
): { window: HoursWindow; message: string } | null {
  for (const window of HOURS_WINDOWS) {
    const message = unmatchedWindowProblem(config[window], refs);
    if (message) return { window, message };
  }
  return null;
}

/* ---------------------------- answering device ----------------------------- */

/** Where people answer calls: one answer for the whole business, per window. */
export type AnsweringDeviceConfig = Record<HoursWindow, AnsweringDevice>;

export function answeringDeviceFromSaved(saved: SavedInboundCallSetting): AnsweringDeviceConfig {
  const read = (w: HoursWindow): AnsweringDevice =>
    saved.answeringDevice?.[WIRE_WINDOW[w]] === "phone" ? "phone" : "browser";
  return { during: read("during"), after: read("after") };
}

/* --------------------------------- saving --------------------------------- */

export type InboundEdits = {
  unmatched?: UnmatchedConfig;
  device?: AnsweringDeviceConfig;
  teams: { teamId: number; window: HoursWindow; value: MatchedWindow }[];
};

/** The document with only `edits` changed — every other team stays as it was. */
function applyInboundEdits(
  doc: SavedInboundCallSetting,
  edits: InboundEdits,
): SavedInboundCallSetting {
  const rows = (w: HoursWindow) => {
    const list = doc.matchedCaller?.[WIRE_WINDOW[w]] ?? [];
    const edited = edits.teams.filter((e) => e.window === w);
    const replaced = list.map((row) => {
      const edit = edited.find((e) => e.teamId === row?.teamId);
      return edit ? matchedWindowToWire(edit.teamId, edit.value) : row;
    });
    const added = edited
      .filter((e) => !list.some((row) => row?.teamId === e.teamId))
      .map((e) => matchedWindowToWire(e.teamId, e.value));
    return [...replaced, ...added];
  };
  return {
    ...doc,
    matchedCaller: { duringBusiness: rows("during"), afterBusiness: rows("after") },
    ...(edits.unmatched && {
      unMatchedCaller: {
        duringBusiness: unmatchedWindowToWire(edits.unmatched.during),
        afterBusiness: unmatchedWindowToWire(edits.unmatched.after),
      },
    }),
    ...(edits.device && {
      answeringDevice: {
        duringBusiness: edits.device.during,
        afterBusiness: edits.device.after,
      },
    }),
  };
}
