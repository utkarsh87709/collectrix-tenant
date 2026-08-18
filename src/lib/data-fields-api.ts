// Debtor data field configuration — the columns every client's import file in
// this tenant is validated and stored against.
//   POST /tenant/getDefaultFields    {}                             -> { fieldsList: DataField[] }
//   POST /tenant/getCustomFields     {}                             -> { fieldsList: DataField[] }
//   POST /tenant/createCustomFields  { fieldName, dataType }        -> {}
//   POST /tenant/updateCustomFields  { fieldId, fieldName, dataType } -> {}
//   POST /tenant/deleteCustomFields  { fieldId }                    -> {}
// Default fields are the fixed, tenant-wide reserved columns (Collectrix-owned,
// read-only here). Custom fields are the tenant's own additions on top of them.
// fieldName uniqueness is enforced server-side across BOTH lists — creating or
// renaming a custom field to match any default or custom field name fails with
// "Field Name Already Exist".
// updateCustomFields/deleteCustomFields return meta.status: true even for a
// fieldId that doesn't exist or belongs to another tenant (no row-affected
// check on the backend) — treat them as fire-and-forget and re-fetch the list
// to see the actual result, rather than trusting the success response alone.
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";

export type DataFieldType = "text" | "number" | "email" | "phoneNumber" | "date" | "boolean";

export type DataField = {
  fieldId: number;
  fieldName: string;
  dataType: DataFieldType;
  createdAt: string;
};

export type CustomFieldInput = {
  fieldName: string;
  dataType: DataFieldType;
};

/** Dropdown options in the order shown in the "Add custom field" form. */
export const DATA_TYPE_OPTIONS: { value: DataFieldType; label: string }[] = [
  { value: "text", label: "String" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "phoneNumber", label: "Phone number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Boolean" },
];

const DATA_TYPE_LABELS: Record<DataFieldType, string> = Object.fromEntries(
  DATA_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DataFieldType, string>;

export function dataTypeLabel(type: string): string {
  return DATA_TYPE_LABELS[type as DataFieldType] ?? type;
}

async function fetchFieldList(path: string): Promise<DataField[]> {
  const data = await apiPost<{ fieldsList?: DataField[] }>(path, {});
  return data?.fieldsList ?? [];
}

export function getDefaultFields(): Promise<DataField[]> {
  return fetchFieldList("/tenant/getDefaultFields");
}

export function getCustomFields(): Promise<DataField[]> {
  return fetchFieldList("/tenant/getCustomFields");
}

export function createCustomField(input: CustomFieldInput): Promise<unknown> {
  return apiPost("/tenant/createCustomFields", { ...input });
}

export function updateCustomField(input: CustomFieldInput & { fieldId: number }): Promise<unknown> {
  return apiPost("/tenant/updateCustomFields", { ...input });
}

export function deleteCustomField(fieldId: number): Promise<unknown> {
  return apiPost("/tenant/deleteCustomFields", { fieldId });
}

/** Builds a header-only CSV from the tenant's full field set (default + custom)
 *  so users can see the exact column layout their import file must match. */
export function buildDataFieldsSampleCsv(fields: DataField[]): string {
  const headers = fields.map((f) => f.fieldName);
  return `${headers.map(csvCell).join(",")}\n`;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
