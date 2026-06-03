import { createFileRoute } from "@tanstack/react-router";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { creditorClients, fmt } from "@/lib/dashboards-mock";
import { Send, FileText } from "lucide-react";

export const Route = createFileRoute("/tenant/dashboards/clients")({
  component: Clients,
});

function Clients() {
  return (
    <div className="px-6 lg:px-10 py-6 space-y-6">
      <Pill tone="tenant">US-148 · Creditor client report packs</Pill>

      <PageCard>
        <CardHead title="Client creditors" subtitle="Generate branded PDF or Excel for each creditor" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-right px-4 py-3">Placed</th>
                <th className="text-right px-4 py-3">Recovered</th>
                <th className="text-right px-4 py-3">Rate</th>
                <th className="text-left px-4 py-3">Last report</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {creditorClients.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-4 py-3 text-right">{fmt.money(c.placed)}</td>
                  <td className="px-4 py-3 text-right text-success font-semibold">{fmt.money(c.recovered)}</td>
                  <td className="px-4 py-3 text-right"><Pill tone={c.rate >= 40 ? "success" : "tenant"}>{fmt.pct(c.rate)}</Pill></td>
                  <td className="px-4 py-3 text-muted-foreground">{c.lastReport}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-xs hover:bg-muted"><FileText className="h-3 w-3" /> PDF</button>
                      <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-xs hover:bg-muted"><Send className="h-3 w-3" /> Send</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageCard>
    </div>
  );
}
