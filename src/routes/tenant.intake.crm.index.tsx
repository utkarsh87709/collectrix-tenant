import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { Plug } from "lucide-react";
import { crmConnections } from "@/lib/crm-mock";

export const Route = createFileRoute("/tenant/intake/crm/")({
  head: () => ({ meta: [{ title: "CRM Integration · Tenant Admin" }] }),
  component: CrmHub,
});

function CrmHub() {
  return (
    <Shell>
      <Topbar title="CRM Integration" subtitle="Connect external CRMs (COLLECT!, Salesforce…) and orchestrate bi-directional sync" />

      <section className="px-6 lg:px-10 py-6">
        <PageCard>
          <CardHead
            title="Connected systems"
            subtitle="Per-tenant CRM connections"
            action={
              <Link
                to="/tenant/intake/crm/connect"
                className="text-xs font-semibold text-tenant hover:underline"
              >
                Add connection
              </Link>
            }
          />
          <ul className="divide-y divide-border">
            {crmConnections.map((c) => {
              const isActive = c.status === "connected";
              return (
                <li key={c.id} className="px-6 py-4 flex items-center gap-4 text-sm">
                  <div className="h-10 w-10 rounded-xl bg-tenant-soft text-tenant flex items-center justify-center">
                    <Plug className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0 font-semibold truncate">{c.label}</div>
                  <Pill tone={isActive ? "success" : "muted"}>
                    {isActive ? "Active" : "Inactive"}
                  </Pill>
                </li>
              );
            })}
          </ul>
        </PageCard>
      </section>
    </Shell>
  );
}
