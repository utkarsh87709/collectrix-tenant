// Deterministic mock analytics data. All values derived from team/agent ids
// so every tenant gets stable, realistic numbers without hardcoding.

import type { AgentKPIs, Filters, KPITargets, TeamKPIs, TrendPoint } from "./analytics-types";
import { teams, tenantUsers } from "./tenant-mock";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function rand(seed: string, min: number, max: number): number {
  const v = (hash(seed) % 10000) / 10000;
  return min + v * (max - min);
}

const periodMult: Record<NonNullable<Filters["dateRange"]>, number> = {
  "7d": 0.25, "30d": 1, "90d": 2.8, "ytd": 9,
};

export function getTeamKPIs(teamId: string, dateRange: Filters["dateRange"] = "30d"): TeamKPIs {
  const m = periodMult[dateRange];
  return {
    amountCollected:      Math.round(rand(teamId + "ac", 180_000, 920_000) * m),
    recoveryRate:         +rand(teamId + "rr", 12, 38).toFixed(1),
    inventoryPenetration: +rand(teamId + "ip", 42, 86).toFixed(1),
    rpcRate:              +rand(teamId + "rpc", 18, 41).toFixed(1),
    ptpKeptRate:          +rand(teamId + "ptp", 51, 78).toFixed(1),
    paymentConversion:    +rand(teamId + "pc", 14, 32).toFixed(1),
    legalRecoveryRate:    +rand(teamId + "lr", 8, 24).toFixed(1),
    productivityFTE:      Math.round(rand(teamId + "fte", 4_800, 18_000) * m),
    forecastVsActual:     +rand(teamId + "fva", 84, 112).toFixed(1),
    complianceScore:      +rand(teamId + "cs", 88, 99).toFixed(1),
    utilizationRate:      +rand(teamId + "ut", 68, 92).toFixed(1),
    revenuePerHour:       Math.round(rand(teamId + "rph", 90, 320)),
  };
}

export function getAgentKPIs(agentId: string, dateRange: Filters["dateRange"] = "30d"): AgentKPIs {
  const m = periodMult[dateRange];
  return {
    accountsWorked:   Math.round(rand(agentId + "aw", 80, 540) * m),
    callsMade:        Math.round(rand(agentId + "cm", 220, 1_180) * m),
    rpcCount:         Math.round(rand(agentId + "rpc", 40, 280) * m),
    rpcRate:          +rand(agentId + "rpcr", 14, 38).toFixed(1),
    ptpCount:         Math.round(rand(agentId + "ptpc", 12, 84) * m),
    ptpKeptRate:      +rand(agentId + "ptpk", 48, 80).toFixed(1),
    amountCollected:  Math.round(rand(agentId + "amt", 12_000, 96_000) * m),
    recoveryRate:     +rand(agentId + "rec", 10, 32).toFixed(1),
    avgTalkTime:      +rand(agentId + "talk", 2.4, 6.8).toFixed(1),
    acwTime:          +rand(agentId + "acw", 0.6, 2.4).toFixed(1),
    qaScore:          +rand(agentId + "qa", 78, 98).toFixed(1),
    complianceIssues: Math.floor(rand(agentId + "ci", 0, 5)),
  };
}

export function getTenantKPIs(tenantId: string, filters?: Filters) {
  const productionTeams = teams.filter((t) => t.type === "production" &&
    (!filters?.productionCategory || filters.productionCategory === "all" || t.productionCategory === filters.productionCategory));
  if (productionTeams.length === 0) return null;
  const agg = productionTeams.map((t) => getTeamKPIs(t.id, filters?.dateRange));
  const sum = (k: keyof TeamKPIs) => agg.reduce((s, x) => s + (x[k] as number), 0);
  const avg = (k: keyof TeamKPIs) => +(sum(k) / agg.length).toFixed(1);
  return {
    amountCollected:      sum("amountCollected"),
    recoveryRate:         avg("recoveryRate"),
    inventoryPenetration: avg("inventoryPenetration"),
    rpcRate:              avg("rpcRate"),
    ptpKeptRate:          avg("ptpKeptRate"),
    paymentConversion:    avg("paymentConversion"),
    legalRecoveryRate:    avg("legalRecoveryRate"),
    productivityFTE:      Math.round(sum("productivityFTE") / agg.length),
    forecastVsActual:     avg("forecastVsActual"),
    complianceScore:      avg("complianceScore"),
  };
}

export function getTrend(seed: string, points = 12, dateRange: Filters["dateRange"] = "30d"): TrendPoint[] {
  const labels = dateRange === "7d"
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : dateRange === "ytd"
      ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      : Array.from({ length: points }, (_, i) => `W${i + 1}`);
  const base = rand(seed, 100, 800);
  return labels.map((label, i) => {
    const v = base * (0.7 + rand(seed + i, 0, 0.6));
    const p = base * (0.65 + rand(seed + "p" + i, 0, 0.5));
    return { label, value: Math.round(v), prev: Math.round(p) };
  });
}

export const DEFAULT_KPI_TARGETS: KPITargets = {
  monthlyCollection: 850_000,
  teamRecovery: 28,
  rpc: 32,
  ptpKept: 68,
  inventoryPenetration: 72,
  legalRecovery: 18,
  complianceThreshold: 95,
  qaScore: 90,
  forecast: 100,
};

export function getAgents(teamId?: string) {
  // Map users → "agent" rows for analytics tables.
  return tenantUsers
    .filter((u) => u.status !== "archived")
    .map((u) => {
      const t = teams.find((x) => x.id === (teamId ?? "tm_01")) ?? teams[0];
      return {
        id: u.id,
        name: u.fullName,
        team: t.name,
        teamType: t.type,
        role: u.roles[0] ?? "—",
        ...getAgentKPIs(u.id),
      };
    });
}

export function delta(curr: number, prev: number): { pct: number; dir: "up" | "down" | "flat" } {
  if (prev === 0) return { pct: 0, dir: "flat" };
  const pct = +(((curr - prev) / prev) * 100).toFixed(1);
  return { pct, dir: pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat" };
}
