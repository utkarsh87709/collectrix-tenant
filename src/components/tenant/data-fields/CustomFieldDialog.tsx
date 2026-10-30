import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
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

export type CustomFieldDraft = {
  fieldName: string;
  dataType: DataFieldType;
  dropdownValues?: string[];
};

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
  const [options, setOptions] = useState<string[]>([""]);
  // Index of an option row just added, so it mounts focused.
  const [focusOption, setFocusOption] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(field?.fieldName ?? "");
    setDataType(field?.dataType ?? "text");
    setOptions(field?.dropdownValues?.length ? [...field.dropdownValues] : [""]);
    setFocusOption(null);
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

  // Blank rows are ignored rather than flagged; duplicates are case-insensitive.
  const isDropdown = dataType === "dropdown";
  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  const lowerOptions = cleanOptions.map((o) => o.toLowerCase());
  const hasDuplicate = lowerOptions.some((o, i) => lowerOptions.indexOf(o) !== i);
  const optionsError = !isDropdown
    ? ""
    : cleanOptions.length === 0
      ? "Add at least one option."
      : hasDuplicate
        ? "Each option must be different."
        : "";
  const valid = !nameError && !optionsError;

  const setOption = (i: number, value: string) =>
    setOptions((list) => list.map((o, j) => (j === i ? value : o)));
  const addOption = () => {
    setFocusOption(options.length);
    setOptions((list) => [...list, ""]);
  };
  const removeOption = (i: number) =>
    setOptions((list) => (list.length === 1 ? [""] : list.filter((_, j) => j !== i)));

  const handleSave = () => {
    setTouched(true);
    if (!valid) return;
    onSave(
      isDropdown
        ? { fieldName: trimmedName, dataType, dropdownValues: cleanOptions }
        : { fieldName: trimmedName, dataType },
    );
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

          {isDropdown && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Options
              </label>
              <p className="text-xs text-muted-foreground">
                What users can pick from on a customer file, in this order.
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={o}
                      onChange={(e) => setOption(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && i === options.length - 1 && o.trim()) {
                          e.preventDefault();
                          addOption();
                        }
                      }}
                      placeholder={`Option ${i + 1}`}
                      aria-label={`Option ${i + 1}`}
                      autoFocus={i === focusOption}
                      disabled={saving}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      disabled={saving || (options.length === 1 && !o)}
                      aria-label={`Remove option ${i + 1}`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addOption}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-tenant hover:underline disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add option
              </button>
              {touched && optionsError && (
                <p className="text-xs text-destructive">{optionsError}</p>
              )}
            </div>
          )}
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
