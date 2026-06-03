import { useEffect, useRef, useState } from "react";
import { X, Paperclip, Check, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  createNote,
  updateNote,
  type Note,
  type NoteTemplate,
} from "@/lib/notes-store";
import type { NoteAttachment } from "@/lib/notes-mock";

type Props = {
  open: boolean;
  onClose: () => void;
  debtorId: string;
  debtorName: string;
  existing?: Note;
  actor?: string;
};

const QUICK_TEMPLATE: NoteTemplate = {
  id: "__quick",
  name: "Quick note",
  category: "custom",
  icon: "QN",
  description: "Free-form note.",
  defaultVisibility: "internal",
  isBuiltIn: true,
  fields: [],
};

export function NoteEditor({ open, onClose, debtorId, debtorName, existing, actor = "Maya Lindstrom" }: Props) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<NoteAttachment[]>(existing?.attachments ?? []);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(existing?.title ?? "");
      // strip HTML for plain description editing
      const plain = existing?.bodyHtml ? existing.bodyHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
      setDescription(plain);
      setAttachments(existing?.attachments ?? []);
    }
  }, [open, existing]);

  if (!open) return null;

  const close = () => {
    setTitle("");
    setDescription("");
    setAttachments([]);
    onClose();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const next: NoteAttachment[] = [];
    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 25MB`);
        continue;
      }
      const dataUrl = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result ?? ""));
        r.readAsDataURL(file);
      });
      next.push({ id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: file.name, size: file.size, type: file.type, dataUrl });
    }
    setAttachments((prev) => [...prev, ...next]);
    e.target.value = "";
  };

  const save = () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    const bodyHtml = description.trim()
      ? `<p>${description.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "</p><p>")}</p>`
      : "";

    if (existing) {
      updateNote(
        existing.id,
        { title: title.trim(), bodyHtml, attachments },
        actor,
      );
      toast.success("Note updated");
    } else {
      createNote({
        debtorId,
        templateId: QUICK_TEMPLATE.id,
        type: QUICK_TEMPLATE.name,
        category: QUICK_TEMPLATE.category,
        title: title.trim(),
        fields: {},
        bodyHtml,
        visibility: "internal",
        pinned: false,
        attachments,
        links: [],
        createdBy: actor,
        actor,
      });
      toast.success("Note added", { description: debtorName });
    }
    close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-xl my-8 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="min-w-0">
            <div className="font-display font-bold truncate">{existing ? "Edit note" : "New note"}</div>
            <div className="text-xs text-muted-foreground truncate">{debtorName}</div>
          </div>
          <button onClick={close} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title…"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Description</label>
            <textarea
              ref={editorRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Add details…"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-tenant/30"
            />
          </div>

          <div>
            <label className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm cursor-pointer">
              <Paperclip className="h-4 w-4" /> Attach files
              <input type="file" multiple className="hidden" onChange={handleFile} />
            </label>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 px-2 py-1 rounded border border-border bg-muted/40 text-xs">
                    {a.type.startsWith("image/") ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                    <span className="font-mono truncate max-w-[180px]">{a.name}</span>
                    <span className="text-muted-foreground">{(a.size / 1024).toFixed(0)}KB</span>
                    <button onClick={() => setAttachments((p) => p.filter((x) => x.id !== a.id))} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={close} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
          <button onClick={save} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
            <Check className="h-4 w-4" /> {existing ? "Save changes" : "Create note"}
          </button>
        </div>
      </div>
    </div>
  );
}
