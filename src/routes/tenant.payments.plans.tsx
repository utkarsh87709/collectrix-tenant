import { createFileRoute } from "@tanstack/react-router";
import { PaymentsShell } from "./tenant.payments";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { usePlans, useInstallments, planComplianceSummary } from "@/lib/payments-store";
import type { InstallmentStatus } from "@/lib/payments-mock";
import { Calendar, Bell, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/tenant/payments/plans")({
  head: () => ({ meta: [{ title: "Payment Plans · Payments" }] }),
  component: PlansPage,
});

const itone: Record<InstallmentStatus, "success" | "warning" | "danger" | "muted" | "info" | "tenant"> = {
  paid: "success", partial: "warning", missed: "danger", late: "danger", scheduled: "info", due: "tenant", waived: "muted",
};

function PlansPage() {
  const plans = usePlans();
  const allInst = useInstallments();

  return (
    <PaymentsShell active="plans">
      <div className="space-y-4">
        {plans.map((plan) => {
          const inst = allInst.filter((i) => i.planId === plan.id).sort((a, b) => a.seq - b.seq);
          const summary = planComplianceSummary(plan.id);
          return (
            <PageCard key={plan.id}>
              <CardHead
                title={`Plan ${plan.id} — debtor #${plan.debtorId}`}
                subtitle={`${plan.cadence} · $${plan.totalAmount.toLocaleString()} total · started ${new Date(plan.startDate).toLocaleDateString()}`}
                action={<Pill tone={plan.status === "active" ? "success" : plan.status === "broken" ? "danger" : "muted"}>{plan.status}</Pill>}
              />
              <div className="px-6 py-4 grid grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div className="rounded-lg bg-success/10 px-3 py-2"><div className="text-muted-foreground">Paid</div><div className="font-bold text-success text-lg">{summary.paid}</div></div>
                <div className="rounded-lg bg-warning/10 px-3 py-2"><div className="text-muted-foreground">Partial</div><div className="font-bold text-warning-foreground text-lg">{summary.partial}</div></div>
                <div className="rounded-lg bg-destructive/10 px-3 py-2"><div className="text-muted-foreground">Missed</div><div className="font-bold text-destructive text-lg">{summary.missed}</div></div>
                <div className="rounded-lg bg-info/10 px-3 py-2"><div className="text-muted-foreground">Upcoming</div><div className="font-bold text-info-foreground text-lg">{summary.upcoming}</div></div>
                <div className="rounded-lg bg-tenant/10 px-3 py-2"><div className="text-muted-foreground">On-time rate</div><div className="font-bold text-tenant text-lg">{summary.onTimeRate}%</div></div>
              </div>
              <div className="border-t border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                    <tr>
                      <th className="px-6 py-2 text-left">#</th>
                      <th className="px-6 py-2 text-left">Due</th>
                      <th className="px-6 py-2 text-right">Amount</th>
                      <th className="px-6 py-2 text-right">Paid</th>
                      <th className="px-6 py-2 text-left">Status</th>
                      <th className="px-6 py-2 text-left">Reminder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {inst.map((i) => {
                      const overdue = new Date(i.dueDate).getTime() < Date.now() && i.status !== "paid";
                      return (
                        <tr key={i.id}>
                          <td className="px-6 py-2 font-mono text-xs">{i.seq}</td>
                          <td className="px-6 py-2 text-xs"><Calendar className="inline h-3 w-3 mr-1" />{new Date(i.dueDate).toLocaleDateString()}</td>
                          <td className="px-6 py-2 text-right">${i.amount.toFixed(2)}</td>
                          <td className="px-6 py-2 text-right">${i.paidAmount.toFixed(2)}</td>
                          <td className="px-6 py-2"><Pill tone={itone[i.status]}>{i.status}</Pill></td>
                          <td className="px-6 py-2 text-xs text-muted-foreground">
                            {i.status === "scheduled" && !overdue && <span className="inline-flex items-center gap-1"><Bell className="h-3 w-3" /> Auto-reminder 3 days prior</span>}
                            {i.status === "paid" && <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> Confirmed</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </PageCard>
          );
        })}
      </div>
    </PaymentsShell>
  );
}
