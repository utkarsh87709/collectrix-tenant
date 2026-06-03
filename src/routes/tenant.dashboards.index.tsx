import { createFileRoute, Link } from "@tanstack/react-router";
import { PageCard, Pill } from "@/components/tenant/ui";
import {
  Briefcase, Users2, UserCog, PieChart, Building2, ShieldCheck,
  DollarSign, Wrench, CalendarClock, Database, ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/tenant/dashboards/")({
  component: Hub,
});

const tiles = [
  { to: "/tenant/dashboards/executive",  story: "US-144", label: "Executive Dashboard",   icon: Briefcase,     desc: "Creditor KPIs, recovery rate, ROI, forecast.", count: "$48.7M AUM" },
  { to: "/tenant/dashboards/supervisor", story: "US-145", label: "Supervisor Operations", icon: Users2,        desc: "Real-time team workload, queue depth, SLA.", count: "18/24 online" },
  { to: "/tenant/dashboards/agents",     story: "US-146", label: "Agent Performance",     icon: UserCog,       desc: "Per-agent calls, RPC, PTP, QA, leaderboard.", count: "5 agents" },
  { to: "/tenant/dashboards/creditors",  story: "US-147", label: "Creditor Analytics",   icon: PieChart,      desc: "Composition, aging, recovery trends, forecast.", count: "5 creditors" },
  { to: "/tenant/dashboards/exports",    story: "US-153", label: "Data Export & BI",      icon: Database,      desc: "CSV / Parquet / Webhook to Snowflake/Tableau.", count: "4 streams" },
];

function Hub() {
  return (
    <section className="px-6 lg:px-10 py-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {tiles.map((t) => (
        <Link key={t.to} to={t.to as never} className="group">
          <PageCard className="h-full hover:shadow-tenant transition">
            <div className="p-5 flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-tenant-soft text-tenant flex items-center justify-center shrink-0">
                <t.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-display font-bold truncate">{t.label}</div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-tenant transition shrink-0" />
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{t.story}</div>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{t.desc}</p>
                <div className="mt-3"><Pill tone="tenant">{t.count}</Pill></div>
              </div>
            </div>
          </PageCard>
        </Link>
      ))}
    </section>
  );
}
