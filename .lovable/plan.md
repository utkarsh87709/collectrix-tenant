# Tenant Analytics Module + Cross-Surface Updates

This is intentionally a phased plan because the spec spans ~10 surfaces. Phase 1 ships the foundation everything else depends on (data model, sidebar, analytics shell + Overview). Each later phase is independently shippable.

## Foundation — shared types, mock factories, permissions

**`src/lib/analytics-types.ts`** — single source of truth:
- `TeamType = "production" | "support"`
- `ProductionCategory = "collection" | "legal" | "other" | "na"`
- `AccessModel = "siloed" | "readonly" | "supervisor" | "shared"`
- Extend `Team`: `type`, `productionCategory`, `description`, `status: "active"|"inactive"`, `analyticsEnabled: boolean`.
- `TeamKPIs`, `AgentKPIs`, `LegalKPIs`, `CollectionKPIs`, `KPITargets`, `KPISet` (groups for Overview/Team/Collection/Legal/Agent).
- `AnalyticsPermission` enum (10 perms from spec §11).

**`src/lib/analytics-mock.ts`** — deterministic seeded mock per tenant id (hash → numbers). Functions: `getTenantKPIs(tenantId, filters)`, `getTeamKPIs(teamId)`, `getAgentKPIs(agentId)`, `getTrend(metric, period)`, `getKPITargets(tenantId)`. Realistic ranges, no hardcoded tenant/team/creditor names — everything driven by tenant settings.

**`src/lib/analytics-permissions.ts`** — `hasAnalyticsPerm(role, perm)`, `visibleAgentScope(role)` returning "self"|"team"|"tenant". Wired to existing demo-role selector so visibility rules can be demoed.

**`src/lib/tenant-mock.ts`** — add the new Team fields and seed each existing team with type/category/status/analyticsEnabled. Add 1–2 support teams (Compliance, Client Services) so empty-state demos work.

**`src/lib/kpi-targets-store.ts`** — `useSyncExternalStore` + localStorage, scope keys = `tenant`, `team:<id>`, `category:<cat>`. CRUD with audit timestamp.

## Phase 1 — Sidebar + Analytics shell + Overview tab

1. **Sidebar (`src/lib/nav-registry.ts`)** — add **Analytics** menu item with `LineChart` icon under a new "Insights" group (above Compliance). Permission-gated in `Sidebar.tsx` via `hasAnalyticsPerm`.
2. **`src/routes/tenant.analytics.tsx`** — layout route with tab bar: Overview / Team Performance / Collection / Legal / Agent. Tabs use search params (`?tab=overview` default). Each tab is a component imported from `src/components/tenant/analytics/`.
3. **`src/components/tenant/analytics/`** new folder:
   - `AnalyticsShell.tsx` — header, filter bar, export buttons (CSV + PDF toast, Schedule disabled), tab nav.
   - `KPICard.tsx` — name, value, Δ vs prev period, sparkline, tooltip.
   - `EmptyState.tsx` — the 8 messages from spec §15 keyed by reason.
   - `ExportBar.tsx` — Export CSV / Download PDF (toast) / Schedule (disabled "coming soon").
   - `Filters.tsx` — Date Range, Portfolio, Placement Batch, Production Category, Team, Role, Agent (composable; each tab passes the subset it wants).
   - `Charts.tsx` — small wrappers around recharts (Line/Area/Bar) with shared theme tokens.
4. **Overview tab** — KPI grid (10 cards from §4), 6 charts, 4 tables (Top/Underperforming/Portfolio/Top Contributors). Pure production teams only.

## Phase 2 — Team Performance + Team Detail Analytics

5. **Team Performance tab** — filters (incl. Team Type defaulting to Production), 10 KPI roll-up cards, team comparison table with "View details" → `/tenant/analytics/team/$teamId`. Support teams display "N/A" in KPI columns.
6. **`src/routes/tenant.analytics.team.$teamId.tsx`** — Team Detail Analytics. Branches on team type:
   - Production: header (name + type + category badges + leader + members + period), 10 KPI cards, 6 trend charts, agent breakdown table with "View agent".
   - Support: header + basic team info + empty state from spec.

## Phase 3 — Collection / Legal / Agent tabs

7. **Collection Teams tab** — filtered to production+collection. Empty state if none. KPI sections: Activity/Productivity (11), Collection Performance (12), Inventory Mgmt (8), Quality & Compliance (7). Charts: collection trend, team comparison, collector productivity, inventory penetration, compliance table.
8. **Legal Teams tab** — filtered to production+legal. KPI sections: Legal Production (8), Legal Recovery (8), Cycle-Time (6). Charts: legal collections, suits, judgments, recovery, cycle-time.
9. **Agent Performance tab** — agent table with 17 cols, permission-scoped (self/team/tenant). "View details" → `/tenant/analytics/agent/$agentId` (light page, can mirror Team Detail layout).

## Phase 4 — Teams module overhaul

10. **`tenant.teams.tsx` — listing** — replace card grid with table (Team Name, Type, Production Category, Leader, Members, Status, Analytics Enabled, Actions). Badges via shared `TeamBadges.tsx`.
11. **Create Team modal** — add Type radio, conditional Production Category select with helper text for Support, Description, Status. Existing Leader/Members/Access Model retained.
12. **Edit Team modal** — same fields + warning banner when Type changes (Production→Support and Support→Production variants, plus require Category if switching to Production).
13. **`tenant.teams.$teamId.tsx`** — new Team Detail page with header (name + badges + leader + members + status + analytics enabled), analytics summary section (Production: 6 KPI mini-cards via `getTeamKPIs`; Support: empty state), "View Analytics" button → `/tenant/analytics/team/$teamId`.

## Phase 5 — Users, Roles, KPI Targets, Dashboard widgets

14. **`tenant.users.tsx` listing** — add Team + Team Type columns (Team Type derived from team assignment).
15. **Invite/Create + ViewUser modals** — Team select shows badge "Production Team · Collection" once chosen. Detail panel shows Assigned Team, Team Type, Production Category, Manager, Analytics Visibility. "View agent analytics" button when permission allows.
16. **`tenant.roles.tsx`** — add new "Analytics & Reporting" permission group with the 10 perms; existing permission editor UI accepts a new group seamlessly.
17. **`src/routes/tenant.settings.kpi-targets.tsx`** (new) — table of metric → tenant/team/category target with inline edit, save via `kpi-targets-store`. Link from `tenant.settings.index.tsx`.
18. **`tenant.index.tsx`** — add 6 analytics widget cards (Total Collected / Recovery Rate / Active Production Teams / PTP Kept / Compliance / Forecast vs Actual) + "View Full Analytics" button → `/tenant/analytics`.

## Cross-cutting

- **Charts**: `recharts` is already in deps — re-use. No new packages needed except possibly `bun add recharts` if missing (will check before phase 1).
- **Export**: CSV via `Blob` download in browser; PDF via `toast.success("PDF report generated")` placeholder + filename — full PDF rendering out of scope (matches level of other "report" buttons in the app today).
- **Audit-ready**: every mutation (target change, team type change, role perm change, export click) calls a tiny `logAnalyticsAudit(...)` helper writing to existing `audit-timeline-store` pattern — no new backend, just timeline entries so the audit trail is visible.
- **Empty states**: single component, 8 keyed messages, never blank tables / zero-value cards.
- **Demo role selector**: existing `useDemoRole()` drives permission gating end-to-end so reviewer can flip Agent / Manager / Admin / Finance and see different sidebar/tab/scope behavior.

## Technical files (new)

- `src/lib/analytics-types.ts`
- `src/lib/analytics-mock.ts`
- `src/lib/analytics-permissions.ts`
- `src/lib/kpi-targets-store.ts`
- `src/routes/tenant.analytics.tsx`
- `src/routes/tenant.analytics.team.$teamId.tsx`
- `src/routes/tenant.analytics.agent.$agentId.tsx`
- `src/routes/tenant.teams.$teamId.tsx`
- `src/routes/tenant.settings.kpi-targets.tsx`
- `src/components/tenant/analytics/{AnalyticsShell,KPICard,EmptyState,ExportBar,Filters,Charts,OverviewTab,TeamPerformanceTab,CollectionTab,LegalTab,AgentTab,TeamBadges}.tsx`

## Technical files (modified)

- `src/lib/tenant-mock.ts` — Team type fields + seed data
- `src/lib/nav-registry.ts` — Analytics nav item + flat-list entries
- `src/components/admin/Sidebar.tsx` — permission gate
- `src/routes/tenant.teams.tsx` — listing + Create/Edit modals
- `src/routes/tenant.users.tsx` — Team column + ViewUser team badge
- `src/routes/tenant.roles.tsx` — Analytics permission group
- `src/routes/tenant.settings.index.tsx` — link to KPI Targets
- `src/routes/tenant.index.tsx` — analytics widgets

## Recommended delivery

I'd ship in this order so each step is reviewable on its own:

1. **Foundation + Phase 1** (data model, sidebar, Overview tab, empty/export/filter shell) — ~1 message
2. **Phase 4** (Teams overhaul + Team Detail) — depends on data model, unblocks Team analytics link — ~1 message
3. **Phase 2** (Team Performance + Team Detail Analytics) — ~1 message
4. **Phase 3** (Collection / Legal / Agent tabs) — ~1 message
5. **Phase 5** (Users + Roles + KPI Targets + dashboard widgets) — ~1 message

If you'd rather collapse phases, say so and I'll batch them. Tell me which phase to start with (default: 1) and I'll go.
