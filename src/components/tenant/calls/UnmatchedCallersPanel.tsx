import { useState } from "react";
import { Bot, Check, ChevronsUpDown, Info, User } from "lucide-react";
import { NativeSelect, PageCard } from "@/components/tenant/ui";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FieldLabel } from "@/components/tenant/statuses/automation-fields";
import {
  INBOUND_MATCHING_HELP,
  type AgentGroup,
  type UnmatchedConfig,
  type UnmatchedDestination as Destination,
  type UnmatchedWindow,
} from "@/lib/call-configuration-api";
import type { HoursWindow, RingOrder } from "@/lib/status-automation-api";
import type { AssignableMember } from "@/lib/team-deck-api";
import type { TeamListItem } from "@/lib/teams-api";
import { ChoiceCard, RoundRobin } from "./CallPatchingPanels";
import { AgentSelect, HoursWindowTabs } from "./InboundCallFields";

const TEXTAREA = "w-full px-3 py-2 text-sm rounded-lg border border-border bg-background";

export type UserOption = { id: number; name: string };

/**
 * The setup for callers who aren't matched to exactly one file: one for the whole
 * business, in each hours window. Inside business hours they go to the AI or a
 * person; outside them, only the AI.
 */
export function UnmatchedCallersPanel({
  value,
  onChange,
  window,
  onWindowChange,
  isDirty,
  canEdit,
  agentGroups,
  users,
  teams,
  membersByTeam,
  loadMembers,
}: {
  value: UnmatchedConfig;
  /** Takes an updater: picking a team seeds its round robin once members load. */
  onChange: (update: (prev: UnmatchedConfig) => UnmatchedConfig) => void;
  window: HoursWindow;
  onWindowChange: (window: HoursWindow) => void;
  isDirty: (window: HoursWindow) => boolean;
  canEdit: boolean;
  agentGroups: AgentGroup[];
  /** Every active user, including people on no team. */
  users: UserOption[];
  teams: TeamListItem[];
  membersByTeam: Record<number, AssignableMember[]>;
  loadMembers: (teamId: number) => Promise<AssignableMember[]>;
}) {
  const current = value[window];
  const human = window === "during" && current.mode === "directPatch";

  const patchWindow = (fn: (w: UnmatchedWindow) => UnmatchedWindow) =>
    onChange((prev) => ({ ...prev, [window]: fn(prev[window]) }));
  const patchDirect = (p: Partial<UnmatchedWindow["direct"]>) =>
    patchWindow((w) => ({ ...w, direct: { ...w.direct, ...p } }));
  const patchAi = (p: Partial<UnmatchedWindow["ai"]>) =>
    patchWindow((w) => ({ ...w, ai: { ...w.ai, ...p } }));

  // A new team starts with all its members in the rotation.
  const pickTeam = async (branch: "direct" | "ai", teamId: number | null) => {
    patchWindow((w) => ({
      ...w,
      [branch]: { ...w[branch], teamId, roundRobin: { ...w[branch].roundRobin, userIds: [] } },
    }));
    if (teamId == null) return;
    const members = await loadMembers(teamId).catch(() => []);
    patchWindow((w) =>
      w[branch].teamId === teamId
        ? {
            ...w,
            [branch]: {
              ...w[branch],
              roundRobin: { ...w[branch].roundRobin, userIds: members.map((m) => m.userId) },
            },
          }
        : w,
    );
  };

  return (
    <PageCard>
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-bold">Unmatched Callers</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="How callers are matched"
                  className="text-muted-foreground"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">{INBOUND_MATCHING_HELP}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-sm text-muted-foreground">
          Global handling for callers not matched to a customer file, across all teams.
        </p>
        {!canEdit && (
          <p className="mt-1 text-xs text-muted-foreground">
            Only a tenant admin can change these settings.
          </p>
        )}
      </div>

      <div className="px-6 py-5 space-y-5">
        <HoursWindowTabs value={window} onChange={onWindowChange} isDirty={isDirty} />

        <fieldset disabled={!canEdit} className="min-w-0 space-y-5">
          {window === "during" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                name="unmatched-mode"
                checked={!human}
                onSelect={() => patchWindow((w) => ({ ...w, mode: "ai" }))}
                icon={<Bot className="h-4 w-4" />}
                title="AI"
                hint="Screen the caller and optionally transfer to a person."
              />
              <ChoiceCard
                name="unmatched-mode"
                checked={human}
                onSelect={() => patchWindow((w) => ({ ...w, mode: "directPatch" }))}
                icon={<User className="h-4 w-4" />}
                title="Human"
                hint="Ring a selected team or an individual."
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="h-4 w-4" /> AI
            </div>
          )}

          {human ? (
            <>
              <div>
                <div className="text-sm font-semibold mb-2">Initialisation</div>
                <FieldLabel>Initial Message</FieldLabel>
                <textarea
                  aria-label="Initial Message"
                  rows={3}
                  className={TEXTAREA}
                  value={current.direct.greeting}
                  onChange={(e) => patchDirect({ greeting: e.target.value })}
                  placeholder="Enter instructions for what the AI should say while the call is being connected to an agent."
                />
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">Send unmatched calls to</div>
                <UnmatchedDestination
                  name="unmatched-human-target"
                  value={current.direct}
                  teams={teams}
                  users={users}
                  disabled={!canEdit}
                  onTarget={(target) => patchDirect({ target })}
                  onTeam={(teamId) => pickTeam("direct", teamId)}
                  onUser={(userId) => patchDirect({ userId })}
                />
              </div>

              <TeamRoundRobin
                value={current.direct}
                onChange={(roundRobin) => patchDirect({ roundRobin })}
                membersByTeam={membersByTeam}
              />

              <div>
                <div className="text-sm font-semibold mb-2">If nobody answers</div>
                <textarea
                  aria-label="If nobody answers"
                  rows={3}
                  className={TEXTAREA}
                  value={current.direct.noAnswerMessage}
                  onChange={(e) => patchDirect({ noAnswerMessage: e.target.value })}
                  placeholder="Enter the message the caller should hear if nobody answers."
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Family members, wrong numbers, customers calling from a number that isn&apos;t on
                their file, and general enquiries. The AI answers, works out who is calling and why,
                and hands the call over only on the terms below.
              </p>
              <AgentSelect
                label="Which AI agent takes these calls"
                hint="The same agents your status automations speak with."
                value={current.ai.agentId}
                onChange={(agentId) => patchAi({ agentId })}
                groups={agentGroups}
              />

              <div className="rounded-xl border border-border p-4 space-y-4">
                <div>
                  <div className="text-sm font-semibold">Handing the call over</div>
                  <p className="text-xs text-muted-foreground">
                    An unmatched caller reaches a person only once the AI knows who they are.
                  </p>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-lg border border-border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">Transfer the caller to a person</div>
                    <p className="text-[11px] text-muted-foreground">
                      Off — the AI takes a message and ends the call itself.
                    </p>
                  </div>
                  <Switch
                    checked={current.ai.transfer}
                    onCheckedChange={(transfer) => patchAi({ transfer })}
                    disabled={!canEdit}
                    aria-label="Transfer the caller to a person"
                  />
                </div>

                {current.ai.transfer && (
                  <>
                    <div>
                      <div className="text-sm font-semibold mb-2">Transfer destination</div>
                      <UnmatchedDestination
                        name={`unmatched-ai-target-${window}`}
                        value={current.ai}
                        teams={teams}
                        users={users}
                        disabled={!canEdit}
                        onTarget={(target) => patchAi({ target })}
                        onTeam={(teamId) => pickTeam("ai", teamId)}
                        onUser={(userId) => patchAi({ userId })}
                      />
                    </div>

                    <TeamRoundRobin
                      value={current.ai}
                      onChange={(roundRobin) => patchAi({ roundRobin })}
                      membersByTeam={membersByTeam}
                    />

                    <p className="text-[11px] text-muted-foreground">
                      The call is handed over as an unidentified caller: the AI never confirms or
                      discusses an account with someone it couldn&apos;t match, and whoever takes
                      the call is told as much.
                    </p>

                    <div>
                      <div className="text-sm font-semibold mb-2">If nobody answers</div>
                      <FieldLabel>Voice message to play</FieldLabel>
                      <textarea
                        aria-label="Voice message to play"
                        rows={3}
                        className={TEXTAREA}
                        value={current.ai.noAnswerMessage}
                        onChange={(e) => patchAi({ noAnswerMessage: e.target.value })}
                        placeholder="What the caller hears…"
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </fieldset>
      </div>
    </PageCard>
  );
}

/** Who a team destination rings, and in what order. Nothing for an individual. */
function TeamRoundRobin({
  value,
  onChange,
  membersByTeam,
}: {
  value: Destination & { roundRobin: RingOrder };
  onChange: (roundRobin: RingOrder) => void;
  membersByTeam: Record<number, AssignableMember[]>;
}) {
  if (value.target !== "team") return null;
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold">Round robin within the team</div>
        <p className="text-xs text-muted-foreground">
          Rings one member at a time, in the order you set, until someone answers.
        </p>
      </div>
      {value.teamId != null && (
        <RoundRobin
          value={value.roundRobin}
          onChange={onChange}
          members={membersByTeam[value.teamId] ?? []}
        />
      )}
    </div>
  );
}

/** Team or Individual. Switching keeps both choices; only the active one counts. */
function UnmatchedDestination({
  name,
  value,
  teams,
  users,
  disabled,
  onTarget,
  onTeam,
  onUser,
}: {
  /** Radio group name — unique per destination on the page. */
  name: string;
  value: Destination;
  teams: TeamListItem[];
  users: UserOption[];
  disabled: boolean;
  onTarget: (target: Destination["target"]) => void;
  onTeam: (teamId: number | null) => void;
  onUser: (userId: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Unmatched call destination" className="flex gap-4">
        {(["team", "individual"] as const).map((option) => (
          <label key={option} className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={name}
              checked={value.target === option}
              onChange={() => onTarget(option)}
              className="accent-tenant"
            />
            {option === "team" ? "Team" : "Individual"}
          </label>
        ))}
      </div>
      {value.target === "team" ? (
        <div>
          <FieldLabel>Team to receive unmatched calls</FieldLabel>
          <NativeSelect
            value={value.teamId ?? ""}
            onChange={(e) => onTeam(e.target.value ? Number(e.target.value) : null)}
            aria-label="Team to receive unmatched calls"
          >
            <option value="">Select a team…</option>
            {teams.map((t) => (
              <option key={t.teamId} value={t.teamId}>
                {t.teamName}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : (
        <div>
          <FieldLabel>Individual to receive unmatched calls</FieldLabel>
          <PersonPicker value={value.userId} users={users} disabled={disabled} onChange={onUser} />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Calls go directly to this person. Useful for a receptionist or front-desk user.
          </p>
        </div>
      )}
    </div>
  );
}

function PersonPicker({
  value,
  users,
  disabled,
  onChange,
}: {
  value: number | null;
  users: UserOption[];
  disabled: boolean;
  onChange: (userId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = users.find((u) => u.id === value);
  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open && !disabled}
          aria-label="Individual to receive unmatched calls"
          disabled={disabled}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left text-sm disabled:opacity-60"
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected?.name ??
              (value != null ? `User #${value} (no longer active)` : "Select a user…")}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search active users…" />
          <CommandList>
            <CommandEmpty>No active users found.</CommandEmpty>
            {users.map((u) => (
              <CommandItem
                key={u.id}
                value={String(u.id)}
                keywords={[u.name]}
                onSelect={() => {
                  onChange(u.id);
                  setOpen(false);
                }}
              >
                <Check className={`mr-2 h-4 w-4 ${value === u.id ? "opacity-100" : "opacity-0"}`} />
                {u.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
