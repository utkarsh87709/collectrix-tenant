import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import type { TrendPoint } from "@/lib/analytics-types";

const t = "hsl(var(--tenant))";
const a = "hsl(var(--accent))";
const mute = "hsl(var(--muted-foreground))";

export function ChartCard({ title, subtitle, children, height = 240 }: { title: string; subtitle?: string; children: React.ReactNode; height?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-elegant">
      <div className="mb-3">
        <h3 className="text-sm font-bold tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div style={{ width: "100%", height }}>{children}</div>
    </div>
  );
}

const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

export function TrendArea({ data, name = "Value" }: { data: TrendPoint[]; name?: string }) {
  return (
    <ResponsiveContainer>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t} stopOpacity={0.4} />
            <stop offset="100%" stopColor={t} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: mute }} stroke={mute} />
        <YAxis tick={{ fontSize: 11, fill: mute }} stroke={mute} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="value" name={name} stroke={t} strokeWidth={2} fill="url(#g1)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CompareLines({ data, currentName = "Current", prevName = "Previous" }: { data: TrendPoint[]; currentName?: string; prevName?: string }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: mute }} stroke={mute} />
        <YAxis tick={{ fontSize: 11, fill: mute }} stroke={mute} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="value" name={currentName} stroke={t} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="prev" name={prevName} stroke={a} strokeWidth={2} strokeDasharray="4 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CompareBars({ data, dataKey = "value", name = "Value" }: { data: Array<Record<string, number | string>>; dataKey?: string; name?: string }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: mute }} stroke={mute} />
        <YAxis tick={{ fontSize: 11, fill: mute }} stroke={mute} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey={dataKey} name={name} fill={t} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
