import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { teams as initialTeams, tenantUsers, type Team } from "@/lib/tenant-mock";
import { Plus, UsersRound, Crown, X, LayoutGrid, Network } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/teams")({
  head: () => ({ meta: [{ title: "Teams · Tenant Admin" }] }),
  component: TeamsPage,
});

type ViewMode = "cards" | "org";

function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [showNew, setShowNew] = useState(false);
  const [view, setView] = useState<ViewMode>("cards");

  // Group teams by leader → enables "user leads multiple teams" visualization
  const teamsByLeader = useMemo(() => {
    const map = new Map<string, Team[]>();
    for (const t of teams) {
      const list = map.get(t.leader) ?? [];
      list.push(t);
      map.set(t.leader, list);
    }
    return map;
  }, [teams]);

  return (
    <Shell>
      <Topbar
        title="Teams"
        subtitle="Hierarchical organization with team-scoped permissions on top of roles"
        action={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
              <button
                onClick={() => setView("cards")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  view === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Cards
              </button>
              <button
                onClick={() => setView("org")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  view === "org" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Network className="h-3.5 w-3.5" /> Org chart
              </button>
            </div>
            <button onClick={() => setShowNew(true)} className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
              <Plus className="h-4 w-4" /> New team
            </button>
          </div>
        }
      />

      {view === "cards" ? (
        <section className="px-6 lg:px-10 py-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {teams.map((t) => {
            const utilization = (t.active / t.capacity) * 100;
            const leadsCount = teamsByLeader.get(t.leader)?.length ?? 1;
            return (
              <PageCard key={t.id}>
                <CardHead
                  title={t.name}
                  subtitle={t.description}
                  action={<Pill tone="tenant"><UsersRound className="h-3 w-3" /> {t.memberCount} members</Pill>}
                />
                <div className="px-6 py-5 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Leader</div>
                    <div className="mt-1 font-semibold inline-flex items-center gap-1.5">
                      <Crown className="h-3.5 w-3.5 text-warning" /> {t.leader}
                    </div>
                    {leadsCount > 1 && (
                      <div className="mt-1">
                        <Pill tone="info">Leads {leadsCount} teams</Pill>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Capacity</div>
                    <div className="mt-1 font-semibold">{t.active} / {t.capacity}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Utilization</div>
                    <div className="mt-1 font-semibold">{utilization.toFixed(0)}%</div>
                  </div>
                </div>
                <div className="px-6 pb-5">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full ${utilization > 90 ? "bg-destructive" : utilization > 75 ? "bg-warning" : "bg-gradient-tenant"}`}
                      style={{ width: `${Math.min(utilization, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="px-6 pb-5 flex flex-wrap gap-1.5">
                  {tenantUsers.slice(0, t.memberCount).map((u) => (
                    <span key={u.id} className="px-2 py-0.5 rounded-md bg-muted text-xs">{u.fullName}</span>
                  ))}
                </div>
              </PageCard>
            );
          })}
        </section>
      ) : (
        <OrgChartView teamsByLeader={teamsByLeader} />
      )}

      {showNew && (
        <NewTeamModal
          onClose={() => setShowNew(false)}
          onCreate={(team) => {
            setTeams((prev) => [team, ...prev]);
            setShowNew(false);
            toast.success(`Team "${team.name}" created`, { description: `Led by ${team.leader}` });
          }}
        />
      )}
    </Shell>
  );
}

function OrgChartView({ teamsByLeader }: { teamsByLeader: Map<string, Team[]> }) {
  const leaders = Array.from(teamsByLeader.entries()).sort((a, b) => b[1].length - a[1].length);

  return (
    <section className="px-6 lg:px-10 py-6">
      <div className="rounded-2xl border border-border bg-card shadow-elegant p-6 overflow-x-auto">
        <div className="flex flex-col items-center gap-8 min-w-max">
          {/* Org root */}
          <div className="px-5 py-3 rounded-xl bg-gradient-tenant text-white shadow-tenant font-display font-bold">
            Organization
          </div>
          <div className="w-px h-6 bg-border" />

          {/* Leaders row */}
          <div className="flex items-start gap-10">
            {leaders.map(([leader, ts]) => (
              <div key={leader} className="flex flex-col items-center gap-4">
                {/* Leader node */}
                <div className="px-4 py-3 rounded-xl border-2 border-tenant bg-tenant-soft text-center min-w-[180px]">
                  <div className="inline-flex items-center gap-1.5 text-sm font-bold">
                    <Crown className="h-3.5 w-3.5 text-warning" /> {leader}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                    {ts.length > 1 ? `Leads ${ts.length} teams` : "Team leader"}
                  </div>
                </div>

                {ts.length > 0 && <div className="w-px h-5 bg-border" />}

                {/* Teams under this leader */}
                <div className="flex items-start gap-4">
                  {ts.map((t) => (
                    <div key={t.id} className="flex flex-col items-center gap-3">
                      <div className="px-3 py-2.5 rounded-lg border border-border bg-card text-center min-w-[160px] shadow-sm">
                        <div className="text-sm font-semibold">{t.name}</div>
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <UsersRound className="h-3 w-3" /> {t.memberCount} members
                        </div>
                      </div>
                      {t.memberCount > 0 && <div className="w-px h-4 bg-border" />}
                      <div className="flex flex-col gap-1 items-center">
                        {tenantUsers.slice(0, Math.min(t.memberCount, 4)).map((u) => (
                          <div key={u.id} className="px-2.5 py-1 rounded-md bg-muted text-[11px] font-medium">
                            {u.fullName}
                          </div>
                        ))}
                        {t.memberCount > 4 && (
                          <div className="text-[10px] text-muted-foreground">+{t.memberCount - 4} more</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        A user can lead multiple teams — they appear once as a leader node with all their teams branching beneath. Members can also belong to more than one team.
      </p>
    </section>
  );
}

function NewTeamModal({ onClose, onCreate }: { onClose: () => void; onCreate: (t: Team) => void }) {
  const [name, setName] = useState("");
  const [leader, setLeader] = useState(tenantUsers[0].fullName);
  const [capacity, setCapacity] = useState<number | "">("");
  const [members, setMembers] = useState<string[]>([]);

  const toggle = (id: string) => setMembers((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-card border border-border shadow-tenant overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-display font-bold text-lg">New team</h3>
            <p className="text-xs text-muted-foreground mt-0.5">A user can lead or belong to more than one team.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-sm">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Team name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="BMO Recovery Team" className="mt-1 w-full px-3 py-2 rounded-lg bg-muted border border-border outline-none focus:ring-2 ring-tenant" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Leader</label>
              <select value={leader} onChange={(e) => setLeader(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-muted border border-border outline-none">
                {tenantUsers.map((u) => <option key={u.id} value={u.fullName}>{u.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Capacity <span className="normal-case text-muted-foreground/60 font-normal">(optional)</span></label>
              <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 50" className="mt-1 w-full px-3 py-2 rounded-lg bg-muted border border-border outline-none focus:ring-2 ring-tenant" />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Initial members <span className="normal-case text-muted-foreground/60 font-normal">(optional)</span> {members.length > 0 && `(${members.length})`}</label>
            <div className="grid sm:grid-cols-2 gap-1 max-h-56 overflow-y-auto rounded-lg border border-border p-2">
              {tenantUsers.map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                  <input type="checkbox" className="accent-tenant" checked={members.includes(u.id)} onChange={() => toggle(u.id)} />
                  <span className="text-sm flex-1 truncate">{u.fullName}</span>
                  <span className="text-xs text-muted-foreground">{u.roles[0]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-muted">Cancel</button>
          <button
            disabled={!name}
            onClick={() => onCreate({
              id: `tm_${Math.random().toString(36).slice(2, 7)}`,
              name,
              leader,
              capacity: capacity === "" ? 0 : Number(capacity),
              memberCount: members.length,
              active: 0,
              type: "production",
              productionCategory: "collection",
              status: "active",
              analyticsEnabled: true,
            })}
            className="px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
          >
            Create team
          </button>
        </div>
      </div>
    </div>
  );
}
