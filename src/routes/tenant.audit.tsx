import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { tenantAudit, type AuditEntry } from "@/lib/tenant-mock";
import { useState } from "react";
import { Search, Download, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/audit")({
  head: () => ({ meta: [{ title: "Permission Audit · Tenant Admin" }] }),
  component: AuditPage,
});

function AuditPage() {
  const [q, setQ] = useState("");
  const [sev, setSev] = useState<"all" | AuditEntry["severity"]>("all");
  const [open, setOpen] = useState<AuditEntry | null>(null);

  const filtered = tenantAudit.filter((e) => {
    if (sev !== "all" && e.severity !== sev) return false;
    if (q && !`${e.action} ${e.target} ${e.actor}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <Shell>
      <Topbar
        title="Permission Audit"
        subtitle="Tamper-resistant log · 7-year retention · SOC2 / GDPR ready"
        action={
          <button onClick={() => toast.success("Compliance report generated", { description: "PDF + CSV exported. Includes signatures section." })} className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
            <Download className="h-4 w-4" /> Export compliance report
          </button>
        }
      />

      <section className="px-6 lg:px-10 py-6">
        <PageCard>
          <CardHead
            title={`${filtered.length} events`}
            action={
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border w-72">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action, actor, or target…" className="bg-transparent text-sm flex-1 outline-none" />
                </div>
                <select value={sev} onChange={(e) => setSev(e.target.value as typeof sev)} className="px-3 py-2 rounded-lg bg-muted border border-border text-sm">
                  <option value="all">All severities</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            }
          />
          <ul className="divide-y divide-border">
            {filtered.map((e) => (
              <li key={e.id}>
                <button onClick={() => setOpen(e)} className="w-full text-left px-6 py-4 hover:bg-muted/30 flex items-start gap-3">
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${e.severity === "critical" ? "bg-destructive" : e.severity === "warning" ? "bg-warning" : "bg-tenant"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{e.action}</span>
                      {e.severity === "critical" && <Pill tone="danger"><AlertTriangle className="h-3 w-3" /> Critical</Pill>}
                      {e.severity === "warning" && <Pill tone="warning">Warning</Pill>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {e.actor} → <span className="font-mono">{e.target}</span> · {e.ip}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{e.ts}</span>
                </button>
              </li>
            ))}
          </ul>
        </PageCard>
      </section>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-end p-0 sm:p-4">
          <div className="w-full sm:max-w-md h-full sm:h-auto sm:rounded-2xl bg-card border border-border shadow-tenant overflow-hidden flex flex-col">
            <div className="flex items-start justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="font-display font-bold">{open.action}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{open.ts}</p>
              </div>
              <button onClick={() => setOpen(null)} className="p-1.5 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-sm">
              <Field label="Actor" value={open.actor} />
              <Field label="Target" value={open.target} mono />
              <Field label="IP address" value={open.ip} mono />
              <Field label="Severity" value={open.severity} />
              {open.before && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Before</div>
                  <ul className="space-y-1">
                    {open.before.map((p) => <li key={p} className="px-2 py-1 rounded bg-destructive/10 text-destructive text-xs font-mono">- {p}</li>)}
                  </ul>
                </div>
              )}
              {open.after && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">After</div>
                  <ul className="space-y-1">
                    {open.after.map((p) => <li key={p} className="px-2 py-1 rounded bg-success/10 text-success text-xs font-mono">+ {p}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={`mt-0.5 ${mono ? "font-mono text-xs" : "text-sm"}`}>{value}</div>
    </div>
  );
}
