import type { ReactNode } from "react";

export function PageCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card shadow-elegant ${className}`}>{children}</div>
  );
}

export function CardHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
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
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-elegant">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        {icon && <div className={`${toneCls[tone]}`}>{icon}</div>}
      </div>
      <div className={`mt-3 font-display text-3xl font-bold ${toneCls[tone]}`}>{value}</div>
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
    legal: "bg-destructive/10 text-destructive border border-destructive/30 uppercase tracking-wide",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${m[tone]}`}>
      {children}
    </span>
  );

}
