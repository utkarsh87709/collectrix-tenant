import type { ReactNode } from "react";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Pill } from "@/components/tenant/ui";
import { StatusPill } from "@/components/tenant/statuses/StatusPill";
import type { RestoreFileStatus } from "@/components/tenant/customers/RestoreFileDialog";
import {
  archivedAgo,
  archivedByLabel,
  archivedDebtorName,
  archiveSource,
  type ArchivedDebtor,
} from "@/lib/archive-api";
import { formatMoney } from "@/lib/customers-api";

/** "12 Oct 2026 at 05:46 AM", or null when the timestamp is missing/unparseable. */
function formatArchivedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return `${date} at ${time}`;
}

/** Read-only summary of one archived file, opened from the Archive tab's View.
 *  An archived file is parked, not worked, so this shows only what the archive
 *  row carries — no edit, notes, documents or calls — plus the one action the
 *  archive allows: Restore (behind archive.restore). */
export function ArchivedFileDrawer({
  open,
  debtor,
  status,
  canRestore,
  onOpenChange,
  onRestore,
}: {
  open: boolean;
  debtor: ArchivedDebtor;
  /** The status the file was on when archived; null when it had none. */
  status: RestoreFileStatus | null;
  canRestore: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: () => void;
}) {
  const fileRef = debtor.ourFileNo || `#${debtor.uploadedDebtorId}`;
  const name = archivedDebtorName(debtor);
  const source = archiveSource(debtor);
  const ago = archivedAgo(debtor.archivedAt);
  const at = formatArchivedAt(debtor.archivedAt);
  const archivedBy = archivedByLabel(debtor);
  // The backend's archiveCustomer takes no reason, so this is derived: a status
  // rule archives because the file reached that status.
  const reason =
    source === "auto"
      ? status
        ? `Auto-archive · ${status.name}`
        : "Auto-archive"
      : source === "manual"
        ? "Manual archive"
        : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 pr-12 border-b border-border">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="font-display text-xl font-bold tracking-tight">
              {name || fileRef}
            </SheetTitle>
            <Pill tone="muted">ARCHIVED</Pill>
          </div>
          <SheetDescription className="mt-1 font-mono text-xs text-muted-foreground">
            {fileRef}
          </SheetDescription>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <dl className="space-y-3.5 text-sm">
            <Row label="Client">{debtor.clientName || "—"}</Row>
            <Row label="Team">{debtor.teamName || "—"}</Row>
            <Row label="Status when archived">
              {status ? (
                <StatusPill
                  code={status.code}
                  name={status.name}
                  color={status.color}
                  className="text-xs px-2 py-0.5"
                />
              ) : (
                <Pill tone="muted">No status</Pill>
              )}
            </Row>
            <Row label="Balance">
              <span className="font-mono tabular-nums">
                {formatMoney(debtor.currentOutstandingBalance)}
              </span>
            </Row>
            <Row label="Archived">{ago && at ? `${ago} · ${at}` : (at ?? "—")}</Row>
            <Row label="Source">
              {source === "auto" ? (
                <Pill tone="success">Auto</Pill>
              ) : source === "manual" ? (
                <Pill tone="muted">Manual</Pill>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Archived by">{archivedBy ?? "—"}</Row>
            <Row label="Reason">{reason ?? "—"}</Row>
          </dl>

          <div className="rounded-xl border border-border bg-muted/30 px-4 py-4">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <ShieldCheck className="h-4 w-4 text-success" /> Records retained
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Activities, communications, documents and payment history for this file are retained.
              Archiving only parks the file — nothing is deleted. This screen is read-only.
            </p>
          </div>
        </div>

        {canRestore && (
          <div className="px-6 py-4 border-t border-border">
            <button
              onClick={onRestore}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
            >
              <RotateCcw className="h-4 w-4" /> Restore file
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-right font-medium min-w-0">{children}</dd>
    </div>
  );
}
