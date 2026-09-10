import { useState } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/tenant/ui";
import {
  updateCustomerDetails,
  backendDateToInput,
  inputDateToBackend,
  type CustomerDetails,
} from "@/lib/customers-api";

type CustomFieldDraft = { fieldId: number; fieldName: string; dataType: string; value: string };

type Draft = {
  debtorFirstName: string;
  debtorMiddleName: string;
  debtorLastName: string;
  address: string;
  homeNo: string;
  cellNo1: string;
  cellNo2: string;
  email: string;
  dob: string;
  principal: string;
  interestRate: string;
  interestType: string;
  compoundingFrequency: string;
  interestStartDate: string;
  currentOutstandingBalance: string;
  currency: string;
  delinquencyDate: string;
  dateOfLastPayment: string;
  lastPaymentAmount: string;
  lastPaymentMethod: string;
  totalPaidToDate: string;
  preferredLanguage: string;
  customFields: CustomFieldDraft[];
};

function fromDetails(d: CustomerDetails): Draft {
  return {
    debtorFirstName: d.debtorFirstName ?? "",
    debtorMiddleName: d.debtorMiddleName ?? "",
    debtorLastName: d.debtorLastName ?? "",
    address: d.address ?? "",
    homeNo: d.homeNo ?? "",
    cellNo1: d.cellNo1 ?? "",
    cellNo2: d.cellNo2 ?? "",
    email: d.email ?? "",
    dob: d.dob ?? "",
    principal: d.principal ?? "",
    interestRate: d.interestRate ?? "",
    interestType: d.interestType ?? "",
    compoundingFrequency: d.compoundingFrequency ?? "",
    interestStartDate: d.interestStartDate ?? "",
    currentOutstandingBalance: d.currentOutstandingBalance ?? "",
    currency: d.currency ?? "",
    delinquencyDate: d.delinquencyDate ?? "",
    dateOfLastPayment: d.dateOfLastPayment ?? "",
    lastPaymentAmount: d.lastPaymentAmount ?? "",
    lastPaymentMethod: d.lastPaymentMethod ?? "",
    totalPaidToDate: d.totalPaidToDate ?? "",
    preferredLanguage: d.preferredLanguage ?? "",
    customFields: d.customFields.map((f) => ({
      fieldId: f.fieldId,
      fieldName: f.fieldName,
      dataType: f.dataType,
      value: f.fieldValue ?? "",
    })),
  };
}

const INTEREST_TYPES = ["Simple", "Compound"];
const COMPOUNDING = ["Monthly", "Quarterly", "Semi-annually", "Annually"];

/** Full-record edit for a customer file (updateCustomerDetails). File number,
 *  client number and creditor come from intake and stay read-only, matching the
 *  profile card's note; everything else is editable. Date fields keep the
 *  backend's dd/mm/yyyy value in state and only convert at the input boundary. */
export function EditCustomerDialog({
  details,
  onClose,
  onSaved,
}: {
  details: CustomerDetails;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => fromDetails(details));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setCustom = (fieldId: number, value: string) =>
    setDraft((d) => ({
      ...d,
      customFields: d.customFields.map((f) => (f.fieldId === fieldId ? { ...f, value } : f)),
    }));

  const save = async () => {
    setSaving(true);
    try {
      const t = (s: string) => s.trim();
      await updateCustomerDetails({
        uploadedDebtorId: details.uploadedDebtorId,
        creditorName: details.creditorName,
        address: t(draft.address),
        homeNo: t(draft.homeNo),
        cellNo1: t(draft.cellNo1),
        cellNo2: t(draft.cellNo2),
        email: t(draft.email),
        dob: t(draft.dob),
        principal: t(draft.principal),
        interestRate: t(draft.interestRate),
        interestType: t(draft.interestType),
        compoundingFrequency: t(draft.compoundingFrequency),
        interestStartDate: t(draft.interestStartDate),
        currentOutstandingBalance: t(draft.currentOutstandingBalance),
        currency: t(draft.currency),
        delinquencyDate: t(draft.delinquencyDate),
        dateOfLastPayment: t(draft.dateOfLastPayment),
        lastPaymentAmount: t(draft.lastPaymentAmount),
        lastPaymentMethod: t(draft.lastPaymentMethod),
        totalPaidToDate: t(draft.totalPaidToDate),
        preferredLanguage: t(draft.preferredLanguage),
        debtorFirstName: t(draft.debtorFirstName) || null,
        debtorMiddleName: t(draft.debtorMiddleName) || null,
        debtorLastName: t(draft.debtorLastName) || null,
        statusId: details.statusId,
        customFields: draft.customFields.map((f) => ({
          fieldId: f.fieldId,
          fieldName: f.fieldName,
          fieldValue: t(f.value) === "" ? null : t(f.value),
        })),
      });
      toast.success("Customer details saved.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the customer details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-tenant" />
            <div>
              <div className="font-display font-bold text-base">Edit customer details</div>
              <div className="text-xs text-muted-foreground">
                {details.ourFileNo} · file number, client number and creditor come from intake and
                can't be edited
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 overflow-y-auto">
          <Section title="File / reference">
            <Text label="Our file no." value={details.ourFileNo} readOnly />
            <Text label="Client number" value={details.clientNumber} readOnly />
            <Text label="Creditor name" value={details.creditorName} readOnly />
          </Section>

          <Section title="Primary customer">
            <Text
              label="First name"
              value={draft.debtorFirstName}
              onChange={(v) => set("debtorFirstName", v)}
            />
            <Text
              label="Middle name"
              value={draft.debtorMiddleName}
              onChange={(v) => set("debtorMiddleName", v)}
            />
            <Text
              label="Last name"
              value={draft.debtorLastName}
              onChange={(v) => set("debtorLastName", v)}
            />
            <Text label="Address" value={draft.address} onChange={(v) => set("address", v)} />
            <Text
              label="Home no."
              type="tel"
              value={draft.homeNo}
              onChange={(v) => set("homeNo", v)}
            />
            <Text
              label="Cell no. 1"
              type="tel"
              value={draft.cellNo1}
              onChange={(v) => set("cellNo1", v)}
            />
            <Text
              label="Cell no. 2"
              type="tel"
              value={draft.cellNo2}
              onChange={(v) => set("cellNo2", v)}
            />
            <Text
              label="Email"
              type="email"
              value={draft.email}
              onChange={(v) => set("email", v)}
            />
            <DateField label="Date of birth" value={draft.dob} onChange={(v) => set("dob", v)} />
          </Section>

          <Section title="Financial / balance">
            <Text
              label="Principal"
              type="number"
              value={draft.principal}
              onChange={(v) => set("principal", v)}
            />
            <Text
              label="Interest rate (%)"
              type="number"
              value={draft.interestRate}
              onChange={(v) => set("interestRate", v)}
            />
            <Choice
              label="Interest type"
              value={draft.interestType}
              options={INTEREST_TYPES}
              onChange={(v) => set("interestType", v)}
            />
            <Choice
              label="Compounding frequency"
              value={draft.compoundingFrequency}
              options={COMPOUNDING}
              onChange={(v) => set("compoundingFrequency", v)}
            />
            <DateField
              label="Interest start date"
              value={draft.interestStartDate}
              onChange={(v) => set("interestStartDate", v)}
            />
            <Text
              label="Current outstanding balance"
              type="number"
              value={draft.currentOutstandingBalance}
              onChange={(v) => set("currentOutstandingBalance", v)}
            />
            <Text label="Currency" value={draft.currency} onChange={(v) => set("currency", v)} />
            <DateField
              label="Delinquency date"
              value={draft.delinquencyDate}
              onChange={(v) => set("delinquencyDate", v)}
            />
          </Section>

          <Section title="Payment history">
            <DateField
              label="Date of last payment"
              value={draft.dateOfLastPayment}
              onChange={(v) => set("dateOfLastPayment", v)}
            />
            <Text
              label="Last payment amount"
              type="number"
              value={draft.lastPaymentAmount}
              onChange={(v) => set("lastPaymentAmount", v)}
            />
            <Text
              label="Last payment method"
              value={draft.lastPaymentMethod}
              onChange={(v) => set("lastPaymentMethod", v)}
            />
            <Text
              label="Total paid to date"
              type="number"
              value={draft.totalPaidToDate}
              onChange={(v) => set("totalPaidToDate", v)}
            />
          </Section>

          <Section title="Other">
            <Text
              label="Preferred language"
              value={draft.preferredLanguage}
              onChange={(v) => set("preferredLanguage", v)}
            />
          </Section>

          {draft.customFields.length > 0 && (
            <Section title="Additional information">
              {draft.customFields.map((f) => (
                <CustomField key={f.fieldId} field={f} onChange={(v) => setCustom(f.fieldId, v)} />
              ))}
            </Section>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Field widgets ------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-3">
        {title}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
        {children}
      </div>
    </div>
  );
}

const INPUT_CLS =
  "w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm read-only:bg-muted/40 read-only:text-muted-foreground";

function Text({
  label,
  value,
  onChange,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: "text" | "number" | "email" | "tel";
  readOnly?: boolean;
}) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type={type}
        step={type === "number" ? "any" : undefined}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={INPUT_CLS}
      />
    </label>
  );
}

/** Value is the backend's dd/mm/yyyy string. Renders a native date picker when
 *  that parses; otherwise a text box holding the raw value, so a stored value
 *  in an unexpected format can be seen and corrected rather than wiped. */
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const asInput = backendDateToInput(value);
  const usePicker = value === "" || asInput !== "";
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      {usePicker ? (
        <input
          type="date"
          value={asInput}
          onChange={(e) => onChange(inputDateToBackend(e.target.value))}
          className={INPUT_CLS}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder="dd/mm/yyyy"
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_CLS}
        />
      )}
    </label>
  );
}

/** A select over the usual options that still shows whatever value the record
 *  already holds (intake data isn't constrained to this list). */
function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const all = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <NativeSelect
        size="sm"
        className="mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {all.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

function CustomField({
  field,
  onChange,
}: {
  field: CustomFieldDraft;
  onChange: (v: string) => void;
}) {
  switch (field.dataType) {
    case "date":
      return <DateField label={field.fieldName} value={field.value} onChange={onChange} />;
    case "boolean":
      return (
        <label className="block text-xs">
          <span className="text-muted-foreground">{field.fieldName}</span>
          <NativeSelect
            size="sm"
            className="mt-1"
            value={field.value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">—</option>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </NativeSelect>
        </label>
      );
    case "number":
      return <Text label={field.fieldName} type="number" value={field.value} onChange={onChange} />;
    case "email":
      return <Text label={field.fieldName} type="email" value={field.value} onChange={onChange} />;
    case "phoneNumber":
      return <Text label={field.fieldName} type="tel" value={field.value} onChange={onChange} />;
    default:
      return <Text label={field.fieldName} value={field.value} onChange={onChange} />;
  }
}
