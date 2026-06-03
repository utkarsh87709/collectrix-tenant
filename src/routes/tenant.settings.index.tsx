import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { useState, useEffect } from "react";
import {
  Building2, Save, Clock,
  Calendar, ChevronRight, ChevronDown, Sparkles,
  Mail, Phone, Eye, EyeOff, CheckCircle2, Plug,
} from "lucide-react";
import { toast } from "sonner";
import { getAvailability, saveAvailability } from "@/lib/agent-availability-api";
import { DAY_KEYS, DAY_LABELS, type WeeklyHours } from "@/lib/agent-availability-utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/tenant/settings/")({
  head: () => ({ meta: [{ title: "Tenant Settings · Tenant Admin" }] }),
  component: SettingsPage,
});

type TabKey = "organization" | "availability" | "integrations";

function SettingsPage() {
  const [tab, setTab] = useState<TabKey>("organization");

  // Organization
  const [name, setName] = useState("Apex Recovery Group");
  const [tz, setTz] = useState("America/Toronto");
  const [locale, setLocale] = useState("en-CA");
  const [currency, setCurrency] = useState("CAD");

  // Availability
  const [agentTz, setAgentTz] = useState("America/Toronto");
  const [meetingBase, setMeetingBase] = useState("https://meet.collectrix.app");
  const [weekly, setWeekly] = useState<WeeklyHours>({
    mon: { start: "09:00", end: "17:00", enabled: true },
    tue: { start: "09:00", end: "17:00", enabled: true },
    wed: { start: "09:00", end: "17:00", enabled: true },
    thu: { start: "09:00", end: "17:00", enabled: true },
    fri: { start: "09:00", end: "17:00", enabled: true },
    sat: { start: "10:00", end: "14:00", enabled: false },
    sun: { start: "10:00", end: "14:00", enabled: false },
  });

  useEffect(() => {
    getAvailability().then((row) => {
      if (row?.timezone) setAgentTz(row.timezone);
      if (row?.meeting_link_base) setMeetingBase(row.meeting_link_base);
      if (row?.weekly_hours) setWeekly(row.weekly_hours as WeeklyHours);
    }).catch(() => {});
  }, []);

  const persistAvailability = async () => {
    try {
      const res = await saveAvailability({ timezone: agentTz, weekly_hours: weekly, meeting_link_base: meetingBase });
      if (res.ok) toast.success("Availability saved");
      else toast.error(res.error ?? "Failed to save");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  };

  // Email configuration
  const [emailProvider, setEmailProvider] = useState("Google");
  const [senderEmail, setSenderEmail] = useState("collections@covenantlegal.co.za");
  const [senderPassword, setSenderPassword] = useState("•••••••••••••••");
  const [showPwd, setShowPwd] = useState(false);
  const [emailConnected, setEmailConnected] = useState(true);

  // Twilio SMS
  const [twilioCountry, setTwilioCountry] = useState("South Africa (+27)");
  const [twilioAreaCode, setTwilioAreaCode] = useState("11");
  const [twilioNumber, setTwilioNumber] = useState("+27 11 234 5678");
  const [twilioConnected, setTwilioConnected] = useState(true);

  const [emailExpanded, setEmailExpanded] = useState(true);
  const [twilioExpanded, setTwilioExpanded] = useState(true);

  const saveEmail = () => { setEmailConnected(true); toast.success("Email settings saved"); };
  const saveTwilio = () => { setTwilioConnected(true); toast.success("Twilio SMS settings saved"); };

  const saveAll = () => toast.success("Settings saved", { description: "Changes propagated to all users." });

  return (
    <Shell>
      <Topbar
        title="Tenant Settings"
        subtitle="Configure your workspace and operating hours"
        action={
          <button onClick={saveAll} className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
            <Save className="h-4 w-4" /> Save changes
          </button>
        }
      />

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
            <TabsTrigger value="organization" className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Building2 className="h-4 w-4 mr-1.5" /> Organization
            </TabsTrigger>
            <TabsTrigger value="availability" className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Clock className="h-4 w-4 mr-1.5" /> Hours
            </TabsTrigger>
            <TabsTrigger value="integrations" className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
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
                <Field label="Tenant name" hint="Shown on emails, letters, and the portal">
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-tenant/40" />
                </Field>
              </div>

              <div className="mt-6">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Regional</div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Timezone">
                    <select value={tz} onChange={(e) => setTz(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-tenant/40">
                      {["America/Toronto","America/New_York","America/Chicago","America/Vancouver","Europe/London","UTC"].map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Locale">
                    <select value={locale} onChange={(e) => setLocale(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-tenant/40">
                      {["en-CA","en-US","en-GB","fr-CA","es-MX"].map((l) => <option key={l}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="Currency">
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-tenant/40">
                      {["CAD","USD","EUR","GBP","MXN"].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              <SectionFooter onSave={saveAll} label="Save profile" />
            </Section>
          </TabsContent>

          {/* Availability */}
          <TabsContent value="availability" className="mt-0">
            <Section
              title="Availability hours"
              desc="When live agents can take escalated debtor calls"
              icon={<Clock className="h-5 w-5" />}
            >
              <div className="rounded-xl border border-border overflow-hidden">
                {DAY_KEYS.map((d, i) => (
                  <div
                    key={d}
                    className={`flex items-center gap-4 px-4 py-3 ${i !== DAY_KEYS.length - 1 ? "border-b border-border" : ""} ${weekly[d].enabled ? "bg-card" : "bg-muted/30"}`}
                  >
                    <label className="flex items-center gap-3 w-40 cursor-pointer">
                      <span className="relative inline-flex items-center">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={weekly[d].enabled}
                          onChange={(e) => setWeekly((p) => ({ ...p, [d]: { ...p[d], enabled: e.target.checked } }))}
                        />
                        <span className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-tenant after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition peer-checked:after:translate-x-4 border border-border" />
                      </span>
                      <span className={`font-semibold text-sm ${!weekly[d].enabled && "text-muted-foreground"}`}>
                        {DAY_LABELS[d]}
                      </span>
                    </label>
                    <div className="flex items-center gap-2 text-sm">
                      <input
                        type="time"
                        disabled={!weekly[d].enabled}
                        value={weekly[d].start}
                        onChange={(e) => setWeekly((p) => ({ ...p, [d]: { ...p[d], start: e.target.value } }))}
                        className="px-2 py-1.5 rounded-md bg-muted border border-border disabled:opacity-40"
                      />
                      <span className="text-muted-foreground text-xs">to</span>
                      <input
                        type="time"
                        disabled={!weekly[d].enabled}
                        value={weekly[d].end}
                        onChange={(e) => setWeekly((p) => ({ ...p, [d]: { ...p[d], end: e.target.value } }))}
                        className="px-2 py-1.5 rounded-md bg-muted border border-border disabled:opacity-40"
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

              <SectionFooter onSave={persistAvailability} label="Save availability" />
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
                  <h2 className="font-display text-lg font-bold tracking-tight">Email Configuration</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Configure the email account used for sending invites and communication messages.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${emailConnected ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-muted text-muted-foreground border border-border"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> {emailConnected ? "Connected" : "Not connected"}
                  </span>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${emailExpanded ? "rotate-180" : ""}`} />
                </div>
              </button>
              {emailExpanded && (
                <div className="px-6 py-6">
                  <div className="grid md:grid-cols-2 gap-5">
                    <Field label="Email Provider">
                      <select value={emailProvider} onChange={(e) => setEmailProvider(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-tenant/40">
                        {["Google", "Microsoft 365", "SendGrid", "Mailgun", "Custom SMTP"].map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </Field>
                    <Field label="Sender Email" hint="Email address used for sending messages">
                      <input value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-tenant/40" />
                    </Field>
                    <Field label="Sender Password" hint="Authentication credential for the email account">
                      <div className="relative">
                        <input
                          type={showPwd ? "text" : "password"}
                          value={senderPassword}
                          onChange={(e) => setSenderPassword(e.target.value)}
                          className="w-full px-3 py-2 pr-10 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-tenant/40"
                        />
                        <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                          {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </Field>
                  </div>
                  <SectionFooter onSave={saveEmail} label="Save Email Settings" />
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
                  <h2 className="font-display text-lg font-bold tracking-tight">Twilio Configuration</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Select the Twilio number used for sending SMS communication.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${twilioConnected ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-muted text-muted-foreground border border-border"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> {twilioConnected ? "Connected" : "Not connected"}
                  </span>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${twilioExpanded ? "rotate-180" : ""}`} />
                </div>
              </button>
              {twilioExpanded && (
                <div className="px-6 py-6">
                  <div className="grid md:grid-cols-3 gap-5">
                    <Field label="Country" hint="Country where the Twilio number is provisioned">
                      <select value={twilioCountry} onChange={(e) => setTwilioCountry(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-tenant/40">
                        {["South Africa (+27)", "United States (+1)", "Canada (+1)", "United Kingdom (+44)", "Australia (+61)", "Mexico (+52)"].map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Area Code" hint="Filter numbers based on region">
                      <input value={twilioAreaCode} onChange={(e) => setTwilioAreaCode(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-tenant/40" />
                    </Field>
                    <Field label="Phone Number" hint="Select the Twilio number to send SMS from">
                      <input value={twilioNumber} onChange={(e) => setTwilioNumber(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-tenant/40" />
                    </Field>
                  </div>
                  <div className="mt-6 pt-5 border-t border-border flex justify-end">
                    <button onClick={saveTwilio} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm">
                      <Save className="h-4 w-4" /> Save SMS Settings
                    </button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>



        </Tabs>
      </section>
    </Shell>
  );
}


function Section({ title, desc, icon, children }: { title: string; desc: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-elegant">
      <div className="flex items-start gap-3 px-6 py-5 border-b border-border">
        <div className="h-10 w-10 rounded-lg bg-tenant-soft text-tenant flex items-center justify-center shrink-0">{icon}</div>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}

function SectionFooter({ onSave, label }: { onSave: () => void; label: string }) {
  return (
    <div className="mt-6 pt-5 border-t border-border flex justify-end">
      <button onClick={onSave} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
        <Save className="h-4 w-4" /> {label}
      </button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground mb-1 block">{label}</label>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      {children}
    </div>
  );
}

function ShortcutCard({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
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
