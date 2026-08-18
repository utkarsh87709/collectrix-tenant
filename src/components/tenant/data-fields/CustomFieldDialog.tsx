import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATA_TYPE_OPTIONS, type DataField, type DataFieldType } from "@/lib/data-fields-api";

export type CustomFieldDraft = { fieldName: string; dataType: DataFieldType };

/**
 * Add/edit modal for a tenant custom field. Purely local — the parent owns
 * persistence and receives the validated draft via `onSave`.
 */
export function CustomFieldDialog({
  open,
  field,
  reservedNames,
  saving = false,
  onClose,
  onSave,
}: {
  open: boolean;
  /** When set, the dialog is in edit mode for this field; otherwise create. */
  field: DataField | null;
  /** Every default + custom field name already in use (lower-cased), for uniqueness validation. */
  reservedNames: string[];
  saving?: boolean;
  onClose: () => void;
  onSave: (draft: CustomFieldDraft) => void;
}) {
  const isEdit = !!field;
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState<DataFieldType>("text");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(field?.fieldName ?? "");
    setDataType(field?.dataType ?? "text");
    setTouched(false);
  }, [open, field]);

  const trimmedName = name.trim();
  const nameTaken =
    trimmedName.length > 0 &&
    trimmedName.toLowerCase() !== (field?.fieldName?.toLowerCase() ?? "") &&
    reservedNames.includes(trimmedName.toLowerCase());

  const nameError = !trimmedName
    ? "Field name is required."
    : nameTaken
      ? "That name is already in use."
      : "";
  const valid = !nameError;

  const handleSave = () => {
    setTouched(true);
    if (!valid) return;
    onSave({ fieldName: trimmedName, dataType });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit custom field" : "Add custom field"}</DialogTitle>
          <DialogDescription>
            Capture anything your clients send that the default columns don't cover.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Field name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Employer name"
              autoFocus
              disabled={saving}
            />
            {touched && nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Data type
            </label>
            <Select
              value={dataType}
              onValueChange={(v) => setDataType(v as DataFieldType)}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
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
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-tenant px-4 py-2 text-sm font-semibold text-white shadow-tenant transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Add field"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
