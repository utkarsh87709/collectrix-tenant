import { createFileRoute } from "@tanstack/react-router";
import { PaymentsShell } from "./tenant.payments";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { useSettlements, updateSettlement, settlementsSummary } from "@/lib/payments-store";
import { Handshake, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/payments/settlements")({
  head: () => ({ meta: [{ title: "Settlements · Payments" }] }),
  component: SettlementsPage,
});

function SettlementsPage() {
  const list = useSettlements();
  const sum = settlementsSummary();

  return (
    <PaymentsShell active="settlements">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 text-sm">
        <Stat label="Offered / Accepted" value={`${sum.accepted}/${sum.total}`} icon={<Handshake className="h-4 w-4" />} />
        <Stat label="Paid in full" value={sum.paid} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <Stat label="Expired" value={sum.expired} tone="danger" icon={<XCircle className="h-4 w-4" />} />
        <Stat label="Total saved" value={`$${sum.saved.toLocaleString()}`} tone="tenant" icon={<Handshake className="h-4 w-4" />} />
      </div>
      <PageCard>
        <CardHead title="Settlement agreements" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
              <tr>
                <th className="px-6 py-3 text-left">ID</th>
                <th className="px-6 py-3 text-left">Customer</th>
                <th className="px-6 py-3 text-right">Original</th>
                <th className="px-6 py-3 text-right">Settlement</th>
                <th className="px-6 py-3 text-right">Discount</th>
                <th className="px-6 py-3 text-left">Deadline</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((s) => {
                const discount = Math.round(((s.originalBalance - s.settlementAmount) / s.originalBalance) * 100);
                const overdue = new Date(s.deadline).getTime() < Date.now() && s.status !== "paid";
                return (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="px-6 py-3 font-mono text-xs">{s.id}</td>
                    <td className="px-6 py-3">#{s.debtorId}</td>
                    <td className="px-6 py-3 text-right">${s.originalBalance.toLocaleString()}</td>
                    <td className="px-6 py-3 text-right font-semibold">${s.settlementAmount.toLocaleString()}</td>
                    <td className="px-6 py-3 text-right"><Pill tone="tenant">{discount}% off</Pill></td>
                    <td className="px-6 py-3 text-xs"><Clock className="inline h-3 w-3 mr-1" />{new Date(s.deadline).toLocaleDateString()}{overdue && <span className="text-destructive ml-1">overdue</span>}</td>
                    <td className="px-6 py-3"><Pill tone={s.status === "paid" ? "success" : s.status === "accepted" ? "tenant" : s.status === "expired" || s.status === "failed" ? "danger" : "muted"}>{s.status}</Pill></td>
                    <td className="px-6 py-3 text-xs">
                      {s.status === "accepted" && (
                        <button onClick={() => { updateSettlement(s.id, { status: "paid", paidAt: new Date().toISOString() }); toast.success("Settlement marked paid in full"); }}
                          className="px-2 py-1 rounded-md bg-success/15 text-success font-semibold">Mark paid</button>
                      )}
                      {s.status === "offered" && (
                        <button onClick={() => { updateSettlement(s.id, { status: "accepted", acceptedAt: new Date().toISOString() }); toast.success("Settlement accepted"); }}
                          className="px-2 py-1 rounded-md bg-tenant/15 text-tenant font-semibold">Accept</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageCard>
    </PaymentsShell>
  );
}

function Stat({ label, value, tone, icon }: { label: string; value: string | number; tone?: "success" | "danger" | "tenant"; icon: React.ReactNode }) {
  const t = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : tone === "tenant" ? "text-tenant" : "";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs uppercase text-muted-foreground font-semibold">{label}<span className={t}>{icon}</span></div>
      <div className={`mt-2 font-display text-2xl font-bold ${t}`}>{value}</div>
    </div>
  );
}
