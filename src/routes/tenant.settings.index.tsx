import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { useState, useEffect, useCallback, useRef } from "react";
import { z } from "zod";
import {
  Building2,
  Save,
  Clock,
  Calendar,
  ChevronDown,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Plug,
  Link2,
  RefreshCw,
  Loader2,
  Table2,
  Search,
  Info,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { DAY_KEYS, DAY_LABELS, type WeeklyHours } from "@/lib/agent-availability-utils";
import {
  COUNTRY_WIDE_STATE,
  getComplianceHours,
  getCountries,
  getStates,
  hoursFromRow,
  invalidComplianceDays,
  saveComplianceHours,
  type ComplianceHoursRow,
  type Country,
  type State,
} from "@/lib/compliance-hours-api";
import {
  getTenantDetails,
  updateTenantDetails,
  getGmailAuthUrl,
  type TenantDetails,
  type UpdateTenantDetailsInput,
  type DayFlag,
} from "@/lib/tenant-settings-api";
import { getTimezoneList, type TimezoneItem } from "@/lib/profile-api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SettingsSkeleton } from "@/components/admin/Skeletons";
import { DataFieldsSection } from "@/components/tenant/data-fields/DataFieldsSection";
import { usePermissions } from "@/lib/permissions/store";

// Tailwind needs whole class names, so the tab strip picks one per tab count.
const TAB_COLS = ["grid-cols-1", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"];

// Gmail OAuth runs in a pop-up. When Google is done, the backend redirects that
// pop-up back to this page with ?google=<message> (e.g. "Connected"); the
// landing page relays the message to the opening tab over this channel.
const GMAIL_CHANNEL = "collectrix.gmail-connect";

const searchSchema = z.object({
  // The router JSON-decodes search values, so coerce e.g. `true` back to text.
  google: z.coerce.string().optional(),
});

export const Route = createFileRoute("/tenant/settings/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Tenant Settings · Tenant Admin" }] }),
  component: SettingsPage,
});

type TabKey = "organization" | "availability" | "integrations" | "dataFields";
/** Sub-tabs of the Hours tab. */
type HoursTab = "availabilityHours" | "complianceHours";

// Only Gmail and Outlook are offered. Backend stores the lowercase value
// ("gmail" | "outlook"); legacy values (e.g. "Google", "Microsoft 365") are
// normalized onto one of these so the dropdown is accurate.
const EMAIL_PROVIDERS = [
  { value: "gmail", label: "Gmail" },
  { value: "outlook", label: "Outlook" },
] as const;
function normalizeProvider(v: string | null | undefined): string {
  const s = (v ?? "").toLowerCase();
  if (s.includes("out") || s.includes("microsoft") || s.includes("365") || s.includes("office"))
    return "outlook";
  return "gmail";
}

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
  // The route opens with either grant: settings.view shows Organization, Hours
  // and Connectors; dataFields.view shows the Data Fields tab.
  const { can } = usePermissions();
  const canViewSettings = can("settings.view");
  const canEditSettings = can("settings.edit");
  const canViewFields = can("dataFields.view");
  const tabCount = (canViewSettings ? 3 : 0) + (canViewFields ? 1 : 0);
  const [tab, setTab] = useState<TabKey>(canViewSettings ? "organization" : "dataFields");
  const [hoursTab, setHoursTab] = useState<HoursTab>("availabilityHours");
  const [loading, setLoading] = useState(canViewSettings);
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
  const [emailProvider, setEmailProvider] = useState("gmail");
  const [senderEmail, setSenderEmail] = useState("");
  // The sender password field was removed (Gmail connects via OAuth); the stored
  // value is round-tripped untouched like the sender-phone values below.
  const [senderPassword, setSenderPassword] = useState<string | null>(null);

  // Gmail OAuth connection
  const { google } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [gmailConnected, setGmailConnected] = useState(false);
  const [fetchingAuthUrl, setFetchingAuthUrl] = useState(false);
  const [googleResult, setGoogleResult] = useState<string | null>(null);
  const gmailChannel = useRef<BroadcastChannel | null>(null);
  const gmailPopup = useRef<Window | null>(null);
  const gmailPopupPoll = useRef<number | undefined>(undefined);

  // Legacy sender-phone values on the tenant record. The Twilio settings UI was
  // removed (numbers are managed in the Phone Numbers module), but since
  // updateTenantDetails replaces the whole record we round-trip these values
  // untouched so saving other settings never wipes them.
  const [senderPhoneCountry, setSenderPhoneCountry] = useState<string | null>(null);
  const [senderPhoneAreaCode, setSenderPhoneAreaCode] = useState<string | null>(null);
  const [senderPhoneNo, setSenderPhoneNo] = useState<string | null>(null);

  const [emailExpanded, setEmailExpanded] = useState(true);

  // Gmail can only send once the OAuth grant exists; Outlook keeps the old check.
  const emailConnected = emailProvider === "gmail" ? gmailConnected : Boolean(senderEmail);

  const hydrate = useCallback((d: TenantDetails) => {
    setName(d.companyName ?? "");
    setTz(d.timezone ?? "");
    setWeekly(detailsToWeekly(d));
    setEmailProvider(normalizeProvider(d.senderEmailType));
    setSenderEmail(d.senderEmailId ?? "");
    setSenderPassword(d.senderEmailPassword ?? null);
    setGmailConnected(Boolean(d.gmailConnected));
    setSenderPhoneCountry(d.senderPhoneCountry ?? null);
    setSenderPhoneAreaCode(d.senderPhoneAreaCode ?? null);
    setSenderPhoneNo(d.senderPhoneNo ?? null);
  }, []);

  // Hydrate the form from the tenant record (and load timezone options).
  useEffect(() => {
    if (!canViewSettings) return;
    let active = true;
    Promise.all([getTenantDetails(), getTimezoneList()])
      .then(([d, { timezoneList }]) => {
        if (!active) return;
        setTimezones(timezoneList);
        hydrate(d);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load settings"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canViewSettings, hydrate]);

  // Re-read the record after a Gmail connect attempt so the button, badge and
  // any sender fields the backend updated are current.
  const refreshDetails = useCallback(() => {
    getTenantDetails()
      .then(hydrate)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load settings"));
  }, [hydrate]);

  // Result relayed by the OAuth landing page (see the effect below). The tab
  // that opened the pop-up closes it; every settings tab shows the message and
  // refreshes.
  useEffect(() => {
    const channel = new BroadcastChannel(GMAIL_CHANNEL);
    channel.onmessage = (e: MessageEvent<string>) => {
      window.clearInterval(gmailPopupPoll.current);
      gmailPopup.current?.close();
      gmailPopup.current = null;
      setTab("integrations");
      setGoogleResult(e.data);
      refreshDetails();
    };
    gmailChannel.current = channel;
    return () => {
      channel.close();
      gmailChannel.current = null;
      window.clearInterval(gmailPopupPoll.current);
    };
  }, [refreshDetails]);

  // Landing here from Google (?google=<message>): relay the message to the tab
  // that opened the pop-up, and also show it here, which covers the same-tab
  // fallback when pop-ups are blocked (this page load already has fresh data).
  useEffect(() => {
    if (!google) return;
    navigate({ search: {}, replace: true });
    gmailChannel.current?.postMessage(google);
    setTab("integrations");
    setGoogleResult(google);
  }, [google, navigate]);

  const connectGmail = async () => {
    // Open the pop-up synchronously in the click so it isn't blocked, then
    // point it at Google once the backend returns the consent URL.
    const w = 520;
    const h = 640;
    const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
    const popup = window.open(
      "",
      "collectrix-gmail-connect",
      `popup,width=${w},height=${h},left=${left},top=${top}`,
    );
    setFetchingAuthUrl(true);
    try {
      const { url } = await getGmailAuthUrl();
      if (!popup) {
        // Pop-ups blocked: run the consent flow in this tab instead.
        window.location.assign(url);
        return;
      }
      popup.location.href = url;
      gmailPopup.current = popup;
      // Closed without a relayed result (cancelled, or the redirect landed on
      // another origin, e.g. when running locally): just re-read the record.
      window.clearInterval(gmailPopupPoll.current);
      gmailPopupPoll.current = window.setInterval(() => {
        if (!popup.closed) return;
        window.clearInterval(gmailPopupPoll.current);
        gmailPopup.current = null;
        refreshDetails();
      }, 500);
    } catch (e) {
      popup?.close();
      toast.error(e instanceof Error ? e.message : "Failed to start Gmail connection");
    } finally {
      setFetchingAuthUrl(false);
    }
  };

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
      senderEmailPassword: senderPassword,
      senderPhoneAreaCode: senderPhoneAreaCode,
      senderPhoneCountry: senderPhoneCountry,
      senderPhoneNo: senderPhoneNo,
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
    senderPhoneCountry,
    senderPhoneAreaCode,
    senderPhoneNo,
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

  return (
    <Shell>
      <Topbar
        title="Tenant Settings"
        subtitle="Configure your workspace and operating hours"
        action={
          canViewSettings && canEditSettings ? (
            <button
              onClick={saveAll}
              disabled={loading || saving}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
              Save changes
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <>
          {/* Tabs */}
          <section className="px-6 lg:px-10 py-6">
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
              <TabsList className={`grid ${TAB_COLS[tabCount]} w-full max-w-3xl mb-5 bg-muted/60`}>
                {canViewSettings && (
                  <>
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
                  </>
                )}
                {canViewFields && (
                  <TabsTrigger
                    value="dataFields"
                    className="data-[state=active]:bg-card data-[state=active]:shadow-sm"
                  >
                    <Table2 className="h-4 w-4 mr-1.5" /> Data Fields
                  </TabsTrigger>
                )}
              </TabsList>

              {canViewSettings && !canEditSettings && (
                <p className="mb-4 text-xs text-muted-foreground">
                  Your role can view these settings but not change them.
                </p>
              )}

              {/* Organization */}
              {canViewSettings && (
                <>
                  <TabsContent value="organization" className="mt-0">
                    <fieldset disabled={!canEditSettings} className="min-w-0">
                      <Section
                        title="Organization profile"
                        desc="Visible to your users and on outbound communications"
                        icon={<Building2 className="h-5 w-5" />}
                      >
                        <div className="grid md:grid-cols-2 gap-5">
                          <Field
                            label="Company name"
                            hint="Shown on emails, letters, and the portal"
                          >
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

                        {canEditSettings && (
                          <SectionFooter
                            onSave={saveProfile}
                            label="Save profile"
                            saving={saving}
                          />
                        )}
                      </Section>
                    </fieldset>
                  </TabsContent>

                  {/* Hours: availability and compliance calling hours */}
                  <TabsContent value="availability" className="mt-0">
                    <Tabs value={hoursTab} onValueChange={(v) => setHoursTab(v as HoursTab)}>
                      <TabsList className="mb-5 bg-muted/60">
                        <TabsTrigger
                          value="availabilityHours"
                          className="data-[state=active]:bg-card data-[state=active]:shadow-sm"
                        >
                          Availability Hours
                        </TabsTrigger>
                        <TabsTrigger
                          value="complianceHours"
                          className="data-[state=active]:bg-card data-[state=active]:shadow-sm"
                        >
                          Compliance Calling Hours
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="availabilityHours" className="mt-0">
                        <fieldset disabled={!canEditSettings} className="min-w-0">
                          <Section
                            title="Operating hours"
                            desc="When live agents can take escalated customer calls"
                            icon={<Clock className="h-5 w-5" />}
                          >
                            <DayHoursRows hours={weekly} onChange={setWeekly} offLabel="Closed" />

                            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-tenant/5 border border-tenant/20 text-xs text-muted-foreground">
                              <Calendar className="h-4 w-4 text-tenant shrink-0 mt-0.5" />
                              <div>
                                Outside these hours, the AI offers a callback at the customer's
                                preferred time.
                              </div>
                            </div>

                            {canEditSettings && (
                              <SectionFooter
                                onSave={saveHours}
                                label="Save hours"
                                saving={saving}
                              />
                            )}
                          </Section>
                        </fieldset>
                      </TabsContent>

                      {/* Kept mounted so a found rule and unsaved edits survive a
                          switch to Availability Hours and back. */}
                      <TabsContent
                        value="complianceHours"
                        forceMount
                        className="mt-0 data-[state=inactive]:hidden"
                      >
                        <ComplianceHoursSection canEdit={canEditSettings} />
                      </TabsContent>
                    </Tabs>
                  </TabsContent>

                  {/* Integrations */}
                  <TabsContent value="integrations" className="mt-0">
                    <fieldset disabled={!canEditSettings} className="min-w-0 space-y-6">
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
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${emailConnected ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30" : "bg-muted text-muted-foreground border border-border"}`}
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
                              <Field
                                label="Email Provider"
                                hint="Service used to deliver outbound email"
                              >
                                <SelectInput
                                  value={emailProvider}
                                  onChange={(e) => setEmailProvider(e.target.value)}
                                >
                                  {EMAIL_PROVIDERS.map((p) => (
                                    <option key={p.value} value={p.value}>
                                      {p.label}
                                    </option>
                                  ))}
                                </SelectInput>
                              </Field>
                              <Field
                                label="Sender Email"
                                hint="Email address used for sending messages"
                              >
                                <input
                                  value={senderEmail}
                                  onChange={(e) => setSenderEmail(e.target.value)}
                                  placeholder="collections@yourdomain.com"
                                  className="w-full h-10 px-3 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-tenant/40"
                                />
                              </Field>
                              {emailProvider === "gmail" && (
                                <Field
                                  label="Google Account"
                                  hint={
                                    gmailConnected
                                      ? "Gmail access is authorized. Re-connect to switch accounts or renew access"
                                      : "Sign in with Google to allow sending through Gmail"
                                  }
                                >
                                  <button
                                    type="button"
                                    onClick={connectGmail}
                                    disabled={fetchingAuthUrl}
                                    className={`inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold disabled:opacity-60 ${gmailConnected ? "border border-border bg-card hover:bg-muted" : "bg-gradient-tenant text-white shadow-tenant"}`}
                                  >
                                    {fetchingAuthUrl ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : gmailConnected ? (
                                      <RefreshCw className="h-4 w-4" />
                                    ) : (
                                      <Link2 className="h-4 w-4" />
                                    )}
                                    {gmailConnected ? "Re-Connect" : "Connect"}
                                  </button>
                                </Field>
                              )}
                            </div>
                            {canEditSettings && (
                              <SectionFooter
                                onSave={saveEmail}
                                label="Save Email Settings"
                                saving={saving}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </fieldset>
                  </TabsContent>
                </>
              )}

              {/* Data Fields */}
              {canViewFields && (
                <TabsContent value="dataFields" className="mt-0">
                  <DataFieldsSection companyName={name} />
                </TabsContent>
              )}
            </Tabs>
          </section>
        </>
      )}

      <AlertDialog open={googleResult !== null} onOpenChange={(o) => !o && setGoogleResult(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {googleResult?.toLowerCase() === "connected" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
              Gmail connection
            </AlertDialogTitle>
            <AlertDialogDescription>{googleResult}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-gradient-tenant text-white shadow-tenant hover:opacity-90">
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}

/** Compliance calling hours: pick a country and a province / state, find its
 *  rule, then edit it — or create one when none exists yet. */
function ComplianceHoursSection({ canEdit }: { canEdit: boolean }) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryCode, setCountryCode] = useState("");
  /** Tagged with its country, so a list still showing the previous country
   *  is never offered for the new one. */
  const [stateList, setStateList] = useState<{ countryCode: string; states: State[] }>({
    countryCode: "",
    states: [],
  });
  const states = stateList.countryCode === countryCode ? stateList.states : [];
  const [statesReload, setStatesReload] = useState(0);
  const [stateCode, setStateCode] = useState("");
  /** The place whose rule is shown — set by "Find compliance rules". */
  const [found, setFound] = useState<{ countryCode: string; stateCode: string } | null>(null);
  const [rule, setRule] = useState<ComplianceHoursRow | null>(null);
  const [hours, setHours] = useState<WeeklyHours | null>(null);
  const [baseline, setBaseline] = useState<WeeklyHours | null>(null);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Ignore a response that arrives after the user picked somewhere else. */
  const statesRequest = useRef(0);
  const ruleRequest = useRef(0);

  const failed = (e: unknown, fallback: string) =>
    setError(e instanceof Error ? e.message : fallback);

  const loadCountries = useCallback(() => {
    setError(null);
    getCountries()
      .then(setCountries)
      .catch((e) => failed(e, "Failed to load countries."));
  }, []);

  useEffect(loadCountries, [loadCountries]);

  useEffect(() => {
    if (!countryCode) return;
    const id = ++statesRequest.current;
    setError(null);
    getStates(countryCode)
      .then((list) => {
        if (id === statesRequest.current) setStateList({ countryCode, states: list });
      })
      .catch((e) => failed(e, "Failed to load provinces and states."));
  }, [countryCode, statesReload]);

  /** Drops the shown rule, so it never sits under a different selection. */
  const clearFound = () => {
    ruleRequest.current += 1;
    setFound(null);
    setRule(null);
    setHours(null);
    setBaseline(null);
    setFinding(false);
  };

  const findRule = useCallback(async (cc: string, sc: string) => {
    const id = ++ruleRequest.current;
    setFinding(true);
    setError(null);
    try {
      const row = await getComplianceHours(cc, sc);
      if (id !== ruleRequest.current) return;
      const h = hoursFromRow(row);
      setFound({ countryCode: cc, stateCode: sc });
      setRule(row);
      setHours(h);
      setBaseline(h);
    } catch (e) {
      if (id === ruleRequest.current) failed(e, "Failed to load the compliance hours.");
    } finally {
      if (id === ruleRequest.current) setFinding(false);
    }
  }, []);

  const retry = () => {
    if (!countries.length) loadCountries();
    else if (countryCode && !states.length) setStatesReload((n) => n + 1);
    else if (countryCode && stateCode) findRule(countryCode, stateCode);
    else setError(null);
  };

  const countryName = (cc: string) =>
    countries.find((c) => c.countryCode === cc)?.countryName ?? "";
  const where = found
    ? found.stateCode === COUNTRY_WIDE_STATE
      ? countryName(found.countryCode)
      : `${states.find((s) => s.stateCode === found.stateCode)?.stateName ?? ""}, ${countryName(found.countryCode)}`
    : "";
  const dirty = !!hours && JSON.stringify(hours) !== JSON.stringify(baseline);
  const invalid = hours ? invalidComplianceDays(hours) : [];

  const save = async () => {
    if (!hours || !found) return;
    if (invalid.length) {
      toast.error(
        `Check ${invalid.map((d) => DAY_LABELS[d]).join(", ")}: the end time must be after the start time.`,
      );
      return;
    }
    setSaving(true);
    try {
      await saveComplianceHours({ ...found, hours, exists: rule !== null });
      toast.success(`Compliance hours saved for ${where}`);
      await findRule(found.countryCode, found.stateCode);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save the compliance hours");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Compliance Calling Hours"
      desc="Calls are only placed when the debtor's local time is inside these Compliance Calling Hours. Your Business Hours are converted into the debtor's local time to choose the during-hours or after-hours AI agent. After business hours there is no live transfer. The debtor's time zone is detected from their phone number's area code. Debtors without a phone number are not called."
      icon={<Clock className="h-5 w-5" />}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <Field label="Country">
            <SelectInput
              value={countryCode}
              onChange={(e) => {
                setCountryCode(e.target.value);
                setStateCode("");
                clearFound();
              }}
              disabled={dirty}
            >
              <option value="">{countries.length ? "Select country" : "Loading…"}</option>
              {countries.map((c) => (
                <option key={c.countryCode} value={c.countryCode}>
                  {c.countryName}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="w-full sm:w-64">
          <Field label="Province / State">
            <SelectInput
              value={stateCode}
              onChange={(e) => {
                setStateCode(e.target.value);
                clearFound();
              }}
              disabled={dirty || !countryCode}
            >
              <option value="">
                {countryCode && !states.length ? "Loading…" : "Select province / state"}
              </option>
              {states.map((s) => (
                <option key={s.stateCode} value={s.stateCode}>
                  {s.stateCode === COUNTRY_WIDE_STATE ? "Default (whole country)" : s.stateName}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <button
          type="button"
          onClick={() => findRule(countryCode, stateCode)}
          disabled={!countryCode || !stateCode || finding || dirty}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-border text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {finding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Find compliance rules
        </button>
      </div>

      {error && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      )}

      {!found || !hours ? (
        !finding && (
          <p className="mt-5 text-sm text-muted-foreground">
            Select a country and province or state, then click Find compliance rules to view its
            calling hours.
          </p>
        )
      ) : (
        <>
          <div className="mt-5 mb-3 flex flex-wrap items-center gap-2 text-xs">
            {rule ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 font-semibold text-success-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" /> Rule saved for {where}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 font-semibold text-warning-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> No rule for {where} yet — suggested hours
                shown, nothing is saved until you create it
              </span>
            )}
            {dirty && rule && (
              <span className="text-muted-foreground">
                Unsaved changes — save or discard them to look up another place.
              </span>
            )}
          </div>

          <fieldset disabled={!canEdit} className="min-w-0">
            <DayHoursRows
              hours={hours}
              onChange={(next) => setHours(next)}
              offLabel="No automated calls"
              invalid={invalid}
            />
          </fieldset>

          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              If a number&apos;s time zone can&apos;t be worked out, no automated call is placed and
              a person decides how to handle it. This applies to every business and can&apos;t be
              switched off.
            </div>
          </div>

          {canEdit && (
            <div className="mt-6 pt-5 border-t border-border flex justify-end gap-2">
              {dirty && rule && (
                <button
                  type="button"
                  onClick={() => setHours(baseline)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" /> Discard
                </button>
              )}
              <button
                type="button"
                onClick={save}
                disabled={saving || (rule !== null && !dirty)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {rule ? "Save compliance hours" : "Create rule"}
              </button>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

/** One row per weekday: on/off, then start and end time. */
function DayHoursRows({
  hours,
  onChange,
  offLabel,
  invalid = [],
}: {
  hours: WeeklyHours;
  onChange: (next: WeeklyHours) => void;
  /** Shown on a day that is switched off. */
  offLabel: string;
  /** Days to flag: end not after start. */
  invalid?: (keyof WeeklyHours)[];
}) {
  const set = (d: keyof WeeklyHours, p: Partial<WeeklyHours[keyof WeeklyHours]>) =>
    onChange({ ...hours, [d]: { ...hours[d], ...p } });
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {DAY_KEYS.map((d, i) => {
        const bad = invalid.includes(d);
        const timeCls = `h-9 px-2 rounded-md bg-muted border text-sm focus:outline-none focus:ring-2 focus:ring-tenant/40 disabled:opacity-40 ${
          bad ? "border-destructive" : "border-border"
        }`;
        return (
          <div
            key={d}
            className={`flex flex-wrap items-center gap-4 px-4 py-3 ${i !== DAY_KEYS.length - 1 ? "border-b border-border" : ""} ${hours[d].enabled ? "bg-card" : "bg-muted/30"}`}
          >
            <div className="flex items-center gap-3 w-40">
              <Toggle
                checked={hours[d].enabled}
                onChange={(v) => set(d, { enabled: v })}
                label={`Toggle ${DAY_LABELS[d]}`}
              />
              <span
                className={`font-semibold text-sm ${!hours[d].enabled ? "text-muted-foreground" : ""}`}
              >
                {DAY_LABELS[d]}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <input
                type="time"
                disabled={!hours[d].enabled}
                value={hours[d].start}
                onChange={(e) => set(d, { start: e.target.value })}
                aria-label={`${DAY_LABELS[d]} start time`}
                className={timeCls}
              />
              <span className="text-muted-foreground text-xs">to</span>
              <input
                type="time"
                disabled={!hours[d].enabled}
                value={hours[d].end}
                onChange={(e) => set(d, { end: e.target.value })}
                aria-label={`${DAY_LABELS[d]} end time`}
                className={timeCls}
              />
            </div>
            {bad && <span className="text-[11px] text-destructive">End must be after start</span>}
            {!hours[d].enabled && (
              <span className="ml-auto text-[11px] text-muted-foreground">{offLabel}</span>
            )}
          </div>
        );
      })}
    </div>
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
  disabled = false,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full h-10 pl-3 pr-9 rounded-lg bg-muted border border-border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-tenant/40 disabled:cursor-not-allowed disabled:opacity-60"
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
