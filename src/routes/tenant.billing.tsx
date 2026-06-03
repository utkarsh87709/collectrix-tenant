import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CreditCard, Download, AlertTriangle, CheckCircle2, XCircle, Clock, Plus, Database, Users,
} from "lucide-react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { Card, StatCard, Badge, SectionHeader } from "@/components/admin/ui";
import { invoicesFor, tenantBillingFor, type Invoice } from "@/lib/packages-mock";

export const Route = createFileRoute("/tenant/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Tenant Admin" },
      { name: "description", content: "Tenant billing, invoices, and payment method management." },
    ],
  }),
  component: TenantBillingPage,
});

function TenantBillingPage() {
  const billing = tenantBillingFor("t_01", 6420, 18);
  const invoices = invoicesFor("t_01", billing.monthlyPrice);
  const usagePct = Math.round((billing.debtorsUsed / billing.debtorLimit) * 100);

  return (
    <Shell>
      <Topbar
        title="Billing"
        subtitle="Manage your subscription, payment method, and invoices"
        action={
          <button onClick={() => toast.info("Opening payment method form")} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
            <Plus className="h-4 w-4" /> Add Payment Method
          </button>
        }
      />
      <div className="px-6 lg:px-10 py-8 space-y-6 max-w-[1500px]">

        {billing.paymentStatus === "due" && (
          <Card className="p-4 border-warning/40 bg-warning/5 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning-foreground shrink-0" />
            <div className="flex-1 text-sm"><strong>Payment due.</strong> Your next invoice is due {billing.nextPaymentDate}.</div>
            <button className="px-3 py-1.5 rounded-lg bg-warning text-warning-foreground text-xs font-semibold">Pay now</button>
          </Card>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Current Package" value={billing.packageName} delta={`$${billing.monthlyPrice}/mo`} icon={CreditCard} tone="info" />
          <StatCard label="Outstanding" value={`$${billing.outstandingBalance}`} delta="Up to date" icon={CheckCircle2} tone="success" />
          <StatCard label="Next Payment" value={billing.nextPaymentDate ?? "—"} delta={billing.billingCycle} icon={Clock} tone="default" />
          <StatCard label="Last Payment" value={billing.lastPaymentDate ?? "—"} delta="Card on file" icon={CheckCircle2} tone="success" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="p-6 lg:col-span-2">
            <SectionHeader title="Subscription overview" description={`Renews ${billing.renewalAt}. Contact support to upgrade or downgrade your plan.`} />
            <div className="grid sm:grid-cols-2 gap-4">
              <UsageMetric icon={Database} label="Debtor accounts" used={billing.debtorsUsed} limit={billing.debtorLimit} primary />
              <UsageMetric icon={Users} label="Users" used={billing.usersUsed} limit={billing.userLimit} />
            </div>
            {usagePct > 80 && (
              <div className="mt-4 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs">
                You're at {usagePct}% of your debtor account limit — consider upgrading to avoid overage fees.
              </div>
            )}
          </Card>

          <Card className="p-6">
            <SectionHeader title="Payment method" />
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-14 rounded bg-gradient-brand flex items-center justify-center text-white text-xs font-bold">VISA</div>
                <div>
                  <div className="text-sm font-semibold">•••• 4242</div>
                  <div className="text-xs text-muted-foreground">Expires 09/28</div>
                </div>
              </div>
              <button className="mt-3 w-full text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted">Update card</button>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Billing contact: <span className="font-medium text-foreground">{billing.billingContact}</span>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <SectionHeader title="Invoices" description="Last 6 months"
            action={<button onClick={() => toast.success("Invoice CSV downloaded")} className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-muted"><Download className="h-3.5 w-3.5" /> Export</button>} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Period</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Due</th>
                  <th className="px-4 py-2.5 font-medium">Paid</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-xs">{inv.number}</td>
                    <td className="px-4 py-3">{inv.periodMonth}</td>
                    <td className="px-4 py-3 text-right font-mono">${inv.amount}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.dueDate}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.paidDate ?? "—"}</td>
                    <td className="px-4 py-3"><InvoiceStatus status={inv.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toast.success(`${inv.number} downloaded`)} className="p-1.5 rounded hover:bg-muted"><Download className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Shell>
  );
}

function UsageMetric({ icon: Icon, label, used, limit, primary }: { icon?: typeof Users; label: string; used: number; limit: number; primary?: boolean }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const tone = pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-warning" : primary ? "bg-gradient-brand" : "bg-primary";
  return (
    <div className={primary ? "rounded-lg border border-primary/30 bg-primary/5 p-3" : ""}>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="flex items-center gap-1.5 text-muted-foreground">{Icon && <Icon className="h-3.5 w-3.5" />} {label}</span>
        <span className="font-mono">{used.toLocaleString()} / {limit.toLocaleString()}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      {pct >= 90 && <div className="text-[10px] text-destructive mt-1">Limit nearly reached</div>}
    </div>
  );
}

function InvoiceStatus({ status }: { status: Invoice["status"] }) {
  if (status === "paid") return <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> Paid</Badge>;
  if (status === "due") return <Badge tone="warning"><AlertTriangle className="h-3 w-3" /> Due</Badge>;
  if (status === "failed") return <Badge tone="destructive"><XCircle className="h-3 w-3" /> Failed</Badge>;
  if (status === "suspended") return <Badge tone="destructive"><XCircle className="h-3 w-3" /> Suspended</Badge>;
  return <Badge tone="default"><Clock className="h-3 w-3" /> Pending</Badge>;
}
