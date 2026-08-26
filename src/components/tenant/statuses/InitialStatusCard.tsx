import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NativeSelect, PageCard } from "@/components/tenant/ui";
import {
  changeInitialStatus,
  checkInitialStatusUsed,
  findInitialStatus,
  type ClientTeamStatus,
} from "@/lib/status-automation-api";

/**
 * The one status new files land in for a team+client pair.
 *
 * Changing it is a two-step flow: checkInitialStatusUsed with the newly picked
 * status first, then changeInitialStatus. When the check comes back false its
 * message is shown as a confirm the user may proceed through — it is advisory
 * (debtors already sitting on a status are not moved), not a block. When it
 * comes back true the change is committed straight away with no dialog.
 *
 * No status carrying initialStatus 1 means the pair has never been configured,
 * so the picker sits on "Select initial status…".
 */
export function InitialStatusCard({
  statuses,
  teamName,
  clientName,
  clientId,
  teamId,
  onChanged,
}: {
  statuses: ClientTeamStatus[];
  teamName: string;
  clientName: string;
  clientId: number;
  teamId: number;
  onChanged: () => void;
}) {
  const current = findInitialStatus(statuses);
  const [pending, setPending] = useState<ClientTeamStatus | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const commit = async (statusId: number) => {
    setBusy(true);
    try {
      await changeInitialStatus({ clientId, teamId, statusId });
      toast.success("Initial status updated");
      setPending(null);
      setWarning(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the initial status.");
    } finally {
      setBusy(false);
    }
  };

  const handleSelect = async (raw: string) => {
    const statusId = Number(raw);
    if (!statusId || statusId === current?.statusId) return;
    const next = statuses.find((s) => s.statusId === statusId);
    if (!next) return;

    setPending(next);
    setBusy(true);
    try {
      const check = await checkInitialStatusUsed({ clientId, teamId, statusId });
      if (check.inUse) {
        setWarning(check.message || "This status is already in use. Do you want to proceed?");
        setBusy(false);
        return; // wait for the user to confirm
      }
      await commit(statusId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not verify the status change.");
      setPending(null);
      setBusy(false);
    }
  };

  const dismissWarning = () => {
    if (busy) return;
    setWarning(null);
    setPending(null);
  };

  return (
    <>
      <PageCard>
        <div className="px-6 py-5 flex items-start gap-3">
          <span className="shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-tenant-soft text-tenant flex items-center justify-center">
            <Flag className="h-4 w-4" />
          </span>
          {/* The control sits in this column too, so it lines up with the
              heading rather than the card edge. */}
          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold">Initial status on assignment</h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Files newly assigned to <span className="font-semibold">{teamName}</span> for{" "}
                <span className="font-semibold">{clientName}</span> land here. Customers already in
                another status stay where they are.
              </p>
            </div>

            <label className="block max-w-sm">
              <span className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Status new files land in
              </span>
              <NativeSelect
                value={current?.statusId ?? ""}
                onChange={(e) => handleSelect(e.target.value)}
                disabled={busy || statuses.length === 0}
              >
                {/* No status carries initialStatus:1 → this pair has never been configured. */}
                <option value="">Select initial status…</option>
                {statuses.map((s) => (
                  <option key={s.statusId} value={s.statusId}>
                    {s.statusCode} · {s.status}
                  </option>
                ))}
              </NativeSelect>
              {busy && !warning && (
                <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
                </span>
              )}
            </label>
          </div>
        </div>
      </PageCard>

      <AlertDialog open={!!warning} onOpenChange={(o) => !o && dismissWarning()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change the initial status?</AlertDialogTitle>
            <AlertDialogDescription>{warning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pending) commit(pending.statusId);
              }}
              disabled={busy}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
