import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead } from "@/components/tenant/ui";
import { ScrollText, Download } from "lucide-react";
import { debtorAuditTrail } from "@/lib/intake-mock";

export const Route = createFileRoute("/tenant/intake/audit")({
  head: () => ({ meta: [{ title: "Customer Audit · Tenant Admin" }] }),
  component: AuditPage,
});

function AuditPage() {
  return (
    <Shell>
      <Topbar
        title="Customer Audit Trail"
        subtitle="Every change to every customer — immutable record"
        action={<button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"><Download className="h-4 w-4" /> Export CSV</button>}
      />
      <section className="px-6 lg:px-10 py-6">
        <PageCard>
          <CardHead title="All changes" subtitle={`${debtorAuditTrail.length} entries shown`} />
          <ul className="divide-y divide-border">
            {debtorAuditTrail.map((a) => (
              <li key={a.id} className="px-6 py-3 flex items-start gap-3 text-sm">
                <ScrollText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold">{a.action}{a.field && <span className="text-muted-foreground font-normal"> · {a.field}</span>}</div>
                  {(a.before || a.after) && (
                    <div className="text-xs font-mono mt-0.5">
                      {a.before && <span className="text-destructive">{a.before}</span>}
                      {a.before && a.after && <span className="mx-1.5 text-muted-foreground">→</span>}
                      {a.after && <span className="text-success">{a.after}</span>}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-0.5">{a.actor} · {a.source} · {a.when}</div>
                </div>
              </li>
            ))}
          </ul>
        </PageCard>
      </section>
    </Shell>
  );
}
