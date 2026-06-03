import { ArrowDownRight, ArrowUpRight, Minus, Info } from "lucide-react";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { delta } from "@/lib/analytics-mock";
import type { TrendPoint } from "@/lib/analytics-types";

export function KPICard({
  label, value, prev, suffix, tooltip, sparkline, target,
}: {
  label: string;
  value: number;
  prev?: number;
  suffix?: string;
  tooltip?: string;
  sparkline?: TrendPoint[];
  target?: number;
}) {
  const d = prev !== undefined ? delta(value, prev) : null;
  const fmt = (n: number) => suffix === "$"
    ? "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : n.toLocaleString(undefined, { maximumFractionDigits: 1 }) + (suffix ?? "");

  const trendColor = d?.dir === "up" ? "text-success" : d?.dir === "down" ? "text-destructive" : "text-muted-foreground";
  const TrendIcon = d?.dir === "up" ? ArrowUpRight : d?.dir === "down" ? ArrowDownRight : Minus;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-elegant flex flex-col gap-3 min-h-[140px]">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
          {label}
          {tooltip && (
            <span title={tooltip} className="cursor-help inline-flex">
              <Info className="h-3 w-3 text-muted-foreground/60" />
            </span>
          )}
        </div>
        {d && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />{Math.abs(d.pct)}%
          </span>
        )}
      </div>
      <div className="font-display text-2xl font-bold tracking-tight">{fmt(value)}</div>
      {sparkline && sparkline.length > 1 && (
        <div className="h-8 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkline}>
              <Line type="monotone" dataKey="value" stroke="hsl(var(--tenant))" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {target !== undefined && (
        <div className="text-[11px] text-muted-foreground">Target: {fmt(target)}</div>
      )}
    </div>
  );
}
