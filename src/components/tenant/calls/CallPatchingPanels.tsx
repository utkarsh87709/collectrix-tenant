import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Headphones,
  PhoneMissed,
  UserCheck,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react";
import { NativeSelect } from "@/components/tenant/ui";
import { FieldLabel } from "@/components/tenant/statuses/automation-fields";
import type { AssignableMember } from "@/lib/team-deck-api";
import { fullName } from "@/lib/teams-api";
import type {
  AnsweringDevice,
  AssignedPatchMethod,
  CallPatching,
  ManualDial,
  Ring,
  UnassignedPatchMethod,
} from "@/lib/status-automation-api";

// Who a call rings once it reaches a person, where they pick up and what is
// said when nobody does. Outbound call steps (Status Automation) and a team's
// incoming call settings (Call Configuration) carry the same fields, so both
// screens draw them from here.

const ASSIGNED_METHODS: { id: AssignedPatchMethod; title: string; hint: string }[] = [
  {
    id: "exactMatch",
    title: "Exact match to the assigned member",
    hint: "Rings only the person the file is distributed to.",
  },
  {
    id: "roundRobin",
    title: "Round robin within the team",
    hint: "Rings one member at a time, in the order you set, until someone answers.",
  },
  {
    id: "ringAll",
    title: "Simultaneous ring — everyone on the team",
    hint: "Rings every available member at once. The first to answer takes the call.",
  },
];

const UNASSIGNED_METHODS: { id: UnassignedPatchMethod; title: string; hint: string }[] = [
  {
    id: "roundRobin",
    title: "Round robin",
    hint: "Rings one member at a time, in the order you set, until someone answers.",
  },
  {
    id: "ringAll",
    title: "Call all the members",
    hint: "Every available member's line rings together. The first to answer takes the call.",
  },
  {
    id: "manual",
    title: "Set it up manually, one by one",
    hint: "Build the chain yourself — pick who rings, for how long, and in what order.",
  },
];

const ANSWERING_DEVICES: {
  id: AnsweringDevice;
  title: string;
  hint: string;
  traits: string[];
}[] = [
  {
    id: "browser",
    title: "Collectrix browser phone",
    hint: "The call comes into the browser. The member sees an alert on screen, answers with one click, and the customer file opens with it.",
    traits: ["Customer file opens", "Recorded here", "Notes during the call"],
  },
  {
    id: "phone",
    title: "External phone number",
    hint: "Collectrix rings the external number saved against that member. The call goes straight through and never reaches the browser.",
    traits: ["No file on screen", "Notes added after", "Needs a saved number"],
  },
];

/* ---------------------------------- tabs ---------------------------------- */

export type PatchTab = "assigned" | "unassigned" | "device" | "noAnswer";

/** Each tab keeps the accent it has in the design when selected. */
const TAB_META: Record<PatchTab, { label: string; icon: LucideIcon; active: string }> = {
  assigned: { label: "Assigned files", icon: UserCheck, active: "bg-gradient-tenant text-white" },
  unassigned: { label: "Unassigned files", icon: UserX, active: "bg-orange-700 text-white" },
  device: { label: "Answering device", icon: Headphones, active: "bg-slate-800 text-white" },
  noAnswer: { label: "If nobody answers", icon: PhoneMissed, active: "bg-rose-600 text-white" },
};

export function PatchTabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: PatchTab[];
  active: PatchTab;
  onSelect: (tab: PatchTab) => void;
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
      {tabs.map((id) => {
        const { label, icon: Icon, active: activeCls } = TAB_META[id];
        const on = id === active;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
              on
                ? `${activeCls} font-semibold shadow-sm`
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

/* --------------------------------- panels --------------------------------- */

function PanelShell({
  icon,
  title,
  badge,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  badge?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {icon}
          <span className="text-sm font-semibold">{title}</span>
          {badge && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {badge}
            </span>
          )}
        </div>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function AssignedFilesPanel({
  name,
  value,
  onChange,
  members,
  description,
}: {
  /** Radio group name — unique per panel on the page. */
  name: string;
  value: CallPatching["assigned"];
  onChange: (value: CallPatching["assigned"]) => void;
  members: AssignableMember[];
  description: string;
}) {
  const setMethod = (method: AssignedPatchMethod) =>
    onChange({
      ...value,
      method,
      // A loaded setting only carries the list of the method it was saved with.
      roundRobin:
        method === "roundRobin" && value.roundRobin.userIds.length === 0
          ? { ...value.roundRobin, userIds: members.map((m) => m.userId) }
          : value.roundRobin,
    });

  return (
    <PanelShell
      icon={<UserCheck className="h-4 w-4 text-muted-foreground" />}
      title="Files that are assigned"
      badge="Call patching"
      description={description}
    >
      <div className="space-y-2">
        {ASSIGNED_METHODS.map((m) => (
          <ChoiceCard
            key={m.id}
            name={name}
            checked={value.method === m.id}
            onSelect={() => setMethod(m.id)}
            title={m.title}
            hint={m.hint}
          />
        ))}
      </div>
      {value.method === "exactMatch" && (
        <RingFields
          ring={value.exactMatch}
          onChange={(exactMatch) => onChange({ ...value, exactMatch })}
          secondsLabel="Ring for"
          timesLabel="Dial times"
          timesSuffix="time(s)"
        />
      )}
      {value.method === "ringAll" && (
        <RingFields
          ring={value.ringAll}
          onChange={(ringAll) => onChange({ ...value, ringAll })}
          secondsLabel="Ring everyone for"
          timesLabel="Dial times"
          timesSuffix="time(s)"
        />
      )}
      {value.method === "roundRobin" && (
        <RoundRobin
          value={value.roundRobin}
          onChange={(roundRobin) => onChange({ ...value, roundRobin })}
          members={members}
        />
      )}
    </PanelShell>
  );
}

export function UnassignedFilesPanel({
  name,
  value,
  onChange,
  members,
  description,
}: {
  /** Radio group name — unique per panel on the page. */
  name: string;
  value: CallPatching["unassigned"];
  onChange: (value: CallPatching["unassigned"]) => void;
  members: AssignableMember[];
  description: string;
}) {
  const memberIds = members.map((m) => m.userId);
  const setMethod = (method: UnassignedPatchMethod) =>
    onChange({
      ...value,
      method,
      roundRobin:
        method === "roundRobin" && value.roundRobin.userIds.length === 0
          ? { ...value.roundRobin, userIds: memberIds }
          : value.roundRobin,
      manual:
        method === "manual" && value.manual.length === 0
          ? memberIds.map((userId) => ({ userId, seconds: 20, times: 1 }))
          : value.manual,
    });

  return (
    <PanelShell
      icon={<UserX className="h-4 w-4 text-muted-foreground" />}
      title="Files that are not assigned"
      badge="Call patching"
      description={description}
    >
      <div className="space-y-2">
        {UNASSIGNED_METHODS.map((m) => (
          <ChoiceCard
            key={m.id}
            name={name}
            checked={value.method === m.id}
            onSelect={() => setMethod(m.id)}
            title={m.title}
            hint={m.hint}
          />
        ))}
      </div>
      {value.method === "ringAll" && (
        <RingFields
          ring={value.ringAll}
          onChange={(ringAll) => onChange({ ...value, ringAll })}
          secondsLabel="Ring everyone for"
          timesLabel="Dial times"
          timesSuffix="time(s)"
        />
      )}
      {value.method === "roundRobin" && (
        <RoundRobin
          value={value.roundRobin}
          onChange={(roundRobin) => onChange({ ...value, roundRobin })}
          members={members}
        />
      )}
      {value.method === "manual" && (
        <ManualList
          value={value.manual}
          onChange={(manual) => onChange({ ...value, manual })}
          members={members}
        />
      )}
    </PanelShell>
  );
}

export function AnsweringDevicePanel({
  name,
  value,
  onChange,
}: {
  /** Radio group name — unique per panel on the page. */
  name: string;
  value: AnsweringDevice;
  onChange: (device: AnsweringDevice) => void;
}) {
  return (
    <PanelShell
      icon={<Headphones className="h-4 w-4 text-muted-foreground" />}
      title="Where your people answer calls"
      description="The assigned and unassigned rules decide who gets rung; this decides the device the ringing lands on. A call the AI handles alone never uses it."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {ANSWERING_DEVICES.map((d) => {
          const on = value === d.id;
          return (
            <label
              key={d.id}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
                on ? "border-tenant bg-tenant-soft" : "border-border hover:bg-muted/40"
              }`}
            >
              <input
                type="radio"
                name={name}
                checked={on}
                onChange={() => onChange(d.id)}
                className="mt-1 accent-tenant"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{d.title}</span>
                <span className="block text-xs text-muted-foreground">{d.hint}</span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {d.traits.map((t) => (
                    <span
                      key={t}
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${
                        on ? "border-tenant/30 text-tenant" : "border-border text-muted-foreground"
                      }`}
                    >
                      {t}
                    </span>
                  ))}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </PanelShell>
  );
}

export function NoAnswerPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (message: string) => void;
}) {
  return (
    <PanelShell
      icon={<PhoneMissed className="h-4 w-4 text-muted-foreground" />}
      title="If nobody answers"
      badge="Voice message"
      description="Played once the ringing runs out — every member tried."
    >
      <div>
        <FieldLabel>Voice message to play</FieldLabel>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder="Sorry, nobody is available to take your call right now. Please leave a message and we'll return your call as soon as we can."
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">Optional.</p>
      </div>
    </PanelShell>
  );
}

/* ------------------------------- fragments -------------------------------- */

/** A whole number followed by its unit, e.g. "[20] seconds". */
export function CountInput({
  value,
  onChange,
  suffix,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
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
      {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
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
      <div className="rounded-lg border border-border p-3 space-y-2">
        <div>
          <div className="text-sm font-semibold">Round robin order</div>
          <p className="text-[11px] text-muted-foreground">
            Members are rung one at a time, top to bottom. Move a row to rearrange it, or take
            someone out of the rotation entirely — they stay on the team either way.
          </p>
        </div>
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
        <p className="flex items-center gap-2 rounded-lg bg-tenant-soft px-3 py-2 text-xs text-tenant">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>
            With {people} {people === 1 ? "person" : "people"} in the rotation this rings for up to{" "}
            <strong>{total} seconds</strong> before the no-answer message plays.
          </span>
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
export function OrderedList<T extends string | number>({
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
        type="button"
        className={btn}
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
        aria-label="Move up"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={btn}
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
        aria-label="Move down"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
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
export function ChoiceCard({
  name,
  checked,
  onSelect,
  title,
  hint,
  icon,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
  icon?: ReactNode;
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
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}
