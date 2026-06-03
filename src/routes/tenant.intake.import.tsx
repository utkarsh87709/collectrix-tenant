import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Download, Plus, Building2, Eye, Pencil, EyeOff, CheckCircle } from "lucide-react";
import { importJobs } from "@/lib/intake-mock";
import { tenantUsers, teams } from "@/lib/tenant-mock";
import { useValidationIssues, setIssueStatus, type ValidationIssue, getValidationIssues } from "@/lib/validation-issues-store";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/intake/import")({
  head: () => ({ meta: [{ title: "Upload & Validate · Tenant Admin" }] }),
  component: ImportPage,
});

const LS_CREDITORS = "collectrix.creditors";
const LS_MAPPING_TEMPLATES = "collectrix.import.mapping-templates";

// ─────────────────────────────────────────────────────────────────────────────
// Canonical debtor import schema. Tenants upload their own CSV/XLSX and map
// their columns to these standard system fields in step 2 of the wizard.
//
// Things deliberately NOT in the template (handled inside the platform):
//   creditors, placement batches, desks, queues, owner type, RPV config,
//   legal/litigation/judgment/dispute/bankruptcy flags, tags, statuses,
//   payment posting. Imported payment fields below are historical reference.
// ─────────────────────────────────────────────────────────────────────────────

type SystemField = {
  key: string;
  label: string;
  group: FieldGroup;
  required?: boolean;
  notes?: string;
};

type FieldGroup =
  | "File"
  | "Creditor"
  | "Assignment"
  | "Debtor"
  | "Co-Debtor"
  | "Financial"
  | "Payments"
  | "Communication"
  | "Vehicle"
  | "Court";

const SYSTEM_FIELDS: SystemField[] = [
  // File / Reference — at least one of (our_file_no, client_file_no) required
  { key: "our_file_no", label: "Our File No.", group: "File", notes: "Internal file/reference (required if Client File No. is blank)" },
  { key: "client_file_no", label: "Client File No.", group: "File", required: true, notes: "Client-side account reference" },
  { key: "old_counsel_file_no", label: "Old Counsel File No.", group: "File" },
  { key: "old_counsel_name", label: "Old Counsel Name", group: "File" },

  // Creditor / Client — at least one of (creditor_name, creditor_number) required
  { key: "creditor_name", label: "Creditor Name", group: "Creditor", required: true },
  { key: "creditor_number", label: "Creditor Number", group: "Creditor" },
  { key: "client_name", label: "Client Name", group: "Creditor" },
  { key: "client_number", label: "Client Number", group: "Creditor" },

  // Assignment (optional — blanks become Unassigned)
  { key: "assigned_agent_name", label: "Assigned Agent Name", group: "Assignment" },
  { key: "assigned_agent_email", label: "Assigned Agent Email / ID", group: "Assignment", notes: "Preferred over name when available" },
  { key: "assigned_team", label: "Assigned Team", group: "Assignment" },

  // Primary debtor
  { key: "debtor_name", label: "Debtor Name", group: "Debtor", required: true },
  { key: "address", label: "Address", group: "Debtor" },
  { key: "city", label: "City", group: "Debtor" },
  { key: "province", label: "Province", group: "Debtor" },
  { key: "postal_code", label: "Postal Code", group: "Debtor" },
  { key: "home_no", label: "Home No.", group: "Debtor" },
  { key: "cell_no", label: "Cell No.", group: "Debtor" },
  { key: "email", label: "Email", group: "Debtor" },
  { key: "dob", label: "DOB", group: "Debtor", notes: "Sensitive — masked at rest" },
  { key: "sin", label: "SIN", group: "Debtor", notes: "Sensitive — masked / permission-gated" },
  { key: "dl", label: "DL", group: "Debtor", notes: "Sensitive — masked / permission-gated" },
  { key: "poe", label: "POE", group: "Debtor" },
  { key: "poe_no", label: "POE No.", group: "Debtor" },

  // Co-debtor
  { key: "co_debtor_name", label: "Co-Debtor Name", group: "Co-Debtor" },
  { key: "co_address", label: "Co-Debtor Address", group: "Co-Debtor" },
  { key: "co_city", label: "Co-Debtor City", group: "Co-Debtor" },
  { key: "co_province", label: "Co-Debtor Province", group: "Co-Debtor" },
  { key: "co_postal_code", label: "Co-Debtor Postal Code", group: "Co-Debtor" },
  { key: "co_home_no", label: "Co-Debtor Home No.", group: "Co-Debtor" },
  { key: "co_cell_no", label: "Co-Debtor Cell No.", group: "Co-Debtor" },
  { key: "co_email", label: "Co-Debtor Email", group: "Co-Debtor" },
  { key: "co_dob", label: "Co-Debtor DOB", group: "Co-Debtor" },
  { key: "co_sin", label: "Co-Debtor SIN", group: "Co-Debtor" },
  { key: "co_dl", label: "Co-Debtor DL", group: "Co-Debtor" },
  { key: "co_poe", label: "Co-Debtor POE", group: "Co-Debtor" },
  { key: "co_poe_no", label: "Co-Debtor POE No.", group: "Co-Debtor" },

  // Financial / balance
  { key: "principal", label: "Principal", group: "Financial", required: true, notes: "Required if Current Outstanding Balance is blank" },
  { key: "current_principal_balance", label: "Current Principal Balance", group: "Financial" },
  { key: "accrued_interest_before_assignment", label: "Accrued Interest Before Assignment", group: "Financial" },
  { key: "interest_rate", label: "Interest Rate", group: "Financial" },
  { key: "interest_type", label: "Interest Type", group: "Financial", notes: "Simple / Compound / None / Client Provided Only (required if Interest Rate set)" },
  { key: "compounding_frequency", label: "Compounding Frequency", group: "Financial", notes: "Daily / Monthly / Quarterly / Semi-Annual / Annual / Not Applicable (required if Compound)" },
  { key: "interest_start_date", label: "Interest Start Date", group: "Financial" },
  { key: "current_outstanding_balance", label: "Current Outstanding Balance", group: "Financial" },
  { key: "currency", label: "Currency", group: "Financial", notes: "e.g. CAD / USD" },

  // Payment history (reference only — posting handled in-platform)
  { key: "date_of_last_payment", label: "Date of Last Payment", group: "Payments" },
  { key: "last_payment_amount", label: "Last Payment Amount", group: "Payments" },
  { key: "last_payment_method", label: "Last Payment Method", group: "Payments" },
  { key: "last_payment_reference_number", label: "Last Payment Reference Number", group: "Payments" },
  { key: "total_paid_to_date", label: "Total Paid to Date", group: "Payments" },

  // Communication preferences (compliance / AI guard rails)
  { key: "preferred_contact_method", label: "Preferred Contact Method", group: "Communication", notes: "Phone / SMS / Email / Mail" },
  { key: "preferred_language", label: "Preferred Language", group: "Communication" },
  { key: "do_not_call", label: "Do Not Call", group: "Communication", notes: "Yes / No" },
  { key: "do_not_email", label: "Do Not Email", group: "Communication", notes: "Yes / No" },
  { key: "do_not_sms", label: "Do Not SMS", group: "Communication", notes: "Yes / No" },

  // Vehicle / asset
  { key: "vin", label: "VIN", group: "Vehicle" },

  // Court / courthouse
  { key: "court_file_no", label: "Court File No.", group: "Court" },
  { key: "courthouse", label: "Courthouse", group: "Court" },
  { key: "courthouse_address", label: "Courthouse Address", group: "Court" },
  { key: "courthouse_city", label: "Courthouse City", group: "Court" },
  { key: "courthouse_province", label: "Courthouse Province", group: "Court" },
  { key: "courthouse_postal_code", label: "Courthouse Postal Code", group: "Court" },
];

const FIELD_GROUP_ORDER: FieldGroup[] = [
  "File", "Creditor", "Assignment", "Debtor", "Co-Debtor",
  "Financial", "Payments", "Communication", "Vehicle", "Court",
];

const SAMPLE_HEADERS = SYSTEM_FIELDS.map((f) => f.key);

const SAMPLE_ROW_1: Record<string, string> = {
  our_file_no: "CTX-2026-0001", client_file_no: "RBC-447821",
  old_counsel_file_no: "", old_counsel_name: "",
  creditor_name: "RBC", creditor_number: "RBC-001", client_name: "RBC Recovery", client_number: "CL-100",
  assigned_agent_name: "Maya Lindstrom", assigned_agent_email: "maya@collectrix.app", assigned_team: "Consumer Recovery",
  debtor_name: "Chen, Margaret", address: "12 King St W, Suite 400", city: "Toronto", province: "ON", postal_code: "M5H 1A1",
  home_no: "+14165550199", cell_no: "+14165550101", email: "margaret.chen@example.com",
  dob: "1981-04-12", sin: "046-454-286", dl: "C1234-56789-01234", poe: "Shopify Inc.", poe_no: "+14165550150",
  co_debtor_name: "", co_address: "", co_city: "", co_province: "", co_postal_code: "",
  co_home_no: "", co_cell_no: "", co_email: "", co_dob: "", co_sin: "", co_dl: "", co_poe: "", co_poe_no: "",
  principal: "8000.00", current_principal_balance: "7600.00", accrued_interest_before_assignment: "420.12",
  interest_rate: "19.99", interest_type: "Compound", compounding_frequency: "Monthly",
  interest_start_date: "2025-11-04", current_outstanding_balance: "8420.12", currency: "CAD",
  date_of_last_payment: "2025-10-22", last_payment_amount: "250.00", last_payment_method: "EFT",
  last_payment_reference_number: "PMT-998812", total_paid_to_date: "1250.00",
  preferred_contact_method: "Email", preferred_language: "EN",
  do_not_call: "No", do_not_email: "No", do_not_sms: "No",
  vin: "",
  court_file_no: "", courthouse: "", courthouse_address: "", courthouse_city: "", courthouse_province: "", courthouse_postal_code: "",
};

const SAMPLE_ROW_2: Record<string, string> = {
  ...Object.fromEntries(SAMPLE_HEADERS.map((k) => [k, ""])),
  client_file_no: "TD-99214",
  creditor_name: "TD Bank", creditor_number: "TD-002",
  debtor_name: "O'Connor, Daniel", address: "88 Yonge St", city: "Toronto", province: "ON", postal_code: "M5E 1J9",
  cell_no: "+14165550102", email: "daniel@example.com",
  dob: "1975-09-30", poe: "Royal Bank",
  co_debtor_name: "O'Connor, Erin", co_email: "erin@example.com", co_cell_no: "+14165550103",
  principal: "1200.00", current_outstanding_balance: "1240.50",
  interest_rate: "9.99", interest_type: "Simple", compounding_frequency: "Not Applicable",
  currency: "CAD",
  date_of_last_payment: "2025-11-15", last_payment_amount: "60.00", last_payment_method: "Card",
  preferred_contact_method: "Phone", preferred_language: "EN",
  do_not_call: "No", do_not_email: "No", do_not_sms: "Yes",
};

const SAMPLE_ROW_3: Record<string, string> = {
  ...Object.fromEntries(SAMPLE_HEADERS.map((k) => [k, ""])),
  our_file_no: "CTX-2026-0047", client_file_no: "SCO-22041",
  creditor_name: "Scotiabank", creditor_number: "SCO-003",
  assigned_team: "Auto Recovery",
  debtor_name: "Ramirez, Aisha", address: "44 Spadina Ave", city: "Toronto", province: "ON", postal_code: "M5V 2H1",
  cell_no: "+16475550144", email: "aisha.r@example.com",
  dob: "1989-07-21", poe: "Telus",
  principal: "13500.00", current_principal_balance: "13500.00", accrued_interest_before_assignment: "780.90",
  interest_rate: "6.49", interest_type: "Compound", compounding_frequency: "Annual",
  interest_start_date: "2024-08-12", current_outstanding_balance: "14280.90", currency: "CAD",
  date_of_last_payment: "2024-07-30", last_payment_amount: "420.00", last_payment_method: "EFT",
  total_paid_to_date: "4200.00",
  preferred_contact_method: "Mail", preferred_language: "EN",
  do_not_call: "Yes", do_not_email: "No", do_not_sms: "Yes",
  vin: "1HGCM82633A123456",
  court_file_no: "CV-25-00012345", courthouse: "Ontario Superior Court of Justice",
  courthouse_address: "330 University Ave", courthouse_city: "Toronto",
  courthouse_province: "ON", courthouse_postal_code: "M5G 1R7",
};

const SAMPLE_ROWS: string[][] = [SAMPLE_ROW_1, SAMPLE_ROW_2, SAMPLE_ROW_3].map((r) =>
  SAMPLE_HEADERS.map((k) => r[k] ?? ""),
);

// ─────────────────────────────────────────────────────────────────────────────
// Saved mapping templates (scoped per tenant, stored client-side for now)
// ─────────────────────────────────────────────────────────────────────────────
type MappingTemplate = { id: string; name: string; mapping: Record<string, string>; savedAt: number };

function loadMappingTemplates(): MappingTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_MAPPING_TEMPLATES);
    return raw ? (JSON.parse(raw) as MappingTemplate[]) : [];
  } catch { return []; }
}

function saveMappingTemplates(list: MappingTemplate[]) {
  try { localStorage.setItem(LS_MAPPING_TEMPLATES, JSON.stringify(list)); } catch { /* noop */ }
}

// Auto-match incoming columns to system fields by normalising both sides.
function normaliseHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function autoMapColumns(incoming: string[]): Record<string, string> {
  // returns: systemFieldKey -> incoming column name
  const map: Record<string, string> = {};
  const normIncoming = incoming.map((h) => ({ raw: h, norm: normaliseHeader(h) }));
  for (const f of SYSTEM_FIELDS) {
    const target = normaliseHeader(f.key);
    const targetLabel = normaliseHeader(f.label);
    const hit = normIncoming.find((h) => h.norm === target || h.norm === targetLabel);
    if (hit) map[f.key] = hit.raw;
  }
  return map;
}

function downloadSampleCsv() {
  const csv = [SAMPLE_HEADERS.join(","), ...SAMPLE_ROWS.map((r) => r.map((c) => csvEscape(c)).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "debtor_import_sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type RowError = { row: number; column: string; reason: string; debtorId?: string; debtorName?: string; status?: "imported_with_warning" | "blocked" | "skipped_duplicate" };

function csvEscape(v: string | number | undefined): string {
  const s = v === undefined || v === null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadErrorReport(ctx: { fileName: string; creditor: string; errors: RowError[] }) {
  const { fileName, creditor, errors } = ctx;
  // Merge in any persisted validation issues recorded for this file so the
  // export reflects the latest state (fixed / ignored / pending).
  const persisted = getValidationIssues().filter((i) => i.fileName === fileName);
  const persistedKey = (i: { rowNumber: number; field: string }) => `${i.rowNumber}|${i.field}`;
  const persistedMap = new Map(persisted.map((i) => [persistedKey(i), i]));

  const header = ["file", "creditor", "row", "debtor_id", "debtor_name", "field", "issue_reason", "status"];
  const lines: string[] = [header.join(",")];

  // Rows from the current upload's error list
  const seen = new Set<string>();
  for (const e of errors) {
    const key = `${e.row}|${e.column}`;
    seen.add(key);
    const match = persistedMap.get(key);
    const status = match?.status ?? e.status ?? (/BLOCKED/i.test(e.reason) ? "blocked" : /[Dd]uplicate/.test(e.reason) ? "skipped_duplicate" : "imported_with_warning");
    lines.push([
      csvEscape(fileName),
      csvEscape(creditor),
      e.row,
      csvEscape(match?.debtorId ?? e.debtorId ?? ""),
      csvEscape(match?.debtorName ?? e.debtorName ?? ""),
      csvEscape(e.column),
      csvEscape(e.reason),
      csvEscape(status),
    ].join(","));
  }

  // Include any additional persisted issues for this file not already listed
  for (const i of persisted) {
    if (seen.has(persistedKey(i))) continue;
    lines.push([
      csvEscape(i.fileName),
      csvEscape(i.creditor),
      i.rowNumber,
      csvEscape(i.debtorId),
      csvEscape(i.debtorName),
      csvEscape(i.field),
      csvEscape(i.reason),
      csvEscape(i.status),
    ].join(","));
  }

  if (lines.length === 1) {
    lines.push([csvEscape(fileName), csvEscape(creditor), "", "", "", "", "No errors detected", "ok"].join(","));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = fileName.replace(/\.[^.]+$/, "") || "import";
  a.download = `${safeName}_error_report.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function loadCreditors(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_CREDITORS);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* noop */ }
  return ["Acme Bank", "Northern Credit Union", "Pacific Telecom"];
}

function saveCreditors(list: string[]) {
  try { localStorage.setItem(LS_CREDITORS, JSON.stringify(list)); } catch { /* noop */ }
}

function ImportPage() {
  const [showWizard, setShowWizard] = useState(false);
  return (
    <Shell>
      <Topbar
        title="Upload & Validate"
        subtitle="Bulk import debtor creditors from CSV or Excel"
        action={
          <button onClick={() => setShowWizard(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
            <Upload className="h-4 w-4" /> New import
          </button>
        }
      />

      <section className="px-6 lg:px-10 py-6">
        <PageCard>
          <CardHead title="Recent imports" subtitle="Last 30 days" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold">File</th>
                  <th className="text-left px-3 py-3 font-semibold">Creditor</th>
                  <th className="text-left px-3 py-3 font-semibold">Rows</th>
                  <th className="text-left px-3 py-3 font-semibold">Imported</th>
                  <th className="text-left px-3 py-3 font-semibold">Skipped</th>
                  <th className="text-left px-3 py-3 font-semibold">Errors</th>
                  <th className="text-left px-3 py-3 font-semibold">Started</th>
                  <th className="text-left px-3 py-3 font-semibold">Duration</th>
                  <th className="text-left px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {importJobs.map((j) => (
                  <tr key={j.id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="px-6 py-3 font-mono text-xs truncate max-w-[280px]">{j.filename}</td>
                    <td className="px-3 py-3 text-muted-foreground">{j.template}</td>
                    <td className="px-3 py-3 font-mono text-xs">{j.rows.toLocaleString()}</td>
                    <td className="px-3 py-3 font-mono text-xs text-success">{j.imported.toLocaleString()}</td>
                    <td className="px-3 py-3 font-mono text-xs text-warning">{j.skipped}</td>
                    <td className="px-3 py-3 font-mono text-xs text-destructive">{j.errors}</td>
                    <td className="px-3 py-3 text-muted-foreground">{j.startedAt}</td>
                    <td className="px-3 py-3 font-mono text-xs">{j.duration}</td>
                    <td className="px-6 py-3"><Pill tone={j.status === "completed" ? "success" : j.status === "running" ? "info" : j.status === "failed" ? "danger" : "warning"}>{j.status}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageCard>
      </section>

      <section className="px-6 lg:px-10 pb-10">
        <ValidationIssuesSection />
      </section>

      {showWizard && <ImportWizard onClose={() => setShowWizard(false)} />}
    </Shell>
  );
}

function ImportWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [creditors, setCreditors] = useState<string[]>(() => loadCreditors());
  const [creditor, setCreditor] = useState<string>(creditors[0] ?? "");
  const [client, setClient] = useState("");
  const [owner, setOwner] = useState("");
  const [team, setTeam] = useState("");
  const [manager, setManager] = useState("");
  const managerCandidates = useMemo(
    () => tenantUsers.filter((u) => u.roles.some((r) => /supervisor|manager|administrator/i.test(r))),
    [],
  );
  const [newCreditorMode, setNewCreditorMode] = useState(false);
  const [newCreditorName, setNewCreditorName] = useState("");
  const [filename, setFilename] = useState("");
  const [validating, setValidating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Mapping step state
  const [incomingColumns, setIncomingColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}); // systemKey -> incoming header
  const [templates, setTemplates] = useState<MappingTemplate[]>(() => loadMappingTemplates());
  const [activeTemplateId, setActiveTemplateId] = useState<string>("");
  const [newTemplateName, setNewTemplateName] = useState("");

  // Expanded summary aligned with the new validation spec
  const summary = useMemo(() => ({
    totalUploaded: 4820,
    valid: 4678,
    imported: 4814,
    withWarnings: 142,
    criticalErrors: 6,
    duplicates: 16,
    assigned: 4734,
    unassigned: 80,
    missingContact: 23,
    financialMismatch: 11,
  }), []);

  const errors: RowError[] = useMemo(() => ([
    { row: 47, column: "cell_no", reason: "Invalid format: 'see notes' — imported, email kept" },
    { row: 102, column: "postal_code", reason: "Invalid Canadian postal: 'A1B' — imported" },
    { row: 188, column: "email", reason: "Invalid email: 'maria@@gmail' — imported, phone kept" },
    { row: 314, column: "current_outstanding_balance", reason: "Cannot parse '$N/A' — defaulted to 0, imported" },
    { row: 421, column: "compounding_frequency", reason: "Interest type is Compound but compounding frequency is blank — imported, flagged" },
    { row: 502, column: "debtor_name", reason: "Missing debtor name AND no contact — BLOCKED" },
    { row: 612, column: "assigned_agent_email", reason: "Agent email does not match an active tenant user — sent to Unassigned" },
    { row: 891, column: "client_file_no", reason: "Duplicate of row 119 — skipped" },
  ]), []);

  const startValidation = () => {
    setValidating(true);
    setTimeout(() => { setValidating(false); setStep(3); }, 900);
  };

  const addCreditor = () => {
    const name = newCreditorName.trim();
    if (!name) return toast.error("Enter a creditor name");
    if (creditors.some((c) => c.toLowerCase() === name.toLowerCase())) return toast.error("Creditor already exists");
    const next = [...creditors, name];
    setCreditors(next);
    saveCreditors(next);
    setCreditor(name);
    setNewCreditorName("");
    setNewCreditorMode(false);
    toast.success(`Added creditor: ${name}`);
  };

  const goNextFromStep1 = () => {
    if (!creditor) return toast.error("Select or create a creditor");
    if (!owner) return toast.error("Select an owner");
    if (!team) return toast.error("Select a team");
    if (!manager) return toast.error("Select a manager");
    if (!filename) return toast.error("Choose a CSV file to upload");
    // Simulate parsing headers from the uploaded file. In practice this would
    // read the first row of the CSV/XLSX. For demo we use the sample headers,
    // lightly shuffled to mimic a tenant's own column names.
    const fakeIncoming = SAMPLE_HEADERS.map((k) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
    setIncomingColumns(fakeIncoming);
    setMapping((prev) => (Object.keys(prev).length ? prev : autoMapColumns(fakeIncoming)));
    setStep(2);
  };

  const applyTemplate = (id: string) => {
    setActiveTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    // Only keep mappings whose incoming column still exists in the file
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(t.mapping)) {
      if (incomingColumns.includes(v)) filtered[k] = v;
    }
    setMapping(filtered);
    toast.success(`Loaded mapping: ${t.name}`);
  };

  const saveTemplate = () => {
    const name = newTemplateName.trim();
    if (!name) return toast.error("Enter a template name");
    const t: MappingTemplate = { id: `tpl_${Date.now().toString(36)}`, name, mapping, savedAt: Date.now() };
    const next = [...templates.filter((x) => x.name.toLowerCase() !== name.toLowerCase()), t];
    setTemplates(next);
    saveMappingTemplates(next);
    setActiveTemplateId(t.id);
    setNewTemplateName("");
    toast.success(`Saved mapping template: ${name}`);
  };

  const requiredKeys = SYSTEM_FIELDS.filter((f) => f.required).map((f) => f.key);
  const missingRequired = requiredKeys.filter((k) => !mapping[k]);
  // Conditional: at least one of (our_file_no, client_file_no)
  const hasEitherFileNo = !!mapping.our_file_no || !!mapping.client_file_no;
  // Conditional: at least one of (creditor_name, creditor_number)
  const hasEitherCreditor = !!mapping.creditor_name || !!mapping.creditor_number;
  // Conditional: at least one of (principal, current_outstanding_balance)
  const hasEitherBalance = !!mapping.principal || !!mapping.current_outstanding_balance;

  const goNextFromStep2 = () => {
    if (missingRequired.length) {
      return toast.error(`Map required fields: ${missingRequired.join(", ")}`);
    }
    if (!hasEitherFileNo) return toast.error("Map at least one of Our File No. or Client File No.");
    if (!hasEitherCreditor) return toast.error("Map at least one of Creditor Name or Creditor Number");
    if (!hasEitherBalance) return toast.error("Map at least one of Principal or Current Outstanding Balance");
    startValidation();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-elegant w-full max-w-4xl max-h-[90vh] flex flex-col border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-display text-lg font-bold">Bulk import debtors</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <Stepper step={step} />

        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm">
          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Creditor */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Creditor <span className="text-destructive">*</span>
                  </label>
                  {!newCreditorMode ? (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Building2 className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <select value={creditor} onChange={(e) => setCreditor(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background">
                          {creditors.length === 0 && <option value="">No creditors yet</option>}
                          {creditors.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <button onClick={() => setNewCreditorMode(true)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted whitespace-nowrap">
                        <Plus className="h-3.5 w-3.5" /> New
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={newCreditorName}
                        onChange={(e) => setNewCreditorName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCreditor()}
                        placeholder="Type new creditor name…"
                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-background"
                      />
                      <button onClick={addCreditor} className="px-3 py-2 rounded-lg bg-gradient-tenant text-white text-xs font-semibold">Add</button>
                      <button onClick={() => { setNewCreditorMode(false); setNewCreditorName(""); }} className="px-3 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted">Cancel</button>
                    </div>
                  )}
                </div>

                {/* Client (optional) */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Client / Creditor Owner
                  </label>
                  <input
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    placeholder="Optional — defaults to creditor"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  />
                </div>
              </div>

              {/* Assignment — choose before upload */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assignment</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Owner <span className="text-destructive">*</span>
                    </label>
                    <select value={owner} onChange={(e) => setOwner(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                      <option value="">Select owner…</option>
                      {tenantUsers.filter((u) => u.status === "active").map((u) => (
                        <option key={u.id} value={u.fullName}>{u.fullName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Team <span className="text-destructive">*</span>
                    </label>
                    <select value={team} onChange={(e) => setTeam(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                      <option value="">Select team…</option>
                      {teams.filter((t) => t.status === "active").map((t) => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Manager <span className="text-destructive">*</span>
                    </label>
                    <select value={manager} onChange={(e) => setManager(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                      <option value="">Select manager…</option>
                      {managerCandidates.map((u) => (
                        <option key={u.id} value={u.fullName}>{u.fullName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground">All records in this file will be assigned to this owner, team and manager. You can reassign individual debtors later.</div>
              </div>



              {/* Sample CSV */}
              <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-tenant/10 text-tenant flex items-center justify-center"><Download className="h-4 w-4" /></div>
                <div className="flex-1">
                  <div className="font-semibold">Need the expected format?</div>
                  <div className="text-xs text-muted-foreground">Includes all {SYSTEM_FIELDS.length} system fields across {FIELD_GROUP_ORDER.length} sections. You can still map your own column names in the next step.</div>
                </div>
                <button onClick={downloadSampleCsv} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold hover:bg-muted whitespace-nowrap">
                  <Download className="h-3.5 w-3.5" /> Download sample
                </button>
              </div>

              {/* Upload */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Upload CSV / XLSX <span className="text-destructive">*</span>
                </label>
                <label className="rounded-xl border-2 border-dashed border-border hover:border-tenant transition cursor-pointer flex flex-col items-center justify-center px-6 py-10 text-center">
                  <FileSpreadsheet className="h-10 w-10 text-tenant mb-3" />
                  <div className="font-semibold">{filename || "Drop file or click to browse"}</div>
                  <div className="text-xs text-muted-foreground mt-1">.csv, .xlsx, .xls, .tsv up to 100MB</div>
                  <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.tsv" className="hidden" onChange={(e) => setFilename(e.target.files?.[0]?.name || "")} />
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <FieldMappingStep
              incomingColumns={incomingColumns}
              mapping={mapping}
              setMapping={setMapping}
              templates={templates}
              activeTemplateId={activeTemplateId}
              applyTemplate={applyTemplate}
              newTemplateName={newTemplateName}
              setNewTemplateName={setNewTemplateName}
              saveTemplate={saveTemplate}
              missingRequired={missingRequired}
              hasEitherFileNo={hasEitherFileNo}
              hasEitherCreditor={hasEitherCreditor}
              hasEitherBalance={hasEitherBalance}
            />
          )}

          {step === 3 && validating && (
            <div className="text-center py-10">
              <div className="h-12 w-12 mx-auto rounded-full border-4 border-tenant border-t-transparent animate-spin mb-4" />
              <div className="font-semibold">Validating rows…</div>
              <div className="text-xs text-muted-foreground mt-1">Required fields · contact format · financial · duplicates · assignment</div>
            </div>
          )}

          {step === 3 && !validating && (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Validation summary</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Total Records" value={summary.totalUploaded.toLocaleString()} tone="default" />
                  <Stat label="Valid Records" value={summary.valid.toLocaleString()} tone="success" />
                  <Stat label="Critical Issues" value={summary.criticalErrors.toString()} tone="warning" />
                  <Stat label="Warnings" value={summary.withWarnings.toLocaleString()} tone="warning" />
                  <Stat label="Duplicates" value={summary.duplicates.toString()} tone="warning" />
                  <Stat label="Unassigned" value={summary.unassigned.toString()} tone="warning" />
                  <Stat label="Missing Contact" value={summary.missingContact.toString()} tone="warning" />
                  <Stat label="Financial Mismatch" value={summary.financialMismatch.toString()} tone="warning" />
                </div>
              </div>

              <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <div className="font-semibold text-foreground">Upload completed with assignment issues</div>
                    <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                      <li>· <span className="font-mono text-foreground">{summary.totalUploaded.toLocaleString()}</span> records uploaded</li>
                      <li>· <span className="font-mono text-success">{summary.assigned.toLocaleString()}</span> assigned successfully</li>
                      <li>· <span className="font-mono text-warning">{summary.unassigned.toLocaleString()}</span> records missing owner / team</li>
                      <li>· Unassigned records are filterable in the debtor listing.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border">
                <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Issues (row · field · severity · suggested fix)</div>
                  <button onClick={() => downloadErrorReport({ fileName: filename, creditor, errors })} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-[11px] font-semibold hover:bg-muted">
                    <Download className="h-3 w-3" /> Error report
                  </button>
                </div>
                <ul className="divide-y divide-border text-xs">
                  {errors.map((e) => {
                    const blocked = /BLOCKED/i.test(e.reason);
                    return (
                      <li key={`${e.row}-${e.column}`} className="px-4 py-2 grid grid-cols-12 items-center gap-2">
                        <span className="font-mono col-span-1">row {e.row}</span>
                        <span className="text-muted-foreground col-span-2 truncate">{e.column}</span>
                        <span className="col-span-1">
                          <Pill tone={blocked ? "danger" : "warning"}>{blocked ? "Critical" : "Warning"}</Pill>
                        </span>
                        <span className="col-span-6 truncate">{e.reason}</span>
                        <span className="col-span-2 text-right">
                          <button className="text-tenant hover:underline text-[11px]">Fix</button>
                          <span className="mx-1 text-muted-foreground">·</span>
                          <button className="text-muted-foreground hover:underline text-[11px]">Ignore</button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{summary.imported.toLocaleString()}</span> records will be imported under <span className="font-semibold text-foreground">{creditor}</span> ({summary.withWarnings} with field warnings). Only {summary.criticalErrors} records are blocked.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-10">
              <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
              <div className="font-display text-lg font-bold">Import complete</div>
              <div className="text-sm text-muted-foreground mt-2">
                {summary.imported.toLocaleString()} debtors imported under <span className="font-semibold text-foreground">{creditor}</span> · {summary.withWarnings} with warnings · {summary.criticalErrors} blocked
              </div>
              <div className="text-xs text-muted-foreground mt-1">Job ID: job_{Date.now().toString(36)}</div>
              <button onClick={() => downloadErrorReport({ fileName: filename, creditor, errors })} className="mt-5 inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted">
                <Download className="h-3.5 w-3.5" /> Download import report
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-between">
          <button onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))} disabled={step === 1 || step === 4 || validating} className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted disabled:opacity-40">Back</button>
          {step === 1 && <button onClick={goNextFromStep1} className="px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">Continue</button>}
          {step === 2 && <button onClick={goNextFromStep2} className="px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">Validate file</button>}
          {step === 3 && !validating && <button onClick={() => { setStep(4); toast.success(`Imported ${summary.imported.toLocaleString()} rows (${summary.withWarnings} with warnings)`); }} className="px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">Import {summary.imported.toLocaleString()} valid records</button>}
          {step === 4 && <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">Done</button>}
        </div>
      </div>
    </div>
  );
}

function FieldMappingStep(props: {
  incomingColumns: string[];
  mapping: Record<string, string>;
  setMapping: Dispatch<SetStateAction<Record<string, string>>>;
  templates: MappingTemplate[];
  activeTemplateId: string;
  applyTemplate: (id: string) => void;
  newTemplateName: string;
  setNewTemplateName: (s: string) => void;
  saveTemplate: () => void;
  missingRequired: string[];
  hasEitherFileNo: boolean;
  hasEitherCreditor: boolean;
  hasEitherBalance: boolean;
}) {
  const { incomingColumns, mapping, setMapping, templates, activeTemplateId, applyTemplate,
    newTemplateName, setNewTemplateName, saveTemplate,
    missingRequired, hasEitherFileNo, hasEitherCreditor, hasEitherBalance } = props;

  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const requiredOk = missingRequired.length === 0 && hasEitherFileNo && hasEitherCreditor && hasEitherBalance;

  return (
    <div className="space-y-4">
      {/* Template + auto-map controls */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
        <select
          value={activeTemplateId}
          onChange={(e) => applyTemplate(e.target.value)}
          className="px-2 py-1.5 rounded-md border border-border bg-background text-xs"
        >
          <option value="">— Load saved mapping —</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button
          onClick={() => setMapping(autoMapColumns(incomingColumns))}
          className="px-2.5 py-1.5 rounded-md border border-border bg-background text-xs font-semibold hover:bg-muted"
        >
          Auto-map columns
        </button>
        <button
          onClick={() => setMapping({})}
          className="px-2.5 py-1.5 rounded-md border border-border bg-background text-xs font-semibold hover:bg-muted"
        >
          Clear
        </button>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="Template name…"
            className="px-2 py-1.5 rounded-md border border-border bg-background text-xs w-40"
          />
          <button onClick={saveTemplate} className="px-2.5 py-1.5 rounded-md bg-gradient-tenant text-white text-xs font-semibold shadow-tenant">Save mapping</button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{mappedCount}</span> of {SYSTEM_FIELDS.length} fields mapped ·
        <span className={requiredOk ? "text-success ml-1" : "text-warning ml-1"}>
          {requiredOk ? "all required fields satisfied" : "required fields missing"}
        </span>
      </div>

      {FIELD_GROUP_ORDER.map((group) => {
        const fields = SYSTEM_FIELDS.filter((f) => f.group === group);
        return (
          <div key={group} className="rounded-lg border border-border">
            <div className="px-4 py-2 border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{group}</div>
            <div className="divide-y divide-border">
              {fields.map((f) => {
                const value = mapping[f.key] ?? "";
                const isRequired = f.required;
                const conditionalUnmet =
                  (f.key === "our_file_no" && !hasEitherFileNo && !value) ||
                  (f.key === "client_file_no" && !hasEitherFileNo && !value) ||
                  (f.key === "creditor_name" && !hasEitherCreditor && !value) ||
                  (f.key === "creditor_number" && !hasEitherCreditor && !value) ||
                  (f.key === "principal" && !hasEitherBalance && !value) ||
                  (f.key === "current_outstanding_balance" && !hasEitherBalance && !value);
                const missing = (isRequired && !value) || conditionalUnmet;
                return (
                  <div key={f.key} className="px-4 py-2 grid grid-cols-12 gap-2 items-center text-xs">
                    <div className="col-span-5 min-w-0">
                      <div className="font-semibold flex items-center gap-1">
                        <span className="truncate">{f.label}</span>
                        {isRequired && <span className="text-destructive">*</span>}
                      </div>
                      {f.notes && <div className="text-muted-foreground text-[11px] truncate">{f.notes}</div>}
                    </div>
                    <div className="col-span-5">
                      <select
                        value={value}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        className={`w-full px-2 py-1.5 rounded-md border bg-background ${missing ? "border-warning" : "border-border"}`}
                      >
                        <option value="">— Not mapped —</option>
                        {incomingColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2 text-right">
                      {value ? <Pill tone="success">Mapped</Pill> : missing ? <Pill tone="warning">Missing</Pill> : <Pill tone="muted">Optional</Pill>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 | 4 }) {
  const items = [
    { n: 1, l: "Upload & creditor" },
    { n: 2, l: "Map fields" },
    { n: 3, l: "Validate & review" },
    { n: 4, l: "Import" },
  ];
  return (
    <div className="px-6 py-3 border-b border-border flex items-center gap-2 text-xs">
      {items.map((it, i) => (
        <div key={it.n} className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center font-semibold ${step >= it.n ? "bg-tenant text-white" : "bg-muted text-muted-foreground"}`}>{it.n}</div>
          <span className={step >= it.n ? "font-semibold" : "text-muted-foreground"}>{it.l}</span>
          {i < items.length - 1 && <span className="mx-1 text-muted-foreground">→</span>}
        </div>
      ))}
    </div>
  );
}



function Stat({ label, value, tone }: { label: string; value: string; tone: "default" | "success" | "warning" }) {
  const c = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-bold mt-1 ${c}`}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Issues / Import Error Log
// ─────────────────────────────────────────────────────────────────────────────

function ValidationIssuesSection() {
  const issues = useValidationIssues();
  const [filter, setFilter] = useState<"all" | "pending" | "fixed" | "ignored">("pending");
  const filtered = filter === "all" ? issues : issues.filter((i) => i.status === filter);

  const downloadCsv = () => {
    const header = "file,creditor,row,debtor,field,reason,status";
    const rows = issues.map((i) =>
      `"${i.fileName}","${i.creditor}",${i.rowNumber},"${i.debtorName}","${i.field}","${i.reason.replace(/"/g, '""')}","${i.status}"`,
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "validation_issues.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageCard>
      <CardHead
        title="Validation Issues"
        subtitle="Field-level warnings from recent imports. Records are imported with usable data; only critical errors are blocked."
        action={
          <div className="flex items-center gap-2">
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="px-2 py-1.5 rounded-md border border-border bg-background text-xs">
              <option value="pending">Pending Review</option>
              <option value="fixed">Fixed</option>
              <option value="ignored">Ignored</option>
              <option value="all">All</option>
            </select>
            <button onClick={downloadCsv} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted">
              <Download className="h-3 w-3" /> Export
            </button>
          </div>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left px-6 py-3 font-semibold">File</th>
              <th className="text-left px-3 py-3 font-semibold">Creditor</th>
              <th className="text-left px-3 py-3 font-semibold">Row</th>
              <th className="text-left px-3 py-3 font-semibold">Debtor</th>
              <th className="text-left px-3 py-3 font-semibold">Field</th>
              <th className="text-left px-3 py-3 font-semibold">Reason</th>
              <th className="text-left px-3 py-3 font-semibold">Status</th>
              <th className="text-left px-6 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-6 py-10 text-center text-muted-foreground text-sm">No issues match this filter.</td></tr>
            )}
            {filtered.map((i) => <IssueRow key={i.id} issue={i} />)}
          </tbody>
        </table>
      </div>
    </PageCard>
  );
}

function IssueRow({ issue: i }: { issue: ValidationIssue }) {
  const tone: "warning" | "success" | "muted" = i.status === "pending" ? "warning" : i.status === "fixed" ? "success" : "muted";
  return (
    <tr className="border-b border-border/60 hover:bg-muted/30">
      <td className="px-6 py-3 font-mono text-xs truncate max-w-[220px]">{i.fileName}</td>
      <td className="px-3 py-3 text-muted-foreground">{i.creditor}</td>
      <td className="px-3 py-3 font-mono text-xs">{i.rowNumber}</td>
      <td className="px-3 py-3">
        <Link to="/tenant/debtors/$debtorId" params={{ debtorId: i.debtorId }} className="text-tenant hover:underline">{i.debtorName}</Link>
      </td>
      <td className="px-3 py-3 font-mono text-xs">{i.field}</td>
      <td className="px-3 py-3 text-muted-foreground max-w-[320px]">{i.reason}</td>
      <td className="px-3 py-3"><Pill tone={tone}>{i.status === "pending" ? "Pending Review" : i.status === "fixed" ? "Fixed" : "Ignored"}</Pill></td>
      <td className="px-6 py-3">
        <div className="flex items-center gap-1">
          <Link to="/tenant/debtors/$debtorId" params={{ debtorId: i.debtorId }} className="p-1.5 rounded border border-border hover:bg-muted" title="View">
            <Eye className="h-3.5 w-3.5" />
          </Link>
          <Link to="/tenant/debtors/$debtorId" params={{ debtorId: i.debtorId }} className="p-1.5 rounded border border-border hover:bg-muted" title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          {i.status !== "fixed" && (
            <button onClick={() => { setIssueStatus(i.id, "fixed"); toast.success("Marked fixed"); }} className="p-1.5 rounded border border-border hover:bg-muted text-success" title="Mark fixed">
              <CheckCircle className="h-3.5 w-3.5" />
            </button>
          )}
          {i.status !== "ignored" && (
            <button onClick={() => { setIssueStatus(i.id, "ignored"); toast.success("Ignored"); }} className="p-1.5 rounded border border-border hover:bg-muted text-muted-foreground" title="Ignore">
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
