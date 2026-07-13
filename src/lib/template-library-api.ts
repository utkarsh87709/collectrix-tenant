// Template Library calls to the separately-hosted backend. Stores reusable
// email and SMS templates, scoped per client.
//   POST /tenant/getTemplateClients {}                          -> { emailClientList[], smsClientList[] }
//   POST /tenant/getClientTemplate { clientId, templateType }   -> { templateList[] }
//   POST /tenant/createTemplate { clientId, templateType, templateName, templateSubject, templateMessage } -> {}
//   POST /tenant/updateTemplate { templateId, templateName, templateSubject, templateMessage }             -> {}
//   POST /tenant/deleteTemplate { templateId }                  -> {}
// templateSubject is mandatory on create even for SMS — pass an empty string.
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";

export type TemplateType = "email" | "sms";

/** A client that can own templates, as returned by getTemplateClients. */
export type TemplateClient = { clientId: number; clientName: string };

export type Template = {
  templateId: number;
  createdAt: string;
  updatedAt: string;
  clientId: number;
  templateType: TemplateType;
  templateName: string;
  /** Empty string for SMS templates. */
  templateSubject: string;
  templateMessage: string;
};

export function getTemplateClients(): Promise<{
  emailClientList: TemplateClient[];
  smsClientList: TemplateClient[];
}> {
  return apiPost("/tenant/getTemplateClients");
}

export async function getClientTemplate(input: {
  clientId: number;
  templateType: TemplateType;
}): Promise<Template[]> {
  const res = await apiPost<{ templateList: Template[] }>("/tenant/getClientTemplate", {
    ...input,
  });
  return res.templateList ?? [];
}

export function createTemplate(input: {
  clientId: number;
  templateType: TemplateType;
  templateName: string;
  templateSubject: string;
  templateMessage: string;
}): Promise<unknown> {
  return apiPost("/tenant/createTemplate", { ...input });
}

export function updateTemplate(input: {
  templateId: number;
  templateName: string;
  templateSubject: string;
  templateMessage: string;
}): Promise<unknown> {
  return apiPost("/tenant/updateTemplate", { ...input });
}

export function deleteTemplate(templateId: number): Promise<unknown> {
  return apiPost("/tenant/deleteTemplate", { templateId });
}
