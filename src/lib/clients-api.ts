// Client (creditor) management calls to the separately-hosted backend.
//   POST /tenant/getAllClients {}                                                                    -> { clients[] }
//   POST /tenant/createClient  { clientName, clientNumber, smsEnabled, emailEnabled, callEnabled, documentEnabled,
//                                bankName, transitNumber, accountNumber } -> {}
//   POST /tenant/updateClient  { clientId, ...same as createClient } -> {}
//   POST /tenant/deleteClient  { clientId }                                                          -> {}
// Each client carries four communication-channel toggles (smsEnabled, emailEnabled,
// callEnabled, documentEnabled) returned by getAllClients and set on create/update.
// Trust account details (bankName, transitNumber, accountNumber) are optional
// free text, added 2026-10-30 and verified live the same day: "" when unset
// (also on clients created before), and updateClient REPLACES them — omitting
// them clears all three, so always send the current values. Stored verbatim
// (no trimming) and silently truncated at 256 / 256 / 64 characters. No
// uniqueness check on accountNumber.
// Duplicate name/number is rejected with meta.status=false and the message
// "Client name or number already exists." (surfaced by apiPost as a thrown Error).
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";

export type ClientChannels = {
  smsEnabled: boolean;
  emailEnabled: boolean;
  callEnabled: boolean;
  documentEnabled: boolean;
};

/** The client's trust account, used in its letters and emails. "" when unset. */
export type ClientBankDetails = {
  bankName: string;
  transitNumber: string;
  accountNumber: string;
};

/** Backend column sizes — longer values are cut off without an error. */
export const BANK_DETAIL_MAX_LENGTH: Record<keyof ClientBankDetails, number> = {
  bankName: 256,
  transitNumber: 256,
  accountNumber: 64,
};

export type Client = ClientChannels &
  ClientBankDetails & {
    clientId: number;
    clientName: string;
    clientNumber: string;
    totalFiles: number;
  };

export function getAllClients(): Promise<{ clients: Client[] }> {
  return apiPost<{ clients: Client[] }>("/tenant/getAllClients");
}

export function createClient(
  input: { clientName: string; clientNumber: string } & ClientChannels & ClientBankDetails,
): Promise<unknown> {
  return apiPost("/tenant/createClient", { ...input });
}

export function updateClient(
  input: { clientId: number; clientName: string; clientNumber: string } & ClientChannels &
    ClientBankDetails,
): Promise<unknown> {
  return apiPost("/tenant/updateClient", { ...input });
}

export function deleteClient(clientId: number): Promise<unknown> {
  return apiPost("/tenant/deleteClient", { clientId });
}
