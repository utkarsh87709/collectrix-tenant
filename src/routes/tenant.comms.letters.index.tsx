import { createFileRoute, Link } from "@tanstack/react-router";
import { PageCard, CardHead, StatTile, Pill } from "@/components/tenant/ui";
import { LETTER_TEMPLATES, type LetterCategory, type LetterStatus } from "@/lib/letters-mock";
import { FileText, Search, Plus, Copy, Languages, ShieldCheck, Archive } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/comms/letters/")({
  head: () => ({ meta: [{ title: "Library · Letters" }] }),
  component: LibraryPage,
});

const CAT_LABEL: Record<LetterCategory, string> = { legal: "Legal Notices", settlement: "Settlement Offers", payment: "Payment Arrangements", compliance: "Compliance" };

function LibraryPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<LetterCategory | "all">("all");
  const [status, setStatus] = useState<LetterStatus | "all">("all");

  const list = LETTER_TEMPLATES.filter((t) =>
    (cat === "all" || t.category === cat) &&
    (status === "all" || t.status === status) &&
    (q === "" || t.name.toLowerCase().includes(q.toLowerCase()))
  );

  const counts = {
    total: LETTER_TEMPLATES.length,
    active: LETTER_TEMPLATES.filter((t) => t.status === "active").length,
    drafts: LETTER_TEMPLATES.filter((t) => t.status === "draft").length,
    languages: new Set(LETTER_TEMPLATES.map((t) => t.language)).size,
  };

  return (
    <>
      <section className="px-6 lg:px-10 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Templates" value={counts.total} delta="across 4 categories" icon={<FileText className="h-4 w-4" />} tone="tenant" />
        <StatTile label="Active" value={counts.active} delta="ready to send" tone="success" />
        <StatTile label="Drafts" value={counts.drafts} delta="pending review" tone="warning" />
        <StatTile label="Languages" value={counts.languages} delta="EN · FR" icon={<Languages className="h-4 w-4" />} />
      </section>

      <section className="px-6 lg:px-10 pb-10">
        <PageCard>
          <CardHead
            title="Template Library"
            subtitle={`${list.length} matching · jurisdiction-organized`}
            action={
              <Link to="/tenant/comms/letters/builder" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
                <Plus className="h-4 w-4" /> New template
              </Link>
            }
          />
          <div className="px-6 py-4 border-b border-border flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates…" className="bg-transparent text-sm flex-1 outline-none" />
            </div>
            {(["all", "legal", "settlement", "payment", "compliance"] as const).map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${cat === c ? "bg-gradient-tenant text-white shadow-tenant" : "bg-muted text-muted-foreground hover:bg-tenant-soft hover:text-tenant"}`}>{c}</button>
            ))}
            <span className="w-px h-6 bg-border mx-1" />
            {(["all", "active", "draft", "archived"] as const).map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${status === s ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-foreground/10"}`}>{s}</button>
            ))}
          </div>
          <ul className="divide-y divide-border">
            {list.map((t) => (
              <li key={t.id} className="px-6 py-4 flex items-start gap-4 text-sm">
                <div className="h-10 w-10 rounded-xl bg-tenant-soft text-tenant flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{t.name}</span>
                    <Pill tone="muted">{CAT_LABEL[t.category]}</Pill>
                    <Pill tone="info">{t.jurisdiction}</Pill>
                    <Pill tone="info">{t.language.toUpperCase()}</Pill>
                    <Pill tone={t.status === "active" ? "success" : t.status === "draft" ? "warning" : "muted"}>{t.status}</Pill>
                    {t.certifiedBy && <Pill tone="success"><ShieldCheck className="h-3 w-3" /> verified</Pill>}
                    {t.requiresApproval && <Pill tone="warning">approval required</Pill>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{t.preview}</div>
                  <div className="text-[11px] text-muted-foreground mt-2 flex items-center gap-3 flex-wrap">
                    <span>v{t.version}</span>
                    <span>· {t.usage30d.toLocaleString()} sent/30d</span>
                    <span>· compliance {t.complianceScore}%</span>
                    {t.creditorClient && <span>· client {t.creditorClient}</span>}
                    {t.tags.length > 0 && <span>· tags: {t.tags.join(", ")}</span>}
                    <span>· updated {t.updatedAt}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => toast.message(`Preview ${t.id} (PDF)`)} className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted">Preview</button>
                  <button onClick={() => toast.success(`Duplicated "${t.name}"`)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-tenant hover:bg-tenant-soft inline-flex items-center gap-1"><Copy className="h-3 w-3" /> Duplicate</button>
                  {t.status !== "archived" && (
                    <button onClick={() => toast.message(`Archived "${t.name}"`)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted inline-flex items-center gap-1"><Archive className="h-3 w-3" /> Archive</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </PageCard>
      </section>
    </>
  );
}
