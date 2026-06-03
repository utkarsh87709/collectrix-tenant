import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { statusCodes, getAllowedNext } from "@/lib/status-mock";
import { ArrowRight, ChevronLeft, Lock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/tenant/settings/statuses")({
  head: () => ({ meta: [{ title: "Debtor Statuses · Tenant Admin" }] }),
  component: StatusesPage,
});

const CATEGORY_LABEL: Record<string, string> = {
  intake: "Intake",
  collection: "Collection",
  resolved: "Resolved / Closed",
  risk: "Risk",
  review: "Review & Hardship",
  legal: "Legal",
};

function StatusesPage() {
  const byCategory = statusCodes.reduce<Record<string, typeof statusCodes>>((acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {});

  const order = ["intake", "collection", "resolved", "risk", "review", "legal"];

  return (
    <Shell>
      <Topbar
        title="Debtor Statuses"
        subtitle="System-defined workflow — shared across all tenants"
        action={
          <Link
            to="/tenant/settings"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" /> Back to settings
          </Link>
        }
      />

      <section className="px-6 lg:px-10 pt-6 space-y-5 pb-12">
        <PageCard>
          <div className="px-6 py-5 flex items-start gap-3">
            <div className="shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-tenant-soft text-tenant flex items-center justify-center">
              <Lock className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold">Static status engine</h2>
              <p className="text-sm text-muted-foreground max-w-3xl">
                Debtor statuses and transition rules are defined by the platform
                and shared across every tenant. Tenants cannot create, edit,
                rename, delete or reorder statuses, and cannot change the
                workflow. Debtor records, history and permissions remain fully
                tenant-scoped.
              </p>
            </div>
          </div>
        </PageCard>

        {order.map((cat) => {
          const items = byCategory[cat];
          if (!items?.length) return null;
          return (
            <PageCard key={cat}>
              <CardHead
                title={CATEGORY_LABEL[cat] ?? cat}
                subtitle={`${items.length} status${items.length === 1 ? "" : "es"}`}
              />
              <ul className="divide-y divide-border">
                {items.map((s) => {
                  const next = getAllowedNext(s.code);
                  return (
                    <li key={s.code} className="px-6 py-4 flex flex-wrap items-start gap-4">
                      <div className="min-w-[220px] flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Pill tone={s.tone}>
                            {s.icon} {s.code}
                          </Pill>
                          <span className="font-semibold">{s.displayName}</span>
                          {s.isFinal && (
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
                              Final
                            </span>
                          )}
                          {s.requiresApproval && (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-warning-foreground bg-warning/15 rounded px-1.5 py-0.5">
                              <ShieldCheck className="h-3 w-3" /> Approval
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {s.description}
                        </p>
                      </div>
                      <div className="min-w-[260px] flex-[2]">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                          Can transition to
                        </div>
                        {next.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">
                            Terminal — no further transitions
                          </p>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {next.map((n) => (
                              <span
                                key={n.code}
                                className="inline-flex items-center gap-1"
                              >
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <Pill tone={n.tone}>
                                  {n.icon} {n.code}
                                </Pill>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </PageCard>
          );
        })}
      </section>
    </Shell>
  );
}
