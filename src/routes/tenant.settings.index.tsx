import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Save,
  Clock,
  Calendar,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Mail,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  Plug,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { DAY_KEYS, DAY_LABELS, type WeeklyHours } from "@/lib/agent-availability-utils";
import {
  getTenantDetails,
  updateTenantDetails,
  type TenantDetails,
  type UpdateTenantDetailsInput,
  type DayFlag,
} from "@/lib/tenant-settings-api";
import { getTimezoneList, type TimezoneItem } from "@/lib/profile-api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SettingsSkeleton } from "@/components/admin/Skeletons";

export const Route = createFileRoute("/tenant/settings/")({
  head: () => ({ meta: [{ title: "Tenant Settings · Tenant Admin" }] }),
  component: SettingsPage,
});

type TabKey = "organization" | "availability" | "integrations";

// Mapping between the backend's per-day flag/time columns and the WeeklyHours
// shape the Hours UI works with.
const DAY_TO_PREFIX: Record<
  keyof WeeklyHours,
  "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
> = {
  mon: "mon",
  tue: "tue",
  wed: "wed",
  thu: "thu",
  fri: "fri",
  sat: "sat",
  sun: "sun",
};

function detailsToWeekly(d: TenantDetails): WeeklyHours {
  const out = {} as WeeklyHours;
  for (const day of DAY_KEYS) {
    const p = DAY_TO_PREFIX[day];
    out[day] = {
      enabled: d[`${p}Enabled` as const] === 1,
      start: d[`${p}StartTime` as const] ?? "09:00",
      end: d[`${p}EndTime` as const] ?? "18:00",
    };
  }
  return out;
}

function SettingsPage() {
  const [tab, setTab] = useState<TabKey>("organization");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timezones, setTimezones] = useState<TimezoneItem[]>([]);

  // Organization
  const [name, setName] = useState("");
  const [tz, setTz] = useState("");

  // Availability
  const [weekly, setWeekly] = useState<WeeklyHours>({
    mon: { start: "09:00", end: "18:00", enabled: true },
    tue: { start: "09:00", end: "18:00", enabled: true },
    wed: { start: "09:00", end: "18:00", enabled: true },
    thu: { start: "09:00", end: "18:00", enabled: true },
    fri: { start: "09:00", end: "18:00", enabled: true },
    sat: { start: "09:00", end: "18:00", enabled: false },
    sun: { start: "09:00", end: "18:00", enabled: false },
  });

  // Email configuration (senderEmail* on the tenant record)
  const [emailProvider, setEmailProvider] = useState("Google");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderPassword, setSenderPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // Twilio SMS (senderPhone* on the tenant record)
  const [twilioCountry, setTwilioCountry] = useState("United States (+1)");
  const [twilioAreaCode, setTwilioAreaCode] = useState("");
  const [twilioNumber, setTwilioNumber] = useState("");

  const [emailExpanded, setEmailExpanded] = useState(true);
  const [twilioExpanded, setTwilioExpanded] = useState(true);

  const emailConnected = Boolean(senderEmail);
  const twilioConnected = Boolean(twilioNumber);

  // Hydrate the form from the tenant record (and load timezone options).
  useEffect(() => {
    let active = true;
    Promise.all([getTenantDetails(), getTimezoneList()])
      .then(([d, { timezoneList }]) => {
        if (!active) return;
        setTimezones(timezoneList);
        setName(d.companyName ?? "");
        setTz(d.timezone ?? "");
        setWeekly(detailsToWeekly(d));
        setEmailProvider(d.senderEmailType ?? "Google");
        setSenderEmail(d.senderEmailId ?? "");
        setSenderPassword(d.senderEmailPassword ?? "");
        setTwilioCountry(d.senderPhoneCountry ?? "United States (+1)");
        setTwilioAreaCode(d.senderPhoneAreaCode ?? "");
        setTwilioNumber(d.senderPhoneNo ?? "");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load settings"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // updateTenantDetails replaces the whole record, so every save sends the full
  // payload assembled from current state — partial saves stay non-destructive.
  const buildPayload = useCallback((): UpdateTenantDetailsInput => {
    const dayFields = {} as Record<string, DayFlag | string>;
    for (const day of DAY_KEYS) {
      const p = DAY_TO_PREFIX[day];
      dayFields[`${p}Enabled`] = (weekly[day].enabled ? 1 : 0) as DayFlag;
      dayFields[`${p}StartTime`] = weekly[day].start;
      dayFields[`${p}EndTime`] = weekly[day].end;
    }
    return {
      companyName: name,
      timezone: tz,
      senderEmailType: emailProvider || null,
      senderEmailId: senderEmail || null,
      senderEmailPassword: senderPassword || null,
      senderPhoneAreaCode: twilioAreaCode || null,
      senderPhoneCountry: twilioCountry || null,
      senderPhoneNo: twilioNumber || null,
      ...(dayFields as unknown as Omit<
        UpdateTenantDetailsInput,
        | "companyName"
        | "timezone"
        | "senderEmailType"
        | "senderEmailId"
        | "senderEmailPassword"
        | "senderPhoneAreaCode"
        | "senderPhoneCountry"
        | "senderPhoneNo"
      >),
    };
  }, [
    name,
    tz,
    emailProvider,
    senderEmail,
    senderPassword,
    twilioCountry,
    twilioAreaCode,
    twilioNumber,
    weekly,
  ]);

  const save = useCallback(
    async (successMsg: string) => {
      setSaving(true);
      try {
        await updateTenantDetails(buildPayload());
        toast.success(successMsg);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [buildPayload],
  );

  const saveAll = () => save("Settings saved");
  const saveProfile = () => save("Organization profile saved");
  const saveHours = () => save("Availability hours saved");
  const saveEmail = () => save("Email settings saved");
  const saveTwilio = () => save("Twilio SMS settings saved");

  return (
    <Shell>
      <Topbar
        title="Tenant Settings"
        subtitle="Configure your workspace and operating hours"
        action={
          <button
            onClick={saveAll}
            disabled={loading || saving}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
            Save changes
          </button>
        }
      />

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <>
          {/* Quick links */}
          <section className="px-6 lg:px-10 pt-6">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-tenant" /> Shortcuts
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ShortcutCard
                to="/tenant/settings/custom-fields"
                icon={<Sparkles className="h-5 w-5" />}
                title="Custom Fields"
                desc="Tenant-defined debtor fields, import & CRM mapping"
              />
            </div>
          </section>

          {/* Tabs */}
          <section className="px-6 lg:px-10 py-6">
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
              <TabsList className="grid grid-cols-3 w-full max-w-3xl mb-5 bg-muted/60">
                <TabsTrigger
                  value="organization"
                  className="data-[state=active]:bg-card data-[state=active]:shadow-sm"
                >
                  <Building2 className="h-4 w-4 mr-1.5" /> Organization
                </TabsTrigger>
                <TabsTrigger
                  value="availability"
                  className="data-[state=active]:bg-card data-[state=active]:shadow-sm"
                >
                  <Clock className="h-4 w-4 mr-1.5" /> Hours
                </TabsTrigger>
                <TabsTrigger
                  value="integrations"
                  className="data-[state=active]:bg-card data-[state=active]:shadow-sm"
                >
                  <Plug className="h-4 w-4 mr-1.5" /> Connectors
                </TabsTrigger>
              </TabsList>

              {/* Organization */}
              <TabsContent value="organization" className="mt-0">
                <Section
                  title="Organization profile"
                  desc="Visible to your users and on outbound communications"
                  icon={<Building2 className="h-5 w-5" />}
                >
                  <div className="grid md:grid-cols-2 gap-5">
                    <Field label="Company name" hint="Shown on emails, letters, and the portal">
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-tenant/40"
                      />
                    </Field>
                    <Field
                      label="Timezone"
                      hint="Default timezone for operating hours and scheduling"
                    >
                      <SelectInput value={tz} onChange={(e) => setTz(e.target.value)}>
                        {/* Keep the saved value selectable even if not in the option list. */}
                        {tz && !timezones.some((t) => t.timezone === tz) && (
                          <option value={tz}>{tz}</option>
                        )}
                        {timezones.map((t) => (
                          <option key={t.timezone} value={t.timezone}>
                            {t.timezone}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                  </div>

                  <SectionFooter onSave={saveProfile} label="Save profile" saving={saving} />
                </Section>
              </TabsContent>

              {/* Availability */}
              <TabsContent value="availability" className="mt-0">
                <Section
                  title="Operating hours"
                  desc="When live agents can take escalated debtor calls"
                  icon={<Clock className="h-5 w-5" />}
                >
                  <div className="rounded-xl border border-border overflow-hidden">
                    {DAY_KEYS.map((d, i) => (
                      <div
                        key={d}
                        className={`flex items-center gap-4 px-4 py-3 ${i !== DAY_KEYS.length - 1 ? "border-b border-border" : ""} ${weekly[d].enabled ? "bg-card" : "bg-muted/30"}`}
                      >
                        <div className="flex items-center gap-3 w-40">
                          <Toggle
                            checked={weekly[d].enabled}
                            onChange={(v) =>
                              setWeekly((p) => ({ ...p, [d]: { ...p[d], enabled: v } }))
                            }
                            label={`Toggle ${DAY_LABELS[d]}`}
                          />
                          <span
                            className={`font-semibold text-sm ${!weekly[d].enabled ? "text-muted-foreground" : ""}`}
                          >
                            {DAY_LABELS[d]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <input
                            type="time"
                            disabled={!weekly[d].enabled}
                            value={weekly[d].start}
                            onChange={(e) =>
                              setWeekly((p) => ({ ...p, [d]: { ...p[d], start: e.target.value } }))
                            }
                            className="h-9 px-2 rounded-md bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-tenant/40 disabled:opacity-40"
                          />
                          <span className="text-muted-foreground text-xs">to</span>
                          <input
                            type="time"
                            disabled={!weekly[d].enabled}
                            value={weekly[d].end}
                            onChange={(e) =>
                              setWeekly((p) => ({ ...p, [d]: { ...p[d], end: e.target.value } }))
                            }
                            className="h-9 px-2 rounded-md bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-tenant/40 disabled:opacity-40"
                          />
                        </div>
                        {!weekly[d].enabled && (
                          <span className="ml-auto text-[11px] text-muted-foreground">Closed</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-tenant/5 border border-tenant/20 text-xs text-muted-foreground">
                    <Calendar className="h-4 w-4 text-tenant shrink-0 mt-0.5" />
                    <div>
                      Outside these hours, the AI offers a callback at the debtor's preferred time.
                    </div>
                  </div>

                  <SectionFooter onSave={saveHours} label="Save hours" saving={saving} />
                </Section>
              </TabsContent>

              {/* Integrations */}
              <TabsContent value="integrations" className="mt-0 space-y-6">
                {/* Email Configuration */}
                <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
                  <button
                    onClick={() => setEmailExpanded((s) => !s)}
                    className="w-full flex items-start gap-3 px-6 py-5 border-b border-border text-left hover:bg-muted/30 transition"
                  >
                    <div className="h-10 w-10 rounded-lg bg-tenant-soft text-tenant flex items-center justify-center shrink-0">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h2 className="font-display text-lg font-bold tracking-tight">
                        Email Configuration
                      </h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Configure the email account used for sending invites and communication
                        messages.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${emailConnected ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-muted text-muted-foreground border border-border"}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                        {emailConnected ? "Connected" : "Not connected"}
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${emailExpanded ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>
                  {emailExpanded && (
                    <div className="px-6 py-6">
                      <div className="grid md:grid-cols-2 gap-5">
                        <Field label="Email Provider" hint="Service used to deliver outbound email">
                          <SelectInput
                            value={emailProvider}
                            onChange={(e) => setEmailProvider(e.target.value)}
                          >
                            {["Google", "Microsoft 365", "SendGrid", "Mailgun", "Custom SMTP"].map(
                              (p) => (
                                <option key={p}>{p}</option>
                              ),
                            )}
                          </SelectInput>
                        </Field>
                        <Field label="Sender Email" hint="Email address used for sending messages">
                          <input
                            value={senderEmail}
                            onChange={(e) => setSenderEmail(e.target.value)}
                            placeholder="collections@yourdomain.com"
                            className="w-full h-10 px-3 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-tenant/40"
                          />
                        </Field>
                        <Field
                          label="Sender Password"
                          hint="Authentication credential for the email account"
                        >
                          <div className="relative">
                            <input
                              type={showPwd ? "text" : "password"}
                              value={senderPassword}
                              onChange={(e) => setSenderPassword(e.target.value)}
                              className="w-full h-10 px-3 pr-10 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-tenant/40"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPwd((s) => !s)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                            >
                              {showPwd ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </Field>
                      </div>
                      <SectionFooter
                        onSave={saveEmail}
                        label="Save Email Settings"
                        saving={saving}
                      />
                    </div>
                  )}
                </div>

                {/* Twilio SMS */}
                <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
                  <button
                    onClick={() => setTwilioExpanded((s) => !s)}
                    className="w-full flex items-start gap-3 px-6 py-5 border-b border-border text-left hover:bg-muted/30 transition"
                  >
                    <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h2 className="font-display text-lg font-bold tracking-tight">
                        Twilio Configuration
                      </h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Select the Twilio number used for sending SMS communication.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${twilioConnected ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-muted text-muted-foreground border border-border"}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                        {twilioConnected ? "Connected" : "Not connected"}
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${twilioExpanded ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>
                  {twilioExpanded && (
                    <div className="px-6 py-6">
                      <div className="grid md:grid-cols-3 gap-5">
                        <Field
                          label="Country"
                          hint="Country where the Twilio number is provisioned"
                        >
                          <SelectInput
                            value={twilioCountry}
                            onChange={(e) => setTwilioCountry(e.target.value)}
                          >
                            {[
                              "South Africa (+27)",
                              "United States (+1)",
                              "Canada (+1)",
                              "United Kingdom (+44)",
                              "Australia (+61)",
                              "Mexico (+52)",
                            ].map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </SelectInput>
                        </Field>
                        <Field label="Area Code" hint="Filter numbers based on region">
                          <input
                            value={twilioAreaCode}
                            onChange={(e) => setTwilioAreaCode(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-tenant/40"
                          />
                        </Field>
                        <Field
                          label="Phone Number"
                          hint="Select the Twilio number to send SMS from"
                        >
                          <input
                            value={twilioNumber}
                            onChange={(e) => setTwilioNumber(e.target.value)}
                            placeholder="+1 555 123 4567"
                            className="w-full h-10 px-3 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-tenant/40"
                          />
                        </Field>
                      </div>
                      <div className="mt-6 pt-5 border-t border-border flex justify-end">
                        <button
                          onClick={saveTwilio}
                          disabled={saving}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm disabled:opacity-60"
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}{" "}
                          Save SMS Settings
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </section>
        </>
      )}
    </Shell>
  );
}

function Section({
  title,
  desc,
  icon,
  children,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-elegant">
      <div className="flex items-start gap-3 px-6 py-5 border-b border-border">
        <div className="h-10 w-10 rounded-lg bg-tenant-soft text-tenant flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}

function SectionFooter({
  onSave,
  label,
  saving,
}: {
  onSave: () => void;
  label: string;
  saving?: boolean;
}) {
  return (
    <div className="mt-6 pt-5 border-t border-border flex justify-end">
      <button
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
        {label}
      </button>
    </div>
  );
}

// Controlled pill toggle. Driven by state (not the CSS peer-checked variant,
// which never applied here because bg-tenant is a hand-written utility) so the
// track reliably turns blue when on — including in Safari.
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-tenant/40 ${
        checked ? "bg-tenant border-tenant" : "bg-muted border-border"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// Native select normalized across browsers: appearance reset, fixed height, and
// a custom chevron so Safari stops rendering it as a thin, cramped control.
function SelectInput({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="w-full h-10 pl-3 pr-9 rounded-lg bg-muted border border-border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-tenant/40"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground mb-1 block">{label}</label>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      {children}
    </div>
  );
}

function ShortcutCard({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card hover:border-tenant/50 hover:bg-tenant/5 transition px-5 py-4 shadow-elegant"
    >
      <div className="h-11 w-11 rounded-xl bg-tenant-soft text-tenant flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{desc}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-tenant group-hover:translate-x-0.5 transition" />
    </Link>
  );
}
