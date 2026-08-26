import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pill } from "@/components/tenant/ui";
import { CustomFieldDialog, type CustomFieldDraft } from "./CustomFieldDialog";
import {
  buildDataFieldsSampleCsv,
  createCustomField,
  dataTypeLabel,
  deleteCustomField,
  getCustomFields,
  getDefaultFields,
  updateCustomField,
  type DataField,
} from "@/lib/data-fields-api";

type SubTab = "custom" | "default";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function DataFieldsSection({ companyName }: { companyName: string }) {
  const [subTab, setSubTab] = useState<SubTab>("custom");
  const [defaultFields, setDefaultFields] = useState<DataField[]>([]);
  const [customFields, setCustomFields] = useState<DataField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DataField | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<DataField | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [defaults, custom] = await Promise.all([getDefaultFields(), getCustomFields()]);
      setDefaultFields(defaults);
      setCustomFields(custom);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data fields.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reservedNames = useMemo(
    () => [...defaultFields, ...customFields].map((f) => f.fieldName.toLowerCase()),
    [defaultFields, customFields],
  );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (f: DataField) => {
    setEditing(f);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSave = async (draft: CustomFieldDraft) => {
    setSaving(true);
    try {
      if (editing) {
        await updateCustomField({ fieldId: editing.fieldId, ...draft });
        toast.success(`Field "${draft.fieldName}" updated`);
      } else {
        await createCustomField(draft);
        toast.success(`Field "${draft.fieldName}" added`);
      }
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this field.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteCustomField(deleting.fieldId);
      toast.success(`Field "${deleting.fieldName}" removed`);
      setDeleting(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove this field.");
    } finally {
      setDeletingBusy(false);
    }
  };

  const downloadSampleTemplate = () => {
    const csv = buildDataFieldsSampleCsv([...defaultFields, ...customFields]);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customer_import_sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5 border-b border-border">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">Customer data fields</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            These fields define the customer import template for {companyName || "your tenant"} and
            apply to every client in this tenant.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={downloadSampleTemplate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Download sample template
          </button>
          <button
            onClick={openCreate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-95 transition-opacity disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add custom field
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-2 px-6 pt-4">
        <SubTabButton active={subTab === "custom"} onClick={() => setSubTab("custom")}>
          Custom fields <Count n={customFields.length} />
        </SubTabButton>
        <SubTabButton active={subTab === "default"} onClick={() => setSubTab("default")}>
          Default CSV columns <Count n={defaultFields.length} />
        </SubTabButton>
      </div>

      <div className="px-6 pb-6 pt-4">
        {loading ? (
          <div className="py-16 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading data fields…
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={load}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Try again
            </button>
          </div>
        ) : subTab === "custom" ? (
          <CustomFieldsTable
            fields={customFields}
            onEdit={openEdit}
            onDelete={setDeleting}
            onAdd={openCreate}
          />
        ) : (
          <DefaultFieldsTable fields={defaultFields} />
        )}
      </div>

      <CustomFieldDialog
        open={dialogOpen}
        field={editing}
        reservedNames={reservedNames}
        saving={saving}
        onClose={closeDialog}
        onSave={handleSave}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && !deletingBusy && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove custom field?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  This removes <span className="font-semibold">{deleting.fieldName}</span> from your
                  data fields template. It will no longer appear on new imports or on the customer
                  file view.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deletingBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SubTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-[11px] font-bold text-muted-foreground">
      {n}
    </span>
  );
}

function CustomFieldsTable({
  fields,
  onEdit,
  onDelete,
  onAdd,
}: {
  fields: DataField[];
  onEdit: (f: DataField) => void;
  onDelete: (f: DataField) => void;
  onAdd: () => void;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Fields your tenant added. They appear in the sample import template, are validated on
        upload, and show on every customer file.
      </p>
      {fields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <FileSpreadsheet className="h-6 w-6 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No custom fields yet.</p>
          <button
            onClick={onAdd}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-95 transition-opacity"
          >
            <Plus className="h-4 w-4" /> Add custom field
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Field name</th>
                <th className="px-4 py-2.5 font-semibold">Data type</th>
                <th className="px-4 py-2.5 font-semibold">Added</th>
                <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fields.map((f) => (
                <tr key={f.fieldId} className="group">
                  <td className="px-4 py-3 font-medium">{f.fieldName}</td>
                  <td className="px-4 py-3">
                    <Pill tone="tenant">{dataTypeLabel(f.dataType)}</Pill>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.createdAt ? dateFmt.format(new Date(f.createdAt)) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(f)}
                        aria-label={`Edit ${f.fieldName}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(f)}
                        aria-label={`Remove ${f.fieldName}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DefaultFieldsTable({ fields }: { fields: DataField[] }) {
  const mid = Math.ceil(fields.length / 2);
  const left = fields.slice(0, mid);
  const right = fields.slice(mid);

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3 flex items-start gap-1.5">
        <span aria-hidden>🔒</span>
        Every import template starts with these columns. They're provided by Collectrix and reserved
        — they can't be renamed, removed, reordered or retyped, and a custom field can't reuse one
        of their names.
      </p>
      <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Field name</th>
              <th className="px-4 py-2.5 font-semibold">Data type</th>
              <th className="px-4 py-2.5 font-semibold">Field name</th>
              <th className="px-4 py-2.5 font-semibold">Data type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {left.map((f, i) => {
              const pair = right[i];
              return (
                <tr key={f.fieldId}>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{f.fieldName}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {dataTypeLabel(f.dataType)}
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {pair?.fieldName ?? ""}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {pair ? dataTypeLabel(pair.dataType) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
