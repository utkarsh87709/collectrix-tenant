import { pillTextColor } from "@/lib/statuses-api";

/**
 * A colour-filled status pill — bold CODE + " · Name" on the status colour.
 * Text colour auto-adapts for contrast against the chosen background.
 */
export function StatusPill({
  code,
  name,
  color,
  className = "",
}: {
  code: string;
  name: string;
  color: string;
  className?: string;
}) {
  const fg = pillTextColor(color);
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${className}`}
      style={{ backgroundColor: color, color: fg }}
    >
      <span className="font-bold">{code || "—"}</span>
      {name && <span className="opacity-90">&nbsp;·&nbsp;{name}</span>}
    </span>
  );
}
