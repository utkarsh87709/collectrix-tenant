import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Bot,
  Lock,
  Moon,
  PhoneForwarded,
  Sun,
  User,
  UserCheck,
  UserX,
} from "lucide-react";
import { NativeSelect } from "@/components/tenant/ui";
import { Switch } from "@/components/ui/switch";
import { DurationField, FieldLabel } from "@/components/tenant/statuses/automation-fields";
import {
  AssignedFilesPanel,
  ChoiceCard,
  CountInput,
  NoAnswerPanel,
  OrderedList,
  PatchTabBar,
  UnassignedFilesPanel,
  type PatchTab,
} from "@/components/tenant/calls/CallPatchingPanels";
import type { TemplateOption } from "@/components/tenant/statuses/StatusAutomationCard";
import type { AssignableMember } from "@/lib/team-deck-api";
import { formatPhoneNo, type TeamPhoneNumber } from "@/lib/teams-api";
import {
  CUSTOMER_NUMBER_FIELDS,
  WEEKLY_MAX_AFTER_RPV,
  toMinutes,
  type AiWindowSetup,
  type CallMode,
  type HoursWindow,
  type OutboundCallSetup,
} from "@/lib/status-automation-api";

const ASSIGNED_HINT = "The customer's file already sits with a member of this team.";
const UNASSIGNED_HINT = "The file is with this team but no member has it yet.";

/** A status' one outbound call: who places it, who it reaches, when and from
 *  which number it goes out, and how often. */
export function OutboundCallSetupEditor({
  name,
  setup,
  onChange,
  agents,
  members,
  phoneNumbers,
}: {
  /** Unique per status — prefixes the radio groups. */
  name: string;
  setup: OutboundCallSetup;
  onChange: (setup: OutboundCallSetup) => void;
  /** The client's AI voice agents (`call` templates). */
  agents: TemplateOption[];
  /** The team's members — who can be rung. */
  members: AssignableMember[];
  /** The team's numbers — the caller ids the call can use. */
  phoneNumbers: TeamPhoneNumber[];
}) {
  const [hours, setHours] = useState<HoursWindow>("during");
  const [tab, setTab] = useState<PatchTab>("assigned");
  const patch = (p: Partial<OutboundCallSetup>) => onChange({ ...setup, ...p });
  const patchWindow = (w: HoursWindow, p: Partial<AiWindowSetup>) =>
    patch({ ai: { ...setup.ai, [w]: { ...setup.ai[w], ...p } } });
  const patchDirect = (p: Partial<OutboundCallSetup["direct"]>) =>
    patch({ direct: { ...setup.direct, ...p } });

  // Calling numbers only: a number with calling switched off can't place one.
  const callerOptions = phoneNumbers.filter((n) => n.callEnabled === 1 && n.status === "active");
  const staleCallerIds = setup.callerIds.filter(
    (id) => !callerOptions.some((n) => n.phoneNoId === id),
  );

  const ai = setup.ai[hours];
  const direct = setup.direct;

  return (
    <div className="space-y-5">
      {/* ── Call mode ────────────────────────────────────────────────── */}
      <div>
        <FieldLabel>Call mode</FieldLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            [
              [
                "ai",
                "AI Agent",
                "An AI voice agent places the call, during and after business hours, and can transfer the customer to a person.",
                <Bot key="ai" className="h-4 w-4" />,
              ],
              [
                "directPatch",
                "Direct Patch",
                "The call connects straight to a person, inside business hours only. No AI agent.",
                <User key="direct" className="h-4 w-4" />,
              ],
            ] as [CallMode, string, string, ReactNode][]
          ).map(([mode, title, hint, icon]) => (
            <ChoiceCard
              key={mode}
              name={`${name}-mode`}
              checked={setup.mode === mode}
              onSelect={() => {
                patch({ mode });
                setTab("assigned");
              }}
              icon={icon}
              title={title}
              hint={hint}
            />
          ))}
        </div>
      </div>

      {/* ── AI agent: one setup per business-hours window ───────────── */}
      {setup.mode === "ai" && (
        <div className="rounded-lg border border-border p-3 space-y-3">
          <HoursTabs active={hours} onSelect={setHours} />
          <PatchTabBar
            tabs={["assigned", "unassigned"]}
            active={tab === "unassigned" ? "unassigned" : "assigned"}
            onSelect={setTab}
          />
          {tab === "unassigned" ? (
            <FilesBranch
              kind="unassigned"
              on={ai.unassignedOn}
              onToggle={(unassignedOn) => patchWindow(hours, { unassignedOn })}
              agent={{
                value: ai.unassignedAgentId,
                onChange: (unassignedAgentId) => patchWindow(hours, { unassignedAgentId }),
                options: agents,
              }}
            >
              <UnassignedFilesPanel
                name={`${name}-ai-${hours}-unassigned`}
                value={ai.unassigned}
                onChange={(unassigned) => patchWindow(hours, { unassigned })}
                members={members}
                description={`${UNASSIGNED_HINT} When the AI hands the call over, this is who is rung.`}
                assignUserToggle
              />
            </FilesBranch>
          ) : (
            <FilesBranch
              kind="assigned"
              on={ai.assignedOn}
              onToggle={(assignedOn) => patchWindow(hours, { assignedOn })}
              agent={{
                value: ai.assignedAgentId,
                onChange: (assignedAgentId) => patchWindow(hours, { assignedAgentId }),
                options: agents,
              }}
            >
              <AssignedFilesPanel
                name={`${name}-ai-${hours}-assigned`}
                value={ai.assigned}
                onChange={(assigned) => patchWindow(hours, { assigned })}
                members={members}
                description={`${ASSIGNED_HINT} When the AI hands the call over, this is who is rung.`}
                forwarding
              />
            </FilesBranch>
          )}
          <p className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <PhoneForwarded className="h-3.5 w-3.5 shrink-0" />
            If no team member answers the transfer, the AI offers a callback.
          </p>
        </div>
      )}

      {/* ── Direct patch: straight to a person, business hours only ─── */}
      {setup.mode === "directPatch" && (
        <div className="rounded-lg border border-border p-3 space-y-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sun className="h-3.5 w-3.5 shrink-0" />
            Direct Patch calls are placed inside business hours only.
          </p>
          <div>
            <FieldLabel>Greeting message</FieldLabel>
            <textarea
              value={direct.greeting}
              onChange={(e) => patchDirect({ greeting: e.target.value })}
              rows={2}
              placeholder="Hello, we're connecting you with a member of our team."
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Played to the customer while the call connects. Optional.
            </p>
          </div>
          <PatchTabBar
            tabs={["assigned", "unassigned", "noAnswer"]}
            active={tab === "device" ? "assigned" : tab}
            onSelect={setTab}
          />
          {tab === "assigned" && (
            <FilesBranch
              kind="assigned"
              on={direct.assignedOn}
              onToggle={(assignedOn) => patchDirect({ assignedOn })}
            >
              <AssignedFilesPanel
                name={`${name}-direct-assigned`}
                value={direct.assigned}
                onChange={(assigned) => patchDirect({ assigned })}
                members={members}
                description={ASSIGNED_HINT}
                forwarding
              />
            </FilesBranch>
          )}
          {tab === "unassigned" && (
            <FilesBranch
              kind="unassigned"
              on={direct.unassignedOn}
              onToggle={(unassignedOn) => patchDirect({ unassignedOn })}
            >
              <UnassignedFilesPanel
                name={`${name}-direct-unassigned`}
                value={direct.unassigned}
                onChange={(unassigned) => patchDirect({ unassigned })}
                members={members}
                description={UNASSIGNED_HINT}
                assignUserToggle
              />
            </FilesBranch>
          )}
          {tab === "noAnswer" && (
            <NoAnswerPanel
              value={direct.noAnswerMessage}
              onChange={(noAnswerMessage) => patchDirect({ noAnswerMessage })}
            />
          )}
        </div>
      )}

      {/* ── When ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <DurationField
          label="Place the call after"
          value={setup.placeAfter}
          onChange={(placeAfter) => patch({ placeAfter })}
          ariaPrefix={`${name} call delay`}
          className="max-w-xs"
        />
        <p className="text-[11px] text-muted-foreground">
          Counted from when the file entered this status.
        </p>
      </div>

      {/* ── Numbers ──────────────────────────────────────────────────── */}
      <div>
        <FieldLabel>Outbound caller ID</FieldLabel>
        {callerOptions.length === 0 && staleCallerIds.length === 0 ? (
          <p className="text-[11px] text-warning-foreground">
            This team has no calling numbers yet — assign one to the team under Teams.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {callerOptions.map((n) => (
              <ToggleChip
                key={n.phoneNoId}
                label={formatPhoneNo(n.phoneNo)}
                on={setup.callerIds.includes(n.phoneNoId)}
                onToggle={(on) =>
                  patch({
                    callerIds: on
                      ? [...setup.callerIds, n.phoneNoId]
                      : setup.callerIds.filter((id) => id !== n.phoneNoId),
                  })
                }
              />
            ))}
            {staleCallerIds.map((id) => (
              <ToggleChip
                key={id}
                label={`#${id} (not a calling number on this team)`}
                on
                onToggle={() => patch({ callerIds: setup.callerIds.filter((x) => x !== id) })}
              />
            ))}
          </div>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          What the customer sees. Pick more than one to spread calls across them.
        </p>
      </div>

      <div>
        <FieldLabel>Customer numbers, in call order</FieldLabel>
        <OrderedList
          items={setup.customerNumbers.map((f) => ({ id: f, label: f }))}
          onChange={(ids) => patch({ customerNumbers: ids })}
          addOptions={CUSTOMER_NUMBER_FIELDS.filter((f) => !setup.customerNumbers.includes(f)).map(
            (f) => ({ id: f, label: f }),
          )}
          addPlaceholder="Add a number…"
          empty="No numbers chosen yet — the call can't run without at least one."
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Every listed number is tried in order on each attempt until contact is made.
        </p>
      </div>

      {/* ── Retry ────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <div className="text-sm font-semibold">Retry interval</div>
        <DurationField
          value={setup.retryAfter}
          onChange={(retryAfter) => patch({ retryAfter })}
          ariaPrefix={`${name} retry interval`}
          className="max-w-xs"
        />
        {setup.retryMissing && toMinutes(setup.retryAfter) <= 0 && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            No retry interval came back for this setup. Enter one and save.
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Time to wait before the next call attempt when the call does not result in a conversation.
        </p>
        <p className="text-[11px] text-muted-foreground">
          Calling continues until the file&apos;s status changes or the file is closed.
        </p>
      </div>

      {/* ── Weekly call limits ───────────────────────────────────────── */}
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div>
          <div className="text-sm font-semibold">Weekly call limits</div>
          <p className="text-xs text-muted-foreground">
            Counted per customer file over a rolling 7 days, retries included.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Max calls per week (before Right Party Verification)</FieldLabel>
            <CountInput
              value={setup.weeklyMaxBeforeRpv}
              onChange={(weeklyMaxBeforeRpv) => patch({ weeklyMaxBeforeRpv })}
              suffix="calls"
              ariaLabel="Max calls per week before Right Party Verification"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Applies until the debtor has been verified on a call.
            </p>
          </div>
          <div>
            <FieldLabel>Max contacts per 7 days (after Right Party Verification)</FieldLabel>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-muted text-sm font-semibold"
                title="Fixed — can't be changed"
              >
                <Lock className="h-3.5 w-3.5 text-muted-foreground" /> {WEEKLY_MAX_AFTER_RPV}
              </span>
              <span className="text-sm text-muted-foreground">contacts</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              AI calls only. Counts conversations with the verified debtor and voicemails left,
              starting after the first contact. Applies from the next attempt once the file has an
              RPV flag.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- fragments -------------------------------- */

function HoursTabs({
  active,
  onSelect,
}: {
  active: HoursWindow;
  onSelect: (w: HoursWindow) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
      {(
        [
          ["during", "During business hours", Sun],
          ["after", "After business hours", Moon],
        ] as const
      ).map(([w, label, Icon]) => {
        const on = w === active;
        return (
          <button
            key={w}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(w)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
              on
                ? `${w === "during" ? "bg-gradient-tenant" : "bg-indigo-600"} text-white font-semibold shadow-sm`
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        );
      })}
    </div>
  );
}

/** One kind of file (assigned / unassigned): calls on or off, the AI agent
 *  that places them, and — passed as children — who they reach. */
function FilesBranch({
  kind,
  on,
  onToggle,
  agent,
  children,
}: {
  kind: "assigned" | "unassigned";
  on: boolean;
  onToggle: (on: boolean) => void;
  /** AI agent mode only. */
  agent?: {
    value: number | null;
    onChange: (id: number | null) => void;
    options: TemplateOption[];
  };
  children?: ReactNode;
}) {
  const assigned = kind === "assigned";
  const Icon = assigned ? UserCheck : UserX;
  const title = assigned ? "Call files that are assigned" : "Call files that are not assigned";
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border px-4 py-3">
        <div className="flex items-start gap-2 min-w-0">
          <Icon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <p className="text-xs text-muted-foreground">
              {assigned ? ASSIGNED_HINT : UNASSIGNED_HINT}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold">{on ? "ON" : "OFF"}</span>
          <Switch checked={on} onCheckedChange={onToggle} aria-label={title} />
        </div>
      </div>
      {!on ? (
        <p className="px-1 text-xs text-muted-foreground">No calls are placed for these files.</p>
      ) : (
        <>
          {agent && <AgentSelect {...agent} kind={kind} />}
          {children}
        </>
      )}
    </div>
  );
}

function AgentSelect({
  kind,
  value,
  onChange,
  options,
}: {
  kind: "assigned" | "unassigned";
  value: number | null;
  onChange: (id: number | null) => void;
  options: TemplateOption[];
}) {
  const label = `AI voice agent for ${kind === "assigned" ? "assigned" : "unassigned"} files`;
  return (
    <div className="max-w-md">
      <FieldLabel>{label}</FieldLabel>
      <NativeSelect
        size="sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        aria-label={label}
      >
        <option value="">Select AI voice agent…</option>
        {/* Keep a saved id visible even if it has left the library. */}
        {value != null && !options.some((a) => a.id === value) && (
          <option value={value}>#{value} (not in this client&apos;s library)</option>
        )}
        {options.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </NativeSelect>
      {options.length === 0 && (
        <p className="mt-1 text-[11px] text-warning-foreground">
          No AI voice agents for this client yet —{" "}
          <Link to="/tenant/engagement/template-library" className="underline">
            add one under Template Library
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function ToggleChip({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <label
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm cursor-pointer ${
        on ? "border-tenant bg-tenant-soft text-tenant font-medium" : "border-border"
      }`}
    >
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-3.5 w-3.5 accent-tenant"
      />
      {label}
    </label>
  );
}
