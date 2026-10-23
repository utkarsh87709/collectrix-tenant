import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";
import { NativeSelect } from "@/components/tenant/ui";
import { DurationField, FieldLabel } from "@/components/tenant/statuses/automation-fields";
import {
  AnsweringDevicePanel,
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
  TRY_NEXT_REASONS,
  copyCallStep,
  formatDuration,
  newCallStep,
  validateCallStep,
  type CallMode,
  type CallStep,
} from "@/lib/status-automation-api";

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
  phoneNumbers,
}: {
  step: CallStep;
  index: number;
  onPatch: (patch: Partial<CallStep>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  agents: TemplateOption[];
  members: AssignableMember[];
  phoneNumbers: TeamPhoneNumber[];
}) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<PatchTab>("assigned");
  const error = validateCallStep(step, index);

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

            <PatchTabBar
              tabs={["assigned", "unassigned", "device", "noAnswer"]}
              active={tab}
              onSelect={setTab}
            />

            {tab === "assigned" && (
              <AssignedFilesPanel
                name={`${step.key}-assigned`}
                value={step.assigned}
                onChange={(assigned) => onPatch({ assigned })}
                members={members}
                description="The customer's file already sits with a member of this team."
              />
            )}
            {tab === "unassigned" && (
              <UnassignedFilesPanel
                name={`${step.key}-unassigned`}
                value={step.unassigned}
                onChange={(unassigned) => onPatch({ unassigned })}
                members={members}
                description="The file is with this team but no member has it yet."
              />
            )}
            {tab === "device" && (
              <AnsweringDevicePanel
                name={`${step.key}-device`}
                value={step.answeringDevice}
                onChange={(answeringDevice) => onPatch({ answeringDevice })}
              />
            )}
            {tab === "noAnswer" && (
              <NoAnswerPanel
                value={step.noAnswerMessage}
                onChange={(noAnswerMessage) => onPatch({ noAnswerMessage })}
              />
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
                {!step.retry.enabled && (
                  <span className="block text-[11px] text-muted-foreground">
                    The step is attempted once and the outcome is recorded.
                  </span>
                )}
              </span>
              <input
                type="checkbox"
                checked={step.retry.enabled}
                onChange={(e) => onPatch({ retry: { ...step.retry, enabled: e.target.checked } })}
                className="h-4 w-4 mt-0.5 accent-tenant"
              />
            </label>
            {step.retry.enabled && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-end gap-4">
                  <DurationField
                    label="Retry after"
                    value={step.retry.after}
                    onChange={(after) => onPatch({ retry: { ...step.retry, after } })}
                    ariaPrefix={`Call step ${index + 1} retry`}
                    className="w-full max-w-xs"
                  />
                  <div>
                    <FieldLabel>Maximum retries</FieldLabel>
                    <CountInput
                      value={step.retry.maxTries}
                      onChange={(maxTries) => onPatch({ retry: { ...step.retry, maxTries } })}
                      ariaLabel={`Call step ${index + 1} maximum retries`}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Applies when the connection target could not be reached, the customer could not be
                  reached, or no number was valid.
                </p>
              </div>
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
