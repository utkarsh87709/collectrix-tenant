// Phone-number (Twilio) management calls to the separately-hosted backend.
//   POST /tenant/getTwilioCountries {}                                          -> { countryList[] }
//   POST /tenant/getNumbers   { numberType, countryCode, areaCode }             -> { telephoneNumberList[] }
//   POST /tenant/buyNumber    { numberType, countryCode, areaCode, numberList } -> {}
//   POST /tenant/getNumberList {}                                               -> { phoneNoList[] }
//   POST /tenant/enableNumber  { phoneNoId }                                    -> {}
//   POST /tenant/disableNumber { phoneNoId }                                    -> {}
//   POST /tenant/updateNumberConfig { phoneNoId, callEnabled, smsEnabled }      -> {}
//   POST /tenant/releaseNumber { phoneNoId }                                    -> {}
// getNumbers / buyNumber talk to Twilio live; while the Twilio connection is
// disabled for testing they return meta.status=false ("Server Error") with an
// empty list — getNumbers treats that as "no numbers available".
// All authenticated with the raw token (attached automatically by apiPost).
import { apiFetch, apiPost } from "./api-client";

export type NumberType = "local" | "tollFree";

/** Observed statuses: "active", "inactive", "released" (and "pending" pre-provisioning). */
export type PhoneNumberStatus = "active" | "inactive" | "pending" | "released" | (string & {});

export type PhoneNumber = {
  phoneNoId: number;
  createdAt: string;
  numberType: NumberType;
  countryCode: string;
  areaCode: string;
  phoneNo: string;
  status: PhoneNumberStatus;
  tenantId: number;
  /** 0 | 1 from the backend. */
  smsEnabled: number;
  callEnabled: number;
};

export type TwilioCountry = { countryCode: string; countryName: string };

// Shape of a purchasable number is unconfirmed — Twilio is disabled in the test
// env so getNumbers returns an empty list. Fields below cover the common Twilio
// AvailablePhoneNumber resource; `numberFor()` reads them defensively. Revisit
// once the Twilio connection is enabled and a real payload is observed.
export type AvailableNumber = {
  phoneNumber?: string;
  friendlyName?: string;
  locality?: string;
  region?: string;
  [key: string]: unknown;
};

/** Best-effort E.164 string for a purchasable number (used by buyNumber). */
export function numberFor(n: AvailableNumber): string {
  return String(n.phoneNumber ?? n.friendlyName ?? "");
}

/** Human label for a purchasable number, e.g. "Toronto, ON". */
export function localityFor(n: AvailableNumber): string {
  return [n.locality, n.region].filter(Boolean).join(", ");
}

export function getNumberList(): Promise<{ phoneNoList: PhoneNumber[] }> {
  return apiPost<{ phoneNoList: PhoneNumber[] }>("/tenant/getNumberList");
}

export function getTwilioCountries(): Promise<{ countryList: TwilioCountry[] }> {
  return apiPost<{ countryList: TwilioCountry[] }>("/tenant/getTwilioCountries");
}

// Tolerant of the Twilio-off "Server Error" envelope: any non-success simply
// means no numbers to show. Genuine network/HTTP failures still throw.
export async function getNumbers(input: {
  numberType: NumberType;
  countryCode: string;
  areaCode: string;
}): Promise<AvailableNumber[]> {
  const res = await apiFetch<{ data?: { telephoneNumberList?: AvailableNumber[] } }>(
    "/tenant/getNumbers",
    { method: "POST", body: JSON.stringify(input) },
  );
  return res?.data?.telephoneNumberList ?? [];
}

export function buyNumber(input: {
  numberType: NumberType;
  countryCode: string;
  areaCode: string;
  numberList: string[];
}): Promise<unknown> {
  return apiPost("/tenant/buyNumber", { ...input });
}

export function enableNumber(phoneNoId: number): Promise<unknown> {
  return apiPost("/tenant/enableNumber", { phoneNoId });
}

export function disableNumber(phoneNoId: number): Promise<unknown> {
  return apiPost("/tenant/disableNumber", { phoneNoId });
}

export function updateNumberConfig(input: {
  phoneNoId: number;
  callEnabled: number;
  smsEnabled: number;
}): Promise<unknown> {
  return apiPost("/tenant/updateNumberConfig", { ...input });
}

export function releaseNumber(phoneNoId: number): Promise<unknown> {
  return apiPost("/tenant/releaseNumber", { phoneNoId });
}
