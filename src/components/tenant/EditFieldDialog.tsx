import { useState } from "react";
import { X, Pencil } from "lucide-react";

export function EditFieldDialog({
  open, onClose, onSave, label, before, sensitive,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (next: string, reason?: string) => void;
  label: string;
  before: string;
  sensitive: boolean;
}) {
  const [draft, setDraft] = useState(before);
  const [reason, setReason] = useState("");

  if (!open) return null;
  const changed = draft.trim() !== before.trim();
  const canSave = changed && (!sensitive || reason.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2"><Pencil className="h-4 w-4 text-tenant" /><div className="font-display font-bold text-sm">Edit {label}</div></div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {sensitive && (
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-warning-foreground">
              Restricted field — only Admin and Finance can change this. A documented reason is required and the change is logged in the audit trail.
            </div>
          )}

          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Before</label>
            <div className="mt-1 px-3 py-2 rounded-lg bg-muted text-sm font-mono break-words">{before || "—"}</div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">After</label>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm" />
          </div>
          {sensitive && (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Reason for change</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm" />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
          <button disabled={!canSave} onClick={() => onSave(draft.trim(), sensitive ? reason.trim() : undefined)}
            className="px-3 py-1.5 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50">
            Save change
          </button>
        </div>
      </div>
    </div>
  );
}

// Restricted fields — Admin / Finance only. Agents and Managers cannot edit.
// Covers core financial/legal/identity fields imported from CSV.
export const SENSITIVE_FIELD_KEYS = new Set<string>([
  // Financial
  "principal", "current_principal_balance", "current_outstanding_balance",
  "accrued_interest_before_assignment", "interest_rate", "interest_type",
  "interest_start_date", "compounding_frequency", "currency",
  // Payment history (finance-owned)
  "last_payment_amount", "last_payment_method", "last_payment_reference_number",
  "date_of_last_payment", "total_paid_to_date",
  // Creditor / account / contract
  "creditor_name", "creditor_number", "client_name", "client_number",
  "account_number",
  // Identity
  "dob", "co_dob", "sin", "co_sin", "dl", "co_dl",
  // Court / legal
  "court_file_no", "courthouse", "courthouse_address", "courthouse_city",
  "courthouse_province", "courthouse_postal_code",
]);


