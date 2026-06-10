import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Type,
  Hash,
  Calendar as CalIcon,
  DollarSign,
  List,
  CheckSquare,
  ToggleLeft,
  Upload,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCustomFields,
  addCustomField,
  updateCustomField,
  deleteCustomField,
  type CustomField,
  type CustomFieldType,
} from "@/lib/custom-fields-store";

export const Route = createFileRoute("/tenant/settings/custom-fields")({
  head: () => ({ meta: [{ title: "Custom Fields · Tenant Admin" }] }),
  component: CustomFieldsPage,
});

const TYPE_META: Record<CustomFieldType, { label: string; icon: typeof Type }> = {
  text: { label: "Text", icon: Type },
  number: { label: "Number", icon: Hash },
  date: { label: "Date", icon: CalIcon },
  currency: { label: "Currency", icon: DollarSign },
  dropdown: { label: "Dropdown", icon: List },
  multiselect: { label: "Multi-select", icon: CheckSquare },
  boolean: { label: "Boolean", icon: ToggleLeft },
  file: { label: "File upload", icon: Upload },
  masked: { label: "Masked sensitive", icon: EyeOff },
};

const ROLES = ["Admin", "Manager", "Agent", "Legal", "Finance"];

function CustomFieldsPage() {
  const fields = useCustomFields();
  const [editing, setEditing] = useState<CustomField | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <Shell>
      <Topbar
        title="Custom Fields"
        subtitle="Capture business-specific debtor data without custom development"
        action={
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
          >
            <Plus className="h-4 w-4" /> New custom field
          </button>
        }
      />

      <section className="px-6 lg:px-10 py-6">
        <PageCard>
          <CardHead
            title={`${fields.length} custom fields`}
            subtitle="Each field appears on the debtor profile, in imports, and in CRM mapping."
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
                <tr>
                  <th className="text-left px-6 py-3">Label</th>
                  <th className="text-left px-3 py-3">Key</th>
                  <th className="text-left px-3 py-3">Type</th>
                  <th className="text-left px-3 py-3">Required</th>
                  <th className="text-left px-3 py-3">Visibility</th>
                  <th className="text-left px-3 py-3">Used in</th>
                  <th className="px-3 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => {
                  const TypeIcon = TYPE_META[f.type].icon;
                  return (
                    <tr key={f.id} className="border-t border-border">
                      <td className="px-6 py-3 font-semibold">{f.label}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{f.key}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <TypeIcon className="h-3.5 w-3.5 text-tenant" />
                          {TYPE_META[f.type].label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {f.required ? (
                          <Pill tone="warning">required</Pill>
                        ) : (
                          <span className="text-xs text-muted-foreground">optional</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {f.visibleToRoles.length === 0 ? "All roles" : f.visibleToRoles.join(", ")}
                      </td>
                      <td className="px-3 py-3 text-xs space-x-1">
                        {f.useInDedupe && <Pill tone="info">dedupe</Pill>}
                        {f.useInVerification && <Pill tone="tenant">verify</Pill>}
                        {f.useInReporting && <Pill tone="success">reports</Pill>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setEditing(f)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-tenant"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete custom field "${f.label}"?`)) {
                                deleteCustomField(f.id);
                                toast.success("Custom field deleted");
                              }
                            }}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {fields.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-sm text-muted-foreground"
                    >
                      No custom fields yet — click "New custom field" to add one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </PageCard>
      </section>

      {(creating || editing) && (
        <FieldEditor
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={(data) => {
            if (editing) {
              updateCustomField(editing.id, data);
              toast.success("Custom field updated");
            } else {
              addCustomField(data);
              toast.success("Custom field created");
            }
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </Shell>
  );
}

function FieldEditor({
  initial,
  onClose,
  onSave,
}: {
  initial: CustomField | null;
  onClose: () => void;
  onSave: (data: Omit<CustomField, "id" | "createdAt">) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [key, setKey] = useState(initial?.key ?? "");
  const [type, setType] = useState<CustomFieldType>(initial?.type ?? "text");
  const [required, setRequired] = useState(initial?.required ?? false);
  const [readOnly, setReadOnly] = useState(initial?.readOnly ?? false);

  const [visibleToRoles, setVisibleToRoles] = useState<string[]>(initial?.visibleToRoles ?? []);
  const [optionsText, setOptionsText] = useState((initial?.options ?? []).join("\n"));
  const [importMapping, setImportMapping] = useState(initial?.importMapping ?? "");
  const [crmMapping, setCrmMapping] = useState(initial?.crmMapping ?? "");
  const [useInDedupe, setUseInDedupe] = useState(initial?.useInDedupe ?? false);
  const [useInVerification, setUseInVerification] = useState(initial?.useInVerification ?? false);
  const [useInReporting, setUseInReporting] = useState(initial?.useInReporting ?? true);

  const submit = () => {
    if (!label.trim()) {
      toast.error("Label is required");
      return;
    }
    const finalKey = (key || label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    onSave({
      label: label.trim(),
      key: finalKey,
      type,
      required,
      readOnly,

      visibleToRoles,
      options:
        type === "dropdown" || type === "multiselect"
          ? optionsText
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      importMapping: importMapping || undefined,
      crmMapping: crmMapping || undefined,
      useInDedupe,
      useInVerification,
      useInReporting,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border shadow-elegant w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg font-bold">
            {initial ? "Edit custom field" : "New custom field"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Label">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Court jurisdiction"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              />
            </FormField>
            <FormField label="Storage key">
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="auto from label"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono"
              />
            </FormField>
          </div>
          <FormField label="Field type">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_META) as CustomFieldType[]).map((t) => {
                const M = TYPE_META[t];
                const Icon = M.icon;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-2 ${type === t ? "border-tenant bg-tenant-soft text-tenant" : "border-border hover:bg-muted"}`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {M.label}
                  </button>
                );
              })}
            </div>
          </FormField>

          {(type === "dropdown" || type === "multiselect") && (
            <FormField label="Options (one per line)">
              <textarea
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono"
                placeholder={"Option A\nOption B\nOption C"}
              />
            </FormField>
          )}

          <FormField label="Visibility by role (empty = all roles)">
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => {
                const on = visibleToRoles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      setVisibleToRoles((p) => (on ? p.filter((x) => x !== r) : [...p, r]))
                    }
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold ${on ? "bg-tenant text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Import mapping (CSV header)">
              <input
                value={importMapping}
                onChange={(e) => setImportMapping(e.target.value)}
                placeholder="e.g. court_jurisdiction"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono"
              />
            </FormField>
            <FormField label="CRM mapping">
              <input
                value={crmMapping}
                onChange={(e) => setCrmMapping(e.target.value)}
                placeholder="e.g. Debtor.CustomField1"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
            <Toggle label="Required" value={required} onChange={setRequired} />
            <Toggle label="Read-only" value={readOnly} onChange={setReadOnly} />
            <Toggle
              label="Use in duplicate detection"
              value={useInDedupe}
              onChange={setUseInDedupe}
            />
            <Toggle
              label="Use in verification"
              value={useInVerification}
              onChange={setUseInVerification}
            />
            <Toggle label="Use in reporting" value={useInReporting} onChange={setUseInReporting} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
          >
            {initial ? "Save changes" : "Create field"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  // State-driven track color: peer-checked:bg-tenant never applied because
  // bg-tenant is a hand-written utility, so the switch stayed white when on.
  return (
    <div className="flex items-center gap-2 py-1">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-tenant/40 ${
          value ? "bg-tenant border-tenant" : "bg-muted border-border"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            value ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}
