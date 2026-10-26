import { FileText, Mail, Send } from "lucide-react";
import { Pill } from "@/components/tenant/ui";
import { statusLabel, type BulkOperationType } from "@/lib/bulk-operations-api";

/** An operation's run status. Only "completed" and "scheduled" are confirmed,
 *  so the rest are toned by keyword. */
export function OperationStatusPill({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const tone =
    s === "completed"
      ? "success"
      : s === "scheduled"
        ? "info"
        : s.includes("fail")
          ? "danger"
          : s.includes("cancel")
            ? "muted"
            : "warning";
  return <Pill tone={tone}>{statusLabel(status)}</Pill>;
}

/** Tinted chip with the operation type's icon. */
export function OperationTypeIcon({ type }: { type: BulkOperationType }) {
  const Icon = type === "email" ? Mail : type === "document" ? FileText : Send;
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--tenant)]/10 text-tenant shrink-0">
      <Icon className="h-4 w-4" />
    </span>
  );
}
