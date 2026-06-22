// Public tenant-invite onboarding flow (no auth token — the visitor is not yet
// a logged-in user). Reached via .../tenantinvite?inviteCode=<uuid>.
//   POST /tenant/getInviteCodeDetails       { inviteCode }            -> invite + package details
//   POST /tenant/makePayment                { cardNumber }            -> { paymentId }   (demo gateway)
//   POST /tenant/completeTenantInviteOnboard { ...registration }      -> {}              (activates tenant)
//
// These use a bare fetch (not apiPost) on purpose: the visitor is logged out, so
// a failing response must surface as an inline error rather than tripping the
// global "session expired" redirect to /login. The backend returns HTTP 200 even
// for business errors, with success carried on meta.status.
import { apiUrl } from "./api-client";

export type InviteDetails = {
  tenantId: number;
  companyName: string;
  emailId: string;
  phoneNo: string;
  packageId: number;
  status: string; // "invited" while the invite is still redeemable
  inviteCode: string;
  packageName: string;
  description: string;
  monthlyPrice: string;
  annualPrice: string;
  overagePerDebtor: string;
  debtorLimit: number;
  tenantUserLimit: number;
  includedModule: string[];
};

export type CompleteOnboardInput = {
  tenantId: number;
  packageId: number;
  paymentId: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  zipCode: string;
  password: string;
  billingFirstName: string;
  billingLastName: string;
  billingAdress: string; // backend spelling (single 'd')
  billingCity: string;
  billingZipCode: string;
  amount: string;
  emailId: string;
  phoneNo: string;
};

async function publicPost<T>(path: string, body: Record<string, unknown>, failMsg: string): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!json?.meta?.status) {
    throw new Error(json?.meta?.message || failMsg);
  }
  return json.data as T;
}

export function getInviteCodeDetails(inviteCode: string): Promise<InviteDetails> {
  return publicPost<InviteDetails>(
    "/tenant/getInviteCodeDetails",
    { inviteCode },
    "This invite link is invalid or has expired.",
  );
}

export function makePayment(cardNumber: string): Promise<{ paymentId: string }> {
  return publicPost<{ paymentId: string }>(
    "/tenant/makePayment",
    { cardNumber },
    "Payment failed. Please try again.",
  );
}

export function completeTenantInviteOnboard(input: CompleteOnboardInput): Promise<unknown> {
  return publicPost(
    "/tenant/completeTenantInviteOnboard",
    { ...input },
    "Failed to complete onboarding. Please try again.",
  );
}
