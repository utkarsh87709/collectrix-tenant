import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, StatTile, Pill } from "@/components/tenant/ui";
import { Mail, MessageSquare, Mailbox, ChevronRight } from "lucide-react";
import { channelKpis } from "@/lib/comms-mock";

export const Route = createFileRoute("/tenant/comms/")({
  head: () => ({ meta: [{ title: "Communications · Tenant Admin" }] }),
  component: CommsHub,
});

const tiles = [
  { to: "/tenant/comms/letters", label: "Physical Letters", icon: Mailbox, story: "US-050", desc: "Library, AI-assisted template builder, bulk generate, approvals", count: "312 in 30d" },
] as const;

function CommsHub() {
  return (
    <Shell>
      <Topbar
        title="Communications Engine"
        subtitle="Epic 5 · US-046 → US-058 · Multi-channel outreach with compliance & analytics"
      />
      <section className="px-6 lg:px-10 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Email · 30d" value={channelKpis.email.sends.toLocaleString()} delta={`${channelKpis.email.open}% open · ${channelKpis.email.click}% click`} icon={<Mail className="h-4 w-4" />} tone="tenant" />
        <StatTile label="SMS · 30d" value={channelKpis.sms.sends.toLocaleString()} delta={`${channelKpis.sms.replyRate}% reply · ${channelKpis.sms.cost}`} icon={<MessageSquare className="h-4 w-4" />} tone="tenant" />
        
        <StatTile label="Letters mailed" value={channelKpis.letter.sends} delta={`${channelKpis.letter.returned}% returned · ${channelKpis.letter.costPerPiece}`} icon={<Mailbox className="h-4 w-4" />} />
      </section>

      <section className="px-6 lg:px-10 pb-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="group">
            <PageCard className="h-full hover:shadow-tenant transition">
              <div className="p-5 flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-tenant-soft text-tenant flex items-center justify-center shrink-0">
                  <t.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-display font-bold truncate">{t.label}</div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-tenant transition shrink-0" />
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{t.story}</div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{t.desc}</p>
                  <div className="mt-3"><Pill tone="tenant">{t.count}</Pill></div>
                </div>
              </div>
            </PageCard>
          </Link>
        ))}
      </section>
    </Shell>
  );
}
