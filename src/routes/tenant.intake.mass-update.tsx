import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, NativeSelect, Pill } from "@/components/tenant/ui";
import { StatusPill } from "@/components/tenant/statuses/StatusPill";
import {
  Download,
  Upload,
  FileSpreadsheet,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ShieldCheck,
  Eraser,
  Lock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileWarning,
} from "lucide-react";
import { toast } from "sonner";
import { getTeamList, type TeamListItem } from "@/lib/teams-api";
import { getAllStatus, type Status } from "@/lib/statuses-api";
import {
  getClientList,
  getStatusList,
  getMassUpdateDebtorList,
  downloadMassUpdateDebtorList,
  validateMassUpdateDebtor,
  updateMassDebtor,
  buildMassUpdateCsv,
  type MassUpdateClient,
  type MassUpdateStatus,
  type MassUpdateDebtor,
  type MassUpdateFilters,
  type MassUpdateValidateResult,
  type MassUpdateRecord,
} from "@/lib/mass-update-api";

export const Route = createFileRoute("/tenant/intake/mass-update")({
  head: () => ({ meta: [{ title: "Mass Update · Tenant Admin" }] }),
  component: MassUpdatePage,
});

const PAGE_SIZE = 10;
const SELECT_ALL_CAP = 5000;

/* --------------------------------- helpers --------------------------------- */

const money = (v: string | number | null | undefined): string => {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const fullName = (d: MassUpdateDebtor): string =>
  [d.debtorFirstName, d.debtorLastName].filter(Boolean).join(" ") || "—";

/** yyyy-mm-dd (native date input) <-> yyyy/mm/dd (backend filter format). */
const toApiDate = (v: string): string | null => (v ? v.replace(/-/g, "/") : null);
const fromApiDate = (v: string | null | undefined): string => (v ? v.replace(/\//g, "-") : "");

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* --------------------------------- page ------------------------------------ */

function MassUpdatePage() {
  const [tab, setTab] = useState<"export" | "update">("export");

  return (
    <Shell>
      <Topbar
        title="Mass Update"
        subtitle="Export the files you need to correct, edit them offline, then upload the corrected file to apply the changes."
      />

      <section className="px-6 lg:px-10 py-6 space-y-5">
        <div className="inline-flex items-center rounded-xl border border-border bg-muted/40 p-1">
          <TabButton active={tab === "export"} onClick={() => setTab("export")} icon={Download}>
            Export data
          </TabButton>
          <TabButton active={tab === "update"} onClick={() => setTab("update")} icon={Upload}>
            Update data
          </TabButton>
        </div>

        {tab === "export" ? <ExportTab /> : <UpdateTab onApplied={() => setTab("export")} />}
      </section>
    </Shell>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Download;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
        active
          ? "bg-card shadow-elegant text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

/* ================================ EXPORT TAB ================================ */

const emptyFilters: MassUpdateFilters = {
  clientId: null,
  teamId: null,
  statusId: null,
  searchText: "",
  dateOfLastPaymentStart: null,
  dateOfLastPaymentEnd: null,
  delinquencyStartDate: null,
  delinquencyEndDate: null,
  currentOutstandingBalanceMin: null,
  currentOutstandingBalanceMax: null,
};

function ExportTab() {
  const [clients, setClients] = useState<MassUpdateClient[]>([]);
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [statuses, setStatuses] = useState<MassUpdateStatus[]>([]);
  const [statusColors, setStatusColors] = useState<Record<string, Status>>({});

  const [filters, setFilters] = useState<MassUpdateFilters>(emptyFilters);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [rows, setRows] = useState<MassUpdateDebtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectingAll, setSelectingAll] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Reference options load once.
  useEffect(() => {
    Promise.all([getClientList(), getTeamList(), getStatusList(), getAllStatus()])
      .then(([cl, tm, st, allSt]) => {
        setClients(cl.clientList ?? []);
        setTeams(tm.teamList ?? []);
        setStatuses(st.statusList ?? []);
        const colorMap: Record<string, Status> = {};
        for (const s of allSt) colorMap[s.status] = s;
        setStatusColors(colorMap);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load filter options."));
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMassUpdateDebtorList({ ...filters, page, size: PAGE_SIZE });
      setRows(res.debtorList ?? []);
      setTotalCount(res.totalCount ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load files.");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  // Debounce so typing in search / balance inputs doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchRows, 300);
    return () => clearTimeout(t);
  }, [fetchRows]);

  const updateFilters = (patch: Partial<MassUpdateFilters>) => {
    setPage(0);
    setSelected(new Set());
    setFilters((f) => ({ ...f, ...patch }));
  };

  const clearAll = () => {
    setPage(0);
    setSelected(new Set());
    setFilters(emptyFilters);
  };

  const isDirty = JSON.stringify(filters) !== JSON.stringify(emptyFilters);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageAllSelected = rows.length > 0 && rows.every((r) => selected.has(r.uploadedDebtorId));
  const togglePage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) rows.forEach((r) => next.delete(r.uploadedDebtorId));
      else rows.forEach((r) => next.add(r.uploadedDebtorId));
      return next;
    });
  };

  const selectAllMatching = async () => {
    setSelectingAll(true);
    try {
      const size = Math.min(totalCount, SELECT_ALL_CAP);
      const res = await getMassUpdateDebtorList({ ...filters, page: 0, size });
      setSelected(new Set((res.debtorList ?? []).map((d) => d.uploadedDebtorId)));
      if (totalCount > SELECT_ALL_CAP) {
        toast.warning(
          `Selected the first ${SELECT_ALL_CAP.toLocaleString()} of ${totalCount.toLocaleString()} matching files.`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to select all matching files.");
    } finally {
      setSelectingAll(false);
    }
  };

  const exportSelected = async () => {
    if (selected.size === 0) return;
    setExporting(true);
    try {
      const payload = await downloadMassUpdateDebtorList([...selected]);
      const csv = buildMassUpdateCsv(payload);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTextFile(`mass-update-export-${stamp}.csv`, csv, "text/csv");
      toast.success(
        `Exported ${selected.size} file${selected.size > 1 ? "s" : ""}. Edit it, then use "Update data" to upload your changes.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageCard>
      <CardHead
        title="Choose the files to correct"
        subtitle="The export carries every data field for the files you pick, one row each, ready to edit and upload back."
      />
      <div className="flex flex-col lg:flex-row">
        <FiltersPanel
          filters={filters}
          onChange={updateFilters}
          onClear={clearAll}
          isDirty={isDirty}
          clients={clients}
          teams={teams}
          statuses={statuses}
        />

        <div className="flex-1 min-w-0 border-t lg:border-t-0 lg:border-l border-border">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold">
                Files <span className="text-tenant">({totalCount})</span>
              </span>
              {totalCount > rows.length && (
                <button
                  onClick={selectAllMatching}
                  disabled={selectingAll}
                  className="inline-flex items-center gap-1.5 text-tenant hover:underline disabled:opacity-50"
                >
                  {selectingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Select all {totalCount} matching
                </button>
              )}
              {selected.size > 0 && (
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear selection ({selected.size})
                </button>
              )}
            </div>
            <button
              onClick={exportSelected}
              disabled={selected.size === 0 || exporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export as CSV{selected.size > 0 ? ` (${selected.size})` : ""}
            </button>
          </div>

          {error ? (
            <ErrorBlock message={error} onRetry={fetchRows} />
          ) : loading ? (
            <div className="flex items-center justify-center px-6 py-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isDirty ? "No files match these filters." : "No customer files yet."}
              </p>
              {isDirty && (
                <button onClick={clearAll} className="text-sm text-tenant hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="w-10 px-5 py-3">
                        <input
                          type="checkbox"
                          checked={pageAllSelected}
                          onChange={togglePage}
                          className="rounded"
                          aria-label="Select page"
                        />
                      </th>
                      <th className="px-3 py-3 font-semibold">File No.</th>
                      <th className="px-3 py-3 font-semibold">Customer</th>
                      <th className="px-3 py-3 font-semibold">Creditor Client</th>
                      <th className="px-3 py-3 font-semibold">Team</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 font-semibold text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((d) => {
                      const isSelected = selected.has(d.uploadedDebtorId);
                      const st = d.status ? statusColors[d.status] : null;
                      return (
                        <tr
                          key={d.uploadedDebtorId}
                          onClick={() => toggle(d.uploadedDebtorId)}
                          className={`border-b border-border last:border-0 cursor-pointer transition ${
                            isSelected ? "bg-tenant/5" : "hover:bg-muted/40"
                          }`}
                        >
                          <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggle(d.uploadedDebtorId)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                            {d.ourFileNo}
                          </td>
                          <td className="px-3 py-3 font-semibold">{fullName(d)}</td>
                          <td className="px-3 py-3 text-muted-foreground">{d.clientName}</td>
                          <td className="px-3 py-3 text-muted-foreground">{d.teamName || "—"}</td>
                          <td className="px-3 py-3">
                            {st ? (
                              <StatusPill
                                code={st.statusCode}
                                name={st.status}
                                color={st.statusColorCode}
                                className="text-xs px-2 py-0.5"
                              />
                            ) : d.status ? (
                              <Pill>{d.status}</Pill>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums">
                            {money(d.currentOutstandingBalance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-border text-sm">
                <span className="text-muted-foreground">
                  Page {page + 1} of {totalPages} · {totalCount} file{totalCount === 1 ? "" : "s"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </PageCard>
  );
}

/* ------------------------------ filters panel ------------------------------- */

function FiltersPanel({
  filters,
  onChange,
  onClear,
  isDirty,
  clients,
  teams,
  statuses,
}: {
  filters: MassUpdateFilters;
  onChange: (patch: Partial<MassUpdateFilters>) => void;
  onClear: () => void;
  isDirty: boolean;
  clients: MassUpdateClient[];
  teams: TeamListItem[];
  statuses: MassUpdateStatus[];
}) {
  const [search, setSearch] = useState(filters.searchText ?? "");
  useEffect(() => setSearch(filters.searchText ?? ""), [filters.searchText]);

  return (
    <aside className="w-full lg:w-[300px] shrink-0 px-5 py-4 space-y-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4 text-tenant" /> Filters
        </span>
        {isDirty && (
          <button
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onChange({ searchText: e.target.value });
          }}
          placeholder="Name or file number"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-tenant/30"
        />
      </div>

      <FilterSection label="Creditor client" defaultOpen>
        <NativeSelect
          size="sm"
          value={filters.clientId ?? ""}
          onChange={(e) =>
            onChange({ clientId: e.target.value === "" ? null : Number(e.target.value) })
          }
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.clientId} value={c.clientId}>
              {c.clientName}
            </option>
          ))}
        </NativeSelect>
      </FilterSection>

      <FilterSection label="Team" defaultOpen>
        <NativeSelect
          size="sm"
          value={filters.teamId ?? ""}
          onChange={(e) =>
            onChange({ teamId: e.target.value === "" ? null : Number(e.target.value) })
          }
        >
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.teamId} value={t.teamId}>
              {t.teamName}
            </option>
          ))}
        </NativeSelect>
      </FilterSection>

      <FilterSection label="Status" defaultOpen>
        <NativeSelect
          size="sm"
          value={filters.statusId ?? ""}
          onChange={(e) =>
            onChange({ statusId: e.target.value === "" ? null : Number(e.target.value) })
          }
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.statusId} value={s.statusId}>
              {s.status}
            </option>
          ))}
        </NativeSelect>
      </FilterSection>

      <FilterSection label="Delinquency date">
        <DateRange
          from={fromApiDate(filters.delinquencyStartDate)}
          to={fromApiDate(filters.delinquencyEndDate)}
          onChange={(from, to) =>
            onChange({ delinquencyStartDate: toApiDate(from), delinquencyEndDate: toApiDate(to) })
          }
        />
      </FilterSection>

      <FilterSection label="Last payment date">
        <DateRange
          from={fromApiDate(filters.dateOfLastPaymentStart)}
          to={fromApiDate(filters.dateOfLastPaymentEnd)}
          onChange={(from, to) =>
            onChange({
              dateOfLastPaymentStart: toApiDate(from),
              dateOfLastPaymentEnd: toApiDate(to),
            })
          }
        />
      </FilterSection>

      <FilterSection label="Balance">
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.currentOutstandingBalanceMin ?? ""}
            onChange={(e) =>
              onChange({
                currentOutstandingBalanceMin: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-tenant/30"
          />
          <span className="text-muted-foreground text-xs">to</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.currentOutstandingBalanceMax ?? ""}
            onChange={(e) =>
              onChange({
                currentOutstandingBalanceMax: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-tenant/30"
          />
        </div>
      </FilterSection>
    </aside>
  );
}

function FilterSection({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border pt-3.5 first:border-t-0 first:pt-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-sm font-semibold mb-2"
      >
        {label}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && children}
    </div>
  );
}

function DateRange({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
          From
        </span>
        <input
          type="date"
          value={from}
          onChange={(e) => onChange(e.target.value, to)}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-tenant/30"
        />
      </label>
      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
          To
        </span>
        <input
          type="date"
          value={to}
          onChange={(e) => onChange(from, e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-tenant/30"
        />
      </label>
    </div>
  );
}

/* ================================ UPDATE TAB ================================= */

const WIZARD_STEPS = ["Upload", "Review", "Apply"];

function UpdateTab({ onApplied }: { onApplied: () => void }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<MassUpdateValidateResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickFile = (f: File | null) => {
    setFile(f);
    setValidationError(null);
  };

  const validate = async () => {
    if (!file) return;
    setValidating(true);
    setValidationError(null);
    try {
      const res = await validateMassUpdateDebtor(file);
      setResult(res);
      setStep(2);
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : "Validation failed.");
    } finally {
      setValidating(false);
    }
  };

  const startOver = () => {
    setStep(1);
    setFile(null);
    setResult(null);
    setValidationError(null);
  };

  // The backend accepts (and applies) a file number repeated across rows —
  // this check is enforced here, client-side, since the promise "duplicates
  // stop the upload" only holds if something actually stops them.
  const duplicateFileNos = useMemo(() => {
    if (!result) return [];
    const all = [...result.validRecords, ...result.invalidRecords];
    const counts = new Map<string, number>();
    for (const r of all) {
      const fileNo = r.record.find((f) => f.fieldCode === "ourFileNo")?.fieldValue;
      if (!fileNo) continue;
      counts.set(fileNo, (counts.get(fileNo) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, n]) => n > 1).map(([fileNo]) => fileNo);
  }, [result]);

  return (
    <PageCard>
      {/* Stepper */}
      <div className="px-6 py-5 border-b border-border">
        <ol className="flex items-center gap-3 text-sm">
          {WIZARD_STEPS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <li key={label} className="flex items-center gap-3">
                <span
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    done
                      ? "bg-tenant text-white"
                      : active
                        ? "bg-tenant/15 text-tenant border-2 border-tenant"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : n}
                </span>
                <span className={active || done ? "font-semibold" : "text-muted-foreground"}>
                  {label}
                </span>
                {i < WIZARD_STEPS.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="px-6 py-6">
        {step === 1 && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h3 className="font-display text-xl font-bold tracking-tight">
                Upload your corrected spreadsheet
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                The file you exported, with the cells you changed. Leave everything else exactly as
                it came.
              </p>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onPickFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className="cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-tenant/50 transition px-6 py-12 text-center"
            >
              <FileSpreadsheet className="h-12 w-12 text-tenant mx-auto" />
              <div className="mt-3 font-semibold">
                {file ? file.name : "Drop the file here, or click to browse"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">.csv, .xlsx, .xls or .tsv</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.tsv"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {validationError && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-sm">
                <AlertTriangle className="h-4.5 w-4.5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-destructive">
                    This file couldn't be validated
                  </div>
                  <div className="text-muted-foreground mt-0.5">{validationError}</div>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-4">
              <InfoCard icon={ShieldCheck} title="Every row must name one of your files">
                A blank file number, or one that doesn't match a file you hold, stops the whole
                upload. Nothing is applied until you confirm the review.
              </InfoCard>
              <InfoCard icon={Eraser} title="Blank keeps, [CLEAR] empties">
                An empty cell leaves the field exactly as it is. Type{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">[CLEAR]</code>{" "}
                to blank a field out on purpose.
              </InfoCard>
              <InfoCard icon={Lock} title="The file number is read-only">
                It's how each row is matched to an existing file — editing it won't rename anything.
                Export again if you need a fresh copy.
              </InfoCard>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={validate}
                disabled={!file || validating}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
              >
                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Validate & review
              </button>
            </div>
          </div>
        )}

        {step === 2 && result && (
          <ReviewStep
            result={result}
            duplicateFileNos={duplicateFileNos}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
          />
        )}

        {step === 3 && result && (
          <ApplyStep
            result={result}
            onBack={() => setStep(2)}
            onStartOver={startOver}
            onApplied={onApplied}
          />
        )}
      </div>
    </PageCard>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <Icon className="h-5 w-5 text-tenant" />
      <div className="mt-2.5 font-semibold text-sm">{title}</div>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{children}</p>
    </div>
  );
}

/* -------------------------------- review step -------------------------------- */

function fieldsOf(r: MassUpdateRecord): { fieldName: string; fieldValue: string }[] {
  return r.record
    .filter((f) => f.fieldCode !== "ourFileNo")
    .map((f) => ({ fieldName: f.fieldName, fieldValue: f.fieldValue }));
}

function fileNoOf(r: MassUpdateRecord): string {
  return r.record.find((f) => f.fieldCode === "ourFileNo")?.fieldValue ?? "—";
}

function ReviewStep({
  result,
  duplicateFileNos,
  onBack,
  onContinue,
}: {
  result: MassUpdateValidateResult;
  duplicateFileNos: string[];
  onBack: () => void;
  onContinue: () => void;
}) {
  const hasDuplicates = duplicateFileNos.length > 0;
  const nothingReady = result.validRecords.length === 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <SummaryTile label="Rows in file" value={result.totalRecords} />
        <SummaryTile label="Ready to update" value={result.validRecords.length} tone="success" />
        <SummaryTile
          label="Flagged"
          value={result.invalidRecords.length}
          tone={result.invalidRecords.length ? "warning" : "default"}
        />
      </div>

      {hasDuplicates && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-sm">
          <FileWarning className="h-4.5 w-4.5 text-destructive shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-destructive">
              {duplicateFileNos.length} file number{duplicateFileNos.length > 1 ? "s" : ""} appear
              on more than one row
            </div>
            <div className="text-muted-foreground mt-0.5">
              {duplicateFileNos.join(", ")} — fix the duplicate row(s) and re-upload before
              applying.
            </div>
          </div>
        </div>
      )}

      {result.invalidRecords.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5">
          <div className="px-4 py-3 border-b border-warning/20 text-sm font-semibold flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" /> {result.invalidRecords.length} row(s) flagged —{" "}
            {nothingReady
              ? "fix these fields and re-upload before you can apply."
              : "fix these fields and re-upload, or continue and they'll be skipped."}
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {result.invalidRecords.map((r, i) => (
              <div key={i} className="px-4 py-3 text-sm">
                <div className="font-mono text-xs font-semibold">{fileNoOf(r)}</div>
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

      {result.validRecords.length > 0 && (
        <div className="rounded-xl border border-border">
          <div className="px-4 py-3 border-b border-border text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> {result.validRecords.length} row(s)
            ready — changed fields shown below
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {result.validRecords.map((r, i) => {
              const changes = fieldsOf(r);
              return (
                <div key={i} className="px-4 py-3 text-sm">
                  <div className="font-mono text-xs font-semibold">{fileNoOf(r)}</div>
                  {changes.length === 0 ? (
                    <div className="text-xs text-muted-foreground mt-1">
                      No field changes detected.
                    </div>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {changes.map((c, j) => (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1 text-xs bg-tenant/10 text-tenant px-2 py-1 rounded-md"
                        >
                          <span className="font-semibold">{c.fieldName}:</span>{" "}
                          {c.fieldValue || "(cleared)"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex flex-col items-end gap-1.5">
          {nothingReady && !hasDuplicates && (
            <span className="text-xs text-muted-foreground">
              Nothing in this file is ready to apply — fix the flagged fields above and re-upload.
            </span>
          )}
          <button
            onClick={onContinue}
            disabled={hasDuplicates || nothingReady}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
          >
            Continue to apply <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- apply step ---------------------------------- */

function ApplyStep({
  result,
  onBack,
  onStartOver,
  onApplied,
}: {
  result: MassUpdateValidateResult;
  onBack: () => void;
  onStartOver: () => void;
  onApplied: () => void;
}) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = result.validRecords.length;

  const apply = async () => {
    setApplying(true);
    setError(null);
    try {
      await updateMassDebtor(result.validRecords);
      setApplied(true);
      toast.success(`Updated ${count} record${count === 1 ? "" : "s"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply the update.");
    } finally {
      setApplying(false);
    }
  };

  if (applied) {
    return (
      <div className="max-w-xl mx-auto flex flex-col items-center text-center py-6">
        <div className="h-14 w-14 rounded-full bg-success/15 text-success flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h3 className="font-display text-xl font-bold mt-4">Update applied</h3>
        <p className="text-sm text-muted-foreground mt-2">
          {count} record{count === 1 ? "" : "s"} updated. The changes are live — check "Export data"
          to confirm.
        </p>
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onApplied}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col items-center text-center py-6">
      <div className="h-14 w-14 rounded-full bg-tenant/15 text-tenant flex items-center justify-center">
        <Upload className="h-7 w-7" />
      </div>
      <h3 className="font-display text-xl font-bold mt-4">
        Apply {count} update{count === 1 ? "" : "s"}?
      </h3>
      <p className="text-sm text-muted-foreground mt-2">
        This writes the changed fields straight to your customer records. Flagged rows are skipped
        and left untouched.
      </p>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-sm mt-4 text-left">
          <AlertTriangle className="h-4.5 w-4.5 text-destructive shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-destructive">This update couldn't be applied</div>
            <div className="text-muted-foreground mt-0.5">{error}</div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={onBack}
          disabled={applying}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back to review
        </button>
        <button
          onClick={onStartOver}
          disabled={applying}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" /> Start over
        </button>
        <button
          onClick={apply}
          disabled={applying || count === 0}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
        >
          {applying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Apply {count} update{count === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- shared ----------------------------------- */

function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning";
}) {
  const color =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={`mt-2 font-display text-3xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
      >
        <RefreshCw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}
