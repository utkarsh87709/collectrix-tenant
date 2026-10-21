import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { NativeSelect } from "@/components/tenant/ui";
import { DurationField, FieldLabel } from "@/components/tenant/statuses/automation-fields";
import type { TemplateOption } from "@/components/tenant/statuses/StatusAutomationCard";
import type { AssignableMember } from "@/lib/team-deck-api";
import { formatPhoneNo, fullName, type TeamPhoneNumber } from "@/lib/teams-api";
import {
  CUSTOMER_NUMBER_FIELDS,
  TRY_NEXT_REASONS,
  copyCallStep,
  formatDuration,
  newCallStep,
  validateCallStep,
  type AssignedPatchMethod,
  type CallMode,
  type CallStep,
  type ManualDial,
  type Ring,
  type UnassignedPatchMethod,
} from "@/lib/status-automation-api";

const ASSIGNED_METHODS: { id: AssignedPatchMethod; title: string; hint: string }[] = [
  {
    id: "exactMatch",
    title: "Exact match to the assigned member",
    hint: "Rings only the member the file is assigned to.",
  },
  {
    id: "roundRobin",
    title: "Round robin within the team",
    hint: "Rings one member at a time, in the order you set, until someone answers.",
  },
  {
    id: "ringAll",
    title: "Simultaneous ring — everyone on the team",
    hint: "Rings every member at once. The first to answer takes the call.",
  },
];

const UNASSIGNED_METHODS: { id: UnassignedPatchMethod; title: string; hint: string }[] = [
  {
    id: "roundRobin",
    title: "Round robin within the team",
    hint: "Rings one member at a time, in the order you set, until someone answers.",
  },
  {
    id: "ringAll",
    title: "Simultaneous ring — everyone on the team",
    hint: "Rings every member at once. The first to answer takes the call.",
  },
  {
    id: "manual",
    title: "Manual setup",
    hint: "Rings the members you pick, in the order you set, each with their own ring time.",
  },
];

type PatchTab = "assigned" | "unassigned" | "noAnswer";

/** The call steps of one status' outbound-call behaviour. */
export function OutboundCallSteps({
  steps,
  onChange,
  agents,
  members,
  phoneNumbers,
}: {
  steps: CallStep[];
  onChange: (steps: CallStep[]) => void;
  /** The client's AI voice agents (`call` templates). */
  agents: TemplateOption[];
  /** The team's members — who can be rung. */
  members: AssignableMember[];
  /** The team's numbers — the caller ids a step can use. */
  phoneNumbers: TeamPhoneNumber[];
}) {
  const memberIds = members.map((m) => m.userId);
  const patchStep = (key: string, patch: Partial<CallStep>) =>
    onChange(steps.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <CallStepCard
          key={step.key}
          step={step}
          index={i}
          onPatch={(patch) => patchStep(step.key, patch)}
          onDuplicate={() =>
            onChange([...steps.slice(0, i + 1), copyCallStep(step), ...steps.slice(i + 1)])
          }
          onRemove={() => onChange(steps.filter((s) => s.key !== step.key))}
          agents={agents}
          members={members}
          memberIds={memberIds}
          phoneNumbers={phoneNumbers}
        />
      ))}
      <button
        onClick={() => onChange([...steps, newCallStep(memberIds)])}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border text-sm hover:bg-muted w-full justify-center"
      >
        <Plus className="h-4 w-4" /> Add call step
      </button>
    </div>
  );
}

function CallStepCard({
  step,
  index,
  onPatch,
  onDuplicate,
  onRemove,
  agents,
  members,
  memberIds,
  phoneNumbers,
}: {
  step: CallStep;
  index: number;
  onPatch: (patch: Partial<CallStep>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  agents: TemplateOption[];
  members: AssignableMember[];
  memberIds: number[];
  phoneNumbers: TeamPhoneNumber[];
}) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<PatchTab>("assigned");
  const error = validateCallStep(step, index);
  const { assigned, unassigned } = step;

  const setAssignedMethod = (method: AssignedPatchMethod) =>
    onPatch({
      assigned: {
        ...assigned,
        method,
        // A loaded step only carries the list of the method it was saved with.
        roundRobin:
          method === "roundRobin" && assigned.roundRobin.userIds.length === 0
            ? { ...assigned.roundRobin, userIds: [...memberIds] }
            : assigned.roundRobin,
      },
    });

  const setUnassignedMethod = (method: UnassignedPatchMethod) =>
    onPatch({
      unassigned: {
        ...unassigned,
        method,
        roundRobin:
          method === "roundRobin" && unassigned.roundRobin.userIds.length === 0
            ? { ...unassigned.roundRobin, userIds: [...memberIds] }
            : unassigned.roundRobin,
        manual:
          method === "manual" && unassigned.manual.length === 0
            ? memberIds.map((userId) => ({ userId, seconds: 20, times: 1 }))
            : unassigned.manual,
      },
    });

  const hours = step.businessHoursOnly
    ? step.customerTimeZone
      ? "Customer's business hours"
      : "Business hours only"
    : "Any time";
  const numbers = step.customerNumbers.length;
  const summary = [
    step.mode === "ai" ? "AI agent" : "Direct patch",
    `After ${formatDuration(step.placeAfter)}`,
    hours,
    numbers ? `${numbers} customer number${numbers === 1 ? "" : "s"}` : "No numbers",
  ].join(" · ");

  // Calling numbers only: a number with calling switched off can't place one.
  const callerOptions = phoneNumbers.filter((n) => n.callEnabled === 1 && n.status === "active");
  const staleCallerIds = step.callerIds.filter(
    (id) => !callerOptions.some((n) => n.phoneNoId === id),
  );

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* ── Step header ──────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-3 flex-1 text-left min-w-0"
          aria-expanded={open}
        >
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0">
            <div className={`font-semibold text-sm ${step.name.trim() ? "" : "italic"}`}>
              {step.name.trim() || "Untitled call step"}
            </div>
            <div className="text-xs text-muted-foreground truncate">{summary}</div>
          </div>
        </button>
        {error && (
          <span className="hidden xl:inline-flex items-center gap-1 text-xs text-warning-foreground bg-warning/15 rounded px-2 py-1 max-w-sm truncate">
            <AlertCircle className="h-3 w-3 shrink-0" /> {error}
          </span>
        )}
        <button
          onClick={onDuplicate}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
          aria-label={`Duplicate call step ${index + 1}`}
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          onClick={onRemove}
          className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
          aria-label={`Remove call step ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-5 border-t border-border">
          {/* ── Name ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            <div>
              <FieldLabel>Call step name</FieldLabel>
              <TextInput
                value={step.name}
                onChange={(name) => onPatch({ name })}
                placeholder="First promise reminder call"
              />
            </div>
            <div>
              <FieldLabel>Internal description</FieldLabel>
              <TextInput
                value={step.description}
                onChange={(description) => onPatch({ description })}
                placeholder="Only your admins see this"
              />
            </div>
          </div>

          {/* ── Call mode ────────────────────────────────────────────── */}
          <div>
            <FieldLabel>Call mode</FieldLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  ["ai", "AI Agent", "An AI agent speaks first and can transfer to a person."],
                  [
                    "directPatch",
                    "Direct Patch",
                    "The call connects straight to a person. No AI, no greeting.",
                  ],
                ] as [CallMode, string, string][]
              ).map(([mode, title, hint]) => (
                <ChoiceCard
                  key={mode}
                  name={`${step.key}-mode`}
                  checked={step.mode === mode}
                  onSelect={() => onPatch({ mode })}
                  title={title}
                  hint={hint}
                />
              ))}
            </div>
          </div>

          {step.mode === "ai" && (
            <div className="max-w-md">
              <FieldLabel>AI voice agent</FieldLabel>
              <NativeSelect
                size="sm"
                value={step.agentId ?? ""}
                onChange={(e) =>
                  onPatch({ agentId: e.target.value ? Number(e.target.value) : null })
                }
                aria-label="AI voice agent that places the call"
              >
                <option value="">Select AI voice agent…</option>
                {/* Keep a saved id visible even if it has left the library. */}
                {step.agentId != null && !agents.some((a) => a.id === step.agentId) && (
                  <option value={step.agentId}>
                    #{step.agentId} (not in this client&apos;s library)
                  </option>
                )}
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
              {agents.length === 0 && (
                <p className="mt-1 text-[11px] text-warning-foreground">
                  No AI voice agents for this client yet —{" "}
                  <Link to="/tenant/engagement/template-library" className="underline">
                    add one under Template Library
                  </Link>
                  .
                </p>
              )}
            </div>
          )}

          {/* ── Who is rung ──────────────────────────────────────────── */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">
                  {step.mode === "ai"
                    ? "When the AI hands the call to a person"
                    : "Who the call connects to"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Who is rung, in what order, and what is said when nobody picks up.
                </p>
              </div>
              <div>
                <FieldLabel>Members answer on</FieldLabel>
                <div className="flex items-center gap-4">
                  {(["phone", "browser"] as const).map((device) => (
                    <label
                      key={device}
                      className="inline-flex items-center gap-1.5 cursor-pointer text-sm"
                    >
                      <input
                        type="radio"
                        name={`${step.key}-device`}
                        checked={step.answeringDevice === device}
                        onChange={() => onPatch({ answeringDevice: device })}
                        className="accent-tenant"
                      />
                      {device === "phone" ? "Phone" : "Browser"}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
              {(
                [
                  ["assigned", "Assigned files"],
                  ["unassigned", "Unassigned files"],
                  ["noAnswer", "If nobody answers"],
                ] as [PatchTab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`px-3 py-1.5 rounded-md text-sm ${
                    tab === id ? "bg-card shadow-sm font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "assigned" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  The customer&apos;s file already sits with a member of this team.
                </p>
                <div className="space-y-2">
                  {ASSIGNED_METHODS.map((m) => (
                    <ChoiceCard
                      key={m.id}
                      name={`${step.key}-assigned`}
                      checked={assigned.method === m.id}
                      onSelect={() => setAssignedMethod(m.id)}
                      title={m.title}
                      hint={m.hint}
                    />
                  ))}
                </div>
                {assigned.method === "exactMatch" && (
                  <RingFields
                    ring={assigned.exactMatch}
                    onChange={(exactMatch) => onPatch({ assigned: { ...assigned, exactMatch } })}
                    secondsLabel="Ring the member for"
                    timesLabel="Ring them"
                    timesSuffix="time(s)"
                  />
                )}
                {assigned.method === "ringAll" && (
                  <RingFields
                    ring={assigned.ringAll}
                    onChange={(ringAll) => onPatch({ assigned: { ...assigned, ringAll } })}
                    secondsLabel="Ring everyone for"
                    timesLabel="Ring them"
                    timesSuffix="time(s)"
                  />
                )}
                {assigned.method === "roundRobin" && (
                  <RoundRobin
                    value={assigned.roundRobin}
                    onChange={(roundRobin) => onPatch({ assigned: { ...assigned, roundRobin } })}
                    members={members}
                  />
                )}
              </div>
            )}

            {tab === "unassigned" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  The file is with this team but no member has it yet.
                </p>
                <div className="space-y-2">
                  {UNASSIGNED_METHODS.map((m) => (
                    <ChoiceCard
                      key={m.id}
                      name={`${step.key}-unassigned`}
                      checked={unassigned.method === m.id}
                      onSelect={() => setUnassignedMethod(m.id)}
                      title={m.title}
                      hint={m.hint}
                    />
                  ))}
                </div>
                {unassigned.method === "ringAll" && (
                  <RingFields
                    ring={unassigned.ringAll}
                    onChange={(ringAll) => onPatch({ unassigned: { ...unassigned, ringAll } })}
                    secondsLabel="Ring everyone for"
                    timesLabel="Ring them"
                    timesSuffix="time(s)"
                  />
                )}
                {unassigned.method === "roundRobin" && (
                  <RoundRobin
                    value={unassigned.roundRobin}
                    onChange={(roundRobin) =>
                      onPatch({ unassigned: { ...unassigned, roundRobin } })
                    }
                    members={members}
                  />
                )}
                {unassigned.method === "manual" && (
                  <ManualList
                    value={unassigned.manual}
                    onChange={(manual) => onPatch({ unassigned: { ...unassigned, manual } })}
                    members={members}
                  />
                )}
              </div>
            )}

            {tab === "noAnswer" && (
              <div>
                <FieldLabel>Message when nobody answers</FieldLabel>
                <textarea
                  value={step.noAnswerMessage}
                  onChange={(e) => onPatch({ noAnswerMessage: e.target.value })}
                  rows={3}
                  placeholder="One of our team members will contact you shortly."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Said to the customer when nobody on the team picks up. Optional.
                </p>
              </div>
            )}
          </div>

          {/* ── When ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <DurationField
              label="Place the call after"
              value={step.placeAfter}
              onChange={(placeAfter) => onPatch({ placeAfter })}
              ariaPrefix={`Call step ${index + 1} delay`}
              className="max-w-xs"
            />
            <p className="-mt-2 text-[11px] text-muted-foreground">
              Counted from when the file entered this status.
            </p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={step.businessHoursOnly}
                onChange={(e) => onPatch({ businessHoursOnly: e.target.checked })}
                className="h-4 w-4 mt-0.5 accent-tenant"
              />
              <span>
                <span className="text-sm">Only during configured business hours</span>
                <span className="block text-[11px] text-muted-foreground">
                  Uses your hours from Tenant Settings → Hours.
                </span>
              </span>
            </label>
            <label
              className={`flex items-start gap-2 ml-6 ${
                step.businessHoursOnly ? "cursor-pointer" : "opacity-50"
              }`}
            >
              <input
                type="checkbox"
                checked={step.businessHoursOnly && step.customerTimeZone}
                disabled={!step.businessHoursOnly}
                onChange={(e) => onPatch({ customerTimeZone: e.target.checked })}
                className="h-4 w-4 mt-0.5 accent-tenant"
              />
              <span>
                <span className="text-sm">Read those hours in the customer&apos;s time zone</span>
                <span className="block text-[11px] text-muted-foreground">
                  A customer in another time zone is called during their own working day.
                </span>
              </span>
            </label>
          </div>

          {/* ── Numbers ──────────────────────────────────────────────── */}
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
                    on={step.callerIds.includes(n.phoneNoId)}
                    onToggle={(on) =>
                      onPatch({
                        callerIds: on
                          ? [...step.callerIds, n.phoneNoId]
                          : step.callerIds.filter((id) => id !== n.phoneNoId),
                      })
                    }
                  />
                ))}
                {staleCallerIds.map((id) => (
                  <ToggleChip
                    key={id}
                    label={`#${id} (not a calling number on this team)`}
                    on
                    onToggle={() => onPatch({ callerIds: step.callerIds.filter((x) => x !== id) })}
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
              items={step.customerNumbers.map((f) => ({ id: f, label: f }))}
              onChange={(ids) => onPatch({ customerNumbers: ids })}
              addOptions={CUSTOMER_NUMBER_FIELDS.filter(
                (f) => !step.customerNumbers.includes(f),
              ).map((f) => ({ id: f, label: f }))}
              addPlaceholder="Add a number…"
              empty="No numbers chosen yet — the call can't run without at least one."
            />
          </div>

          <div>
            <FieldLabel>Try the next number when</FieldLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TRY_NEXT_REASONS.map((reason) => (
                <label
                  key={reason}
                  className="inline-flex items-center gap-2 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={step.tryNextWhen.includes(reason)}
                    onChange={(e) =>
                      onPatch({
                        tryNextWhen: e.target.checked
                          ? [...step.tryNextWhen, reason]
                          : step.tryNextWhen.filter((r) => r !== reason),
                      })
                    }
                    className="h-4 w-4 accent-tenant"
                  />
                  {reason}
                </label>
              ))}
            </div>
          </div>

          {/* ── Retry ────────────────────────────────────────────────── */}
          <div className="rounded-lg border border-border p-3">
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <span>
                <span className="text-sm font-semibold">Retry the whole step</span>
                <span className="block text-[11px] text-muted-foreground">
                  {step.retry.enabled
                    ? "If none of the numbers connect, the step starts over after this long."
                    : "The step is attempted once and the outcome is recorded."}
                </span>
              </span>
              <input
                type="checkbox"
                checked={step.retry.enabled}
                onChange={(e) => onPatch({ retry: { ...step.retry, enabled: e.target.checked } })}
                className="h-4 w-4 mt-0.5 accent-tenant"
              />
            </label>
            {step.retry.enabled && (
              <DurationField
                label="Retry after"
                value={step.retry.after}
                onChange={(after) => onPatch({ retry: { ...step.retry, after } })}
                ariaPrefix={`Call step ${index + 1} retry`}
                className="max-w-xs mt-3"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- fragments -------------------------------- */

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background"
    />
  );
}

/** A whole number followed by its unit, e.g. "[20] seconds". */
function CountInput({
  value,
  onChange,
  suffix,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix: string;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="w-20 h-9 px-2 text-sm rounded-lg border border-border bg-background"
        aria-label={ariaLabel}
      />
      <span className="text-sm text-muted-foreground">{suffix}</span>
    </div>
  );
}

function RingFields({
  ring,
  onChange,
  secondsLabel,
  timesLabel,
  timesSuffix,
}: {
  ring: Ring;
  onChange: (r: Ring) => void;
  secondsLabel: string;
  timesLabel: string;
  timesSuffix: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <FieldLabel>{secondsLabel}</FieldLabel>
        <CountInput
          value={ring.seconds}
          onChange={(seconds) => onChange({ ...ring, seconds })}
          suffix="seconds"
          ariaLabel={`${secondsLabel} (seconds)`}
        />
      </div>
      <div>
        <FieldLabel>{timesLabel}</FieldLabel>
        <CountInput
          value={ring.times}
          onChange={(times) => onChange({ ...ring, times })}
          suffix={timesSuffix}
          ariaLabel={`${timesLabel} (${timesSuffix})`}
        />
      </div>
    </div>
  );
}

/** Display name for a ring-list member; a saved id can belong to someone who
 *  has since left the team. */
function memberLabel(members: AssignableMember[], userId: number): string {
  const m = members.find((x) => x.userId === userId);
  return m ? fullName(m) : `User #${userId} (not on this team)`;
}

function RoundRobin({
  value,
  onChange,
  members,
}: {
  value: Ring & { userIds: number[] };
  onChange: (v: Ring & { userIds: number[] }) => void;
  members: AssignableMember[];
}) {
  const people = value.userIds.length;
  const total = people * value.seconds * value.times;
  return (
    <div className="space-y-3">
      <RingFields
        ring={value}
        onChange={(r) => onChange({ ...value, ...r })}
        secondsLabel="Ring each member for"
        timesLabel="Cycle the list"
        timesSuffix="time(s) before giving up"
      />
      <div>
        <FieldLabel>Round robin order</FieldLabel>
        <OrderedList
          items={value.userIds.map((id) => ({ id, label: memberLabel(members, id) }))}
          onChange={(userIds) => onChange({ ...value, userIds })}
          addOptions={members
            .filter((m) => !value.userIds.includes(m.userId))
            .map((m) => ({ id: m.userId, label: fullName(m) }))}
          addPlaceholder="Add a member…"
          empty="Nobody in the rotation — add a member."
        />
      </div>
      {people > 0 && total > 0 && (
        <p className="text-[11px] text-muted-foreground">
          With {people} {people === 1 ? "person" : "people"} in the rotation this rings for up to{" "}
          <strong>{total} seconds</strong> before giving up.
        </p>
      )}
    </div>
  );
}

/** Manual setup: an ordered list of members, each with their own timing. */
function ManualList({
  value,
  onChange,
  members,
}: {
  value: ManualDial[];
  onChange: (v: ManualDial[]) => void;
  members: AssignableMember[];
}) {
  const patch = (userId: number, p: Partial<ManualDial>) =>
    onChange(value.map((m) => (m.userId === userId ? { ...m, ...p } : m)));
  const addable = members.filter((m) => !value.some((v) => v.userId === m.userId));

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-[11px] text-warning-foreground">Nobody is rung yet — add a member.</p>
      )}
      {value.map((m, i) => (
        <div
          key={m.userId}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2"
        >
          <span className="h-5 w-5 rounded-full bg-tenant-soft text-tenant text-[11px] font-bold flex items-center justify-center shrink-0">
            {i + 1}
          </span>
          <span className="text-sm flex-1 min-w-32">{memberLabel(members, m.userId)}</span>
          <CountInput
            value={m.seconds}
            onChange={(seconds) => patch(m.userId, { seconds })}
            suffix="seconds"
            ariaLabel={`Ring ${memberLabel(members, m.userId)} for (seconds)`}
          />
          <CountInput
            value={m.times}
            onChange={(times) => patch(m.userId, { times })}
            suffix="time(s)"
            ariaLabel={`Ring ${memberLabel(members, m.userId)} (times)`}
          />
          <MoveButtons
            index={i}
            count={value.length}
            onMove={(to) => onChange(move(value, i, to))}
            onRemove={() => onChange(value.filter((x) => x.userId !== m.userId))}
          />
        </div>
      ))}
      {addable.length > 0 && (
        <AddSelect
          placeholder="Add a member…"
          options={addable.map((m) => ({ id: m.userId, label: fullName(m) }))}
          onAdd={(userId) => onChange([...value, { userId, seconds: 20, times: 1 }])}
        />
      )}
    </div>
  );
}

/** Reorderable list with an "add" picker for what isn't in it yet. */
function OrderedList<T extends string | number>({
  items,
  onChange,
  addOptions,
  addPlaceholder,
  empty,
}: {
  items: { id: T; label: string }[];
  onChange: (ids: T[]) => void;
  addOptions: { id: T; label: string }[];
  addPlaceholder: string;
  empty: string;
}) {
  const ids = items.map((x) => x.id);
  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-[11px] text-warning-foreground">{empty}</p>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {items.map((item, i) => (
            <div key={String(item.id)} className="flex items-center gap-3 px-3 py-2">
              <span className="h-5 w-5 rounded-full bg-tenant-soft text-tenant text-[11px] font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm flex-1 min-w-0 truncate">{item.label}</span>
              <MoveButtons
                index={i}
                count={items.length}
                onMove={(to) => onChange(move(ids, i, to))}
                onRemove={() => onChange(ids.filter((id) => id !== item.id))}
              />
            </div>
          ))}
        </div>
      )}
      {addOptions.length > 0 && (
        <AddSelect
          placeholder={addPlaceholder}
          options={addOptions}
          onAdd={(id) => onChange([...ids, id])}
        />
      )}
    </div>
  );
}

function AddSelect<T extends string | number>({
  placeholder,
  options,
  onAdd,
}: {
  placeholder: string;
  options: { id: T; label: string }[];
  onAdd: (id: T) => void;
}) {
  return (
    <NativeSelect
      size="sm"
      className="max-w-xs"
      // Always shows the placeholder: picking an option adds it and resets.
      value=""
      onChange={(e) => {
        const hit = options.find((o) => String(o.id) === e.target.value);
        if (hit) onAdd(hit.id);
      }}
      aria-label={placeholder}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={String(o.id)} value={String(o.id)}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}

function MoveButtons({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const btn = "p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        className={btn}
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
        aria-label="Move up"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button
        className={btn}
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
        aria-label="Move down"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <button
        className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
        onClick={onRemove}
        aria-label="Remove"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** A radio option drawn as a selectable card. */
function ChoiceCard({
  name,
  checked,
  onSelect,
  title,
  hint,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
        checked ? "border-tenant bg-tenant-soft" : "border-border hover:bg-muted/40"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="mt-1 accent-tenant"
      />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
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
