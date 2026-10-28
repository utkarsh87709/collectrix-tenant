import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, RefreshCw, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, NativeSelect } from "@/components/tenant/ui";
import { UsersTableSkeleton } from "@/components/admin/Skeletons";
import {
  OperationStatusPill,
  OperationTypeIcon,
} from "@/components/tenant/bulk-operations/OperationBadges";
import {
  BULK_OPERATION_STATUSES,
  createdLabel,
  formatOperationTime,
  getBulkOperations,
  getBulkOperationUsers,
  isCompleted,
  operationKey,
  typeLabel,
  type BulkOperation,
  type BulkOperationUser,
} from "@/lib/bulk-operations-api";
import { getClientList, type MassUpdateClient } from "@/lib/mass-update-api";

export const Route = createFileRoute("/tenant/engagement/bulk-operations/")({
  head: () => ({ meta: [{ title: "Bulk Operations · Tenant Admin" }] }),
  component: BulkOperationsPage,
});

const PAGE_SIZE = 10;

/* -------------------------------- Filters ---------------------------------- */
// Status, client and created-by are all real server-side params on
// getBulkOperation, so they combine and page correctly.

type Filters = {
  status: string | "all";
  client: number | "all";
  user: number | "all";
};

const EMPTY_FILTERS: Filters = { status: "all", client: "all", user: "all" };

function activeFilterCount(f: Filters): number {
  return [f.status, f.client, f.user].filter((v) => v !== "all").length;
}

function BulkOperationsPage() {
  const [clients, setClients] = useState<MassUpdateClient[]>([]);
  const [users, setUsers] = useState<BulkOperationUser[]>([]);
  useEffect(() => {
    getClientList()
      .then((res) => setClients(res.clientList ?? []))
      .catch(() => toast.error("Failed to load clients."));
    getBulkOperationUsers()
      .then(setUsers)
      .catch(() => toast.error("Failed to load users."));
  }, []);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const [page, setPage] = useState(0);
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset to page 1 whenever the scope changes.
  useEffect(() => {
    setPage(0);
  }, [filters]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getBulkOperations({
        page,
        size: PAGE_SIZE,
        status: filters.status === "all" ? null : filters.status,
        clientId: filters.client === "all" ? null : filters.client,
        userId: filters.user === "all" ? null : filters.user,
      });
      setOperations(res.bulkOperationsList);
      setTotalCount(res.totalCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bulk operations.");
      setOperations([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const activeCount = activeFilterCount(filters);

  return (
    <Shell>
      <Topbar
        title="Bulk Operations"
        subtitle="Bulk emails and documents produced for many customer files at once"
      />

      <section className="px-6 lg:px-10 py-6 space-y-4">
        {/* Filters */}
        <PageCard>
          <div className="px-6 py-4 flex flex-wrap items-center gap-2">
            <NativeSelect
              className="w-full sm:w-48"
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
              aria-label="Status"
            >
              <option value="all">All statuses</option>
              {BULK_OPERATION_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              className="w-full sm:w-48"
              value={filters.client}
              onChange={(e) =>
                setFilter("client", e.target.value === "all" ? "all" : Number(e.target.value))
              }
              aria-label="Client"
            >
              <option value="all">All clients</option>
              {clients.map((c) => (
                <option key={c.clientId} value={c.clientId}>
                  {c.clientName}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              className="w-full sm:w-48"
              value={filters.user}
              onChange={(e) =>
                setFilter("user", e.target.value === "all" ? "all" : Number(e.target.value))
              }
              aria-label="Created by"
            >
              <option value="all">All users</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.userName}
                </option>
              ))}
            </NativeSelect>
            <div className="ml-auto flex items-center gap-2">
              {activeCount > 0 && (
                <button
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" /> Clear filters ({activeCount})
                </button>
              )}
              <button
                onClick={fetchRows}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </PageCard>

        {/* Table */}
        <PageCard>
          <CardHead
            title="Operations"
            subtitle={`${totalCount} ${totalCount === 1 ? "operation" : "operations"} · Open a completed operation to see every file it affected and download its documents.`}
            icon={<Send className="h-5 w-5" />}
          />

          {loading ? (
            <div className="py-1">
              <UsersTableSkeleton />
            </div>
          ) : error ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-destructive font-medium">{error}</p>
              <button
                onClick={fetchRows}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : operations.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Send className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-display text-lg font-bold">
                {activeCount > 0 ? "No operations match your filters" : "No bulk operations yet"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                {activeCount > 0
                  ? "Try clearing a filter."
                  : "Bulk emails and document runs started from Case Files → Customers are listed here."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Operation</th>
                    <th className="px-4 py-3 font-semibold">Client</th>
                    <th className="px-4 py-3 font-semibold">Created by</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Results</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {operations.map((op) => {
                    const key = operationKey(op);
                    const done = isCompleted(op.status);
                    // The operation is named after its template today; only
                    // show the template separately if the two ever differ.
                    const template =
                      op.templateName && op.templateName !== op.bulkOperationName
                        ? op.templateName
                        : null;
                    return (
                      <tr key={key} className="hover:bg-muted/30">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <OperationTypeIcon type={op.bulkOperationType} />
                            <div className="min-w-0">
                              {done ? (
                                <Link
                                  to="/tenant/engagement/bulk-operations/$operationKey"
                                  params={{ operationKey: key }}
                                  className="font-semibold hover:text-tenant hover:underline"
                                >
                                  {op.bulkOperationName || "Untitled operation"}
                                </Link>
                              ) : (
                                <span
                                  className="font-semibold"
                                  title="Details open once the operation has completed."
                                >
                                  {op.bulkOperationName || "Untitled operation"}
                                </span>
                              )}
                              <div className="text-xs text-muted-foreground">
                                {typeLabel(op.bulkOperationType)}
                                {template && ` · ${template}`}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{op.clientName || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{op.firstName || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {formatOperationTime(op.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <OperationStatusPill status={op.status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                          {op.result ? (
                            <>
                              <span className="font-semibold text-success">
                                {op.result.totalCreated}
                              </span>{" "}
                              {createdLabel(op.bulkOperationType).toLowerCase()} ·{" "}
                              <span className="font-semibold text-warning">
                                {op.result.totalSkipped}
                              </span>{" "}
                              skipped ·{" "}
                              <span className="font-semibold text-destructive">
                                {op.result.totalFailed}
                              </span>{" "}
                              failed
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex justify-end">
                            {done ? (
                              <Link
                                to="/tenant/engagement/bulk-operations/$operationKey"
                                params={{ operationKey: key }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-muted transition"
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                Opens when completed
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && totalCount > 0 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border text-xs text-muted-foreground">
              <span>
                Page {page + 1} of {totalPages} · {totalCount} total
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
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
    </Shell>
  );
}
