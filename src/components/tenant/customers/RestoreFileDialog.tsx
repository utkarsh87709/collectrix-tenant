import { useState } from "react";
import { Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Pill } from "@/components/tenant/ui";
import { StatusPill } from "@/components/tenant/statuses/StatusPill";
import { unArchiveCustomer } from "@/lib/archive-api";

export type RestoreFileStatus = { code: string; name: string; color: string };

/** Confirms an un-archive. Shared by the Archive tab's per-row Restore button
 *  and an archived customer's Manage menu. The backend's UnArchiveCustomer
 *  takes only the id — there is no reason/remark to collect, so none is asked
 *  for. The file goes back to its team with the status it was archived on. */
export function RestoreFileDialog({
  uploadedDebtorId,
  name,
  fileRef,
  clientName,
  teamName,
  status,
  onClose,
  onRestored,
}: {
  uploadedDebtorId: number;
  name: string;
  fileRef: string;
  clientName: string | null;
  teamName: string | null;
  /** The status the file was on when archived; null when it had none. */
  status: RestoreFileStatus | null;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const label = name || fileRef;

  const submit = async () => {
    setSubmitting(true);
    try {
      await unArchiveCustomer(uploadedDebtorId);
      toast.success(`${label} restored to the active workload.`);
      onRestored();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't restore this file.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-md">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-tenant" />
              <div className="font-display font-bold text-base">Restore file</div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {teamName
                ? `Return this file to the active workload for ${teamName}.`
                : "Return this file to the active workload."}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div className="font-semibold">{label}</div>
            <div className="mt-0.5 text-xs text-muted-foreground font-mono">
              {fileRef}
              {clientName ? ` · ${clientName}` : ""}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Restores to</span>
            {status ? (
              <StatusPill
                code={status.code}
                name={status.name}
                color={status.color}
                className="text-xs px-2 py-0.5"
              />
            ) : (
              <Pill tone="muted">No status</Pill>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            The file keeps the status it had when it was archived and reappears in its team's
            queues.
          </p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Restore file
          </button>
        </div>
      </div>
    </div>
  );
}
