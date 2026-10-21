import { NativeSelect } from "@/components/tenant/ui";
import { DURATION_UNIT_LABEL, type Duration, type DurationUnit } from "@/lib/status-automation-api";

/** Number + unit pair. Stored as minutes on the wire, edited in whatever unit
 *  suits — the backend takes 4320 where the user means "3 days". */
export function DurationField({
  label,
  value,
  onChange,
  ariaPrefix,
  className = "",
}: {
  label: string;
  value: Duration;
  onChange: (d: Duration) => void;
  ariaPrefix: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          value={value.value}
          onChange={(e) => onChange({ ...value, value: Math.max(0, Number(e.target.value) || 0) })}
          className="flex-1 min-w-16 h-9 px-2 text-sm rounded-lg border border-border bg-background"
          aria-label={`${ariaPrefix} amount`}
        />
        <NativeSelect
          size="sm"
          // The wrapper is a flex item: without a width its w-full select would
          // have nothing to measure against.
          className="w-28 shrink-0"
          value={value.unit}
          onChange={(e) => onChange({ ...value, unit: e.target.value as DurationUnit })}
          aria-label={`${ariaPrefix} unit`}
        >
          {(Object.keys(DURATION_UNIT_LABEL) as DurationUnit[]).map((u) => (
            <option key={u} value={u}>
              {DURATION_UNIT_LABEL[u]}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}

export function SectionLabel({
  children,
  className = "mb-3",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`text-[11px] uppercase tracking-wider text-muted-foreground font-semibold ${className}`}
    >
      {children}
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
      {children}
    </label>
  );
}
