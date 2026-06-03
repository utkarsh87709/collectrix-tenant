import { useEffect, useState } from "react";
import { findStatus } from "@/lib/status-mock";
import { Pill } from "@/components/tenant/ui";
import { ArrowRight, Check, X } from "lucide-react";

/**
 * Simplified, fixed-workflow status-change confirmation modal.
 * Tenants cannot configure statuses or transitions — only confirm a change
 * to one of the allowed next statuses and (optionally) leave a note.
 */
export function StatusChangeDialog({
  open,
  fromStatus,
  toStatus,
  onClose,
  onConfirm,
}: {
  open: boolean;
  fromStatus: string;
  toStatus: string;
  onClose: () => void;
  onConfirm: (payload: { note: string }) => void;
}) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  const from = findStatus(fromStatus);
  const to = findStatus(toStatus);

  if (!open || !to) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Status change
            </div>
            <h3 className="font-display text-lg font-bold mt-0.5">Change Debtor Status</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 text-sm">
          <p className="text-muted-foreground">
            You are changing the debtor status from{" "}
            <span className="font-semibold text-foreground">
              {from ? `${from.displayName} (${from.code})` : fromStatus}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-foreground">
              {to.displayName} ({to.code})
            </span>
            . This action will be recorded in the debtor activity history.
          </p>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
            {from ? (
              <Pill tone={from.tone}>
                {from.icon} {from.code}
              </Pill>
            ) : (
              <span className="text-xs text-muted-foreground">{fromStatus}</span>
            )}
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Pill tone={to.tone}>
              {to.icon} {to.code}
            </Pill>
            <span className="ml-1 text-xs text-muted-foreground truncate">
              {to.displayName}
            </span>
          </div>

          <div>
            <label
              htmlFor="status-change-note"
              className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block"
            >
              Note / reason (optional)
            </label>
            <textarea
              id="status-change-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add context for this status change…"
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ note: note.trim() })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
          >
            <Check className="h-4 w-4" /> Confirm Status Change
          </button>
        </div>
      </div>
    </div>
  );
}
