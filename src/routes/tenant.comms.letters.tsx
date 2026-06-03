import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { ArrowLeft, Library, Wrench, Layers, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/tenant/comms/letters")({
  head: () => ({ meta: [{ title: "Letters · Communications" }] }),
  component: LettersLayout,
});

const TABS: { to: string; label: string; icon: typeof Library; exact?: boolean }[] = [
  { to: "/tenant/comms/letters", label: "Library", icon: Library, exact: true },
  { to: "/tenant/comms/letters/builder", label: "Template Builder", icon: Wrench },
  { to: "/tenant/comms/letters/bulk", label: "Bulk Generate", icon: Layers },
  { to: "/tenant/comms/letters/approval", label: "Approval Queue", icon: ShieldCheck },
];

function LettersLayout() {
  const { pathname } = useLocation();
  return (
    <Shell>
      <Topbar
        title="Letter Template Engine"
        subtitle="Epic 8 · US-084 → US-090 · Library · builder · bulk · approval · mail house · compliance · analytics"
        action={
          <Link to="/tenant/comms" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />
      <div className="px-6 lg:px-10 pt-2 border-b border-border">
        <div className="flex items-center gap-1 overflow-x-auto -mb-px">
          {TABS.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                  active ? "border-tenant text-tenant" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
      <Outlet />
    </Shell>
  );
}
