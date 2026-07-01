// Tenant workspace settings calls to the separately-hosted backend.
//   POST /tenant/getTenantDetails    {}                    -> TenantDetails
//   POST /tenant/updateTenantDetails { ...TenantDetails }   -> {}
// A single tenant record backs the whole Settings page: the Organization tab
// (companyName, timezone), the Hours tab (per-day enabled/start/end), and the
// Connectors tab (sender email — Gmail/Outlook). The senderPhone* fields are
// legacy (the Twilio settings UI was removed in favour of the Phone Numbers
// module) and are round-tripped untouched. updateTenantDetails replaces the
// whole record, so every save must send the FULL payload.
// Timezone options come from getTimezoneList (see profile-api).
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";

/** 0 = closed, 1 = open. Backend uses numeric flags, not booleans. */
export type DayFlag = 0 | 1;

export type TenantDetails = {
  tenantId: number;
  companyName: string;
  timezone: string;
  senderEmailType: string | null;
  senderEmailId: string | null;
  senderEmailPassword: string | null;
  senderPhoneAreaCode: string | null;
  senderPhoneCountry: string | null;
  senderPhoneNo: string | null;
  sunEnabled: DayFlag;
  monEnabled: DayFlag;
  tueEnabled: DayFlag;
  wedEnabled: DayFlag;
  thuEnabled: DayFlag;
  friEnabled: DayFlag;
  satEnabled: DayFlag;
  sunStartTime: string;
  monStartTime: string;
  tueStartTime: string;
  wedStartTime: string;
  thuStartTime: string;
  friStartTime: string;
  satStartTime: string;
  sunEndTime: string;
  monEndTime: string;
  tueEndTime: string;
  wedEndTime: string;
  thuEndTime: string;
  friEndTime: string;
  satEndTime: string;
};

/** Fields accepted by updateTenantDetails (everything except the server-owned tenantId). */
export type UpdateTenantDetailsInput = Omit<TenantDetails, "tenantId">;

export function getTenantDetails(): Promise<TenantDetails> {
  return apiPost<TenantDetails>("/tenant/getTenantDetails");
}

export function updateTenantDetails(input: UpdateTenantDetailsInput): Promise<unknown> {
  return apiPost("/tenant/updateTenantDetails", { ...input });
}
