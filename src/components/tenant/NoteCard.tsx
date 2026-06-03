import { Link } from "@tanstack/react-router";
import { Paperclip, Pin, PinOff, Trash2, Pencil } from "lucide-react";
import type { Note } from "@/lib/notes-store";
import { Pill } from "./ui";

function strip(html: string) {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, "");
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.textContent ?? "";
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export function NoteCard({
  note,
  onPin,
  onEdit,
  onDelete,
}: {
  note: Note;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const snippet = strip(note.bodyHtml).slice(0, 140);
  return (
    <div className={`rounded-xl border p-4 transition ${note.pinned ? "border-tenant/50 bg-tenant/5" : "border-border bg-card hover:border-tenant/30"}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {note.pinned && <Pill tone="warning">Pinned</Pill>}
            {note.attachments.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Paperclip className="h-3 w-3" /> {note.attachments.length}
              </span>
            )}
          </div>
          <Link
            to="/tenant/debtors/$debtorId/notes/$noteId"
            params={{ debtorId: note.debtorId, noteId: note.id }}
            className="font-display font-bold text-sm hover:text-tenant block"
          >
            {note.title}
          </Link>
          {snippet && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{snippet}</div>}
          <div className="text-[11px] text-muted-foreground mt-2">
            {note.createdBy} · {fmt(note.createdAt)}
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={onPin} className="p-1.5 rounded hover:bg-muted" title={note.pinned ? "Unpin" : "Pin"}>
            {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-muted" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
