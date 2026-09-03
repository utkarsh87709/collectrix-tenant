import { useEffect, useState } from "react";
import { ArrowLeftRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/tenant/ui";
import {
  getAssignableTeams,
  changeCustomerTeam,
  type AssignableTeam,
} from "@/lib/customers-api";

/** Shared by the customers list's bulk-select bar and a single customer's
 *  Manage menu — `count` is just display copy, `uploadedDebtorIdList` carries
 *  either the multi-select or a one-item array. */
export function MoveToTeamDialog({
  count,
  uploadedDebtorIdList,
  onClose,
  onMoved,
}: {
  count: number;
  uploadedDebtorIdList: number[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const [teams, setTeams] = useState<AssignableTeam[]>([]);
  const [teamId, setTeamId] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getAssignableTeams()
      .then((r) => setTeams(r.teamList))
      .catch(() => toast.error("Couldn't load teams."));
  }, []);

  const submit = async () => {
    if (teamId === "") return;
    setSubmitting(true);
    try {
      await changeCustomerTeam({ uploadedDebtorIdList, teamId, remark: reason.trim() });
      toast.success(count > 1 ? `${count} files moved.` : "File moved.");
      onMoved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't move to that team.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-tenant" />
            <div className="font-display font-bold text-base">Move to team</div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            This file will move to the chosen team with the status cleared and the current member
            unassigned. The destination team gives it a new status and member on their Moved Files
            page.
          </p>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Destination team
            </span>
            <NativeSelect
              className="mt-1"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Choose a team…</option>
              {teams.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.teamName}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Reason / note (optional)
            </span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Better creditor fit for that desk"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={teamId === "" || submitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tenant text-white text-sm font-semibold disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <ArrowLeftRight className="h-4 w-4" /> Move
          </button>
        </div>
      </div>
    </div>
  );
}
