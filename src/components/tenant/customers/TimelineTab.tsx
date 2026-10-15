import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { PageCard, CardHead } from "@/components/tenant/ui";
import { TimelineList, TimelineSkeleton } from "./CustomerTimeline";
import { isFlagEvent, useCustomerTimeline, type TimelineState } from "./customer-timeline";

/**
 * The customer profile's Timeline tab. Status and Flag history both come from the
 * one getCustomerTimeline call — rows headed "Flag Added" / "Flag Removed" go to
 * Flag history, everything else to Status history. There's no per-customer audit
 * endpoint; per backend dev, Audit trail just links to the tenant audit log.
 * The backend scopes the timeline to the caller's tenant.
 */
export function TimelineTab({
  uploadedDebtorId,
  canViewAudit,
}: {
  uploadedDebtorId: number;
  /** audit.view — the Audit trail card links to /tenant/audit, which needs it. */
  canViewAudit: boolean;
}) {
  const state = useCustomerTimeline(uploadedDebtorId);
  const { status, flags } = useMemo(() => {
    const events = state?.events ?? [];
    return {
      status: events.filter((e) => !isFlagEvent(e)),
      flags: events.filter(isFlagEvent),
    };
  }, [state]);

  return (
    <div className="space-y-4">
      <PageCard>
        <CardHead title="Status history" subtitle="Customer file actions" />
        <div className="px-6 py-5">
          <HistoryBody state={state} events={status} emptyText="No status changes recorded." />
        </div>
      </PageCard>

      <PageCard>
        <CardHead
          title="Flag history"
          subtitle={
            state
              ? `${flags.length} flag change${flags.length === 1 ? "" : "s"}`
              : "Loading flag changes…"
          }
        />
        <div className="px-6 py-5">
          <HistoryBody state={state} events={flags} emptyText="No flag changes recorded." />
        </div>
      </PageCard>

      {canViewAudit && (
        // Header-only card: drop CardHead's divider so it doesn't double the card border.
        <PageCard className="[&>div]:border-b-0">
          <CardHead
            title="Audit trail"
            subtitle="Every change to this customer — imports, edits, AI actions, CRM sync, payments, communications, archive/delete"
            action={
              <Link
                to="/tenant/audit"
                className="text-sm font-semibold text-tenant hover:underline"
              >
                Full log
              </Link>
            }
          />
        </PageCard>
      )}
    </div>
  );
}

function HistoryBody({
  state,
  events,
  emptyText,
}: {
  state: TimelineState | null;
  events: TimelineState["events"];
  emptyText: string;
}) {
  if (!state) return <TimelineSkeleton />;
  if (state.error) {
    return <p className="text-xs text-destructive">Couldn't load the timeline.</p>;
  }
  return <TimelineList events={events} emptyText={emptyText} initialCount={3} />;
}
