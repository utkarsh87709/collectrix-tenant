import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  History,
  Loader2,
  UserCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageCard, CardHead, NativeSelect, Pill } from "@/components/tenant/ui";
import { formatDateTime, timeAgo } from "@/components/tenant/inbox/inbox-utils";
import {
  fullName,
  getAssignableTeams,
  getCustomerTimeline,
  type AssignableTeam,
  type CustomerDetails,
  type CustomerTimelineEvent,
} from "@/lib/customers-api";
import {
  getTeamDeckAssignUserList,
  teamDeckAssignUser,
  memberName,
  type AssignableMember,
} from "@/lib/team-deck-api";

// getCustomerTimeline headers that make up the assignment history (per backend
// dev, 2026-10-15). Matched case-insensitively in case the casing drifts.
const HISTORY_HEADERS = new Set(["team changed", "assigned user"]);

/**
 * The customer profile's Assignment tab: who works the file and on which team.
 * The agent can be changed to another member of the file's team (teamDeckAssignUser).
 * Picking another team doesn't save here: it opens the Move to team dialog, since
 * a move also clears the agent and resets the status. History is the timeline
 * filtered to assignment events.
 */
export function AssignmentTab({
  details,
  canReassign,
  canChangeTeam,
  showMoveButton,
  isArchived,
  onMoveToTeam,
  onChanged,
}: {
  details: CustomerDetails;
  canReassign: boolean;
  /** Makes the Team dropdown editable (customers.moveTeam). */
  canChangeTeam: boolean;
  showMoveButton: boolean;
  isArchived: boolean;
  onMoveToTeam: (teamId?: number) => void;
  onChanged: () => void;
}) {
  const teamId = details.assignedTeamId;
  const currentId = details.assignedTo;
  const currentName = fullName({
    firstName: details.assignedUserFirstName,
    lastName: details.assignedUserLastName,
  });
  // An archived file is parked and read-only — restore it to change anything.
  const editable = canReassign && !isArchived && teamId != null;
  const teamEditable = canChangeTeam && !isArchived;

  const [teams, setTeams] = useState<AssignableTeam[] | null>(null);
  useEffect(() => {
    if (!teamEditable) return;
    let cancelled = false;
    getAssignableTeams()
      .then((r) => !cancelled && setTeams(r.teamList))
      .catch(() => {
        if (cancelled) return;
        setTeams([]);
        toast.error("Couldn't load teams.");
      });
    return () => {
      cancelled = true;
    };
  }, [teamEditable]);

  const [members, setMembers] = useState<AssignableMember[] | null>(null);
  useEffect(() => {
    if (!editable || teamId == null) return;
    let cancelled = false;
    setMembers(null);
    getTeamDeckAssignUserList(teamId)
      .then((r) => !cancelled && setMembers(r.assignUserList ?? []))
      .catch(() => {
        if (cancelled) return;
        setMembers([]);
        toast.error("Couldn't load this team's members.");
      });
    return () => {
      cancelled = true;
    };
  }, [editable, teamId]);

  // Keep the current owner selectable even if they've since left the team.
  const options = useMemo(() => {
    const list = members ?? [];
    if (currentId != null && !list.some((m) => m.userId === currentId)) {
      return [
        {
          userId: currentId,
          firstName: currentName || `User #${currentId}`,
          lastName: null,
          emailId: "",
          role: "",
        },
        ...list,
      ];
    }
    return list;
  }, [members, currentId, currentName]);

  const [draft, setDraft] = useState<number | null>(currentId);
  const [saving, setSaving] = useState(false);
  const dirty = draft !== currentId;

  const save = async () => {
    if (draft == null || !dirty) return;
    const member = options.find((m) => m.userId === draft);
    setSaving(true);
    try {
      await teamDeckAssignUser(draft, [details.uploadedDebtorId]);
      toast.success(`Assigned to ${member ? memberName(member) : "the selected member"}.`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reassign this file.");
    } finally {
      setSaving(false);
    }
  };

  const [history, setHistory] = useState<CustomerTimelineEvent[] | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    getCustomerTimeline(details.uploadedDebtorId)
      .then((r) => {
        if (cancelled) return;
        const rows = (r.timelineList ?? []).filter((e) =>
          HISTORY_HEADERS.has(e.header?.trim().toLowerCase()),
        );
        rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setHistory(rows);
      })
      .catch(() => !cancelled && setHistory([]));
    return () => {
      cancelled = true;
    };
  }, [details.uploadedDebtorId]);

  return (
    <PageCard>
      <CardHead
        title="Assignment & ownership"
        subtitle="Who is responsible for this customer — the assigned agent and team"
        action={
          showMoveButton && !isArchived ? (
            <button
              onClick={() => onMoveToTeam()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-semibold hover:bg-muted"
            >
              <ArrowLeftRight className="h-4 w-4" /> Move to team
            </button>
          ) : undefined
        }
      />

      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Assigned agent" icon={<UserCircle className="h-3.5 w-3.5" />}>
          <NativeSelect
            value={draft == null ? "" : String(draft)}
            disabled={!editable || saving || members === null}
            onChange={(e) => setDraft(e.target.value ? Number(e.target.value) : null)}
            aria-label="Assigned agent"
          >
            {editable && members === null ? (
              <option value="">Loading members…</option>
            ) : editable ? (
              <>
                {currentId == null && <option value="">Unassigned — pick a member</option>}
                {options.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {memberName(m)}
                    {m.userId === currentId ? " (current owner)" : ""}
                  </option>
                ))}
                {options.length === 0 && (
                  <option value="" disabled>
                    No members on this team
                  </option>
                )}
              </>
            ) : (
              <option value={currentId ?? ""}>{currentName || "Unassigned"}</option>
            )}
          </NativeSelect>
        </Field>
        <Field label="Team" icon={<Users className="h-3.5 w-3.5" />}>
          <NativeSelect
            // Stays on the current team: a pick opens the move dialog, and
            // cancelling it should leave this showing where the file still is.
            value={teamId ?? ""}
            disabled={!teamEditable || teams === null}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (e.target.value && v !== teamId) onMoveToTeam(v);
            }}
            aria-label="Team"
          >
            {(teamId == null || !teams?.some((t) => t.teamId === teamId)) && (
              <option value={teamId ?? ""}>{details.teamName || "No team"}</option>
            )}
            {teams?.map((t) => (
              <option key={t.teamId} value={t.teamId}>
                {t.teamName}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {(isArchived || (canReassign && teamId == null)) && (
          <p className="md:col-span-2 text-xs text-muted-foreground">
            {isArchived
              ? "This file is archived. Restore it to change its assignment."
              : "This file isn't on a team yet, so there's no one to hand it to. Move it to a team first."}
          </p>
        )}
      </div>

      <div className="px-6 py-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          {showHistory ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <History className="h-4 w-4" /> Assignment history
          {history !== null && ` (${history.length})`}
        </button>
        {editable && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDraft(currentId)}
              disabled={!dirty || saving}
              className="px-3 py-1.5 rounded-lg border border-border text-sm font-semibold hover:bg-muted disabled:opacity-40"
            >
              Reset
            </button>
            <button
              onClick={save}
              disabled={!dirty || draft == null || saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-40"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save assignment
            </button>
          </div>
        )}
      </div>

      {showHistory && (
        <div className="px-6 py-3 border-t border-border">
          {history === null ? (
            <div className="space-y-2 py-1">
              <div className="h-6 animate-pulse rounded-md bg-muted" />
              <div className="h-6 animate-pulse rounded-md bg-muted" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">No assignment changes yet.</p>
          ) : (
            <ol className="space-y-2.5 text-sm">
              {history.map((e) => (
                <li key={e.timelineId} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Pill tone={e.header.trim().toLowerCase() === "team changed" ? "info" : "tenant"}>
                    {e.header}
                  </Pill>
                  {e.message && e.message !== e.header && (
                    <span className="text-foreground">{e.message}</span>
                  )}
                  {e.userName && <span className="text-muted-foreground">· by {e.userName}</span>}
                  <span
                    className="ml-auto text-xs text-muted-foreground"
                    title={formatDateTime(e.createdAt)}
                  >
                    {timeAgo(e.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </PageCard>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
        {icon} {label}
      </div>
      {children}
    </div>
  );
}
