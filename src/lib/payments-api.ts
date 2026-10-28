// Payment calls for a customer file — the profile's Payments tab. Endpoints from
// the backend dev's Postman collection (2026-10-27); response shapes verified
// live (read-only) against debtor 167 on devapi the same day.
//
//   POST /tenant/paymentAgreementDetails { uploadedDebtorId }
//     -> { activeAgreementExist, debtorDetails, agreementHistory[],
//          paymentVerificationList[], paymentPendingList[], paymentHistoryList[] }
//     activeAgreementExist decides whether the tab offers the four agreement types
//     (false) or shows the current agreement (true). debtorDetails is the
//     getCustomerDetails record plus the active agreement's payment* fields (all
//     null when there is none). agreementHistory holds every agreement, status
//     "active" or "cancelled", with createdUserId but no creator name.
//     paymentVerificationList holds every payment row (pending, verified,
//     rejected) — claims from submitForVerification and finance postings from
//     postPaymentReceived alike. paymentPendingList is its "pending" rows;
//     paymentHistoryList is its "verified" + "rejected" rows.
//     Payment rows carry createdUserName; paymentDate comes back as an ISO
//     timestamp at UTC midnight, agreement dates as yyyy/mm/dd strings.
//   POST /tenant/createPaymentAgreement { uploadedDebtorId, paymentAgreementType, ...type fields }
//     paymentAgreementType is paymentInFull | settlementInFull | paymentPlanAgreed |
//     promiseToPay; each type's fields are listed on CreatePaymentAgreementInput.
//     Dates go as yyyy/mm/dd, amounts as strings. It does not change the file's
//     status (no PIF/SIF/PPA/PTP statuses exist in the tenant).
//   POST /tenant/cancelPaymentAgreement { uploadedDebtorId } -> cancels the active agreement.
//   POST /tenant/uploadPaymentFile (multipart: file) -> { fileUrl }
//     The fileUrl goes in paymentUploadProof on the agreement / payment calls.
//   POST /tenant/submitForVerification { uploadedDebtorId, paymentAmountReceived, paymentMethod,
//                                        paymentDate, paymentReferenceNumber, paymentNotes,
//                                        paymentUploadProof } -> a "pending" row
//   POST /tenant/postPaymentReceived   { same body } -> a "verified" row straight away
//   POST /tenant/approvePayment { uploadedDebtorId, id } -> pending row becomes "verified"
//   POST /tenant/rejectPayment  { uploadedDebtorId, id } -> pending row becomes "rejected"
//     No reason/notes field on reject. Verified rows reduce the file's
//     currentOutstandingBalance by their amount (debtor 167 went from 90000 to
//     89570 after 200 + 230 were verified).
// All authenticated with the raw token (attached automatically by apiPost); the
// multipart upload attaches it by hand, like every other module's file upload.
import { apiPost, apiUrl } from "./api-client";
import { getAuthToken } from "./auth-token";
import type { CustomerDetails } from "./customers-api";

export type PaymentAgreementType =
  | "paymentInFull"
  | "settlementInFull"
  | "paymentPlanAgreed"
  | "promiseToPay";

export const AGREEMENT_TYPE_LABEL: Record<PaymentAgreementType, string> = {
  paymentInFull: "Payment In Full",
  settlementInFull: "Settlement In Full",
  paymentPlanAgreed: "Payment Plan Agreed",
  promiseToPay: "Promise To Pay",
};

/** Free text on the backend; these are the options the forms offer. */
export const PAYMENT_METHODS = [
  "Bank Transfer",
  "Card",
  "Cheque",
  "Cash",
  "Money Order",
  "Wire",
  "ACH",
] as const;

/** The agreement fields, as stored on an agreement row and on debtorDetails. */
export type PaymentAgreementFields = {
  paymentAgreementType: PaymentAgreementType | null;
  paymentInterestAmount: string | null;
  paymentReferenceNumber: string | null;
  paymentUploadProof: string | null;
  paymentNotes: string | null;
  paymentSettlementAmount: string | null;
  paymentApprovedBy: string | null;
  paymentComputeBy: string | null;
  paymentNoOfInstallments: string | null;
  /** yyyy/mm/dd */
  paymentFirstPaymentDate: string | null;
  paymentPromisedAmount: string | null;
  /** yyyy/mm/dd */
  paymentPromisedDate: string | null;
  /** yyyy/mm/dd */
  paymentDueDate: string | null;
  paymentMethod: string | null;
  paymentFrequency: string | null;
  paymentInstallmentAmount: string | null;
};

export type PaymentAgreement = PaymentAgreementFields & {
  id: number;
  createdAt: string;
  updatedAt: string;
  uploadedDebtorId: number;
  /** "active" | "cancelled" */
  status: string;
  createdUserId: number;
  cancelledUserId: number | null;
};

export type PaymentRecord = {
  id: number;
  createdAt: string;
  updatedAt: string;
  uploadedDebtorId: number;
  /** "pending" | "verified" | "rejected" */
  status: string;
  createdUserId: number;
  paymentAmountReceived: string;
  paymentMethod: string;
  /** ISO timestamp at UTC midnight — read with paymentDateLabel. */
  paymentDate: string;
  paymentReferenceNumber: string | null;
  paymentNotes: string | null;
  paymentUploadProof: string | null;
  createdUserName: string | null;
};

export type PaymentAgreementDetails = {
  activeAgreementExist: boolean;
  debtorDetails: CustomerDetails & PaymentAgreementFields;
  agreementHistory: PaymentAgreement[];
  paymentVerificationList: PaymentRecord[];
  paymentPendingList: PaymentRecord[];
  paymentHistoryList: PaymentRecord[];
};

export function getPaymentAgreementDetails(
  uploadedDebtorId: number,
): Promise<PaymentAgreementDetails> {
  return apiPost("/tenant/paymentAgreementDetails", { uploadedDebtorId });
}

type AgreementCommon = {
  uploadedDebtorId: number;
  paymentMethod: string;
  paymentNotes: string;
};

export type CreatePaymentAgreementInput = AgreementCommon &
  (
    | {
        paymentAgreementType: "paymentInFull";
        paymentInterestAmount: string;
        paymentDueDate: string;
        paymentReferenceNumber: string;
        paymentUploadProof: string | null;
      }
    | {
        paymentAgreementType: "settlementInFull";
        paymentSettlementAmount: string;
        paymentInterestAmount: string;
        paymentDueDate: string;
        paymentReferenceNumber: string;
        paymentApprovedBy: string;
        paymentUploadProof: string | null;
      }
    | {
        paymentAgreementType: "paymentPlanAgreed";
        paymentInterestAmount: string;
        paymentComputeBy: string;
        paymentFrequency: string;
        paymentInstallmentAmount: string;
        paymentNoOfInstallments: string;
        paymentFirstPaymentDate: string;
      }
    | {
        paymentAgreementType: "promiseToPay";
        paymentPromisedAmount: string;
        paymentPromisedDate: string;
      }
  );

export function createPaymentAgreement(input: CreatePaymentAgreementInput): Promise<unknown> {
  return apiPost("/tenant/createPaymentAgreement", input);
}

export function cancelPaymentAgreement(uploadedDebtorId: number): Promise<unknown> {
  return apiPost("/tenant/cancelPaymentAgreement", { uploadedDebtorId });
}

export async function uploadPaymentFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const token = getAuthToken();
  const res = await fetch(apiUrl("/tenant/uploadPaymentFile"), {
    method: "POST",
    headers: token ? { Authorization: token } : undefined,
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.meta?.status || !json?.data?.fileUrl) {
    throw new Error(json?.meta?.message || "Couldn't upload that file.");
  }
  return json.data.fileUrl as string;
}

export type PaymentInput = {
  uploadedDebtorId: number;
  paymentAmountReceived: number;
  paymentMethod: string;
  /** yyyy/mm/dd */
  paymentDate: string;
  paymentReferenceNumber: string;
  paymentNotes: string;
  paymentUploadProof: string | null;
};

export function submitForVerification(input: PaymentInput): Promise<unknown> {
  return apiPost("/tenant/submitForVerification", input);
}

export function postPaymentReceived(input: PaymentInput): Promise<unknown> {
  return apiPost("/tenant/postPaymentReceived", input);
}

export function approvePayment(uploadedDebtorId: number, id: number): Promise<unknown> {
  return apiPost("/tenant/approvePayment", { uploadedDebtorId, id });
}

export function rejectPayment(uploadedDebtorId: number, id: number): Promise<unknown> {
  return apiPost("/tenant/rejectPayment", { uploadedDebtorId, id });
}

/* ------------------------------- Helpers -------------------------------- */

/** yyyy-mm-dd (native date input) → yyyy/mm/dd for these endpoints. */
export function inputDateToPaymentDate(s: string): string {
  return s.replace(/-/g, "/");
}

/** dd/mm/yyyy for an agreement date (yyyy/mm/dd) or a payment's paymentDate
 *  (ISO at UTC midnight). Reads the calendar date off the string itself, so a
 *  timezone behind UTC doesn't show the day before. */
export function paymentDateLabel(s: string | null | undefined): string {
  const m = s?.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s || "—";
}
