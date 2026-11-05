import { Link } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { NativeSelect } from "@/components/tenant/ui";
import { FieldLabel } from "@/components/tenant/statuses/automation-fields";
import { HOURS_LABEL, HOURS_WINDOWS, type AgentGroup } from "@/lib/call-configuration-api";
import type { HoursWindow } from "@/lib/status-automation-api";

// Fields shared by the matched and unmatched halves of Call Configuration.

export function UnsavedDot() {
  return (
    <span className="h-1.5 w-1.5 rounded-full bg-warning" title="Unsaved changes" aria-hidden />
  );
}

/** Which of the two business-hours setups is on screen. */
export function HoursWindowTabs({
  value,
  onChange,
  isDirty,
}: {
  value: HoursWindow;
  onChange: (window: HoursWindow) => void;
  isDirty: (window: HoursWindow) => boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">
      {HOURS_WINDOWS.map((w) => {
        const on = w === value;
        const inside = w === "during";
        const Icon = inside ? Sun : Moon;
        return (
          <button
            key={w}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(w)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm ${
              on
                ? `${inside ? "bg-gradient-tenant" : "bg-indigo-600"} text-white font-semibold shadow-sm`
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" /> {HOURS_LABEL[w]}
            {isDirty(w) && <UnsavedDot />}
          </button>
        );
      })}
    </div>
  );
}

/** An AI voice agent, grouped by client: these settings aren't tied to a client. */
export function AgentSelect({
  label,
  hint,
  value,
  onChange,
  groups,
}: {
  label: string;
  hint: string;
  value: number | null;
  onChange: (id: number | null) => void;
  groups: AgentGroup[];
}) {
  const known = value == null || groups.some((g) => g.agents.some((a) => a.id === value));
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <NativeSelect
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        aria-label={label}
      >
        <option value="">
          {groups.length === 0 ? "No AI voice agents yet" : "Select an agent…"}
        </option>
        {/* Keep a saved id visible even if it has left the library. */}
        {!known && <option value={value ?? ""}>#{value} (not in the Template Library)</option>}
        {groups.map((g) => (
          <optgroup key={g.clientId} label={g.clientName}>
            {g.agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </optgroup>
        ))}
      </NativeSelect>
      <p className="mt-1 text-[11px] text-muted-foreground">
        <Link to="/tenant/engagement/template-library" className="text-tenant underline">
          Create an agent
        </Link>{" "}
        · {hint}
      </p>
    </div>
  );
}
