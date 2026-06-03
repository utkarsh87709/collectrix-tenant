// Unified debtor audit timeline view.
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { useDebtorAuditTimeline, CATEGORY_LABEL, type AuditCategory, type AuditEvent } from "@/lib/audit-timeline-store";
import { Bot, User, Cog, Filter } from "lucide-react";
import { useMemo, useState } from "react";

const TONE_BY_CATEGORY: Record<AuditCategory, "tenant" | "success" | "warning" | "danger" | "info" | "muted"> = {
  debtor_created: "info", csv_imported: "info", validation: "warning",
  field_edit: "tenant", status_changed: "tenant", owner_changed: "tenant", team_changed: "tenant",
  flag: "warning", rpv: "info", call: "info", comms: "info", note: "muted",
  payment_reported: "warning", payment_posted: "success", balance_updated: "success",
  engagement: "warning", archive: "warning", delete: "danger",
};

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

function ActorIcon({ kind }: { kind: AuditEvent["actorKind"] }) {
  if (kind === "ai") return <Bot className="h-3.5 w-3.5 text-info" />;
  if (kind === "system") return <Cog className="h-3.5 w-3.5 text-muted-foreground" />;
  return <User className="h-3.5 w-3.5 text-tenant" />;
}

export function AuditTimeline({ debtorId }: { debtorId: string }) {
  const all = useDebtorAuditTimeline(debtorId);
  const [activeCats, setActiveCats] = useState<Set<AuditCategory>>(new Set());

  const categories = useMemo(() => {
    const set = new Set<AuditCategory>();
    all.forEach((e) => set.add(e.category));
    return Array.from(set);
  }, [all]);

  const filtered = activeCats.size === 0 ? all : all.filter((e) => activeCats.has(e.category));

  // Group by day
  const groups = useMemo(() => {
    const m = new Map<string, AuditEvent[]>();
    filtered.forEach((e) => {
      const key = new Date(e.at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    });
    return Array.from(m.entries());
  }, [filtered]);

  return (
    <PageCard>
      <CardHead title="Audit timeline" subtitle={`${all.length} events · full accountability trail`} />
      <div className="px-6 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <button onClick={() => setActiveCats(new Set())}
          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${activeCats.size === 0 ? "bg-tenant text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          All
        </button>
        {categories.map((c) => (
          <button key={c}
            onClick={() => {
              setActiveCats((prev) => {
                const next = new Set(prev);
                if (next.has(c)) next.delete(c); else next.add(c);
                return next;
              });
            }}
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${activeCats.has(c) ? "bg-tenant text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <div className="divide-y divide-border">
        {groups.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">No events match this filter.</div>
        )}
        {groups.map(([day, items]) => (
          <div key={day} className="py-2">
            <div className="px-6 pt-2 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{day}</div>
            <ul>
              {items.map((e) => (
                <li key={e.id} className="px-6 py-2 flex items-start gap-2 text-xs hover:bg-muted/30">
                  <div className="mt-0.5"><ActorIcon kind={e.actorKind} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Pill tone={TONE_BY_CATEGORY[e.category]}>{CATEGORY_LABEL[e.category]}</Pill>
                      <span className="font-semibold">{e.action}</span>
                      <span className="text-muted-foreground ml-auto">{fmt(e.at)}</span>
                    </div>
                    {e.summary && <div className="text-muted-foreground mt-0.5">{e.summary}</div>}
                    {(e.before || e.after) && (
                      <div className="font-mono text-[11px] mt-0.5">
                        {e.before && <span className="text-destructive">{e.before}</span>}
                        {e.before && e.after && <span className="mx-1.5 text-muted-foreground">→</span>}
                        {e.after && <span className="text-success">{e.after}</span>}
                      </div>
                    )}
                    {e.reason && <div className="text-[11px] text-muted-foreground italic mt-0.5">Reason: {e.reason}</div>}
                    <div className="text-[11px] text-muted-foreground mt-0.5">{e.actor}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PageCard>
  );
}
