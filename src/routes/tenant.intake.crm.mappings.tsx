import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import {
  ArrowLeft, GitBranch, Settings2, Eye, FlaskConical, RefreshCw,
  ArrowLeftRight, ArrowRight, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { fieldMappings, statusMaps } from "@/lib/crm-mock";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/intake/crm/mappings")({
  head: () => ({ meta: [{ title: "Field & Status Mapping · Tenant Admin" }] }),
  component: MappingsPage,
});

const CATEGORIES = [
  "Debtor",
  "Status",
  "Notes",
  "Creditor",
  "Account / Reference",
  "Payment",
  "Communication log",
  "Call transcript",
  "Call summary",
  "Assignment",
  "Custom",
] as const;
type Category = (typeof CATEGORIES)[number];

// Seed categories for existing mock mappings.
function defaultCategory(crmField: string): Category {
  if (/Status/i.test(crmField)) return "Status";
  if (/Balance|Payment|Amount/i.test(crmField)) return "Payment";
  if (/Account|Number|Reference/i.test(crmField)) return "Account / Reference";
  if (/Creditor/i.test(crmField)) return "Creditor";
  if (/VIP|Flag|Custom/i.test(crmField)) return "Custom";
  return "Debtor";
}

function MappingsPage() {
  const [tab, setTab] = useState<"fields" | "status">("fields");
  const [syncMode, setSyncMode] = useState<"one-way-out" | "one-way-in" | "two-way">("two-way");
  const [conflict, setConflict] = useState<"last_write" | "platform_wins" | "crm_wins" | "manual">("last_write");
  const [filterCat, setFilterCat] = useState<"all" | Category>("all");
  const [categories, setCategories] = useState<Record<string, Category>>(
    Object.fromEntries(fieldMappings.map((f) => [f.id, defaultCategory(f.crmField)]))
  );

  const filtered = fieldMappings.filter(
    (f) => filterCat === "all" || categories[f.id] === filterCat
  );

  return (
    <Shell>
      <Topbar
        title="Tenant maps CRM fields to Collectrix AI fields"
        subtitle="Please confirm how your CRM fields should connect with Collectrix AI fields."
        action={
          <Link to="/tenant/intake/crm" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      {/* Integration controls */}
      <section className="px-6 lg:px-10 pt-6">
        <PageCard>
          <CardHead title="Integration controls" subtitle="Sync direction, conflict handling, and last sync status" />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 p-5">
            <ControlBox label="Sync direction">
              <select
                value={syncMode}
                onChange={(e) => setSyncMode(e.target.value as typeof syncMode)}
                className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-xs font-semibold"
              >
                <option value="two-way">Two-way sync</option>
                <option value="one-way-out">One-way · Collectrix → CRM</option>
                <option value="one-way-in">One-way · CRM → Collectrix</option>
              </select>
              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {syncMode === "two-way" ? <ArrowLeftRight className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                {syncMode === "two-way" ? "Bi-directional" : "Uni-directional"}
              </div>
            </ControlBox>

            <ControlBox label="Conflict handling rule">
              <select
                value={conflict}
                onChange={(e) => setConflict(e.target.value as typeof conflict)}
                className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-xs font-semibold"
              >
                <option value="last_write">Last write wins</option>
                <option value="platform_wins">Collectrix AI wins</option>
                <option value="crm_wins">CRM wins</option>
                <option value="manual">Manual review</option>
              </select>
            </ControlBox>

            <ControlBox label="Last sync status">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="font-semibold">Healthy</span>
              </div>
              <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" /> 2 min ago · 1,284 records
              </div>
            </ControlBox>

            <ControlBox label="Sync error log">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="font-semibold">3 errors</span>
              </div>
              <button
                onClick={() => toast.message("Opening sync error log…")}
                className="mt-1 text-[11px] font-semibold text-tenant hover:underline"
              >
                View error log
              </button>
            </ControlBox>
          </div>

          <div className="px-5 pb-5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => toast.message("Previewing mapped data (10 sample records)…")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
            >
              <Eye className="h-3.5 w-3.5" /> Preview mapped data
            </button>
            <button
              onClick={() => toast.success("Test mapping started against 10 records.")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
            >
              <FlaskConical className="h-3.5 w-3.5" /> Test mapping
            </button>
            <button
              onClick={() => toast.success("Re-sync queued.")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-xs font-semibold shadow-tenant"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Re-sync now
            </button>
          </div>
        </PageCard>
      </section>

      <section className="px-6 lg:px-10 py-6">
        <PageCard>
          <CardHead
            title={tab === "fields" ? "Map CRM fields to Collectrix AI fields" : "Map your CRM statuses to Collectrix AI statuses"}
            subtitle={
              tab === "fields"
                ? "Group your mappings by category — debtor, payment, notes, call transcripts, custom, and more."
                : "Pick the Collectrix AI status that each CRM status should resolve to."
            }
            action={
              <div className="flex items-center gap-1 text-xs">
                {(["fields", "status"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-md font-semibold ${tab === t ? "bg-tenant-soft text-tenant" : "text-muted-foreground hover:text-foreground"}`}>{t === "fields" ? "Fields" : "Statuses"}</button>
                ))}
              </div>
            }
          />

          {tab === "fields" ? (
            <>
              <div className="px-6 py-3 border-b border-border flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">Category</span>
                <button
                  onClick={() => setFilterCat("all")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${filterCat === "all" ? "bg-tenant text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  All
                </button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFilterCat(c)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${filterCat === c ? "bg-tenant text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
                    <tr>
                      <th className="text-left px-6 py-3">CRM field</th>
                      <th className="text-left px-3 py-3">Collectrix AI field</th>
                      <th className="text-left px-3 py-3">Category</th>
                      <th className="text-left px-3 py-3">Direction</th>
                      <th className="text-left px-3 py-3">Sample</th>
                      <th className="text-left px-3 py-3">Type</th>
                      <th className="text-left px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((f) => (
                      <tr key={f.id} className="border-t border-border">
                        <td className="px-6 py-3 font-mono text-xs">{f.crmField} <span className="text-muted-foreground">({f.crmType})</span></td>
                        <td className="px-3 py-3 font-mono text-xs">{f.platformField}</td>
                        <td className="px-3 py-3">
                          <select
                            value={categories[f.id] ?? "Debtor"}
                            onChange={(e) => setCategories((p) => ({ ...p, [f.id]: e.target.value as Category }))}
                            className="px-2 py-1 rounded-md border border-input bg-background text-[11px] font-semibold"
                          >
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-3"><Pill tone="tenant">{f.direction}</Pill></td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{f.sample}</td>
                        <td className="px-3 py-3 text-xs">
                          {f.required && <Pill tone="warning">required</Pill>}
                          {f.custom && <Pill tone="info">custom</Pill>}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button onClick={() => toast.message("Edit mapping")} className="text-muted-foreground hover:text-tenant"><Settings2 className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-6 py-4 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{filtered.length} of {fieldMappings.length} mappings shown · auto-detected on first sync</span>
                  <button onClick={() => toast.success("Importing 10 test records…")} className="font-semibold text-tenant hover:underline">Test mapping (10 records)</button>
                </div>
              </div>
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
                  <tr>
                    <th className="text-left px-6 py-3">Collectrix AI status</th>
                    <th className="text-left px-3 py-3">CRM code</th>
                    <th className="text-left px-3 py-3">Sync out</th>
                    <th className="text-left px-3 py-3">Sync in</th>
                    <th className="text-left px-3 py-3">Conflict</th>
                  </tr>
                </thead>
                <tbody>
                  {statusMaps.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-6 py-3 font-mono font-semibold"><GitBranch className="h-3 w-3 inline mr-2 text-tenant" />{s.platform}</td>
                      <td className="px-3 py-3 font-mono">{s.crm}</td>
                      <td className="px-3 py-3"><Pill tone={s.syncOut ? "success" : "muted"}>{s.syncOut ? "yes" : "no"}</Pill></td>
                      <td className="px-3 py-3"><Pill tone={s.syncIn ? "success" : "muted"}>{s.syncIn ? "yes" : "no"}</Pill></td>
                      <td className="px-3 py-3 text-xs">{s.conflict}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageCard>
      </section>
    </Shell>
  );
}

function ControlBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{label}</div>
      {children}
    </div>
  );
}
