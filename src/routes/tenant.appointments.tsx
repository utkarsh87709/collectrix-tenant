import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { CalendarPlus, Copy, Phone, Mail, Search, Filter, CalendarDays, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getCallbacks } from "@/lib/agent-availability-api";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/appointments")({
  head: () => ({ meta: [{ title: "Scheduled Appointments · Tenant" }] }),
  component: AppointmentsPage,
});

type Meeting = {
  id: string;
  debtor_name: string;
  debtor_phone: string | null;
  debtor_email: string | null;
  scheduled_at: string;
  duration_min: number;
  timezone: string;
  meeting_link: string;
  status: string;
  notes: string | null;
  source?: string | null;
};

type StatusFilter = "all" | "scheduled" | "completed" | "cancelled" | "no_show";
type RangeFilter = "all" | "today" | "week" | "upcoming" | "past";

const inputCls =
  "w-full rounded-lg border border-border bg-muted/30 pl-9 pr-3 py-2 text-sm outline-none focus:border-tenant focus:bg-background";

function statusTone(s: string) {
  if (s === "completed") return "success" as const;
  if (s === "cancelled" || s === "no_show") return "danger" as const;
  return "tenant" as const;
}

function withinRange(iso: string, range: RangeFilter) {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (range === "all") return true;
  if (range === "today") {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return d >= start.getTime() && d <= end.getTime();
  }
  if (range === "week") return d >= now && d <= now + 7 * day;
  if (range === "upcoming") return d >= now;
  if (range === "past") return d < now;
  return true;
}

function AppointmentsPage() {
  const [items, setItems] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [range, setRange] = useState<RangeFilter>("upcoming");

  useEffect(() => {
    getCallbacks()
      .then((r) => { if (r.ok) setItems(r.items as Meeting[]); })
      .catch(() => toast.error("Failed to load appointments"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return items
      .filter((m) => (status === "all" ? true : m.status === status))
      .filter((m) => withinRange(m.scheduled_at, range))
      .filter((m) =>
        !ql ||
        m.debtor_name.toLowerCase().includes(ql) ||
        (m.debtor_email ?? "").toLowerCase().includes(ql) ||
        (m.debtor_phone ?? "").toLowerCase().includes(ql),
      )
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [items, q, status, range]);

  const stats = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    return {
      total: items.length,
      upcoming: items.filter((m) => m.status === "scheduled" && new Date(m.scheduled_at).getTime() >= now).length,
      today: items.filter((m) => {
        const t = new Date(m.scheduled_at).getTime();
        const s = new Date(); s.setHours(0, 0, 0, 0);
        const e = new Date(); e.setHours(23, 59, 59, 999);
        return t >= s.getTime() && t <= e.getTime();
      }).length,
      week: items.filter((m) => {
        const t = new Date(m.scheduled_at).getTime();
        return t >= now && t <= now + 7 * day;
      }).length,
    };
  }, [items]);

  const copy = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Meeting link copied");
  };

  return (
    <Shell>
      <Topbar
        title="Scheduled Appointments"
        subtitle="All upcoming and past callback meetings across your team"
        action={null}
      />

      <section className="px-6 lg:px-10 pt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard label="Upcoming" value={stats.upcoming} icon={<Clock3 className="h-4 w-4" />} tone="tenant" />
        <StatCard label="Today" value={stats.today} icon={<CalendarDays className="h-4 w-4" />} tone="success" />
        <StatCard label="Next 7 days" value={stats.week} icon={<CalendarDays className="h-4 w-4" />} />
      </section>

      <section className="px-6 lg:px-10 py-6">
        <PageCard>
          <CardHead
            title="Appointments"
            subtitle="Filter by status, time range, or search by debtor"
          />
          <div className="px-6 pb-4 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search by name, email, or phone…"
                className={inputCls}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <SelectChip
              icon={<Filter className="h-3.5 w-3.5" />}
              value={status}
              onChange={(v) => setStatus(v as StatusFilter)}
              options={[
                { v: "all", l: "All statuses" },
                { v: "scheduled", l: "Scheduled" },
                { v: "completed", l: "Completed" },
                { v: "cancelled", l: "Cancelled" },
                { v: "no_show", l: "No-show" },
              ]}
            />
            <SelectChip
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              value={range}
              onChange={(v) => setRange(v as RangeFilter)}
              options={[
                { v: "upcoming", l: "Upcoming" },
                { v: "today", l: "Today" },
                { v: "week", l: "Next 7 days" },
                { v: "past", l: "Past" },
                { v: "all", l: "All time" },
              ]}
            />
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading appointments…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No appointments match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">When</th>
                    <th className="text-left px-4 py-3">Debtor</th>
                    <th className="text-left px-4 py-3">Contact</th>
                    <th className="text-left px-4 py-3">Duration</th>
                    <th className="text-left px-4 py-3">Source</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Meeting link</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const dt = new Date(m.scheduled_at);
                    return (
                      <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium">{dt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                          <div className="text-xs text-muted-foreground">{dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · {m.timezone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{m.debtor_name}</div>
                          {m.notes && <div className="text-xs text-muted-foreground line-clamp-1 max-w-[260px]">{m.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {m.debtor_phone && <div className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{m.debtor_phone}</div>}
                          {m.debtor_email && <div className="inline-flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3" />{m.debtor_email}</div>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.duration_min}m</td>
                        <td className="px-4 py-3"><Pill tone="muted">{(m.source ?? "manual").replace(/_/g, " ")}</Pill></td>
                        <td className="px-4 py-3"><Pill tone={statusTone(m.status)}>{m.status.replace("_", " ")}</Pill></td>
                        <td className="px-4 py-3">
                          <button onClick={() => copy(m.meeting_link)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-border hover:bg-muted">
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PageCard>
      </section>
    </Shell>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone?: "tenant" | "success" }) {
  const accent = tone === "tenant" ? "text-tenant" : tone === "success" ? "text-success-foreground" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={accent}>{icon}</span>
      </div>
      <div className={`mt-2 text-2xl font-display font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function SelectChip({
  value, onChange, options, icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
  icon?: React.ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs font-semibold">
      {icon}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none"
      >
        {options.map((o) => (<option key={o.v} value={o.v}>{o.l}</option>))}
      </select>
    </label>
  );
}
