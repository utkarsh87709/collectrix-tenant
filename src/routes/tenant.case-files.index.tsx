import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { Wallet, Inbox, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/tenant/case-files/")({
  head: () => ({ meta: [{ title: "Case Files · Tenant Admin" }] }),
  component: CaseFilesHub,
});

const tiles = [
  {
    to: "/tenant/debtors",
    icon: Wallet,
    label: "Customers",
    desc: "Search and inspect customer accounts",
    color: "from-emerald-500/10 to-emerald-500/0",
  },
  {
    to: "/tenant/team-deck",
    icon: Inbox,
    label: "Team Deck",
    desc: "Files handed to teams, awaiting a member",
    color: "from-sky-500/10 to-sky-500/0",
  },
] as const;

function CaseFilesHub() {
  return (
    <Shell>
      <Topbar title="Case Files" subtitle="Customer accounts and team file queues" />
      <section className="px-6 lg:px-10 py-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="group">
            <div
              className={`rounded-2xl border border-border bg-gradient-to-br ${t.color} bg-card p-5 shadow-elegant hover:shadow-tenant transition-all hover:-translate-y-0.5`}
            >
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
    </Shell>
  );
}
