import { createFileRoute } from "@tanstack/react-router";
import { PaymentsShell } from "./tenant.payments";
import { PageCard, CardHead, StatTile, Pill } from "@/components/tenant/ui";
import { Wallet, Calendar, Handshake, AlertTriangle, RotateCcw, DollarSign } from "lucide-react";
import {
  usePayments, usePlans, useSettlements, useRefunds, useNSF,
  paymentsSummary, planComplianceSummary, settlementsSummary, refundsSummary, nsfSummary, agingBuckets,
} from "@/lib/payments-store";

export const Route = createFileRoute("/tenant/payments/")({
  head: () => ({ meta: [{ title: "Payments Overview · Tenant Admin" }] }),
  component: OverviewPage,
});

function OverviewPage() {
  // subscribe so the page re-renders on store mutations
  void usePayments(); void usePlans(); void useSettlements(); void useRefunds(); void useNSF();

  const ps = paymentsSummary();
  const pc = planComplianceSummary();
  const ss = settlementsSummary();
  const rs = refundsSummary();
  const ns = nsfSummary();
  const ag = agingBuckets();

  const totalAging = ag.current + ag.d30 + ag.d60 + ag.d90 + ag.d90plus;
  const pct = (n: number) => (totalAging === 0 ? 0 : Math.round((n / totalAging) * 100));

  return (
    <PaymentsShell active="overview">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile label="Cleared payments" value={`$${ps.totalCleared.toLocaleString()}`} icon={<Wallet className="h-4 w-4" />} tone="success" delta={`${ps.cleared} transactions`} />
        <StatTile label="Plan compliance" value={`${pc.onTimeRate}%`} icon={<Calendar className="h-4 w-4" />} tone="tenant" delta={`${pc.paid}/${pc.total} on-time`} />
        <StatTile label="Settlements" value={ss.total} icon={<Handshake className="h-4 w-4" />} delta={`Saved $${ss.saved.toLocaleString()} for debtors`} />
        <StatTile label="NSF events" value={ns.total} icon={<AlertTriangle className="h-4 w-4" />} tone={ns.total > 0 ? "danger" : "default"} delta={`$${ns.fees} in fees`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <PageCard>
          <CardHead title="Aging buckets" subtitle="Outstanding installment balance by age" />
          <div className="px-6 py-4 space-y-3 text-sm">
            {[
              { label: "Current", val: ag.current, tone: "success" as const },
              { label: "1 – 30 days", val: ag.d30, tone: "tenant" as const },
              { label: "31 – 60 days", val: ag.d60, tone: "warning" as const },
              { label: "61 – 90 days", val: ag.d90, tone: "warning" as const },
              { label: "90+ days", val: ag.d90plus, tone: "danger" as const },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{row.label}</span>
                  <span>${row.val.toLocaleString()} <span className="text-muted-foreground">({pct(row.val)}%)</span></span>
                </div>
                <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${row.tone === "danger" ? "bg-destructive" : row.tone === "warning" ? "bg-warning" : row.tone === "tenant" ? "bg-tenant" : "bg-success"}`} style={{ width: `${pct(row.val)}%` }} />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="font-semibold">Total outstanding</span>
              <span className="font-display text-xl font-bold">${totalAging.toLocaleString()}</span>
            </div>
          </div>
        </PageCard>

        <PageCard>
          <CardHead title="Cash flow snapshot" subtitle="Last 90 days" />
          <ul className="px-6 py-4 space-y-2 text-sm">
            <li className="flex items-center justify-between"><span>Payments cleared</span><span className="font-semibold text-success">+${ps.totalCleared.toLocaleString()}</span></li>
            <li className="flex items-center justify-between"><span>Reversed (NSF)</span><span className="font-semibold text-destructive">−${ps.totalReversed.toLocaleString()}</span></li>
            <li className="flex items-center justify-between"><span>Refunds pending</span><span className="font-semibold text-warning-foreground">−${rs.totalAmount.toLocaleString()}</span></li>
            <li className="flex items-center justify-between border-t border-border pt-2 mt-2 font-bold">
              <span>Net settled</span>
              <span>${(ps.totalCleared - ps.totalReversed - rs.totalAmount).toLocaleString()}</span>
            </li>
          </ul>
        </PageCard>

        <PageCard>
          <CardHead title="Plan health" />
          <ul className="px-6 py-4 space-y-2 text-sm">
            <li className="flex items-center justify-between"><span>Paid installments</span><Pill tone="success">{pc.paid}</Pill></li>
            <li className="flex items-center justify-between"><span>Partial</span><Pill tone="warning">{pc.partial}</Pill></li>
            <li className="flex items-center justify-between"><span>Missed / late</span><Pill tone="danger">{pc.missed}</Pill></li>
            <li className="flex items-center justify-between"><span>Upcoming</span><Pill tone="info">{pc.upcoming}</Pill></li>
          </ul>
        </PageCard>

        <PageCard>
          <CardHead title="Compliance reminders" />
          <ul className="px-6 py-4 space-y-3 text-sm">
            <li className="flex gap-2"><DollarSign className="h-4 w-4 text-success shrink-0 mt-0.5" /><span>Settlements legally bind both parties — record terms, deadline, and conditions in writing.</span></li>
            <li className="flex gap-2"><RotateCcw className="h-4 w-4 text-warning shrink-0 mt-0.5" /><span>NSF reversals automatically restore balance and flag the payment method for review.</span></li>
            <li className="flex gap-2"><AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" /><span>Refunds for overpayment are required by FDCPA — process within 30 days.</span></li>
          </ul>
        </PageCard>
      </div>
    </PaymentsShell>
  );
}
