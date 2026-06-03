import type { DemoRole } from "./demo-role";
import type { AnalyticsPermission, AnalyticsScope } from "./analytics-types";

// Map demo roles → analytics permissions and visible scope.
// In production this would come from the tenant role definitions.

const ROLE_PERMS: Record<DemoRole, AnalyticsPermission[]> = {
  admin: [
    "analytics.executive", "analytics.team", "analytics.collection", "analytics.legal",
    "analytics.agent", "analytics.export", "analytics.pdf", "analytics.kpi_targets",
    "analytics.compliance", "analytics.financial",
  ],
  manager: [
    "analytics.team", "analytics.collection", "analytics.legal",
    "analytics.agent", "analytics.export", "analytics.pdf", "analytics.compliance",
  ],
  finance: [
    "analytics.executive", "analytics.team", "analytics.export", "analytics.pdf",
    "analytics.financial", "analytics.compliance",
  ],
  agent: ["analytics.agent"],
};

export function hasAnalyticsPerm(role: DemoRole, perm: AnalyticsPermission): boolean {
  return ROLE_PERMS[role]?.includes(perm) ?? false;
}

export function analyticsScope(role: DemoRole): AnalyticsScope {
  if (role === "admin" || role === "finance") return "tenant";
  if (role === "manager") return "team";
  return "self";
}

export function canSeeAnalyticsModule(role: DemoRole): boolean {
  return ROLE_PERMS[role]?.length > 0;
}

export function visibleAnalyticsTabs(role: DemoRole): Array<{ id: string; label: string }> {
  const tabs: Array<{ id: string; label: string; perm: AnalyticsPermission }> = [
    { id: "overview",   label: "Overview",         perm: "analytics.executive" },
    { id: "team",       label: "Team Performance", perm: "analytics.team" },
    { id: "collection", label: "Collection Teams", perm: "analytics.collection" },
    { id: "legal",      label: "Legal Teams",      perm: "analytics.legal" },
    { id: "agent",      label: "Agent Performance",perm: "analytics.agent" },
  ];
  return tabs.filter((t) => hasAnalyticsPerm(role, t.perm)).map(({ id, label }) => ({ id, label }));
}
