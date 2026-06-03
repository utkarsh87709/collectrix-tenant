export type OnboardingStep = "invite_sent" | "registration_pending" | "billing_pending" | "complete";

export type Tenant = {
  id: string;
  name: string;
  subdomain: string;
  status: "active" | "deactivated" | "invited";
  tier: "Starter" | "Professional" | "Enterprise";
  payment: "current" | "due" | "failed" | "pending";
  lastLogin: string;
  users: number;
  debtors: number;
  daysOverdue?: number;
  deletesIn?: number;
  createdAt: string;
  // Invitation lifecycle
  contactEmail?: string;
  contactPhone?: string;
  packageId?: string;
  invitedAt?: string;
  inviteExpiresAt?: string;
  activatedAt?: string;
  onboardingStep?: OnboardingStep;
};

export const tenants: Tenant[] = [
  { id: "t_01", name: "Apex Recovery Group", subdomain: "apex", status: "active", tier: "Enterprise", payment: "current", lastLogin: "2h ago", users: 48, debtors: 12480, createdAt: "2024-03-12" },
  { id: "t_02", name: "Northbridge Collections", subdomain: "northbridge", status: "active", tier: "Professional", payment: "due", lastLogin: "1d ago", users: 22, debtors: 5210, daysOverdue: 4, createdAt: "2024-06-01" },
  { id: "t_03", name: "Quill & Park Legal", subdomain: "quillpark", status: "active", tier: "Enterprise", payment: "current", lastLogin: "12m ago", users: 65, debtors: 18920, createdAt: "2023-11-20" },
  { id: "t_04", name: "Harbor Credit Services", subdomain: "harbor", status: "active", tier: "Starter", payment: "failed", lastLogin: "9d ago", users: 6, debtors: 412, daysOverdue: 12, createdAt: "2025-01-08" },
  { id: "t_05", name: "Meridian Financial", subdomain: "meridian", status: "active", tier: "Professional", payment: "current", lastLogin: "5h ago", users: 31, debtors: 7820, createdAt: "2024-09-15" },
  { id: "t_06", name: "Sable & Stone Recovery", subdomain: "sablestone", status: "deactivated", tier: "Professional", payment: "failed", lastLogin: "32d ago", users: 14, debtors: 2104, daysOverdue: 28, deletesIn: 8, createdAt: "2024-02-01" },
  { id: "t_07", name: "Trident Receivables", subdomain: "trident", status: "active", tier: "Enterprise", payment: "current", lastLogin: "1h ago", users: 102, debtors: 34210, createdAt: "2023-07-22" },
  { id: "t_08", name: "Cascade Asset Management", subdomain: "cascade", status: "active", tier: "Starter", payment: "due", lastLogin: "3d ago", users: 4, debtors: 188, daysOverdue: 2, createdAt: "2025-02-14" },
  { id: "t_09", name: "Beacon Collection Co.", subdomain: "beacon", status: "deactivated", tier: "Starter", payment: "failed", lastLogin: "45d ago", users: 3, debtors: 96, daysOverdue: 41, deletesIn: 22, createdAt: "2024-05-03" },
  { id: "t_10", name: "Vanguard Receivables Group", subdomain: "vanguard", status: "active", tier: "Enterprise", payment: "current", lastLogin: "30m ago", users: 88, debtors: 26410, createdAt: "2023-10-11", activatedAt: "2023-10-11" },
  { id: "t_11", name: "Lighthouse Recovery Partners", subdomain: "lighthouse", status: "invited", tier: "Professional", payment: "pending", lastLogin: "—", users: 0, debtors: 0, createdAt: "2026-05-02", contactEmail: "ops@lighthouserp.com", contactPhone: "+1 415 555 0142", packageId: "pkg_growth", invitedAt: "2026-05-02", inviteExpiresAt: "2026-05-09", onboardingStep: "registration_pending" },
  { id: "t_12", name: "Summit Receivables LLC", subdomain: "summit", status: "invited", tier: "Starter", payment: "pending", lastLogin: "—", users: 0, debtors: 0, createdAt: "2026-05-06", contactEmail: "founders@summitrec.com", contactPhone: "+1 212 555 0188", packageId: "pkg_standard", invitedAt: "2026-05-06", inviteExpiresAt: "2026-05-13", onboardingStep: "invite_sent" },
];

export const tenantGrowth = [
  { m: "May", v: 4 }, { m: "Jun", v: 6 }, { m: "Jul", v: 5 }, { m: "Aug", v: 8 },
  { m: "Sep", v: 11 }, { m: "Oct", v: 9 }, { m: "Nov", v: 14 }, { m: "Dec", v: 17 },
  { m: "Jan", v: 21 }, { m: "Feb", v: 19 }, { m: "Mar", v: 26 }, { m: "Apr", v: 31 },
];

export const tierDistribution = [
  { name: "Starter", value: 28 },
  { name: "Professional", value: 47 },
  { name: "Enterprise", value: 25 },
];

export const paymentHealth = [
  { name: "Current", value: 84 },
  { name: "Due", value: 9 },
  { name: "Failed", value: 5 },
  { name: "Suspended", value: 2 },
];

export const dailyActiveUsers = Array.from({ length: 30 }, (_, i) => ({
  d: `D${i + 1}`,
  v: 1200 + Math.round(Math.sin(i / 3) * 220) + i * 12,
}));
