import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead } from "@/components/tenant/ui";
import {
  Upload, FileSpreadsheet, Download, X, Loader2, CheckCircle2, AlertTriangle,
  ArrowRight, ArrowLeft, RefreshCw, Eye, Search, UserPlus, Pencil, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { getAllClients, type Client } from "@/lib/clients-api";
import {
  validateDebtorFile, uploadDebtor, getUploadedDebtor, debtorFileDetails,
  assignUserList, assignUser, updateNewDebtor,
  type UploadedFile, type ValidateResult, type DebtorRecord, type AssignableUser,
} from "@/lib/upload-debtor-api";
import { DEBTOR_FIELDS, DEBTOR_SECTIONS, buildSampleCsv } from "@/lib/debtor-fields";

export const Route = createFileRoute("/tenant/intake/upload")({
  head: () => ({ meta: [{ title: "Upload Debtor Data · Tenant Admin" }] }),
  component: UploadDebtorPage,
});

/* --------------------------------- helpers --------------------------------- */

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const str = (v: DebtorRecord[string]): string => (v == null || Array.isArray(v) ? "" : String(v));

/** Minimal CSV parse for the client-side preview (header + first rows). */
function parseCsvPreview(text: string, maxRows = 5): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  return {
    headers: parseLine(lines[0]),
    rows: lines.slice(1, 1 + maxRows).map(parseLine),
  };
}

/* --------------------------------- page ------------------------------------ */

function UploadDebtorPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detail, setDetail] = useState<UploadedFile | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [imports, cl] = await Promise.all([getUploadedDebtor(0, 100), getAllClients()]);
      setFiles(imports.uploadFileList ?? []);
      setClients(cl.clients ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load imports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (detail) {
    return <FileDetail file={detail} onBack={() => { setDetail(null); fetchAll(); }} />;
  }

  return (
    <Shell>
      <Topbar
        title="Upload Debtor Data"
        subtitle="Import debtor files into this tenant"
        action={
          <button
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
          >
            <Upload className="h-4 w-4" /> New import
          </button>
        }
      />

      <section className="px-6 lg:px-10 py-6">
        <PageCard>
          <CardHead title="Imports" subtitle={loading ? "Loading…" : "Files uploaded into this tenant"} />

          {error ? (
            <ErrorBlock message={error} onRetry={fetchAll} />
          ) : loading ? (
            <div className="flex items-center justify-center px-6 py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No imports yet. Upload your first debtor file.</p>
              <button
                onClick={() => setWizardOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
              >
                <Upload className="h-4 w-4" /> New import
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-6 py-3 font-semibold">File</th>
                    <th className="px-6 py-3 font-semibold">Client</th>
                    <th className="px-6 py-3 font-semibold">Import date</th>
                    <th className="px-6 py-3 font-semibold">Assigned files</th>
                    <th className="px-6 py-3 font-semibold">Validation</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.fileId} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="px-6 py-4 font-mono text-xs">{f.originalFileName}</td>
                      <td className="px-6 py-4">{f.clientName}</td>
                      <td className="px-6 py-4 text-muted-foreground">{relativeTime(f.createdAt)}</td>
                      <td className="px-6 py-4 font-mono text-muted-foreground tabular-nums">
                        {(f.assignedCount ?? 0)} / {f.totalCount}
                      </td>
                      <td className="px-6 py-4">
                        {f.invalidCount === 0 ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-warning font-semibold">
                            <AlertTriangle className="h-4 w-4" /> {f.invalidCount}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setDetail(f)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
                        >
                          <Eye className="h-4 w-4" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageCard>
      </section>

      {wizardOpen && (
        <ImportWizard
          clients={clients}
          onClose={() => setWizardOpen(false)}
          onComplete={() => { setWizardOpen(false); fetchAll(); }}
        />
      )}
    </Shell>
  );
}

/* ------------------------------- import wizard ------------------------------ */

const WIZARD_STEPS = ["Client & upload", "Validate & review", "Import"];

function ImportWizard({ clients, onClose, onComplete }: { clients: Client[]; onClose: () => void; onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState<number | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickFile = (f: File | null) => {
    setFile(f);
    setResult(null);
    setPreview(null);
    if (f && /\.(csv|tsv)$/i.test(f.name)) {
      f.text().then((t) => setPreview(parseCsvPreview(t))).catch(() => setPreview(null));
    }
  };

  const downloadSample = () => {
    const blob = new Blob([buildSampleCsv()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "debtor_import_sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validate = async () => {
    if (clientId === "") return toast.error("Select a client");
    if (!file) return toast.error("Choose a file to upload");
    setValidating(true);
    try {
      const res = await validateDebtorFile(file);
      setResult(res);
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Validation failed.");
    } finally {
      setValidating(false);
    }
  };

  const runImport = async () => {
    if (!result || clientId === "") return;
    setImporting(true);
    try {
      const debtorList: DebtorRecord[] = [
        ...result.validRecords.map((r) => ({ ...r, validRecord: 1, invalidAttribute: [] })),
        ...result.invalidRecords.map((r) => ({ ...r, validRecord: 0, invalidAttribute: r.invalidAttribute ?? [] })),
      ];
      await uploadDebtor({
        originalFileName: result.originalFileName,
        newFileName: result.newFileName,
        clientId,
        debtorList,
      });
      setStep(3);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Overlay onClose={onClose} wide>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-display text-2xl font-bold tracking-tight">Upload Debtor Data</h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Stepper */}
      <ol className="flex items-center gap-3 mt-5 mb-6 text-sm">
        {WIZARD_STEPS.map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <li key={label} className="flex items-center gap-3">
              <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                done ? "bg-tenant text-white" : active ? "bg-tenant/15 text-tenant border-2 border-tenant" : "bg-muted text-muted-foreground"
              }`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : n}
              </span>
              <span className={active || done ? "font-semibold" : "text-muted-foreground"}>{label}</span>
              {i < WIZARD_STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </li>
          );
        })}
      </ol>

      <div className="border-t border-border pt-6 max-h-[60vh] overflow-y-auto">
        {step === 1 && (
          <div className="space-y-5">
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Client <span className="text-destructive">*</span>
              </span>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-tenant/40"
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.clientId} value={c.clientId}>{c.clientName} ({c.clientNumber})</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1.5">The client this file came from. Manage clients on the Client List page.</p>
            </label>

            <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Download className="h-5 w-5 text-tenant mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">Need the expected format?</div>
                  <div className="text-xs text-muted-foreground">
                    Includes all {DEBTOR_FIELDS.length} system columns across {DEBTOR_SECTIONS.length} sections. Match your file to this layout before uploading.
                  </div>
                </div>
              </div>
              <button onClick={downloadSample} className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
                <Download className="h-4 w-4" /> Download sample
              </button>
            </div>

            <div>
              <span className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Upload CSV / XLSX <span className="text-destructive">*</span>
              </span>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); onPickFile(e.dataTransfer.files?.[0] ?? null); }}
                className="cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-tenant/50 transition px-6 py-10 text-center"
              >
                <FileSpreadsheet className="h-12 w-12 text-tenant mx-auto" />
                <div className="mt-3 font-semibold">{file ? file.name : "Drop a file or click to browse"}</div>
                <div className="text-xs text-muted-foreground mt-1">.csv, .xlsx, .xls, .tsv up to 100MB</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.tsv"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            {preview && preview.headers.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <FileSpreadsheet className="h-4 w-4 text-tenant" /> Data preview
                    <span className="text-xs font-normal text-muted-foreground">· {preview.headers.length} columns · {preview.rows.length} rows</span>
                  </div>
                  <button onClick={() => onPickFile(null)} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-muted">
                    <X className="h-3.5 w-3.5" /> Clear
                  </button>
                </div>
                <div className="overflow-x-auto max-h-52">
                  <table className="text-xs whitespace-nowrap">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                        {preview.headers.map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                          {preview.headers.map((_, ci) => (
                            <td key={ci} className="px-3 py-2">{row[ci] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && result && (
          <div className="space-y-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Validation summary</div>
            <div className="grid grid-cols-3 gap-4">
              <SummaryTile label="Total uploaded" value={result.totalRecords} />
              <SummaryTile label="Imported (new)" value={result.totalRecords} tone="success" />
              <SummaryTile label="Rows flagged" value={result.invalidRecords.length} tone={result.invalidRecords.length ? "warning" : "default"} />
            </div>

            {result.invalidRecords.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-4">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <div><span className="font-semibold">No flagged rows.</span> <span className="text-muted-foreground">Every row passed validation.</span></div>
              </div>
            ) : (
              <div className="rounded-xl border border-warning/30 bg-warning/5">
                <div className="px-4 py-3 border-b border-warning/20 text-sm font-semibold flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" /> {result.invalidRecords.length} row(s) flagged — they will still be imported as “new” and can be fixed afterward.
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-border">
                  {result.invalidRecords.map((r, i) => (
                    <div key={i} className="px-4 py-3 text-sm">
                      <div className="font-medium">{str(r.debtorName) || `Row ${i + 1}`}</div>
                      <ul className="mt-1 space-y-0.5">
                        {(r.invalidAttribute ?? []).map((a, j) => (
                          <li key={j} className="text-xs text-muted-foreground">
                            <span className="font-mono text-warning">{a.parameterName}</span> — {a.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && result && (
          <div className="flex flex-col items-center text-center py-10">
            <div className="h-14 w-14 rounded-full bg-success/15 text-success flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="font-display text-xl font-bold mt-4">Import complete</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
              {result.totalRecords} debtor record(s) imported. Open the import to review and assign records.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        {step === 3 ? (
          <button onClick={onComplete} className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
            Done
          </button>
        ) : (
          <>
            <button
              onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              {step === 1 ? "Cancel" : <><ArrowLeft className="h-4 w-4" /> Back</>}
            </button>
            {step === 1 ? (
              <button
                onClick={validate}
                disabled={validating || clientId === "" || !file}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
              >
                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Validate file
              </button>
            ) : (
              <button
                onClick={runImport}
                disabled={importing}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Import {result?.totalRecords ?? 0} rows
              </button>
            )}
          </>
        )}
      </div>
    </Overlay>
  );
}

/* ------------------------------- file detail -------------------------------- */

function FileDetail({ file, onBack }: { file: UploadedFile; onBack: () => void }) {
  const [tab, setTab] = useState<"new" | "assigned">("new");
  const [search, setSearch] = useState("");
  const [debtors, setDebtors] = useState<DebtorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState<DebtorRecord | null>(null);

  const fetchDebtors = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const res = await debtorFileDetails({ fileId: file.fileId, status: tab, searchText: search });
      setDebtors(res.debtorList ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load records.");
    } finally {
      setLoading(false);
    }
  }, [file.fileId, tab, search]);

  useEffect(() => {
    const t = setTimeout(fetchDebtors, 250); // debounce search
    return () => clearTimeout(t);
  }, [fetchDebtors]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const allSelected = debtors.length > 0 && debtors.every((d) => d.uploadedDebtorId != null && selected.has(d.uploadedDebtorId));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(debtors.map((d) => d.uploadedDebtorId).filter((x): x is number => x != null)));
  };

  return (
    <Shell>
      <Topbar title={file.originalFileName} subtitle={`${file.clientName} · ${file.totalCount} records`} />

      <section className="px-6 lg:px-10 py-6">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> All imports
        </button>

        <PageCard>
          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 pt-3 border-b border-border">
            {(["new", "assigned"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px capitalize transition ${
                  tab === t ? "border-tenant text-tenant" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}{" "}
                <span className="ml-1 text-xs">
                  {t === "new" ? (file.newCount ?? 0) : (file.assignedCount ?? 0)}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, email, creditor, file no…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-tenant/30"
              />
            </div>
            {debtors.length > 0 && (
              <button onClick={toggleAll} className="text-sm text-tenant hover:underline whitespace-nowrap">
                {allSelected ? "Clear selection" : "Select all filtered"}
              </button>
            )}
          </div>

          {error ? (
            <ErrorBlock message={error} onRetry={fetchDebtors} />
          ) : loading ? (
            <div className="flex items-center justify-center px-6 py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : debtors.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              No {tab} records{search ? ` matching “${search}”` : ""}.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {debtors.map((d) => {
                const id = d.uploadedDebtorId!;
                const issues = d.invalidAttribute?.length ?? 0;
                return (
                  <li key={id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                    {tab === "new" && (
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={() => toggle(id)}
                        className="rounded shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">
                        {str(d.debtorName) || "—"}
                        <span className="ml-2 font-normal text-xs text-muted-foreground">
                          #{str(d.ourFileNo) || str(d.clientFileNo) || id}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[str(d.creditorName), str(d.city), str(d.email)].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {issues > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning bg-warning/10 px-2 py-1 rounded-md shrink-0">
                        <AlertTriangle className="h-3.5 w-3.5" /> {issues} issue{issues > 1 ? "s" : ""}
                      </span>
                    )}
                    {tab === "new" && (
                      <button
                        onClick={() => setEditing(d)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs hover:bg-muted shrink-0"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                    )}
                    {tab === "assigned" && d.assignedTo != null && (
                      <span className="text-xs text-muted-foreground shrink-0">Assigned</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </PageCard>
      </section>

      {/* Assign action bar */}
      {tab === "new" && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-3 shadow-elegant">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <button
            onClick={() => setAssigning(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
          >
            <UserPlus className="h-4 w-4" /> Assign to user
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      {assigning && (
        <AssignModal
          fileId={file.fileId}
          ids={[...selected]}
          onClose={() => setAssigning(false)}
          onAssigned={() => { setAssigning(false); fetchDebtors(); }}
        />
      )}

      {editing && (
        <EditDebtorModal
          debtor={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchDebtors(); }}
        />
      )}
    </Shell>
  );
}

/* ------------------------------- assign modal ------------------------------- */

function AssignModal({ fileId, ids, onClose, onAssigned }: { fileId: number; ids: number[]; onClose: () => void; onAssigned: () => void }) {
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    assignUserList({ fileId, status: "new" })
      .then((r) => setUsers(r.userList ?? []))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load users."))
      .finally(() => setLoading(false));
  }, [fileId]);

  const submit = async () => {
    if (userId === "") return;
    setSaving(true);
    try {
      await assignUser(ids, userId);
      toast.success(`Assigned ${ids.length} record(s).`);
      onAssigned();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign.");
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Assign records</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Assign {ids.length} selected record(s) to a user.</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>

      <div className="mt-6">
        <span className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">User</span>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading users…</div>
        ) : (
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-tenant/40"
          >
            <option value="">Select a user…</option>
            {users.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.firstName} — {u.role}{u.teamName ? ` · ${u.teamName}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-6">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
        <button
          onClick={submit}
          disabled={userId === "" || saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Assign
        </button>
      </div>
    </Overlay>
  );
}

/* ------------------------------- edit modal --------------------------------- */

function EditDebtorModal({ debtor, onClose, onSaved }: { debtor: DebtorRecord; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of DEBTOR_FIELDS) init[f.key] = str(debtor[f.key]);
    return init;
  });
  const [saving, setSaving] = useState(false);
  const flagged = new Set((debtor.invalidAttribute ?? []).map((a) => a.parameterName));

  const submit = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { uploadedDebtorId: debtor.uploadedDebtorId };
      for (const f of DEBTOR_FIELDS) {
        if (f.omitForUpdate) continue;
        payload[f.key] = form[f.key] ?? "";
      }
      await updateNewDebtor(payload);
      toast.success("Record updated.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update record.");
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose} wide>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Edit debtor</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{str(debtor.debtorName) || "Record"} · fix flagged fields and save.</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>

      <div className="mt-5 max-h-[60vh] overflow-y-auto space-y-6 pr-1">
        {DEBTOR_SECTIONS.map((section) => (
          <div key={section}>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-2">
              <ChevronRight className="h-3.5 w-3.5" /> {section}
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {DEBTOR_FIELDS.filter((f) => f.section === section).map((f) => {
                const isFlagged = flagged.has(f.key);
                return (
                  <label key={f.key} className="block">
                    <span className="block text-xs text-muted-foreground mb-1">
                      {f.label}
                      {isFlagged && <span className="ml-1.5 text-warning font-semibold">• needs fix</span>}
                    </span>
                    <input
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      disabled={f.omitForUpdate}
                      className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-tenant/30 disabled:opacity-60 disabled:cursor-not-allowed ${
                        isFlagged ? "border-warning" : "border-border"
                      }`}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 pt-5 border-t border-border mt-2">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
        <button
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} Save changes
        </button>
      </div>
    </Overlay>
  );
}

/* --------------------------------- shared ----------------------------------- */

function SummaryTile({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "warning" }) {
  const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={`mt-2 font-display text-3xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <button onClick={onRetry} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
        <RefreshCw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}

function Overlay({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-md"} rounded-2xl border border-border bg-card p-6 shadow-elegant`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
