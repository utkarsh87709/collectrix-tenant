import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { PageCard, CardHead } from "@/components/tenant/ui";
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  useCustomFields, useDebtorCustomValues, setDebtorCustomValue,
  type CustomField,
} from "@/lib/custom-fields-store";

export function CustomFieldsSection({ debtorId }: { debtorId: string }) {
  const fields = useCustomFields();
  const values = useDebtorCustomValues(debtorId);

  return (
    <PageCard>
      <CardHead
        title="Custom fields"
        subtitle="Tenant-defined fields for this debtor"
        action={
          <Link
            to="/tenant/settings/custom-fields"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-tenant hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Manage fields
          </Link>
        }
      />
      {fields.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          <Sparkles className="h-5 w-5 mx-auto mb-2 text-tenant" />
          No custom fields configured yet.{" "}
          <Link to="/tenant/settings/custom-fields" className="text-tenant font-semibold hover:underline">Create one</Link>.
        </div>
      ) : (
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((f) => (
            <FieldRow key={f.id} field={f} value={values[f.key]} debtorId={debtorId} />
          ))}
        </div>
      )}
    </PageCard>
  );
}

function FieldRow({ field, value, debtorId }: { field: CustomField; value: unknown; debtorId: string }) {
  const [local, setLocal] = useState<string>(value == null ? "" : String(value));
  const commit = (v: string | boolean | string[]) => {
    setDebtorCustomValue(debtorId, field.key, v);
    toast.success(`${field.label} saved`);
  };

  const isReadOnly = field.readOnly;
  const display = (() => {
    switch (field.type) {
      case "boolean":
        return (
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              disabled={isReadOnly}
              checked={value === true || value === "true"}
              onChange={(e) => commit(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-xs text-muted-foreground">{value === true || value === "true" ? "Yes" : "No"}</span>
          </label>
        );
      case "dropdown":
        return (
          <select
            disabled={isReadOnly}
            value={local}
            onChange={(e) => { setLocal(e.target.value); commit(e.target.value); }}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
          >
            <option value="">— select —</option>
            {(field.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
      case "multiselect": {
        const arr = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div className="flex flex-wrap gap-1.5">
            {(field.options ?? []).map((opt) => {
              const on = arr.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => commit(on ? arr.filter((x) => x !== opt) : [...arr, opt])}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold ${on ? "bg-tenant text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        );
      }
      case "date":
        return (
          <input
            type="date"
            disabled={isReadOnly}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => commit(local)}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
          />
        );
      case "number":
      case "currency":
        return (
          <input
            type="number"
            disabled={isReadOnly}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => commit(local)}
            placeholder={field.type === "currency" ? "0.00" : "0"}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
          />
        );
      case "masked":
        return (
          <input
            type="password"
            disabled={isReadOnly}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => commit(local)}
            placeholder="••••••••"
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono"
          />
        );
      case "file":
        return (
          <button
            disabled={isReadOnly}
            onClick={() => toast.message("File upload opens here")}
            className="w-full px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-muted text-left"
          >
            {local || "Click to upload…"}
          </button>
        );
      default:
        return (
          <input
            type="text"
            disabled={isReadOnly}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => commit(local)}
            placeholder={field.validation ? `format: ${field.validation}` : ""}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
          />
        );
    }
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </span>
        {isReadOnly && <span className="text-[10px] text-muted-foreground">read-only</span>}
      </div>
      {display}
    </div>
  );
}
