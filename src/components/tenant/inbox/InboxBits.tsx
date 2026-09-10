// Small presentational pieces shared by the inbox panes.
import { Pill } from "@/components/tenant/ui";
import { pillTextColor } from "@/lib/statuses-api";
import { avatarTone, initials } from "./inbox-utils";

export function Avatar({
  name,
  seed,
  size = "md",
  className = "",
}: {
  name: string;
  seed: string | number;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const box = {
    xs: "h-4 w-4 text-[8px] ring-0",
    sm: "h-8 w-8 text-[10px]",
    md: "h-10 w-10 text-xs",
    lg: "h-11 w-11 text-sm",
  }[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarTone(seed)} font-bold text-white shadow-sm ring-2 ring-card ${box} ${className}`}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* --------------------------------- Status --------------------------------- */

/** Compact status chip — coloured when the row carries the tenant's status
 *  colour, a neutral pill otherwise (getCustomerList rows have no colour). */
export function MiniStatus({
  code,
  name,
  color,
}: {
  code?: string | null;
  name?: string | null;
  color?: string | null;
}) {
  const label = code || name;
  if (!label) return null;
  if (color) {
    return (
      <span
        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
        style={{ backgroundColor: color, color: pillTextColor(color) }}
        title={name ?? undefined}
      >
        {label}
      </span>
    );
  }
  return <Pill tone="muted">{name || code}</Pill>;
}

export function TagChip({
  children,
  onRemove,
  removing,
}: {
  children: string;
  onRemove?: () => void;
  removing?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-1.5 py-0.5 text-[11px] font-semibold text-warning-foreground">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="ml-0.5 -mr-0.5 rounded p-0.5 hover:bg-warning/30 disabled:opacity-50"
          aria-label={`Remove tag ${children}`}
        >
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
            <path
              d="M3 3l6 6M9 3l-6 6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </span>
  );
}
