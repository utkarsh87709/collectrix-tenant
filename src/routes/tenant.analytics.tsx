import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { ExportBar } from "@/components/tenant/analytics/ExportBar";
import { FiltersBar } from "@/components/tenant/analytics/Filters";
import { OverviewTab } from "@/components/tenant/analytics/OverviewTab";
import { TeamPerformanceTab } from "@/components/tenant/analytics/TeamPerformanceTab";
import { CollectionTab } from "@/components/tenant/analytics/CollectionTab";
import { LegalTab } from "@/components/tenant/analytics/LegalTab";
import { AgentTab } from "@/components/tenant/analytics/AgentTab";
import { EmptyState } from "@/components/tenant/analytics/EmptyState";
import { useDemoRole } from "@/lib/demo-role";
import { visibleAnalyticsTabs, canSeeAnalyticsModule } from "@/lib/analytics-permissions";
import { usePortal } from "@/lib/portal-context";
import type { Filters } from "@/lib/analytics-types";

type Search = { tab?: string };

export const Route = createFileRoute("/tenant/analytics")({
  head: () => ({ meta: [{ title: "Analytics · Tenant Admin" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({ tab: typeof s.tab === "string" ? s.tab : undefined }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const role = useDemoRole();
  const { tenantId } = usePortal();
  const navigate = useNavigate({ from: "/tenant/analytics" });
  const { tab: tabParam } = useSearch({ from: "/tenant/analytics" });
  const allowedTabs = visibleAnalyticsTabs(role);
  const activeTab = allowedTabs.find((t) => t.id === tabParam)?.id ?? allowedTabs[0]?.id ?? "overview";

  const [filters, setFilters] = useState<Filters>({ dateRange: "30d", productionCategory: "all" });

  if (!canSeeAnalyticsModule(role)) {
    return (
      <Shell>
        <Topbar title="Analytics" subtitle="Performance insights for production teams" />
        <section className="px-6 lg:px-10 py-6">
          <EmptyState reason="no_filter_results" />
          <p className="text-center text-xs text-muted-foreground mt-3">Your role does not have analytics permissions.</p>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <Topbar
        title="Analytics"
        subtitle="Production team performance, recovery, legal and agent insights"
        action={<ExportBar scope={`Analytics — ${activeTab}`} />}
      />

      <section className="px-6 lg:px-10 py-6 space-y-5">
        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
          {allowedTabs.map((t) => {
            const active = t.id === activeTab;
            return (
              <button
                key={t.id}
                onClick={() => navigate({ search: { tab: t.id } })}
                className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                  active ? "border-tenant text-tenant" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-border bg-card/60 p-3">
          <FiltersBar
            filters={filters}
            setFilters={setFilters}
            show={tabFilterKeys(activeTab)}
          />
        </div>

        {/* Tab body */}
        {activeTab === "overview"   && <OverviewTab filters={filters} tenantId={tenantId} />}
        {activeTab === "team"       && <TeamPerformanceTab filters={filters} />}
        {activeTab === "collection" && <CollectionTab filters={filters} tenantId={tenantId} />}
        {activeTab === "legal"      && <LegalTab filters={filters} tenantId={tenantId} />}
        {activeTab === "agent"      && <AgentTab filters={filters} />}
      </section>
    </Shell>
  );
}

function tabFilterKeys(tab: string): ("dateRange" | "creditor" | "placementBatch" | "productionCategory" | "teamType" | "team" | "agent" | "role")[] {
  switch (tab) {
    case "overview":   return ["dateRange", "creditor", "placementBatch", "productionCategory"];
    case "team":       return ["dateRange", "teamType", "productionCategory", "team", "creditor", "placementBatch"];
    case "collection": return ["dateRange", "team", "creditor", "placementBatch"];
    case "legal":      return ["dateRange", "team", "creditor", "placementBatch"];
    case "agent":      return ["dateRange", "team", "role", "creditor", "productionCategory"];
    default:           return ["dateRange"];
  }
}
