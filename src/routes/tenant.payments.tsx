import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/tenant/payments")({
  head: () => ({ meta: [{ title: "Payment Status Management · Tenant Admin" }] }),
  component: PaymentsLayout,
});

function PaymentsLayout() {
  return <Outlet />;
}

export function PaymentsShell({ active, children }: { active: string; children: React.ReactNode }) {
  const tabs: { key: string; to: string; label: string }[] = [
    { key: "overview",       to: "/tenant/payments",                label: "Overview" },
    { key: "plans",          to: "/tenant/payments/plans",          label: "Payment Plans" },
    { key: "settlements",    to: "/tenant/payments/settlements",    label: "Settlements" },
  ];
  return (
    <Shell>
      <Topbar
        title="Payment Status Management"
        subtitle="Manually track customer payment status — agents reconcile externally and update here"
        action={<span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-tenant/15 text-tenant text-xs font-semibold"><Wallet className="h-3.5 w-3.5" /> Status tracker</span>}
      />
      <div className="px-6 lg:px-10 pt-4">
        <div className="flex flex-wrap gap-1 border-b border-border">
          {tabs.map((t) => (
            <Link key={t.key} to={t.to as never}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition ${
                active === t.key
                  ? "border-tenant text-tenant bg-tenant/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}>{t.label}</Link>
          ))}
        </div>
      </div>
      <div className="px-6 lg:px-10 py-6">{children}</div>
    </Shell>
  );
}
