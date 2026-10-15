import { useEffect, useState } from "react";
import { getCustomerTimeline, type CustomerTimelineEvent } from "@/lib/customers-api";

// Per backend dev (2026-10-15): Flag history is the getCustomerTimeline rows with
// these two headers; every other row belongs to Status history. Matched
// case-insensitively in case the casing drifts.
const FLAG_HEADERS = new Set(["flag added", "flag removed"]);

export function isFlagEvent(e: CustomerTimelineEvent): boolean {
  return FLAG_HEADERS.has(e.header?.trim().toLowerCase() ?? "");
}

/**
 * Who made the change. The backend currently glues "System" onto every userName
 * ("Jas SaranSystem" — even for manual actions), so that suffix is stripped; a
 * bare "System" is kept as the actor. Drop this once the backend sends it clean.
 */
export function timelineActor(userName: string | null | undefined): string | null {
  const name = userName?.trim();
  if (!name) return null;
  return name.replace(/^(.*\S)System$/, "$1").trim();
}

/** "2026-10-14 14:25 UTC" — the design shows every timeline time in UTC. */
export function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const s = d.toISOString();
  return `${s.slice(0, 10)} ${s.slice(11, 16)} UTC`;
}

export type TimelineState = { events: CustomerTimelineEvent[]; error: boolean };

/**
 * A file's getCustomerTimeline rows, newest first — `null` until the first load
 * for this file. A change to `refreshKey` (e.g. the caller's freshly refetched
 * details) reloads in place without flashing back to the skeleton.
 */
export function useCustomerTimeline(
  uploadedDebtorId: number,
  refreshKey?: unknown,
): TimelineState | null {
  const [state, setState] = useState<(TimelineState & { id: number }) | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCustomerTimeline(uploadedDebtorId)
      .then((r) => {
        if (cancelled) return;
        const events = [...(r.timelineList ?? [])].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setState({ id: uploadedDebtorId, events, error: false });
      })
      .catch(() => !cancelled && setState({ id: uploadedDebtorId, events: [], error: true }));
    return () => {
      cancelled = true;
    };
  }, [uploadedDebtorId, refreshKey]);

  return state?.id === uploadedDebtorId ? state : null;
}
