import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { getCustomerTimeline, type CustomerTimelineEvent } from "@/lib/customers-api";
import { formatDateTime, timeAgo } from "@/components/tenant/inbox/inbox-utils";

/**
 * A customer file's activity history from getCustomerTimeline, newest first.
 * Shared by the inbox details drawer and the customer profile's Timeline tab.
 */
export function CustomerTimeline({ uploadedDebtorId }: { uploadedDebtorId: number }) {
  const [events, setEvents] = useState<CustomerTimelineEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    getCustomerTimeline(uploadedDebtorId)
      .then((r) => !cancelled && setEvents(r.timelineList ?? []))
      .catch(() => !cancelled && setEvents([]));
    return () => {
      cancelled = true;
    };
  }, [uploadedDebtorId]);

  const sorted = useMemo(
    () =>
      events
        ? [...events].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
        : [],
    [events],
  );

  if (events === null) {
    return (
      <div className="space-y-2">
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (sorted.length === 0) {
    return <p className="text-xs text-muted-foreground">No activity recorded on this file yet.</p>;
  }

  return (
    <ol className="relative ml-3 space-y-3 border-l border-border pl-5">
      {sorted.map((e, i) => (
        <li key={e.timelineId} className="relative">
          <span
            className={`absolute -left-[31px] top-0 inline-flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-card ${
              i === 0 ? "bg-tenant text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            <History className="h-3 w-3" />
          </span>
          <div className="text-sm font-semibold leading-6">{e.header}</div>
          {e.message && e.message !== e.header && (
            <div className="text-xs text-muted-foreground">{e.message}</div>
          )}
          <div className="text-[11px] text-muted-foreground">
            {formatDateTime(e.createdAt)}
            <span className="opacity-70"> · {timeAgo(e.createdAt)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
