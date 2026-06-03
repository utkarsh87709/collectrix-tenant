// Shared analytics types. Single source of truth for the Analytics module
// and Teams classification across the tenant admin panel.

export type TeamType = "production" | "support";
export type ProductionCategory = "collection" | "legal" | "other" | "na";
export type AccessModel = "siloed" | "readonly" | "supervisor" | "shared";
export type TeamStatus = "active" | "inactive";

export type AnalyticsScope = "self" | "team" | "tenant";

export const ANALYTICS_PERMISSIONS = [
  "analytics.executive",
  "analytics.team",
  "analytics.collection",
  "analytics.legal",
  "analytics.agent",
  "analytics.export",
  "analytics.pdf",
  "analytics.kpi_targets",
  "analytics.compliance",
  "analytics.financial",
] as const;
export type AnalyticsPermission = (typeof ANALYTICS_PERMISSIONS)[number];

export const ANALYTICS_PERMISSION_LABELS: Record<AnalyticsPermission, string> = {
  "analytics.executive":    "View Executive Dashboard",
  "analytics.team":         "View Team Analytics",
  "analytics.collection":   "View Collection Analytics",
  "analytics.legal":        "View Legal Analytics",
  "analytics.agent":        "View Agent Analytics",
  "analytics.export":       "Export Reports",
  "analytics.pdf":          "Download PDF Report",
  "analytics.kpi_targets":  "Configure KPI Targets",
  "analytics.compliance":   "View Compliance Metrics",
  "analytics.financial":    "View Financial Metrics",
};

export type TeamKPIs = {
  amountCollected: number;
  recoveryRate: number;
  inventoryPenetration: number;
  rpcRate: number;
  ptpKeptRate: number;
  paymentConversion: number;
  legalRecoveryRate: number;
  productivityFTE: number;
  forecastVsActual: number; // % attained
  complianceScore: number;
  utilizationRate: number;
  revenuePerHour: number;
};

export type AgentKPIs = {
  accountsWorked: number;
  callsMade: number;
  rpcCount: number;
  rpcRate: number;
  ptpCount: number;
  ptpKeptRate: number;
  amountCollected: number;
  recoveryRate: number;
  avgTalkTime: number;
  acwTime: number;
  qaScore: number;
  complianceIssues: number;
};

export type KPITargets = {
  monthlyCollection: number;
  teamRecovery: number;
  rpc: number;
  ptpKept: number;
  inventoryPenetration: number;
  legalRecovery: number;
  complianceThreshold: number;
  qaScore: number;
  forecast: number;
};

export type TrendPoint = { label: string; value: number; prev?: number };

export type Filters = {
  dateRange: "7d" | "30d" | "90d" | "ytd";
  creditor?: string;
  placementBatch?: string;
  productionCategory?: ProductionCategory | "all";
  teamType?: TeamType | "all";
  teamId?: string;
  agentId?: string;
  role?: string;
};
