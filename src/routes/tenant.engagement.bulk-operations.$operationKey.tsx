import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileArchive,
  MinusCircle,
  Paperclip,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill, StatTile } from "@/components/tenant/ui";
import { UsersTableSkeleton } from "@/components/admin/Skeletons";
import { OperationStatusPill } from "@/components/tenant/bulk-operations/OperationBadges";
import { usePermissions } from "@/lib/permissions/store";
import {
  createdLabel,
  formatOperationTime,
  getBulkOperationDetails,
  isCompleted,
  outcomeBucket,
  parseOperationKey,
  statusLabel,
  typeLabel,
  type BulkOperationDebtor,
  type BulkOperationDetails,
  type OutcomeBucket,
} from "@/lib/bulk-operations-api";
import { downloadCsv, toCsv } from "@/lib/csv";

export const Route = createFileRoute("/tenant/engagement/bulk-operations/$operationKey")({
  head: () => ({ meta: [{ title: "Bulk Operation · Tenant Admin" }] }),
  component: BulkOperationPage,
});

function BackLink() {
  return (
    <Link
      to="/tenant/engagement/bulk-operations"
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
    >
      <ArrowLeft className="h-4 w-4" /> All bulk operations
    </Link>
  );
}

type Tab = "all" | OutcomeBucket;

function BulkOperationPage() {
  const { operationKey } = useParams({ from: "/tenant/engagement/bulk-operations/$operationKey" });
  const parsed = useMemo(() => parseOperationKey(operationKey), [operationKey]);

  const [details, setDetails] = useState<BulkOperationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!parsed) return;
    setLoading(true);
    setError(null);
    try {
      setDetails(await getBulkOperationDetails(parsed.id, parsed.bulkOperationType));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load this operation.");
    } finally {
      setLoading(false);
    }
  }, [parsed]);

  useEffect(() => {
    load();
  }, [load]);

  if (!parsed) {
    return (
      <Message title="Operation not found" body="This link doesn't point to a bulk operation." />
    );
  }

  if (loading) {
    return (
      <Shell>
        <Topbar title="Bulk operation" action={<BackLink />} />
        <section className="px-6 lg:px-10 py-6">
          <PageCard>
            <UsersTableSkeleton />
          </PageCard>
        </section>
      </Shell>
    );
  }

  if (error || !details) {
    return (
      <Message
        title="Couldn't load this operation"
        body={`It may not exist, or the server couldn't return it.${error ? ` (${error})` : ""}`}
        onRetry={load}
      />
    );
  }

  // Details only open once the run has finished; a direct link to an
  // unfinished one lands here instead.
  if (!isCompleted(details.status)) {
    return (
      <Message
        title={details.bulkOperationName || "Bulk operation"}
        body={`This operation is ${statusLabel(details.status).toLowerCase()}. Its details open once it has completed.`}
        icon={<Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />}
      />
    );
  }

  return <OperationDetails details={details} type={parsed.bulkOperationType} />;
}

/** Full-page notice with a way back (and optionally a retry). */
function Message({
  title,
  body,
  icon,
  onRetry,
}: {
  title: string;
  body: string;
  icon?: React.ReactNode;
  onRetry?: () => void;
}) {
  return (
    <Shell>
      <Topbar title={title} action={<BackLink />} />
      <section className="px-6 lg:px-10 py-6">
        <PageCard>
          <div className="px-6 py-16 text-center">
            {icon}
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{body}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            )}
          </div>
        </PageCard>
      </section>
    </Shell>
  );
}

function OperationDetails({ details, type }: { details: BulkOperationDetails; type: string }) {
  const perms = usePermissions();
  const canExport = perms.can("bulkOperations.export");
  const canOpenCustomers = perms.can("customers.view");

  const doneLabel = createdLabel(type);
  const fileCount = details.debtorList.length;
  const result = details.result ?? { totalCreated: 0, totalSkipped: 0, totalFailed: 0 };

  const buckets = useMemo(() => {
    const out: Record<OutcomeBucket, BulkOperationDebtor[]> = {
      created: [],
      skipped: [],
      failed: [],
    };
    for (const d of details.debtorList) out[outcomeBucket(d.outcome)].push(d);
    return out;
  }, [details.debtorList]);

  const [tab, setTab] = useState<Tab>("all");
  const rows = tab === "all" ? details.debtorList : buckets[tab];
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "all", label: "All", count: fileCount },
    { id: "created", label: doneLabel, count: buckets.created.length },
    { id: "skipped", label: "Skipped", count: buckets.skipped.length },
    { id: "failed", label: "Failed", count: buckets.failed.length },
  ];

  const exportCsv = () => {
    if (rows.length === 0) return;
    const csv = toCsv(
      ["File no.", "Customer", "Email", "Outcome", "Detail"],
      rows.map((d) => [
        d.ourFileNo || `#${d.uploadedDebtorId}`,
        customerName(d),
        d.email ?? "",
        d.outcome ?? "",
        d.failureRemark ?? "",
      ]),
    );
    downloadCsv(`bulk-${type}-${details.id}-${tab}.csv`, csv);
    toast.success(`Exported ${rows.length} ${rows.length === 1 ? "file" : "files"}.`);
  };

  const attachments = details.documentNameList ?? [];

  return (
    <Shell>
      <Topbar
        title={details.bulkOperationName || "Bulk operation"}
        subtitle={`${typeLabel(type)} · ${fileCount} ${fileCount === 1 ? "file" : "files"}`}
        action={<BackLink />}
      />

      <section className="px-6 lg:px-10 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <OperationStatusPill status={details.status} />
          <span>
            Started {formatOperationTime(details.createdAt)}
            {details.createdBy && ` by ${details.createdBy}`}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label={doneLabel}
            value={result.totalCreated}
            tone="success"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatTile
            label="Skipped"
            value={result.totalSkipped}
            tone="warning"
            icon={<MinusCircle className="h-4 w-4" />}
          />
          <StatTile
            label="Failed"
            value={result.totalFailed}
            tone="danger"
            icon={<XCircle className="h-4 w-4" />}
          />
        </div>

        <PageCard>
          <dl className="divide-y divide-border text-sm">
            <DetailRow label={type === "document" ? "Document" : "Template"}>
              <div className="font-semibold">{details.templateName || "—"}</div>
              {details.templateOrignalFileName && (
                <div className="text-xs text-muted-foreground">
                  {details.templateOrignalFileName}
                </div>
              )}
            </DetailRow>
            <DetailRow label="Client">{details.clientName || "—"}</DetailRow>
            <DetailRow label="Created by">
              {details.createdBy || "—"} · {formatOperationTime(details.createdAt)}
            </DetailRow>
            {type === "email" && (
              <DetailRow label="Attachments">
                {attachments.length === 0 ? (
                  <span className="text-muted-foreground">None</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((name, i) => (
                      <span
                        key={`${name}-${i}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" /> {name}
                      </span>
                    ))}
                  </div>
                )}
              </DetailRow>
            )}
            {type === "document" && (
              <DetailRow label="Downloads">
                {!details.archiveLink ? (
                  <span className="text-muted-foreground">
                    This operation produced no documents.
                  </span>
                ) : canExport ? (
                  <a
                    href={details.archiveLink}
                    download
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
                  >
                    <FileArchive className="h-4 w-4" /> ZIP · one document per file
                  </a>
                ) : (
                  <span className="text-muted-foreground">
                    Your role can't download documents — that needs the Bulk operations · Download
                    permission.
                  </span>
                )}
              </DetailRow>
            )}
          </dl>
        </PageCard>

        <PageCard>
          <CardHead
            title="Affected files"
            subtitle="Every customer file this operation touched."
            icon={<Users className="h-5 w-5" />}
            action={
              canExport ? (
                <button
                  onClick={exportCsv}
                  disabled={rows.length === 0}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-4 w-4" /> CSV
                </button>
              ) : undefined
            }
          />

          <div className="px-6 pt-4 flex flex-wrap gap-1" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  tab === t.id
                    ? "bg-[color:var(--tenant)]/10 text-tenant"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {t.label} <span className="ml-1 text-xs opacity-70">{t.count}</span>
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Nothing in this tab.
            </div>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-semibold">File no.</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Outcome</th>
                    <th className="px-6 py-3 font-semibold">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((d) => {
                    const fileNo = d.ourFileNo || `#${d.uploadedDebtorId}`;
                    const bucket = outcomeBucket(d.outcome);
                    return (
                      <tr key={d.uploadedDebtorId} className="hover:bg-muted/30">
                        <td className="px-6 py-3 font-mono text-xs whitespace-nowrap">
                          {canOpenCustomers ? (
                            <Link
                              to="/tenant/debtors/$debtorId"
                              params={{ debtorId: String(d.uploadedDebtorId) }}
                              className="hover:text-tenant hover:underline"
                            >
                              {fileNo}
                            </Link>
                          ) : (
                            fileNo
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {customerName(d) || <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{d.email || "—"}</td>
                        <td className="px-4 py-3">
                          <Pill
                            tone={
                              bucket === "created"
                                ? "success"
                                : bucket === "skipped"
                                  ? "warning"
                                  : "danger"
                            }
                          >
                            {d.outcome || doneLabel}
                          </Pill>
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">
                          {d.failureRemark || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PageCard>
      </section>
    </Shell>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[10rem_1fr] gap-1 sm:gap-4 px-6 py-3">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground font-semibold sm:pt-0.5">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

/** "First Middle Last", or "" when the file has no name fields. */
function customerName(d: BulkOperationDebtor): string {
  return [d.debtorFirstName, d.debtorMiddleName, d.debtorLastName].filter(Boolean).join(" ");
}
