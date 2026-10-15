import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { CustomerTimelineEvent } from "@/lib/customers-api";
import { formatDateTime, timeAgo } from "@/components/tenant/inbox/inbox-utils";
import { formatUtc, timelineActor, useCustomerTimeline } from "./customer-timeline";

export function TimelineSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-10 animate-pulse rounded-lg bg-muted" />
      <div className="h-10 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

/**
 * Timeline rows as a dotted vertical rail: header, then the message (skipped
 * when empty), then "time UTC · who".
 */
export function TimelineList({
  events,
  emptyText,
  initialCount,
  showRelative = false,
}: {
  events: CustomerTimelineEvent[];
  emptyText: string;
  /** Rows shown before "Show N more"; every row when omitted. */
  initialCount?: number;
  /** Also print "· 3 hours ago" after the UTC time. */
  showRelative?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (events.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  }

  const hiddenCount = initialCount != null ? Math.max(events.length - initialCount, 0) : 0;
  const collapsible = hiddenCount > 0;
  const shown = collapsible && !expanded ? events.slice(0, initialCount) : events;

  return (
    <div>
      <div className="mb-3 text-xs text-muted-foreground">newest first · all times UTC</div>
      <ol className="ml-1 border-l border-border">
        {shown.map((e) => {
          // Messages can carry stray spaces ("Utkarsh Singh Parihar  -> Sam Patel ").
          const detail = e.message?.replace(/\s+/g, " ").trim();
          const actor = timelineActor(e.userName);
          return (
            <li key={e.timelineId} className="relative pb-5 pl-5 last:pb-0">
              <span
                className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full bg-tenant ring-4 ring-card"
                aria-hidden
              />
              <div className="text-sm font-semibold">{e.header}</div>
              {detail && detail !== e.header && (
                <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
              )}
              <div
                className="mt-0.5 text-[11px] text-muted-foreground"
                title={formatDateTime(e.createdAt)}
              >
                {formatUtc(e.createdAt)}
                {actor && ` · ${actor}`}
                {showRelative && <span className="opacity-70"> · {timeAgo(e.createdAt)}</span>}
              </div>
            </li>
          );
        })}
      </ol>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-tenant hover:underline"
        >
          {expanded ? (
            <>
              <Minus className="h-4 w-4" /> Show less
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Show {hiddenCount} more
            </>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Every timeline row in one list (status and flag changes together) — the
 * inbox details drawer's Timeline section. The customer profile splits the same
 * rows into Status and Flag history instead (TimelineTab).
 */
export function CustomerTimeline({
  uploadedDebtorId,
  refreshKey,
}: {
  uploadedDebtorId: number;
  refreshKey?: unknown;
}) {
  const state = useCustomerTimeline(uploadedDebtorId, refreshKey);
  if (!state) return <TimelineSkeleton />;
  if (state.error) {
    return <p className="text-xs text-destructive">Couldn't load the timeline.</p>;
  }
  return (
    <TimelineList
      events={state.events}
      emptyText="No activity recorded on this file yet."
      showRelative
    />
  );
}
