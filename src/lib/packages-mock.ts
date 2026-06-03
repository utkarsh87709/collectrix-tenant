// Mock package + billing catalog used by tenant billing and onboarding.
// The real source of truth lives in the `packages` / `tenant_packages` /
// `tenant_invoices` Supabase tables — this mock keeps the UI rich for the
// stakeholder walkthrough until those tables are wired in.

export type PackageStatus = "active" | "draft" | "inactive";

export type Package = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  billingCycle: "monthly" | "annual";
  debtorLimit: number;
  userLimit: number;
  teamLimit: number;
  storageLimitGb: number;
  tokenLimit: number;
  smsLimit: number;
  callMinutesLimit: number;
  includedModules: string[];
  overagePerDebtor: number;
  status: PackageStatus;
  tenantsAssigned: number;
  createdAt: string;
  updatedAt: string;
};

export const packages: Package[] = [
  {
    id: "pkg_standard",
    name: "Standard",
    description: "Default package — every Collectrix module, sized for most agencies.",
    monthlyPrice: 499,
    annualPrice: 4990,
    billingCycle: "monthly",
    debtorLimit: 10000,
    userLimit: 25,
    teamLimit: 10,
    storageLimitGb: 200,
    tokenLimit: 5_000_000,
    smsLimit: 25_000,
    callMinutesLimit: 25_000,
    includedModules: ["AI Voice", "Communications", "Workflows", "Compliance", "Analytics", "Integrations"],
    overagePerDebtor: 0.04,
    status: "active",
    tenantsAssigned: 10,
    createdAt: "2025-01-12",
    updatedAt: "2026-04-18",
  },
  {
    id: "pkg_growth",
    name: "Growth",
    description: "Mid-market plan with higher debtor capacity and team limits.",
    monthlyPrice: 999,
    annualPrice: 9990,
    billingCycle: "monthly",
    debtorLimit: 30000,
    userLimit: 60,
    teamLimit: 25,
    storageLimitGb: 500,
    tokenLimit: 15_000_000,
    smsLimit: 75_000,
    callMinutesLimit: 75_000,
    includedModules: ["AI Voice", "Communications", "Workflows", "Compliance", "Analytics", "Integrations", "Bulk Operations"],
    overagePerDebtor: 0.03,
    status: "active",
    tenantsAssigned: 0,
    createdAt: "2026-02-02",
    updatedAt: "2026-04-22",
  },
  {
    id: "pkg_enterprise",
    name: "Enterprise",
    description: "High-volume tier for large recovery groups & legal collections.",
    monthlyPrice: 2499,
    annualPrice: 24990,
    billingCycle: "monthly",
    debtorLimit: 100000,
    userLimit: 250,
    teamLimit: 100,
    storageLimitGb: 2000,
    tokenLimit: 50_000_000,
    smsLimit: 250_000,
    callMinutesLimit: 250_000,
    includedModules: ["AI Voice", "Communications", "Workflows", "Compliance", "Analytics", "Integrations", "Bulk Operations", "Custom Roles", "Dedicated Support"],
    overagePerDebtor: 0.02,
    status: "draft",
    tenantsAssigned: 0,
    createdAt: "2026-03-10",
    updatedAt: "2026-04-30",
  },
];

export type TenantBilling = {
  tenantId: string;
  packageId: string;
  packageName: string;
  monthlyPrice: number;
  billingCycle: "monthly" | "annual";
  debtorsUsed: number;
  debtorLimit: number;
  usersUsed: number;
  userLimit: number;
  teamsUsed: number;
  teamLimit: number;
  tokensUsed: number;
  tokenLimit: number;
  smsSent: number;
  smsLimit: number;
  callsCount: number;
  callMinutes: number;
  callMinutesLimit: number;
  storageUsedGb: number;
  storageLimitGb: number;
  outstandingBalance: number;
  failedPaymentCount: number;
  lastPaymentDate?: string;
  nextPaymentDate?: string;
  assignedAt: string;
  renewalAt: string;
  paymentStatus: "paid" | "due" | "failed" | "pending" | "suspended";
  billingContact: string;
};

export function tenantBillingFor(tenantId: string, debtors: number, users: number): TenantBilling {
  return {
    tenantId,
    packageId: "pkg_standard",
    packageName: "Standard",
    monthlyPrice: 499,
    billingCycle: "monthly",
    debtorsUsed: debtors,
    debtorLimit: 10000,
    usersUsed: users,
    userLimit: 25,
    teamsUsed: Math.max(1, Math.floor(users / 6)),
    teamLimit: 10,
    tokensUsed: Math.round(debtors * 280),
    tokenLimit: 5_000_000,
    smsSent: Math.round(debtors * 1.4),
    smsLimit: 25_000,
    callsCount: Math.round(debtors * 0.6),
    callMinutes: Math.round(debtors * 1.8),
    callMinutesLimit: 25_000,
    storageUsedGb: Math.min(200, Math.round(debtors / 60)),
    storageLimitGb: 200,
    outstandingBalance: 0,
    failedPaymentCount: 0,
    lastPaymentDate: "2026-04-01",
    nextPaymentDate: "2026-06-01",
    assignedAt: "2025-08-12",
    renewalAt: "2026-08-12",
    paymentStatus: "paid",
    billingContact: "billing@example.com",
  };
}

export type Invoice = {
  id: string;
  number: string;
  periodMonth: string; // YYYY-MM
  amount: number;
  status: "paid" | "due" | "failed" | "pending" | "suspended";
  dueDate: string;
  paidDate?: string;
};

export function invoicesFor(tenantId: string, monthly = 499): Invoice[] {
  const now = new Date();
  const rows: Invoice[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const status: Invoice["status"] = i === 0 ? "due" : i === 1 ? "paid" : i === 4 ? "failed" : "paid";
    rows.push({
      id: `inv_${tenantId}_${period}`,
      number: `INV-${period.replace("-", "")}-${tenantId.slice(-3).toUpperCase()}`,
      periodMonth: period,
      amount: monthly,
      status,
      dueDate: `${period}-15`,
      paidDate: status === "paid" ? `${period}-12` : undefined,
    });
  }
  return rows;
}

export const packageDistribution = [
  { name: "Standard", value: 64 },
  { name: "Growth", value: 28 },
  { name: "Enterprise", value: 8 },
];

export const revenueByPackage = [
  { name: "Standard", revenue: 89 },
  { name: "Growth", revenue: 112 },
  { name: "Enterprise", revenue: 47 },
];

export const debtorUsageTrend = [
  { m: "Nov", v: 124 }, { m: "Dec", v: 138 }, { m: "Jan", v: 156 },
  { m: "Feb", v: 172 }, { m: "Mar", v: 189 }, { m: "Apr", v: 204 },
];

export const failedPaymentTrend = [
  { m: "Nov", v: 3 }, { m: "Dec", v: 5 }, { m: "Jan", v: 4 },
  { m: "Feb", v: 7 }, { m: "Mar", v: 6 }, { m: "Apr", v: 5 },
];
