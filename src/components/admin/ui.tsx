import { ArrowUpRight, type LucideIcon } from "lucide-react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-xl shadow-elegant ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "default",
}: {
  label: React.ReactNode;
  value: string | number;
  delta?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
}) {
  const toneMap = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
    info: "bg-info/15 text-info-foreground",
  } as const;
  return (
    <Card className="p-5 hover:shadow-glow transition-shadow cursor-pointer group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="font-display text-3xl font-bold mt-2 tracking-tight">{value}</p>
          {delta && <p className="text-xs text-muted-foreground mt-1">{delta}</p>}
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3 flex items-center text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        View details <ArrowUpRight className="h-3 w-3 ml-1" />
      </div>
    </Card>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "destructive" | "info" | "outline";
}) {
  const map = {
    default: "bg-secondary text-secondary-foreground",
    success: "bg-success/15 text-success border border-success/30",
    warning: "bg-warning/20 text-warning-foreground border border-warning/40",
    destructive: "bg-destructive/15 text-destructive border border-destructive/30",
    info: "bg-info/15 text-info-foreground border border-info/30",
    outline: "border border-border text-muted-foreground",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${map[tone]}`}>
      {children}
    </span>
  );
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}
