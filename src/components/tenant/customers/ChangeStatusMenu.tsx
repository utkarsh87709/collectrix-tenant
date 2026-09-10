import { useEffect, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/tenant/statuses/StatusPill";
import { Pill } from "@/components/tenant/ui";
import { getAllStatus, type Status } from "@/lib/statuses-api";
import { updateCustomerStatus } from "@/lib/customers-api";

/** The status pill in a customer's header. For users who may change status it
 *  doubles as a dropdown listing every tenant status (there's no transition-rule
 *  API, so all of them are offered); everyone else just sees the pill. */
export function ChangeStatusMenu({
  uploadedDebtorId,
  statusId,
  statusCode,
  statusName,
  statusColor,
  canChange,
  onChanged,
}: {
  uploadedDebtorId: number;
  statusId: number | null;
  statusCode: string | null;
  statusName: string | null;
  statusColor: string | null;
  canChange: boolean;
  onChanged: () => void;
}) {
  const [statuses, setStatuses] = useState<Status[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canChange) return;
    let cancelled = false;
    getAllStatus()
      .then((s) => {
        if (!cancelled) setStatuses(s);
      })
      .catch(() => {
        if (!cancelled) setStatuses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canChange]);

  const pill = statusName ? (
    <StatusPill
      code={statusCode ?? statusName}
      name={statusName}
      color={statusColor ?? "#64748b"}
    />
  ) : (
    <Pill tone="muted">No status</Pill>
  );

  if (!canChange) return pill;

  const choose = async (s: Status) => {
    if (s.statusId === statusId) return;
    setBusy(true);
    try {
      await updateCustomerStatus({
        uploadedDebtorIdList: [uploadedDebtorId],
        statusId: s.statusId,
      });
      toast.success(`Status changed to ${s.status}.`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change the status.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={busy}
          title="Change status"
          className="inline-flex items-center gap-1 rounded-full focus:outline-none focus:ring-2 focus:ring-tenant/40 disabled:opacity-60"
        >
          {pill}
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Change status
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {statuses === null ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">Loading statuses…</div>
        ) : statuses.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">No statuses configured.</div>
        ) : (
          statuses.map((s) => (
            <DropdownMenuItem
              key={s.statusId}
              onSelect={() => choose(s)}
              className="flex items-center gap-2"
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: s.statusColorCode }}
                aria-hidden
              />
              <span className="font-semibold">{s.statusCode}</span>
              <span className="text-muted-foreground truncate">· {s.status}</span>
              {s.statusId === statusId && <Check className="h-3.5 w-3.5 ml-auto text-tenant" />}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
