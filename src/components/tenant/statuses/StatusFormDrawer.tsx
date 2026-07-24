import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { StatusPill } from "./StatusPill";
import { isValidHex, type Status } from "@/lib/statuses-api";
import { cn } from "@/lib/utils";

export type StatusDraft = {
  status: string;
  statusCode: string;
  statusColorCode: string;
};

const DEFAULT_COLOR = "#1EC9A0";

/**
 * Right-side drawer for creating or editing a status. Purely local — the parent
 * owns persistence and receives the validated draft via `onSave`.
 */
export function StatusFormDrawer({
  open,
  status,
  existingCodes,
  saving = false,
  onClose,
  onSave,
}: {
  open: boolean;
  /** When set, the drawer is in edit mode for this status; otherwise create. */
  status: Status | null;
  /** Codes already in use (upper-cased), for uniqueness validation. */
  existingCodes: string[];
  /** True while the parent persists the draft — disables the form + shows a spinner. */
  saving?: boolean;
  onClose: () => void;
  onSave: (draft: StatusDraft) => void;
}) {
  const isEdit = !!status;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [touched, setTouched] = useState(false);

  // Reset the form whenever the drawer opens for a new target.
  useEffect(() => {
    if (!open) return;
    setName(status?.status ?? "");
    setCode(status?.statusCode ?? "");
    setColor(status?.statusColorCode ?? DEFAULT_COLOR);
    setTouched(false);
  }, [open, status]);

  const trimmedName = name.trim();
  const trimmedCode = code.trim().toUpperCase();

  const codeTaken =
    trimmedCode.length > 0 &&
    trimmedCode !== (status?.statusCode?.toUpperCase() ?? "") &&
    existingCodes.includes(trimmedCode);

  const nameError = !trimmedName ? "Name is required." : "";
  const codeError = !trimmedCode
    ? "Code is required."
    : trimmedCode.length < 2 || trimmedCode.length > 4
      ? "Code must be 2–4 characters."
      : codeTaken
        ? "That code is already in use."
        : "";
  const colorError = !isValidHex(color) ? "Enter a valid hex colour." : "";

  const valid = !nameError && !codeError && !colorError;

  const handleSave = () => {
    setTouched(true);
    if (!valid) return;
    onSave({ status: trimmedName, statusCode: trimmedCode, statusColorCode: color });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {isEdit ? "Edit status" : "New status"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isEdit
              ? "Update this status. Its code stays bound to existing files."
              : "Create a new status for your account lifecycle."}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Preview */}
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
              Preview
            </div>
            <StatusPill
              code={trimmedCode || "NEW"}
              name={trimmedName || "Status name"}
              color={isValidHex(color) ? color : DEFAULT_COLOR}
            />
          </div>

          {/* Name */}
          <Field label="Name" required error={touched ? nameError : ""}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Active"
              autoFocus
            />
          </Field>

          {/* Code */}
          <Field
            label="Code"
            required
            help="2–4 characters, auto-uppercased. Unique across your statuses."
            error={touched ? codeError : ""}
          >
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="ACT"
              maxLength={4}
              className="font-mono tracking-wide"
            />
          </Field>

          {/* Color */}
          <Field
            label="Color"
            help="Pill color shown across the app."
            error={touched ? colorError : ""}
          >
            <div className="flex items-stretch gap-3">
              <label
                className="relative h-11 w-14 shrink-0 rounded-lg border border-border overflow-hidden cursor-pointer"
                style={{ backgroundColor: isValidHex(color) ? color : "transparent" }}
              >
                <input
                  type="color"
                  value={isValidHex(color) ? color : DEFAULT_COLOR}
                  onChange={(e) => setColor(e.target.value.toUpperCase())}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Pick color"
                />
              </label>
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                placeholder="#1EC9A0"
                className="h-11 font-mono"
              />
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (touched && !valid)}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-tenant px-5 py-2 text-sm font-semibold text-white shadow-tenant transition-opacity hover:opacity-90",
              (saving || (touched && !valid)) && "opacity-50 cursor-not-allowed",
            )}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Status
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  required,
  help,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
