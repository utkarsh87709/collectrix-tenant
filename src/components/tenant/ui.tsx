import type { ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Native <select> with a predictable box.
 *
 * Left to the UA, a select is sized by its own font metrics — Safari and iOS in
 * particular ignore most of the padding and render a cramped control that
 * doesn't match the inputs next to it. `appearance-none` plus an explicit height
 * takes that back, so the chevron has to be drawn by hand.
 *
 * "md" matches a standard form input; "sm" is for the dense grids inside cards.
 */
export function NativeSelect({
  size = "md",
  className = "",
  ...props
  // `size` on a native select is a row count; this one is a style token, so the
  // DOM attribute is deliberately shadowed rather than forwarded.
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: "sm" | "md" }) {
  const box = size === "md" ? "h-11 pl-3 pr-9 text-sm" : "h-9 pl-2.5 pr-8 text-sm";
  return (
    <div className={`relative ${className}`}>
      <select
        {...props}
        className={`w-full ${box} rounded-lg border border-border bg-background cursor-pointer appearance-none truncate focus:outline-none focus:ring-2 focus:ring-tenant/40 disabled:cursor-default disabled:opacity-60`}
      >
        {props.children}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground ${
          size === "md" ? "right-3 h-4 w-4" : "right-2.5 h-3.5 w-3.5"
        }`}
      />
    </div>
  );
}

export function PageCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border/70 bg-card shadow-elegant overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHead({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="relative flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
      {/* Brand accent — a navy→cyan bar on the card's left edge marks every
          section header without shifting the title off the content grid. */}
      <span
        className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full bg-gradient-tenant"
        aria-hidden
      />
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-tenant/10 text-tenant shrink-0">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  delta,
  icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon?: ReactNode;
  tone?: "default" | "tenant" | "warning" | "danger" | "success";
}) {
  const toneCls: Record<string, string> = {
    default: "text-foreground",
    tenant: "text-tenant",
    warning: "text-warning",
    danger: "text-destructive",
    success: "text-success",
  };
  // Tinted icon chip + top accent line, colored per tone — gives the metric a
  // branded, deliberate feel instead of a bare number on a card.
  const chipCls: Record<string, string> = {
    default: "bg-tenant/10 text-tenant",
    tenant: "bg-tenant/10 text-tenant",
    warning: "bg-warning/15 text-warning",
    danger: "bg-destructive/15 text-destructive",
    success: "bg-success/15 text-success",
  };
  const accentCls: Record<string, string> = {
    default: "bg-gradient-tenant",
    tenant: "bg-gradient-tenant",
    warning: "bg-warning",
    danger: "bg-destructive",
    success: "bg-success",
  };
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-elegant transition-shadow hover:shadow-glow">
      <span
        className={`absolute inset-x-0 top-0 h-0.5 ${accentCls[tone]} opacity-80`}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </span>
        {icon && (
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${chipCls[tone]} shrink-0`}
          >
            {icon}
          </span>
        )}
      </div>
      <div className={`mt-3 font-display text-3xl font-bold tracking-tight ${toneCls[tone]}`}>
        {value}
      </div>
      {delta && <div className="mt-1 text-xs text-muted-foreground">{delta}</div>}
    </div>
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "tenant" | "success" | "warning" | "danger" | "info" | "legal";
}) {
  const m: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    tenant: "bg-tenant-soft text-tenant border border-[color:var(--tenant)]/20",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    danger: "bg-destructive/15 text-destructive",
    info: "bg-info/15 text-info-foreground",
    legal:
      "bg-destructive/10 text-destructive border border-destructive/30 uppercase tracking-wide",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${m[tone]}`}
    >
      {children}
    </span>
  );
}
