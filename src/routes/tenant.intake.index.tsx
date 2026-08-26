import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, StatTile, Pill } from "@/components/tenant/ui";
import { Database, GitMerge, ScrollText, ArrowRight, Upload, Users, Plug } from "lucide-react";
import { importJobs, debtors } from "@/lib/intake-mock";

export const Route = createFileRoute("/tenant/intake/")({
  head: () => ({ meta: [{ title: "Data Intake · Tenant Admin" }] }),
  component: IntakeHub,
});

const tiles = [
  { to: "/tenant/intake/import", icon: Upload, label: "Upload & Validate", desc: "Excel / CSV import wizard with field mapping", color: "from-sky-500/10 to-sky-500/0" },
  { to: "/tenant/debtors", icon: Users, label: "Customer Search & Profile", desc: "Search and inspect customer records", color: "from-emerald-500/10 to-emerald-500/0" },
  { to: "/tenant/intake/dedupe", icon: GitMerge, label: "Deduplication Queue", desc: "Review duplicate records side-by-side", color: "from-amber-500/10 to-amber-500/0" },
  { to: "/tenant/intake/audit", icon: ScrollText, label: "Customer Audit Trail", desc: "Who changed what, when", color: "from-fuchsia-500/10 to-fuchsia-500/0" },
  { to: "/tenant/intake/crm", icon: Plug, label: "CRM Integration", desc: "COLLECT!, Salesforce sync", color: "from-violet-500/10 to-violet-500/0" },
] as const;

function IntakeHub() {
  const totalDebtors = debtors.length;
  const lastImport = importJobs[0];
  return (
    <Shell>
      <Topbar title="Data Intake" subtitle="Import creditors with on-the-fly field mapping and manage customer records" />
      <section className="px-6 lg:px-10 py-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Last import" value={lastImport.imported.toLocaleString()} delta={`${lastImport.filename} · ${lastImport.startedAt}`} icon={<Upload className="h-4 w-4" />} />
        <StatTile label="Active customers" value={totalDebtors.toLocaleString()} delta="across all creditors" icon={<Database className="h-4 w-4" />} tone="success" />
        <StatTile label="Dedupe queue" value="3" delta="awaiting review" icon={<GitMerge className="h-4 w-4" />} tone="warning" />
      </section>

      <section className="px-6 lg:px-10 pb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="group">
            <div className={`rounded-2xl border border-border bg-gradient-to-br ${t.color} bg-card p-5 shadow-elegant hover:shadow-tenant transition-all hover:-translate-y-0.5`}>
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-tenant-soft text-tenant flex items-center justify-center">
                  <t.icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-tenant transition" />
              </div>
              <div className="mt-4 font-display font-bold text-base">{t.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
            </div>
          </Link>
        ))}
      </section>

      <section className="px-6 lg:px-10 pb-10">
        <PageCard>
          <CardHead title="Recent imports" subtitle="Latest 5 jobs" action={<Link to="/tenant/intake/import" className="text-xs font-semibold text-tenant hover:underline">View all</Link>} />
          <ul className="divide-y divide-border">
            {importJobs.slice(0, 5).map((j) => (
              <li key={j.id} className="px-6 py-3 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{j.filename}</div>
                  <div className="text-xs text-muted-foreground">{j.template} · {j.startedAt}</div>
                </div>
                <span className="text-xs font-mono">{j.imported}/{j.rows}</span>
                <Pill tone={j.status === "completed" ? "success" : j.status === "running" ? "info" : j.status === "failed" ? "danger" : "warning"}>{j.status}</Pill>
              </li>
            ))}
          </ul>
        </PageCard>
      </section>
    </Shell>
  );
}
