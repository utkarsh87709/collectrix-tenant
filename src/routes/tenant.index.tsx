import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, type Variants } from "motion/react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, StatTile, Pill } from "@/components/tenant/ui";
import {
  Users, ShieldCheck, KeyRound, Lock, Activity, AlertTriangle, ArrowUpRight,
  Briefcase, Users2, UserCog, PieChart, Database, DollarSign,
  BarChart3, ChevronRight, Trophy, TrendingUp, Gauge, Sparkles,
} from "lucide-react";
import { tenantUsers, tenantRoles, sessions, apiKeys, tenantAudit } from "@/lib/tenant-mock";
import { executiveKpis, creditors, agents, aging, fmt } from "@/lib/dashboards-mock";
import { DashboardFilters, defaultFilters, activeFilterSummary, type DashboardFilterState } from "@/components/tenant/dashboards/DashboardFilters";
import { usePortal } from "@/lib/portal-context";

export const Route = createFileRoute("/tenant/")({
  head: () => ({ meta: [{ title: "Tenant Overview · Dashboards & Reports" }] }),
  component: TenantOverview,
});

type TabKey = "overview" | "executive" | "agents" | "creditor" | "more";

const REPORT_TILES = [
  { to: "/tenant/dashboards/executive",  story: "US-144", label: "Executive Dashboard",   icon: Briefcase,     desc: "Creditor KPIs, recovery rate, ROI, forecast." },
  { to: "/tenant/dashboards/supervisor", story: "US-145", label: "Supervisor Operations", icon: Users2,        desc: "Real-time team workload, queue depth, SLA." },
  { to: "/tenant/dashboards/agents",     story: "US-146", label: "Agent Performance",     icon: UserCog,       desc: "Per-agent calls, RPC, PTP, QA leaderboard." },
  { to: "/tenant/dashboards/creditors",  story: "US-147", label: "Creditor Analytics",   icon: PieChart,      desc: "Composition, aging, recovery trends." },
  { to: "/tenant/dashboards/exports",    story: "US-153", label: "Data Export & BI",      icon: Database,      desc: "CSV / Parquet / Webhook to BI tools." },
];

const gridV: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };
const itemV: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const fadeV: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

function TenantOverview() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [filters, setFilters] = useState<DashboardFilterState>(defaultFilters);
  const navigate = useNavigate();
  const { activeTenant, tenantId, completedOnboarding, isPendingOnboarding } = usePortal();

  useEffect(() => {
    if (isPendingOnboarding(tenantId)) navigate({ to: "/tenant/onboarding" });
  }, [tenantId]);

  const isFresh = activeTenant?.status === "invited" && completedOnboarding[tenantId];

  const activeUsers = tenantUsers.filter((u) => u.status === "active").length;
  const pendingUsers = tenantUsers.filter((u) => u.status === "pending").length;
  const noTwoFA = tenantUsers.filter((u) => !u.twoFA && u.status === "active").length;
  const activeKeys = apiKeys.filter((k) => k.status === "active").length;

  const multiplier = filters.range === "7d" ? 0.25 : filters.range === "90d" ? 2.7 : filters.range === "ytd" ? 4.1 : 1;

  const exec = useMemo(() => ({
    aum: executiveKpis.totalBalance,
    collected: Math.round(executiveKpis.ytdCollected * multiplier),
    recoveryRate: executiveKpis.recoveryRate,
    forecast: Math.round(executiveKpis.forecastNext30 * multiplier),
  }), [multiplier]);

  const sortedAgents = useMemo(() => {
    const list = (filters.agentId === "all" ? agents : agents.filter((a) => a.id === filters.agentId))
      .map((a) => ({ ...a, collected: Math.round(a.collected * multiplier) }));
    return [...list].sort((a, b) => b.collected - a.collected);
  }, [filters, multiplier]);

  const creditorList = useMemo(() => {
    return filters.creditorId === "all" ? creditors : creditors.filter((p) => p.id === filters.creditorId);
  }, [filters]);

  const TABS: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
    { key: "overview",  label: "Overview",            icon: Gauge },
    { key: "executive", label: "Executive KPIs",      icon: Briefcase },
    { key: "agents",    label: "Agent Performance",   icon: UserCog },
    { key: "creditor",  label: "Creditor Analytics",  icon: PieChart },
    { key: "more",      label: "All Reports",         icon: BarChart3 },
  ];

  if (isFresh) {
    return (
      <Shell>
        <Topbar title="Tenant Administration" subtitle={`${activeTenant?.name ?? ""} · Workspace ready`} />
        <section className="px-6 lg:px-10 py-16">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-tenant flex items-center justify-center shadow-tenant mb-6">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Welcome, {activeTenant?.name}</h2>
            <p className="text-muted-foreground mt-3">
              Your workspace is activated. There's no data here yet — start by inviting your team.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/tenant/users" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
                <Users className="h-4 w-4" /> Invite users
              </Link>
              <Link to="/tenant/roles" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition">
                <ShieldCheck className="h-4 w-4" /> Configure roles
              </Link>
            </div>
          </motion.div>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <Topbar
        title="Tenant Administration"
        subtitle={`${activeTenant?.name ?? "Apex Recovery Group"} · Dashboards & Reports`}
        action={
          <Link to="/tenant/users" className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-95 transition">
            <Users className="h-4 w-4" /> Manage Users
          </Link>
        }
      />

      {/* Tabs */}
      <div className="px-6 lg:px-10 pt-5 border-b border-border">
        <div className="flex items-center gap-1 overflow-x-auto -mb-px">
          {TABS.map((t) => {
            const active = tab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition ${
                  active ? "text-tenant" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
                {active && <motion.span layoutId="ovTabUnderline" className="absolute -bottom-px left-2 right-2 h-0.5 rounded-full bg-tenant" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "overview" && (
        <div className="px-6 lg:px-10 py-6 space-y-6">
          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-tenant text-white p-6 sm:p-7 shadow-tenant">
            <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
            <motion.div className="absolute -top-12 -right-6 h-44 w-44 rounded-full blur-3xl bg-white/15"
              animate={{ x: [0, -20, 0], y: [0, 16, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} />
            <div className="relative flex items-end justify-between gap-4 flex-wrap">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-semibold">
                  <Sparkles className="h-3 w-3" /> Workspace overview
                </span>
                <h2 className="mt-3 font-display text-2xl sm:text-3xl font-bold tracking-tight">
                  Welcome back{activeTenant?.name ? `, ${activeTenant.name}` : ""}
                </h2>
                <p className="mt-1.5 text-white/80 text-sm max-w-md">Here's what's happening across your workspace today.</p>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/tenant/users" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-semibold transition">
                  <Users className="h-4 w-4" /> Users
                </Link>
                <Link to="/tenant/roles" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-tenant text-sm font-semibold transition hover:bg-white/90">
                  <ShieldCheck className="h-4 w-4" /> Roles
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Stat tiles */}
          <motion.section variants={gridV} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div variants={itemV}><StatTile label="Active Users" value={activeUsers} delta={`${pendingUsers} pending invite`} icon={<Users className="h-5 w-5" />} tone="tenant" /></motion.div>
            <motion.div variants={itemV}><StatTile label="Custom Roles" value={tenantRoles.length} delta="2 legal-authorized" icon={<ShieldCheck className="h-5 w-5" />} /></motion.div>
            <motion.div variants={itemV}><StatTile label="Active API Keys" value={activeKeys} delta={`${apiKeys.length - activeKeys} revoked/expired`} icon={<KeyRound className="h-5 w-5" />} /></motion.div>
            <motion.div variants={itemV}><StatTile label="Live Sessions" value={sessions.length} delta="all under 30m inactivity" icon={<Activity className="h-5 w-5" />} tone="success" /></motion.div>
          </motion.section>

          {/* Activity + signals */}
          <motion.section variants={gridV} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <motion.div variants={itemV} className="lg:col-span-2">
              <PageCard className="h-full">
                <CardHead title="Recent permission activity" subtitle="Last 24 hours" action={<Link to="/tenant/audit" className="text-xs font-semibold text-tenant inline-flex items-center gap-1">View all <ArrowUpRight className="h-3 w-3" /></Link>} />
                <ul className="divide-y divide-border">
                  {tenantAudit.slice(0, 6).map((e) => {
                    const tone = e.severity === "critical" ? "bg-destructive/10 text-destructive" : e.severity === "warning" ? "bg-warning/15 text-warning-foreground" : "bg-tenant-soft text-tenant";
                    return (
                      <li key={e.id} className="px-6 py-3.5 flex items-start gap-3 text-sm hover:bg-muted/30 transition-colors">
                        <span className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                          <Activity className="h-3.5 w-3.5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{e.action}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{e.actor} → <span className="font-mono">{e.target}</span></div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{e.ts}</span>
                      </li>
                    );
                  })}
                </ul>
              </PageCard>
            </motion.div>

            <motion.div variants={itemV}>
              <PageCard className="h-full">
                <CardHead title="Security signals" subtitle="Issues to address" />
                <ul className="px-6 py-4 space-y-3 text-sm">
                  <SignalRow icon={<AlertTriangle className="h-4 w-4" />} tone="bg-warning/15 text-warning-foreground" title={`${noTwoFA} users without 2FA`} sub="Enforcement deadline in 14 days." />
                  <SignalRow icon={<Lock className="h-4 w-4" />} tone="bg-tenant-soft text-tenant" title="2 legal-authorized roles" sub="All credentials verified." />
                  <SignalRow icon={<KeyRound className="h-4 w-4" />} tone="bg-info/15 text-info-foreground" title="1 API key expiring in 12 days" sub="CRM Sync Integration." />
                </ul>
                <div className="px-6 pb-5 flex gap-2">
                  <Pill tone="tenant">SOC2 Ready</Pill>
                  <Pill tone="success">RLS Enforced</Pill>
                </div>
              </PageCard>
            </motion.div>
          </motion.section>
        </div>
      )}

      {tab === "executive" && (
        <motion.section variants={fadeV} initial="hidden" animate="show" className="px-6 lg:px-10 py-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="tenant">US-144 · Executive</Pill>
            <span className="text-xs text-muted-foreground">{activeFilterSummary(filters)}</span>
          </div>
          <DashboardFilters value={filters} onChange={setFilters} />
          <motion.div variants={gridV} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div variants={itemV}><StatTile label="Assets under mgmt" value={fmt.money(exec.aum)} icon={<Briefcase className="h-5 w-5" />} tone="tenant" /></motion.div>
            <motion.div variants={itemV}><StatTile label="Collected" value={fmt.money(exec.collected)} delta={activeFilterSummary(filters)} icon={<DollarSign className="h-5 w-5" />} tone="success" /></motion.div>
            <motion.div variants={itemV}><StatTile label="Recovery rate" value={fmt.pct(exec.recoveryRate)} icon={<TrendingUp className="h-5 w-5" />} /></motion.div>
            <motion.div variants={itemV}><StatTile label="Forecast" value={fmt.money(exec.forecast)} delta="next period" icon={<BarChart3 className="h-5 w-5" />} /></motion.div>
          </motion.div>
          <PageCard>
            <CardHead title="Open the full Executive Dashboard" subtitle="Drill-down trends, ROI, forecast vs actual" action={<Link to="/tenant/dashboards/executive" className="text-xs font-semibold text-tenant inline-flex items-center gap-1">Open <ArrowUpRight className="h-3 w-3" /></Link>} />
            <div className="p-6 text-sm text-muted-foreground">Use the All Reports tab to access every report module.</div>
          </PageCard>
        </motion.section>
      )}

      {tab === "agents" && (
        <motion.section variants={fadeV} initial="hidden" animate="show" className="px-6 lg:px-10 py-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="tenant">US-146 · Agent Performance</Pill>
            <span className="text-xs text-muted-foreground">{activeFilterSummary(filters)}</span>
          </div>
          <DashboardFilters value={filters} onChange={setFilters} showCreditor={false} showStatus={false} />
          <PageCard>
            <CardHead title="Leaderboard — Cash collected" action={<Trophy className="h-5 w-5 text-warning" />} />
            <div className="p-6 space-y-3">
              {sortedAgents.length === 0 && <div className="text-sm text-muted-foreground">No agents match the filters.</div>}
              {sortedAgents.map((a, i) => {
                const max = sortedAgents[0]?.collected ?? 1;
                return (
                  <div key={a.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">#{i + 1} · {a.name}</span>
                      <span className="font-semibold">${a.collected.toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div className="h-full bg-gradient-tenant" initial={{ width: 0 }} animate={{ width: `${(a.collected / max) * 100}%` }} transition={{ delay: Math.min(i * 0.05, 0.4), duration: 0.5, ease: "easeOut" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </PageCard>
        </motion.section>
      )}

      {tab === "creditor" && (
        <motion.section variants={fadeV} initial="hidden" animate="show" className="px-6 lg:px-10 py-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="tenant">US-147 · Creditor Analytics</Pill>
            <span className="text-xs text-muted-foreground">{activeFilterSummary(filters)}</span>
          </div>
          <DashboardFilters value={filters} onChange={setFilters} showAgent={false} />
          <div className="grid lg:grid-cols-3 gap-4">
            <PageCard className="lg:col-span-2">
              <CardHead title="Creditor composition" subtitle={`${creditorList.length} creditor${creditorList.length !== 1 ? "s" : ""}`} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3">Creditor</th>
                      <th className="text-right px-4 py-3">Accounts</th>
                      <th className="text-right px-4 py-3">Balance</th>
                      <th className="text-right px-4 py-3">Recovery %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditorList.map((p) => (
                      <tr key={p.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-right">{p.accounts.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{fmt.money(p.balance)}</td>
                        <td className="px-4 py-3 text-right"><Pill tone={p.recovery >= 40 ? "success" : "tenant"}>{fmt.pct(p.recovery)}</Pill></td>
                      </tr>
                    ))}
                    {creditorList.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No creditors match.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </PageCard>
            <PageCard>
              <CardHead title="Aging buckets" subtitle="Share of total AUM" />
              <div className="p-6 space-y-3">
                {aging.map((b, i) => (
                  <div key={b.bucket}>
                    <div className="flex justify-between text-xs mb-1"><span>{b.bucket}</span><span className="font-semibold">{b.pct}%</span></div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div className="h-full bg-gradient-tenant" initial={{ width: 0 }} animate={{ width: `${b.pct * 3}%` }} transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.5, ease: "easeOut" }} />
                    </div>
                  </div>
                ))}
              </div>
            </PageCard>
          </div>
        </motion.section>
      )}

      {tab === "more" && (
        <motion.section variants={gridV} initial="hidden" animate="show" className="px-6 lg:px-10 py-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {REPORT_TILES.map((t) => (
            <motion.div key={t.to} variants={itemV}>
              <Link to={t.to as never} className="group block h-full">
                <PageCard className="h-full transition hover:shadow-tenant hover:border-tenant/50">
                  <div className="p-5 flex items-start gap-3">
                    <div className="h-11 w-11 rounded-xl bg-tenant-soft text-tenant flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <t.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-display font-bold truncate">{t.label}</div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-tenant group-hover:translate-x-0.5 transition shrink-0" />
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{t.story}</div>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{t.desc}</p>
                    </div>
                  </div>
                </PageCard>
              </Link>
            </motion.div>
          ))}
        </motion.section>
      )}
    </Shell>
  );
}

function SignalRow({ icon, tone, title, sub }: { icon: React.ReactNode; tone: string; title: string; sub: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>{icon}</span>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
    </li>
  );
}
