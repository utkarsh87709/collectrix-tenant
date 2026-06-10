import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, Pill } from "@/components/tenant/ui";
import { UsersTableSkeleton } from "@/components/admin/Skeletons";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Download,
  AlertTriangle,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FilterX,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAuditLogs,
  getEventList,
  type AuditLog,
  type AuditOutcome,
  type EventListItem,
} from "@/lib/audit-api";

export const Route = createFileRoute("/tenant/audit")({
  head: () => ({ meta: [{ title: "Audit · Compliance" }] }),
  component: AuditPage,
});

const PAGE_SIZE = 10;
type OutcomeFilter = AuditOutcome | "all";

function fullNameOf(e: { firstName: string; lastName: string }) {
  return [e.firstName, e.lastName].filter(Boolean).join(" ").trim();
}

function initialsOf(name: string, email: string) {
  const base = (name || email || "?").trim();
  return (
    base
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [events, setEvents] = useState<EventListItem[]>([]);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [searchText, setSearchText] = useState("");
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const [eventType, setEventType] = useState("");
  // Empty by default so the API returns the full range.
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [open, setOpen] = useState<AuditLog | null>(null);
  const [exporting, setExporting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasActiveFilters =
    !!searchText || outcome !== "all" || !!eventType || !!startDate || !!endDate;

  // Debounce the search box into searchText.
  useEffect(() => {
    const t = setTimeout(() => setSearchText(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  // Reset to first page whenever a filter changes.
  useEffect(() => {
    setPage(0);
  }, [searchText, outcome, eventType, startDate, endDate]);

  const buildParams = useCallback(
    (overrides?: Partial<{ page: number; size: number }>) => ({
      page,
      size: PAGE_SIZE,
      searchText,
      outcome: outcome === "all" ? ("" as const) : outcome,
      startDate,
      endDate,
      eventType,
      ...overrides,
    }),
    [page, searchText, outcome, startDate, endDate, eventType],
  );

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAuditLogs(buildParams());
      setLogs(res.auditLogs ?? []);
      setTotalCount(res.totalCount ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit logs.");
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    getEventList()
      .then((r) => setEvents(r.eventList ?? []))
      .catch(() => {});
  }, []);

  const clearFilters = () => {
    setQ("");
    setSearchText("");
    setOutcome("all");
    setEventType("");
    setStartDate("");
    setEndDate("");
  };

  // Export the full filtered result set to CSV (fetches all matching rows).
  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await getAuditLogs(buildParams({ page: 0, size: Math.max(totalCount, 1) }));
      const rows = res.auditLogs ?? [];
      if (rows.length === 0) {
        toast.error("No events to export");
        return;
      }
      const header = [
        "Audit ID",
        "Timestamp",
        "Event",
        "Outcome",
        "Severity",
        "Actor",
        "Email",
        "Role",
        "Company",
      ];
      const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = [
        header.join(","),
        ...rows.map((e) =>
          [
            e.auditId,
            e.createdAt,
            e.eventName,
            e.outcome,
            e.sevirity,
            fullNameOf(e),
            e.emailId,
            e.role,
            e.companyName,
          ]
            .map((v) => esc(String(v)))
            .join(","),
        ),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Compliance report exported", {
        description: `${rows.length} events written to CSV.`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to export report");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Shell>
      <Topbar
        title="Audit"
        subtitle="Tamper-resistant compliance log · every account and security event"
        action={
          <button
            onClick={exportCsv}
            disabled={exporting || totalCount === 0}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export report"}
          </button>
        }
      />

      <section className="px-6 lg:px-10 py-6">
        <PageCard>
          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-border">
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight">
                {totalCount} {totalCount === 1 ? "event" : "events"}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Account, role and security activity across your organization
              </p>
            </div>
            <button
              onClick={fetchLogs}
              disabled={loading}
              aria-label="Refresh"
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Filter toolbar */}
          <div className="px-6 py-4 border-b border-border bg-muted/20">
            <div className="flex flex-wrap items-end gap-3">
              <Labeled label="Search" className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2 h-10 px-3 rounded-lg bg-card border border-border focus-within:ring-2 ring-tenant">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search event, actor, or email…"
                    className="bg-transparent text-sm flex-1 outline-none"
                  />
                  {q && (
                    <button
                      onClick={() => setQ("")}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </Labeled>

              <Labeled label="Event type" className="min-w-[160px]">
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm outline-none focus:ring-2 ring-tenant"
                >
                  <option value="">All events</option>
                  {events.map((ev) => (
                    <option key={ev.eventName} value={ev.eventName}>
                      {ev.eventName}
                    </option>
                  ))}
                </select>
              </Labeled>

              <Labeled label="Outcome" className="min-w-[130px]">
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as OutcomeFilter)}
                  className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm outline-none focus:ring-2 ring-tenant"
                >
                  <option value="all">All outcomes</option>
                  <option value="Success">Success</option>
                  <option value="Failure">Failure</option>
                </select>
              </Labeled>

              <Labeled label="From">
                <input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 px-3 rounded-lg bg-card border border-border text-sm outline-none focus:ring-2 ring-tenant"
                />
              </Labeled>

              <Labeled label="To">
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 px-3 rounded-lg bg-card border border-border text-sm outline-none focus:ring-2 ring-tenant"
                />
              </Labeled>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <FilterX className="h-4 w-4" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <div className="py-1">
              <UsersTableSkeleton />
            </div>
          ) : error ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-destructive font-medium">{error}</p>
              <button
                onClick={fetchLogs}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">No audit events found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasActiveFilters
                  ? "Try adjusting or clearing your filters."
                  : "Events will appear here as activity happens."}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
                >
                  <FilterX className="h-4 w-4" /> Clear filters
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {logs.map((e) => {
                const critical = e.sevirity === "Critical";
                const failed = e.outcome === "Failure";
                const name = fullNameOf(e);
                return (
                  <li key={e.auditId}>
                    <button
                      onClick={() => setOpen(e)}
                      className="group w-full text-left px-6 py-3.5 hover:bg-muted/40 transition-colors flex items-center gap-3"
                    >
                      <span
                        className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                          critical
                            ? "bg-destructive/15 text-destructive"
                            : failed
                              ? "bg-warning/20 text-warning-foreground"
                              : "bg-tenant-soft text-tenant"
                        }`}
                      >
                        {initialsOf(name, e.emailId)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{e.eventName}</span>
                          {critical ? (
                            <Pill tone="danger">
                              <AlertTriangle className="h-3 w-3" /> Critical
                            </Pill>
                          ) : failed ? (
                            <Pill tone="warning">Failure</Pill>
                          ) : (
                            <Pill tone="success">Success</Pill>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {name || "—"} · <span className="font-mono">{e.emailId}</span>
                        </div>
                      </div>
                      <div className="hidden sm:block text-right shrink-0">
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(e.createdAt)}
                        </div>
                        <div className="text-[11px] text-muted-foreground/70">{e.role}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Pagination */}
          {!loading && !error && totalCount > 0 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border text-xs text-muted-foreground">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of{" "}
                {totalCount}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <span className="px-2">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </PageCard>
      </section>

      <AnimatePresence>
        {open && <DetailSheet log={open} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </Shell>
  );
}

function DetailSheet({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const critical = log.sevirity === "Critical";
  const failed = log.outcome === "Failure";
  const name = fullNameOf(log);
  const accent = critical
    ? "bg-destructive/15 text-destructive"
    : failed
      ? "bg-warning/20 text-warning-foreground"
      : "bg-tenant-soft text-tenant";
  const Icon = critical ? ShieldAlert : failed ? AlertTriangle : ShieldCheck;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full sm:max-w-md h-full bg-card border-l border-border shadow-tenant flex flex-col"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span
                className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${accent}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-base leading-tight truncate">
                  {log.eventName}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(log.createdAt)}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            {failed ? (
              <Pill tone="warning">Failure</Pill>
            ) : (
              <Pill tone="success">
                <CheckCircle2 className="h-3 w-3" /> Success
              </Pill>
            )}
            {critical && (
              <Pill tone="danger">
                <AlertTriangle className="h-3 w-3" /> Critical
              </Pill>
            )}
            <Pill tone="muted">{log.sevirity}</Pill>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm">
          {/* Actor card */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
            <span className="h-10 w-10 shrink-0 rounded-full bg-gradient-tenant text-white flex items-center justify-center text-sm font-bold">
              {initialsOf(name, log.emailId)}
            </span>
            <div className="min-w-0">
              <div className="font-semibold truncate">{name || "—"}</div>
              <div className="text-xs text-muted-foreground font-mono truncate">{log.emailId}</div>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Role" value={log.role} />
            <Field label="Company" value={log.companyName} />
            <Field label="Outcome" value={log.outcome} />
            <Field label="Severity" value={log.sevirity} />
            <Field label="Audit ID" value={`#${log.auditId}`} mono />
            <Field label="User ID" value={`#${log.userId}`} mono />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Labeled({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={`mt-0.5 break-words ${mono ? "font-mono text-xs" : "text-sm"}`}>
        {value || "—"}
      </div>
    </div>
  );
}
