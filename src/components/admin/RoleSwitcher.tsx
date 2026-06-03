import { useDemoRole, setDemoRole, type DemoRole } from "@/lib/demo-role";

const ROLE_OPTIONS: { value: DemoRole; label: string; hint: string }[] = [
  { value: "agent",   label: "Agent",   hint: "Front-line collector — limited edit & no delete." },
  { value: "manager", label: "Manager", hint: "Can edit sensitive fields & archive." },
  { value: "admin",   label: "Admin",   hint: "Full access — delete, override, audit." },
  { value: "finance", label: "Finance", hint: "Payments & balance focus." },
];

export function RoleSwitcher({ compact = false }: { compact?: boolean }) {
  const role = useDemoRole();
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
      title="Demo: switch role to preview permissions"
    >
      {!compact && (
        <span className="hidden lg:inline px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          View as
        </span>
      )}
      {ROLE_OPTIONS.map((r) => {
        const active = r.value === role;
        return (
          <button
            key={r.value}
            type="button"
            onClick={() => setDemoRole(r.value)}
            title={r.hint}
            className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition ${
              active
                ? "bg-gradient-tenant text-white shadow-tenant"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
