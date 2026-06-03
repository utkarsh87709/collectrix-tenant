// Client-side calls to the separately-hosted backend for agent availability
// and callback meetings. Replaces the former TanStack Start server functions.
import { apiFetch } from "./api-client";
import type { WeeklyHours } from "./agent-availability-utils";

export type Availability = {
  timezone: string;
  weekly_hours: WeeklyHours;
  meeting_link_base: string;
};

export type CallbackMeeting = {
  id: string;
  debtor_name: string;
  debtor_phone: string | null;
  debtor_email: string | null;
  scheduled_at: string;
  duration_min: number;
  timezone: string;
  meeting_link: string;
  status: string;
  notes: string | null;
  source?: string | null;
};

export function getAvailability(): Promise<Availability> {
  return apiFetch<Availability>("/agent-availability");
}

export function saveAvailability(
  input: Availability,
): Promise<{ ok: boolean; error?: string }> {
  return apiFetch<{ ok: boolean; error?: string }>("/agent-availability", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getCallbacks(): Promise<{
  ok: boolean;
  items: CallbackMeeting[];
  error?: string;
}> {
  return apiFetch<{ ok: boolean; items: CallbackMeeting[]; error?: string }>(
    "/callbacks",
  );
}
