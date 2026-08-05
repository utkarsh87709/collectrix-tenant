import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { StatusPill } from "@/components/tenant/statuses/StatusPill";
import { NativeSelect } from "@/components/tenant/ui";
import {
  CHANNEL_LABEL,
  DURATION_UNIT_LABEL,
  conflictingChannels,
  isAiOnlyChannel,
  newFollowUp,
  summarizeAutomation,
  validateAutomation,
  type ChannelConfig,
  type ChannelKey,
  type Duration,
  type DurationUnit,
  type FollowUp,
  type MessageSource,
  type StatusAutomationConfig,
  type StatusAutomationRow,
} from "@/lib/status-automation-api";

const CHANNEL_ICON: Record<ChannelKey, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  call: Phone,
};

/** A selectable Template Library entry (template or AI agent). */
export type TemplateOption = { id: number; name: string };

/** A team member eligible for auto-assignment. */
export type MemberOption = { userId: number; name: string };

export function StatusAutomationCard({
  row,
  config,
  allowed,
  open,
  onToggleOpen,
  onChange,
  onPreview,
  templatesFor,
  templateName,
  members,
  documentsAllowed,
  otherStatuses,
  loadingDetails,
}: {
  row: StatusAutomationRow;
  config: StatusAutomationConfig;
  /** Channels the selected client permits. */
  allowed: ChannelKey[];
  open: boolean;
  onToggleOpen: () => void;
  onChange: (patch: Partial<StatusAutomationConfig>) => void;
  onPreview: () => void;
  templatesFor: (channel: ChannelKey, source: MessageSource) => TemplateOption[];
  templateName: (id: number | null) => string;
  members: MemberOption[];
  /** False when the client has document generation switched off. */
  documentsAllowed: boolean;
  otherStatuses: StatusAutomationRow[];
  loadingDetails: boolean;
}) {
  const error = validateAutomation(config, allowed);
  const summary = summarizeAutomation(config, allowed, templateName);
  const conflicts = conflictingChannels(config, allowed);

  const patchChannel = (ch: ChannelKey, patch: Partial<ChannelConfig>) =>
    onChange({ channels: { ...config.channels, [ch]: { ...config.channels[ch], ...patch } } });

  const patchFollowUp = (key: string, patch: Partial<FollowUp>) =>
    onChange({
      followUps: config.followUps.map((f) => (f.key === key ? { ...f, ...patch } : f)),
    });

  const addFollowUp = () =>
    onChange({ followUps: [...config.followUps, newFollowUp(allowed[0] ?? "email")] });

  return (
    <div className="rounded-2xl border border-border/70 bg-card shadow-elegant overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 flex items-center gap-4 border-b border-border">
        <button
          onClick={onToggleOpen}
          className="flex items-center gap-3 flex-1 text-left min-w-0"
          aria-expanded={open}
        >
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <StatusPill code={row.statusCode} name="" color={row.statusColorCode} />
          <div className="min-w-0">
            <div className="font-semibold">{row.status}</div>
            <div className="text-xs text-muted-foreground truncate">
              {loadingDetails ? "Loading saved settings…" : summary}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-3 shrink-0">
          {error && (
            <span className="hidden lg:inline-flex items-center gap-1 text-xs text-warning-foreground bg-warning/15 rounded px-2 py-1">
              <AlertCircle className="h-3 w-3" /> {error}
            </span>
          )}
          <button
            onClick={onPreview}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs hover:bg-muted"
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-muted-foreground">
              {config.enabled ? "Enabled" : "Disabled"}
            </span>
            <input
              type="checkbox"
              className="sr-only peer"
              checked={config.enabled}
              disabled={loadingDetails}
              onChange={(e) => onChange({ enabled: e.target.checked })}
              aria-label={`Automation for ${row.status}`}
            />
            <span
              className={`relative w-10 h-5 ${config.enabled ? "bg-tenant" : "bg-muted"} rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-5`}
            />
          </label>
        </div>
      </div>

      {open && (
        <div
          className={`px-6 py-5 space-y-6 ${config.enabled ? "" : "opacity-50 pointer-events-none"}`}
        >
          {conflicts.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
              <span>
                {conflicts.map((c) => CHANNEL_LABEL[c]).join(", ")} is configured here but switched
                off for this client. Saving will turn it off and drop its follow-ups.
              </span>
            </div>
          )}

          {/* ── Outreach channels ─────────────────────────────────────── */}
          <section>
            <SectionLabel>Outreach channels</SectionLabel>
            {allowed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This client has every communication channel switched off. Enable SMS, email or
                calling on the client record to automate outreach.
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {allowed.map((ch) => {
                  const cfg = config.channels[ch];
                  const Icon = CHANNEL_ICON[ch];
                  const aiOnly = isAiOnlyChannel(ch);
                  const options = templatesFor(ch, cfg.messageSource);
                  return (
                    <div
                      key={ch}
                      className={`rounded-lg border p-3 space-y-3 ${cfg.enabled ? "border-tenant/40 bg-tenant-soft/30" : "border-border bg-muted/30"}`}
                    >
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold">
                          <Icon className="h-4 w-4 text-tenant" /> {CHANNEL_LABEL[ch]}
                          {aiOnly && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-tenant bg-tenant-soft rounded px-1 py-0.5">
                              AI
                            </span>
                          )}
                        </span>
                        <input
                          type="checkbox"
                          checked={cfg.enabled}
                          onChange={(e) => patchChannel(ch, { enabled: e.target.checked })}
                          className="h-4 w-4 accent-tenant"
                        />
                      </label>

                      {cfg.enabled && (
                        <div className="space-y-2">
                          <DurationField
                            label="Start outreach after"
                            value={cfg.startAfter}
                            onChange={(startAfter) => patchChannel(ch, { startAfter })}
                            ariaPrefix={`${CHANNEL_LABEL[ch]} delay`}
                          />

                          {/* Voice is always agent-driven, so it skips the
                              template/AI choice and picks an agent directly. */}
                          {!aiOnly && (
                            <div>
                              <FieldLabel>Message source</FieldLabel>
                              <div className="flex items-center gap-4">
                                {/* "ai" is hidden for now — Template is the only
                                    selectable source for text channels. */}
                                {(["template"] as MessageSource[]).map((src) => (
                                  <label
                                    key={src}
                                    className="inline-flex items-center gap-1.5 cursor-pointer text-sm"
                                  >
                                    <input
                                      type="radio"
                                      name={`src-${config.statusId}-${ch}`}
                                      checked={cfg.messageSource === src}
                                      onChange={() =>
                                        // The two sources read different
                                        // libraries, so the old id can't carry over.
                                        patchChannel(ch, { messageSource: src, templateId: null })
                                      }
                                      className="accent-tenant"
                                    />
                                    {src === "template" ? "Template" : "AI-generated"}
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <FieldLabel>
                              {aiOnly
                                ? "AI agent"
                                : cfg.messageSource === "ai"
                                  ? "AI prompt (optional)"
                                  : "First template"}
                            </FieldLabel>
                            <NativeSelect
                              size="sm"
                              value={cfg.templateId ?? ""}
                              onChange={(e) =>
                                patchChannel(ch, {
                                  templateId: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                            >
                              <option value="">
                                {aiOnly
                                  ? "Select agent…"
                                  : cfg.messageSource === "ai"
                                    ? "No prompt — let the AI write freely"
                                    : "Select template…"}
                              </option>
                              {options.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </NativeSelect>
                            {options.length === 0 && (
                              <p className="mt-1 text-[11px] text-warning-foreground">
                                Nothing in the{" "}
                                {aiOnly
                                  ? "call"
                                  : cfg.messageSource === "ai"
                                    ? "AI prompt"
                                    : CHANNEL_LABEL[ch].toLowerCase()}{" "}
                                library for this client yet — add one under Template Library.
                              </p>
                            )}
                            {aiOnly && (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                The AI agent places the call and speaks with each debtor at call
                                time.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Follow-ups ─────────────────────────────────────────────── */}
          {allowed.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel className="mb-0">Follow-ups</SectionLabel>
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={config.followUpsEnabled}
                    onChange={(e) => onChange({ followUpsEnabled: e.target.checked })}
                    className="h-3.5 w-3.5 accent-tenant"
                  />
                  Enable follow-ups
                </label>
              </div>
              {config.followUpsEnabled && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Each follow-up is timed from the moment the file entered this status, the same
                    anchor as the first outreach above.
                  </p>
                  {config.followUps.map((fu, idx) => {
                    const options = templatesFor(fu.channel, fu.messageSource);
                    const aiOnly = isAiOnlyChannel(fu.channel);
                    return (
                      <div
                        key={fu.key}
                        className="rounded-lg border border-border bg-card p-3 space-y-2"
                      >
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="text-xs text-muted-foreground font-semibold pb-2 w-6">
                            #{idx + 1}
                          </div>
                          <div className="flex-1 min-w-40">
                            <FieldLabel>Channel</FieldLabel>
                            <NativeSelect
                              size="sm"
                              value={fu.channel}
                              onChange={(e) => {
                                const next = e.target.value as ChannelKey;
                                patchFollowUp(fu.key, {
                                  channel: next,
                                  // Text channels are template-only while the
                                  // "ai" source is hidden.
                                  messageSource: isAiOnlyChannel(next) ? "ai" : "template",
                                  templateId: null,
                                });
                              }}
                            >
                              {allowed.map((c) => (
                                <option key={c} value={c}>
                                  {CHANNEL_LABEL[c]}
                                </option>
                              ))}
                            </NativeSelect>
                          </div>
                          <DurationField
                            label="Send after"
                            value={fu.after}
                            onChange={(after) => patchFollowUp(fu.key, { after })}
                            ariaPrefix={`Follow-up ${idx + 1} delay`}
                            className="min-w-52"
                          />
                          <button
                            onClick={() =>
                              onChange({
                                followUps: config.followUps.filter((f) => f.key !== fu.key),
                              })
                            }
                            className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                            aria-label={`Remove follow-up ${idx + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {!aiOnly && (
                            <div>
                              <FieldLabel>Message source</FieldLabel>
                              <div className="flex items-center gap-4 py-1">
                                {/* "ai" is hidden for now — Template is the only
                                    selectable source for text channels. */}
                                {(["template"] as MessageSource[]).map((src) => (
                                  <label
                                    key={src}
                                    className="inline-flex items-center gap-1.5 cursor-pointer text-sm"
                                  >
                                    <input
                                      type="radio"
                                      name={`fusrc-${fu.key}`}
                                      checked={fu.messageSource === src}
                                      onChange={() =>
                                        patchFollowUp(fu.key, {
                                          messageSource: src,
                                          templateId: null,
                                        })
                                      }
                                      className="accent-tenant"
                                    />
                                    {src === "template" ? "Template" : "AI-generated"}
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <FieldLabel>
                              {aiOnly
                                ? "AI agent"
                                : fu.messageSource === "ai"
                                  ? "AI prompt (optional)"
                                  : "Template"}
                            </FieldLabel>
                            <NativeSelect
                              size="sm"
                              value={fu.templateId ?? ""}
                              onChange={(e) =>
                                patchFollowUp(fu.key, {
                                  templateId: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                            >
                              <option value="">
                                {aiOnly
                                  ? "Select agent…"
                                  : fu.messageSource === "ai"
                                    ? "No prompt — let the AI write freely"
                                    : "Select template…"}
                              </option>
                              {options.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </NativeSelect>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    onClick={addFollowUp}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border text-sm hover:bg-muted w-full justify-center"
                  >
                    <Plus className="h-4 w-4" /> Add follow-up
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ── Toggleable behaviours ──────────────────────────────────── */}
          <BehaviorRow
            icon={<UserPlus className="h-4 w-4 text-tenant" />}
            title="Assign to team member"
            subtitle="Files entering this status are handed to one member of the selected team."
            enabled={config.assignMember.enabled}
            onToggle={(enabled) => onChange({ assignMember: { ...config.assignMember, enabled } })}
          >
            <NativeSelect
              size="sm"
              className="max-w-sm"
              value={config.assignMember.userId ?? ""}
              onChange={(e) =>
                onChange({
                  assignMember: {
                    ...config.assignMember,
                    userId: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
              aria-label="Team member to assign"
            >
              <option value="">Select team member…</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
            {members.length === 0 && (
              <p className="mt-1 text-[11px] text-warning-foreground">
                This team has no members to assign to yet.
              </p>
            )}
          </BehaviorRow>

          <BehaviorRow
            icon={<FileText className="h-4 w-4 text-tenant" />}
            title="Generate documents"
            subtitle={
              documentsAllowed
                ? "Produces this status' document set when a file enters it."
                : "This client has document generation switched off."
            }
            enabled={config.generateDocuments}
            disabled={!documentsAllowed}
            onToggle={(enabled) => onChange({ generateDocuments: enabled })}
          />

          <BehaviorRow
            icon={<Archive className="h-4 w-4 text-tenant" />}
            title="Auto-archive when in this status"
            subtitle="Removes the file from active workload & aging but retains all records, documents and history. Recoverable."
            enabled={config.autoArchive.enabled}
            onToggle={(enabled) => onChange({ autoArchive: { ...config.autoArchive, enabled } })}
          >
            <DurationField
              label="Archive after"
              value={config.autoArchive.after}
              onChange={(after) => onChange({ autoArchive: { ...config.autoArchive, after } })}
              ariaPrefix="Auto-archive delay"
              className="max-w-xs"
            />
          </BehaviorRow>

          <BehaviorRow
            icon={<Clock className="h-4 w-4 text-tenant" />}
            title="Inactivity transition"
            subtitle="Moves the file on when nothing happens on it for this long."
            enabled={config.inactivity.enabled}
            onToggle={(enabled) => onChange({ inactivity: { ...config.inactivity, enabled } })}
          >
            <div className="flex flex-wrap items-end gap-3">
              <DurationField
                label="After no activity for"
                value={config.inactivity.after}
                onChange={(after) => onChange({ inactivity: { ...config.inactivity, after } })}
                ariaPrefix="Inactivity period"
                className="min-w-52"
              />
              <div className="min-w-48">
                <FieldLabel>Move to status</FieldLabel>
                <NativeSelect
                  size="sm"
                  value={config.inactivity.toStatusId ?? ""}
                  onChange={(e) =>
                    onChange({
                      inactivity: {
                        ...config.inactivity,
                        toStatusId: e.target.value ? Number(e.target.value) : null,
                      },
                    })
                  }
                >
                  <option value="">Select status…</option>
                  {otherStatuses.map((s) => (
                    <option key={s.statusId} value={s.statusId}>
                      {s.statusCode} · {s.status}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </BehaviorRow>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- fragments -------------------------------- */

/** Number + unit pair. Stored as minutes on the wire, edited in whatever unit
 *  suits — the backend takes 4320 where the user means "3 days". */
function DurationField({
  label,
  value,
  onChange,
  ariaPrefix,
  className = "",
}: {
  label: string;
  value: Duration;
  onChange: (d: Duration) => void;
  ariaPrefix: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          value={value.value}
          onChange={(e) => onChange({ ...value, value: Math.max(0, Number(e.target.value) || 0) })}
          className="flex-1 min-w-16 h-9 px-2 text-sm rounded-lg border border-border bg-background"
          aria-label={`${ariaPrefix} amount`}
        />
        <NativeSelect
          size="sm"
          // The wrapper is a flex item: without a width its w-full select would
          // have nothing to measure against.
          className="w-28 shrink-0"
          value={value.unit}
          onChange={(e) => onChange({ ...value, unit: e.target.value as DurationUnit })}
          aria-label={`${ariaPrefix} unit`}
        >
          {(Object.keys(DURATION_UNIT_LABEL) as DurationUnit[]).map((u) => (
            <option key={u} value={u}>
              {DURATION_UNIT_LABEL[u]}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  className = "mb-3",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`text-[11px] uppercase tracking-wider text-muted-foreground font-semibold ${className}`}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
      {children}
    </label>
  );
}

/** One switchable behaviour, revealing its settings only when switched on. */
function BehaviorRow({
  icon,
  title,
  subtitle,
  enabled,
  disabled = false,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border border-border p-4 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-sm font-semibold">
            {icon} {title}
          </div>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>}
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-4 w-4 accent-tenant"
          />
          <span className="text-sm">Enable</span>
        </label>
      </div>
      {enabled && children && <div className="mt-3">{children}</div>}
    </div>
  );
}
