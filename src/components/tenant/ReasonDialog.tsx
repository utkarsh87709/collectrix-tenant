import { useState } from "react";
import { X, Archive, Trash2 } from "lucide-react";

export function ReasonDialog({
  open, onClose, onConfirm, kind, label,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  kind: "archive" | "delete";
  label: string;
}) {
  const [reason, setReason] = useState("");
  if (!open) return null;
  const submit = () => { if (reason.trim()) { onConfirm(reason.trim()); setReason(""); } };
  const isDelete = kind === "delete";
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            {isDelete ? <Trash2 className="h-4 w-4 text-destructive" /> : <Archive className="h-4 w-4 text-warning" />}
            <div className="font-display font-bold text-sm">{label}</div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            {isDelete
              ? "Soft delete — the record remains in the audit trail and is recoverable by admins."
              : "Archiving hides the customer from active work views. Recoverable via the Archived filter."}
          </p>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Reason (required)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              placeholder={isDelete ? "Why is this record being deleted?" : "Why archive this customer?"}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
          <button onClick={submit} disabled={!reason.trim()}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 ${isDelete ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}`}>
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}
