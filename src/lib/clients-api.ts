// Client (creditor) management calls to the separately-hosted backend.
//   POST /tenant/getAllClients {}                                                                    -> { clients[] }
//   POST /tenant/createClient  { clientName, clientNumber, smsEnabled, emailEnabled, callEnabled, documentEnabled } -> {}
//   POST /tenant/updateClient  { clientId, clientName, clientNumber, smsEnabled, emailEnabled, callEnabled, documentEnabled } -> {}
//   POST /tenant/deleteClient  { clientId }                                                          -> {}
// Each client carries four communication-channel toggles (smsEnabled, emailEnabled,
// callEnabled, documentEnabled) returned by getAllClients and set on create/update.
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

export type Client = ClientChannels & {
  clientId: number;
  clientName: string;
  clientNumber: string;
  totalFiles: number;
};

export function getAllClients(): Promise<{ clients: Client[] }> {
  return apiPost<{ clients: Client[] }>("/tenant/getAllClients");
}

export function createClient(
  input: { clientName: string; clientNumber: string } & ClientChannels,
): Promise<unknown> {
  return apiPost("/tenant/createClient", { ...input });
}

export function updateClient(
  input: { clientId: number; clientName: string; clientNumber: string } & ClientChannels,
): Promise<unknown> {
  return apiPost("/tenant/updateClient", { ...input });
}

export function deleteClient(clientId: number): Promise<unknown> {
  return apiPost("/tenant/deleteClient", { clientId });
}
