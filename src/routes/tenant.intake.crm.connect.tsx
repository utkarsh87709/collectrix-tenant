import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { useState } from "react";
import {
  Plug,
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Mail,
  KeyRound,
  Lock,
  ShieldCheck,
  GitBranch,
  Plus,
  Trash2,
} from "lucide-react";
import { connectors, fieldMappings as defaultFieldMappings, statusMaps as defaultStatusMaps, type Connector, type FieldMapping, type StatusMap } from "@/lib/crm-mock";

// Dynamically fetched from the CRM in real usage; mocked here.
const CRM_FIELD_OPTIONS = [
  "Debtor.Name",
  "Debtor.Balance",
  "Debtor.Status",
  "Debtor.AccountNumber",
  "Debtor.Phone1",
  "Debtor.Phone2",
  "Debtor.Email",
  "Debtor.Address",
  "Debtor.VIP_FLAG",
  "Debtor.Creditor",
  "Debtor.LastContact",
];

const PLATFORM_FIELD_OPTIONS = [
  "full_name",
  "balance",
  "status",
  "external_id",
  "phones[0]",
  "phones[1]",
  "email",
  "address",
  "custom.vip_client",
  "creditor_client",
  "last_contact_at",
];

const PLATFORM_STATUS_OPTIONS = ["NEW", "ACTIVE", "PTP", "BRP", "LEGAL", "PIF", "SIF", "DISPUTED", "CEASE"];

// Dynamically fetched from the connected CRM in real usage; mocked here.
const CRM_STATUS_OPTIONS = [
  { code: "N", label: "New" },
  { code: "A", label: "Active" },
  { code: "P", label: "Promise to Pay" },
  { code: "B", label: "Broken Promise" },
  { code: "L", label: "Legal" },
  { code: "C", label: "Closed / Paid" },
  { code: "S", label: "Settled" },
  { code: "D", label: "Disputed" },
  { code: "X", label: "Cease & Desist" },
  { code: "H", label: "Hold" },
  { code: "R", label: "Returned" },
];
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/intake/crm/connect")({
  head: () => ({ meta: [{ title: "Connect CRM · Tenant Admin" }] }),
  component: ConnectCrmPage,
});

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const TOTAL_STEPS = 5;
const STEP_LABELS = ["Credentials", "Test connection", "Map fields", "Map statuses", "Confirm"];

function ConnectCrmPage() {
  const [picked, setPicked] = useState<Connector | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [serverUrl, setServerUrl] = useState("https://collect.example.com");
  const [database, setDatabase] = useState("PROD");
  const [authMethod, setAuthMethod] = useState<"api_key" | "basic" | "oauth2">("api_key");
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | { ok: boolean; message: string; latencyMs?: number; version?: string }>(null);
  const [fields, setFields] = useState<FieldMapping[]>(defaultFieldMappings);
  const [statuses, setStatuses] = useState<StatusMap[]>(defaultStatusMaps);

  const pick = (c: Connector) => {
    if (c.status === "coming_soon") {
      toast.message(`${c.name} connector is coming soon`, { description: "We'll notify you when it's ready." });
      return;
    }
    if (c.status === "custom") {
      toast.message("Custom integration", { description: "Contact support to scope a custom adapter." });
      return;
    }
    if (c.status === "standalone") {
      toast.success("Standalone mode active — no external CRM needed.");
      return;
    }
    setPicked(c);
    setStep(1);
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/crm/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorId: picked?.id, serverUrl, authMethod }),
      });
      const data = await r.json();
      setTestResult({
        ok: data.ok,
        message: data.message ?? data.error ?? "Unknown",
        latencyMs: data.latencyMs,
        version: data.checks?.version,
      });
      if (data.ok) toast.success("Connection healthy");
      else toast.error("Connection failed", { description: data.error });
    } catch (e) {
      setTestResult({ ok: false, message: "Network error" });
      toast.error("Network error");
    } finally {
      setTesting(false);
    }
  };

  const finish = () => {
    toast.success(`${picked?.name} connection saved`, {
      description: `Saved with ${fields.length} field mappings and ${statuses.length} status mappings.`,
    });
    setStep(0);
    setPicked(null);
    setTestResult(null);
  };

  const updateField = (id: string, patch: Partial<FieldMapping>) =>
    setFields((arr) => arr.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const updateStatus = (id: string, patch: Partial<StatusMap>) =>
    setStatuses((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <Shell>
      <Topbar
        title="Connect a CRM"
        subtitle="US-036 · Choose a connector and configure credentials"
        action={
          <Link to="/tenant/intake/crm" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Back to CRM hub
          </Link>
        }
      />

      <section className="px-6 lg:px-10 py-6">
        {step === 0 && (
          <PageCard>
            <CardHead title="Connector catalog" subtitle="Pick the system your team already uses" />
            <div className="p-5 space-y-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Available now</div>
                <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {connectors.filter((c) => c.status === "available").map((c) => (
                    <ConnectorCard key={c.id} c={c} onPick={pick} />
                  ))}
                </ul>
              </div>

              <OtherConnectors
                items={connectors.filter((c) => c.status !== "available")}
                onPick={pick}
              />
            </div>
          </PageCard>
        )}

        {picked && step >= 1 && (
          <PageCard>
            <CardHead
              title={`Connect ${picked.name}`}
              subtitle={`Step ${step} of ${TOTAL_STEPS} · ${STEP_LABELS[step - 1]}`}
              action={
                <button onClick={() => { setStep(0); setPicked(null); }} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
              }
            />

            <Stepper step={step} />

            <div className="px-6 py-6">
              {step === 1 && (
                <div className="space-y-5 max-w-2xl">
                  <Field label={`${picked.name} server URL`}>
                    <input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" placeholder="https://collect.mycompany.com" />
                  </Field>
                  <Field label="Database (optional, multi-DB instances)">
                    <input value={database} onChange={(e) => setDatabase(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                  </Field>
                  <Field label="Authentication method">
                    <div className="grid grid-cols-3 gap-2">
                      {(["api_key", "basic", "oauth2"] as const).filter((m) => picked.authMethods.includes(m)).map((m) => (
                        <button key={m} onClick={() => setAuthMethod(m)} className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 ${authMethod === m ? "border-tenant bg-tenant-soft text-tenant" : "border-border hover:bg-muted"}`}>
                          {m === "api_key" && <KeyRound className="h-3.5 w-3.5" />}
                          {m === "basic" && <Lock className="h-3.5 w-3.5" />}
                          {m === "oauth2" && <ShieldCheck className="h-3.5 w-3.5" />}
                          {m === "api_key" ? "API key" : m === "basic" ? "Basic auth" : "OAuth 2.0"}
                        </button>
                      ))}
                    </div>
                  </Field>
                  {authMethod === "basic" && (
                    <Field label="Username">
                      <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                    </Field>
                  )}
                  {authMethod !== "oauth2" && (
                    <Field label={authMethod === "api_key" ? "API key" : "Password"}>
                      <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono" placeholder="••••••••••••" />
                    </Field>
                  )}
                  {authMethod === "oauth2" && (
                    <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                      OAuth 2.0 will redirect to {picked.name} to authorize. After approval you'll be returned here.
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 max-w-2xl">
                  <div className="text-sm text-muted-foreground">
                    Validates: credentials, server reachability, API version compatibility, and required permissions.
                  </div>
                  <button onClick={test} disabled={testing} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50">
                    {testing ? <><Loader2 className="h-4 w-4 animate-spin" /> Testing…</> : <><Plug className="h-4 w-4" /> Test connection</>}
                  </button>
                  {testResult && (
                    <div className={`rounded-xl border p-4 text-sm ${testResult.ok ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10"}`}>
                      <div className="font-semibold mb-1">{testResult.ok ? "Success" : "Failed"}</div>
                      <div className="text-muted-foreground text-xs">{testResult.message}</div>
                      {testResult.ok && (
                        <ul className="mt-2 text-xs grid grid-cols-2 gap-1 text-muted-foreground">
                          <li>Latency: <b>{testResult.latencyMs}ms</b></li>
                          <li>API version: <b>{testResult.version}</b></li>
                          <li>Reachable: <b>yes</b></li>
                          <li>Permissions: <b>granted</b></li>
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-tenant/30 bg-tenant-soft/40 p-3 text-xs">
                    <div className="font-semibold text-tenant mb-0.5">Tenant maps CRM fields to Collectrix AI fields</div>
                    <div className="text-muted-foreground">Please confirm how your CRM fields should connect with Collectrix AI fields. You can map debtor, status, notes, creditor, account, payment, communication, call transcript & summary, assignment, and custom fields.</div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                      CRM fields are fetched live from {picked.name}. Pick the Collectrix AI field each one maps to.
                    </div>
                    <button
                      onClick={() => setFields((arr) => [...arr, { id: `fm_new_${Date.now()}`, crmField: "", crmType: "string", platformField: "", platformType: "text", direction: "bi", required: false, custom: true }])}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add mapping
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
                        <tr>
                          <th className="text-left px-4 py-2.5">CRM field</th>
                          <th className="text-left px-3 py-2.5">Collectrix AI field</th>
                          <th className="px-3 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((f) => (
                          <tr key={f.id} className="border-t border-border">
                            <td className="px-4 py-2">
                              <select
                                value={f.crmField}
                                onChange={(e) => updateField(f.id, { crmField: e.target.value })}
                                className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-xs font-mono"
                              >
                                <option value="">— select CRM field —</option>
                                {CRM_FIELD_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={f.platformField}
                                onChange={(e) => updateField(f.id, { platformField: e.target.value })}
                                className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-xs font-mono"
                              >
                                <option value="">— select Collectrix AI field —</option>
                                {PLATFORM_FIELD_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => setFields((arr) => arr.filter((x) => x.id !== f.id))}
                                className="text-muted-foreground hover:text-destructive"
                                aria-label="Remove mapping"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-xs text-muted-foreground">{fields.length} mappings configured.</div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-tenant/30 bg-tenant-soft/40 p-3 text-xs">
                    <div className="font-semibold text-tenant mb-0.5">Map your CRM statuses to Collectrix AI statuses</div>
                    <div className="text-muted-foreground">Multiple CRM codes can resolve to the same Collectrix AI status.</div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                      Map {picked.name} status codes to Collectrix AI statuses.
                    </div>
                    <button
                      onClick={() => setStatuses((arr) => [...arr, { id: `sm_new_${Date.now()}`, platform: "", crm: "", syncOut: true, syncIn: true, conflict: "last_write" }])}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add mapping
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
                        <tr>
                          <th className="text-left px-4 py-2.5">CRM code</th>
                          <th className="text-left px-3 py-2.5">Collectrix AI status</th>
                          <th className="px-3 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {statuses.map((s) => (
                          <tr key={s.id} className="border-t border-border">
                            <td className="px-4 py-2">
                              <CrmCodeMultiSelect
                                value={s.crm}
                                onChange={(v) => updateStatus(s.id, { crm: v })}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="inline-flex items-center gap-2">
                                <GitBranch className="h-3 w-3 text-tenant" />
                                <select
                                  value={s.platform}
                                  onChange={(e) => updateStatus(s.id, { platform: e.target.value })}
                                  className="px-2 py-1.5 rounded-md border border-input bg-background text-xs font-mono font-semibold"
                                >
                                  <option value="">— select Collectrix AI status —</option>
                                  {PLATFORM_STATUS_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => setStatuses((arr) => arr.filter((x) => x.id !== s.id))}
                                className="text-muted-foreground hover:text-destructive"
                                aria-label="Remove mapping"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-xs text-muted-foreground">Tip: add multiple rows with the same platform status to merge several CRM codes into one.</div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-3 max-w-2xl text-sm">
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <div className="font-semibold mb-2">Review</div>
                    <dl className="grid grid-cols-2 gap-y-2 text-xs">
                      <dt className="text-muted-foreground">Connector</dt><dd className="font-mono">{picked.name}</dd>
                      <dt className="text-muted-foreground">Server URL</dt><dd className="font-mono truncate">{serverUrl}</dd>
                      <dt className="text-muted-foreground">Database</dt><dd className="font-mono">{database || "—"}</dd>
                      <dt className="text-muted-foreground">Auth method</dt><dd className="font-mono">{authMethod}</dd>
                      <dt className="text-muted-foreground">Field mappings</dt><dd className="font-mono">{fields.length} configured</dd>
                      <dt className="text-muted-foreground">Status mappings</dt><dd className="font-mono">{statuses.length} configured</dd>
                    </dl>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Next: configure sync direction, frequency, and any advanced rules.
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <button
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
                disabled={step === 1}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              {step < TOTAL_STEPS ? (
                <button
                  onClick={() => setStep((s) => ((s + 1) as Step))}
                  disabled={step === 2 && !testResult?.ok}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
                >
                  Continue <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button onClick={finish} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
                  <Check className="h-4 w-4" /> Save connection
                </button>
              )}
            </div>
          </PageCard>
        )}
      </section>
    </Shell>
  );
}

function CrmCodeMultiSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const toggle = (code: string) => {
    const next = selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code];
    onChange(next.join(","));
  };
  const labelText = selected.length
    ? selected.map((c) => {
        const opt = CRM_STATUS_OPTIONS.find((o) => o.code === c);
        return opt ? `${opt.code}` : c;
      }).join(", ")
    : "— select CRM codes —";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border border-input bg-background text-xs font-mono text-left"
      >
        <span className={selected.length ? "" : "text-muted-foreground"}>{labelText}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-64 max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-lg p-1">
            {CRM_STATUS_OPTIONS.map((opt) => {
              const checked = selected.includes(opt.code);
              return (
                <label key={opt.code} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt.code)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="font-mono font-semibold">{opt.code}</span>
                  <span className="text-muted-foreground">— {opt.label}</span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 px-6 py-4 border-b border-border bg-muted/30 overflow-x-auto">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <li key={label} className="flex items-center gap-2 shrink-0">
            <div className={`h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center ${done ? "bg-success text-white" : active ? "bg-gradient-tenant text-white" : "bg-muted text-muted-foreground"}`}>
              {done ? <Check className="h-3 w-3" /> : n}
            </div>
            <span className={`text-xs font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
            {n < STEP_LABELS.length && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </li>
        );
      })}
    </ol>
  );
}

function ConnectorPill({ status }: { status: Connector["status"] }) {
  if (status === "available") return <Pill tone="success">available</Pill>;
  if (status === "coming_soon") return <Pill tone="info">coming soon</Pill>;
  if (status === "custom") return <Pill tone="warning">custom dev</Pill>;
  return <Pill tone="muted">standalone</Pill>;
}

function ConnectorCard({ c, onPick }: { c: Connector; onPick: (c: Connector) => void }) {
  const dim = c.status !== "available";
  return (
    <li>
      <button
        onClick={() => onPick(c)}
        className={`w-full text-left rounded-2xl border border-border bg-card p-5 shadow-elegant transition-all ${dim ? "opacity-70 hover:opacity-100" : "hover:shadow-tenant hover:-translate-y-0.5"}`}
      >
        <div className="flex items-center justify-between">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${c.status === "available" ? "bg-tenant-soft text-tenant" : "bg-muted text-muted-foreground"}`}>
            <Plug className="h-5 w-5" />
          </div>
          <ConnectorPill status={c.status} />
        </div>
        <div className="mt-4 font-display font-bold text-base">{c.name}</div>
        <div className="text-xs text-muted-foreground">{c.vendor}</div>
        <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{c.description}</p>
        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          <a href={c.docsUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 hover:text-tenant">
            <ExternalLink className="h-3 w-3" /> Docs
          </a>
          <a href={`mailto:${c.supportEmail}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 hover:text-tenant">
            <Mail className="h-3 w-3" /> Support
          </a>
        </div>
      </button>
    </li>
  );
}

function OtherConnectors({ items, onPick }: { items: Connector[]; onPick: (c: Connector) => void }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-muted/20">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <div className="text-sm font-semibold">Other connectors</div>
          <div className="text-xs text-muted-foreground">{items.length} integrations coming soon or available as custom builds</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pt-0">
          {items.map((c) => (
            <ConnectorCard key={c.id} c={c} onPick={onPick} />
          ))}
        </ul>
      )}
    </div>
  );
}
