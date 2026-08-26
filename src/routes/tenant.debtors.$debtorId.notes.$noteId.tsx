import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { VisibilityBadge } from "@/components/tenant/NoteBadge";
import { NoteEditor } from "@/components/tenant/NoteEditor";
import { useNote, togglePin, deleteNote } from "@/lib/notes-store";
import { debtors } from "@/lib/intake-mock";
import { ChevronLeft, Pin, PinOff, Pencil, Trash2, Printer, FileText, Image as ImageIcon, Mic, Link2, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/debtors/$debtorId/notes/$noteId")({
  head: () => ({ meta: [{ title: "Note · Customer · Tenant Admin" }] }),
  component: NoteDetail,
  notFoundComponent: () => (
    <Shell>
      <div className="px-10 py-20 text-center">
        <h2 className="font-display text-2xl font-bold">Note not found</h2>
      </div>
    </Shell>
  ),
});

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function NoteDetail() {
  const { debtorId, noteId } = useParams({ from: "/tenant/debtors/$debtorId/notes/$noteId" });
  const note = useNote(noteId);
  const debtor = debtors.find((d) => d.id === debtorId);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  if (!note) {
    return (
      <Shell>
        <div className="px-10 py-20 text-center">
          <h2 className="font-display text-2xl font-bold">Note not found</h2>
          <Link to="/tenant/debtors/$debtorId" params={{ debtorId }} className="text-tenant text-sm hover:underline mt-2 inline-block">← Back to customer</Link>
        </div>
      </Shell>
    );
  }

  const onDelete = () => {
    const reason = window.prompt("Reason for deleting this note (required):");
    if (!reason || !reason.trim()) return;
    const res = deleteNote(note.id, { actor: "Maya Lindstrom", reason, role: "admin" });
    if (!res.ok) { toast.error(res.error ?? "Cannot delete"); return; }
    toast.success("Note deleted");
    navigate({ to: "/tenant/debtors/$debtorId", params: { debtorId } });
  };

  return (
    <Shell>
      <Topbar
        title={note.title}
        subtitle={`${note.type} · ${debtor?.name ?? debtorId}`}
        action={
          <Link to="/tenant/debtors/$debtorId" params={{ debtorId }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
            <ChevronLeft className="h-4 w-4" /> Back to customer
          </Link>
        }
      />

      <section className="px-6 lg:px-10 py-6 grid grid-cols-1 lg:grid-cols-3 gap-4 print:block">
        <div className="lg:col-span-2 space-y-4">
          <PageCard>
            <div className="px-6 py-4 border-b border-border flex items-center gap-2 flex-wrap">
              <Pill tone="tenant">{note.type}</Pill>
              <VisibilityBadge visibility={note.visibility} />
              {note.pinned && <Pill tone="warning">Pinned</Pill>}
              <div className="ml-auto flex gap-1.5 print:hidden">
                <button onClick={() => { togglePin(note.id); toast.success(note.pinned ? "Unpinned" : "Pinned"); }} className="p-2 rounded-lg border border-border hover:bg-muted" title="Pin">
                  {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </button>
                <button onClick={() => setEditing(true)} className="p-2 rounded-lg border border-border hover:bg-muted" title="Edit"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => window.print()} className="p-2 rounded-lg border border-border hover:bg-muted" title="Print"><Printer className="h-4 w-4" /></button>
                <button onClick={onDelete} className="p-2 rounded-lg border border-border hover:bg-destructive/10 text-destructive" title="Delete"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div
              className="px-6 py-5 prose-sm max-w-none text-sm [&_h3]:font-bold [&_h3]:text-base [&_h3]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_a]:text-tenant [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: note.bodyHtml || "<p class='text-muted-foreground italic'>No body content.</p>" }}
            />
          </PageCard>

          {Object.keys(note.fields).length > 0 && (
            <PageCard>
              <CardHead title="Structured fields" />
              <div className="px-6 py-4 grid grid-cols-2 gap-4 text-sm">
                {Object.entries(note.fields).map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.replace(/_/g, " ")}</div>
                    <div className="font-semibold">{v || "—"}</div>
                  </div>
                ))}
              </div>
            </PageCard>
          )}

          {note.attachments.length > 0 && (
            <PageCard>
              <CardHead title={`Attachments (${note.attachments.length})`} />
              <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {note.attachments.map((a) => (
                  <a key={a.id} href={a.dataUrl} download={a.name} className="rounded-lg border border-border p-2 hover:border-tenant hover:bg-tenant/5 block">
                    {a.type.startsWith("image/") && a.dataUrl ? (
                      <img src={a.dataUrl} alt={a.name} className="w-full h-24 object-cover rounded mb-2" />
                    ) : (
                      <div className="h-24 flex items-center justify-center bg-muted rounded mb-2">
                        {a.type.startsWith("image/") ? <ImageIcon className="h-8 w-8 text-muted-foreground" /> : <FileText className="h-8 w-8 text-muted-foreground" />}
                      </div>
                    )}
                    <div className="text-xs font-mono truncate">{a.name}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Download className="h-3 w-3" />{(a.size / 1024).toFixed(0)}KB</div>
                  </a>
                ))}
              </div>
            </PageCard>
          )}

          {note.links.length > 0 && (
            <PageCard>
              <CardHead title="Linked objects" />
              <div className="px-6 py-4 flex flex-wrap gap-2">
                {note.links.map((l) => (
                  <span key={l.id} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-xs">
                    <Link2 className="h-3 w-3" /> {l.label}
                  </span>
                ))}
              </div>
            </PageCard>
          )}

          {note.voiceTranscript && (
            <PageCard>
              <CardHead title="Voice transcript" />
              <div className="px-6 py-4 text-sm flex items-start gap-2">
                <Mic className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-muted-foreground italic">{note.voiceTranscript}</div>
              </div>
            </PageCard>
          )}
        </div>

        <div className="space-y-4 print:hidden">
          <PageCard>
            <CardHead title="Metadata" />
            <div className="px-6 py-4 space-y-2 text-sm">
              <Meta label="Created by" value={note.createdBy} />
              <Meta label="Created at" value={fmt(note.createdAt)} />
              <Meta label="Last updated" value={fmt(note.updatedAt)} />
              <Meta label="Visibility" value={note.visibility === "internal" ? "Internal only" : "Creditor visible"} />
              <Meta label="Category" value={note.category} />
            </div>
          </PageCard>

          <PageCard>
            <CardHead title="Audit trail" />
            <ul className="divide-y divide-border">
              {note.audit.map((a) => (
                <li key={a.id} className="px-6 py-2.5 text-xs">
                  <div className="font-semibold">{a.action}</div>
                  <div className="text-muted-foreground">{a.actor} · {fmt(a.when)}</div>
                </li>
              ))}
            </ul>
          </PageCard>
        </div>
      </section>

      {debtor && (
        <NoteEditor
          open={editing}
          onClose={() => setEditing(false)}
          debtorId={debtorId}
          debtorName={debtor.name}
          existing={note}
        />
      )}
    </Shell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-right">{value}</span>
    </div>
  );
}
