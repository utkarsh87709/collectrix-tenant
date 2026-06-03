import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { sessions } from "@/lib/tenant-mock";
import { useState } from "react";
import { Power, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/security")({
  head: () => ({ meta: [{ title: "Security & Sessions · Tenant Admin" }] }),
  component: SecurityPage,
});

function SecurityPage() {
  const [timeout_, setTimeout_] = useState(60);
  const [inactivity, setInactivity] = useState(30);
  const [concurrent, setConcurrent] = useState<"unlimited" | "single" | "limited">("limited");
  const [limitN, setLimitN] = useState(2);

  return (
    <Shell>
      <Topbar
        title="Security & Sessions"
        subtitle="Session policy, concurrent logins, and active device control"
      />

      <section className="px-6 lg:px-10 py-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <PageCard>
          <CardHead title="Session timeout" subtitle="Inactivity logs user out automatically" />
          <div className="px-6 py-5 space-y-5 text-sm">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Hard timeout</label>
              <select value={timeout_} onChange={(e) => setTimeout_(Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg bg-muted border border-border">
                {[15, 30, 60, 120, 240, 480].map((v) => <option key={v} value={v}>{v} minutes</option>)}
                <option value={0}>Never expire</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Inactivity timeout</label>
              <input type="number" value={inactivity} onChange={(e) => setInactivity(Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg bg-muted border border-border" />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="accent-tenant" />
              Re-authenticate for sensitive actions (legal, exports, password)
            </label>
          </div>
        </PageCard>

        <PageCard>
          <CardHead title="Concurrent logins" />
          <div className="px-6 py-5 space-y-3 text-sm">
            {[
              { v: "unlimited", l: "Unlimited devices" },
              { v: "limited", l: `Limit to ${limitN} devices` },
              { v: "single", l: "Single session only — newest wins" },
            ].map((opt) => (
              <label key={opt.v} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${concurrent === opt.v ? "border-tenant bg-tenant-soft" : "border-border hover:bg-muted"}`}>
                <input type="radio" checked={concurrent === opt.v} onChange={() => setConcurrent(opt.v as typeof concurrent)} className="accent-tenant" />
                <span className="flex-1">{opt.l}</span>
                {opt.v === "limited" && (
                  <input type="number" value={limitN} onChange={(e) => setLimitN(Number(e.target.value))} className="w-16 px-2 py-1 rounded bg-card border border-border text-sm" />
                )}
              </label>
            ))}
          </div>
        </PageCard>

        <PageCard>
          <CardHead title="Force re-login" subtitle="Invalidate all sessions across the tenant" />
          <div className="px-6 py-5 text-sm space-y-3">
            <p className="text-muted-foreground">Use during a security incident. All users will be returned to the login screen on their next request.</p>
            <button
              onClick={() => toast.success("All tenant sessions invalidated", { description: "Users must re-authenticate. Action audited." })}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 text-sm font-semibold hover:bg-destructive/20"
            >
              <Power className="h-4 w-4" /> Force log out everyone
            </button>
          </div>
        </PageCard>
      </section>

      <section className="px-6 lg:px-10 pb-6">
        <PageCard>
          <CardHead title="Active sessions" subtitle={`${sessions.length} live · per-device control`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Device</th>
                  <th className="px-4 py-3 font-semibold">IP / Location</th>
                  <th className="px-4 py-3 font-semibold">Login</th>
                  <th className="px-4 py-3 font-semibold">Last activity</th>
                  <th className="px-4 py-3 font-semibold w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-6 py-3 font-semibold">{s.user}</td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2">
                        <MonitorSmartphone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{s.device}</span>
                        <Pill tone="muted">{s.browser}</Pill>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      <div className="font-mono">{s.ip}</div>
                      <div>{s.location}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{s.loginAt}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{s.lastActive}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toast.success(`Session for ${s.user} terminated`)} className="px-2.5 py-1 rounded-md text-xs font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20">
                        Terminate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageCard>
      </section>
    </Shell>
  );
}
