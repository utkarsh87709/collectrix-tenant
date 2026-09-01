// Template Library calls to the separately-hosted backend. Stores reusable
// email, SMS and call (AI voice agent) templates, scoped per client.
//   POST /tenant/getTemplateClients {}                          -> { emailClientList[], smsClientList[], callClientList[] }
//   POST /tenant/getClientTemplate { clientId, templateType }   -> { templateList[] }
//   POST /tenant/createTemplate { clientId, templateType, templateName, templateSubject, templateMessage, greetingMsg } -> {}
//   POST /tenant/updateTemplate { templateId, templateType, templateName, templateSubject, templateMessage, greetingMsg } -> {}
//   POST /tenant/deleteTemplate { templateId }                  -> {}
// templateSubject is mandatory on create even for SMS — pass an empty string.
// greetingMsg only applies to "call" templates (null for the rest). On update
// templateType is accepted but the type itself cannot be changed.
// All authenticated with the raw token (attached automatically by apiPost).
import { apiPost } from "./api-client";

/** Message channels a template can belong to — one client list per type. */
export type TemplateType = "email" | "sms" | "call";

/**
 * Every library getClientTemplate can read. "aiPrompt" holds the AI agents
 * (named system prompts such as "Firm Reminder") that generate message bodies
 * when a channel's source is AI rather than a fixed template; it has no client
 * list of its own on getTemplateClients.
 */
export type LibraryType = TemplateType | "aiPrompt";

/** A client that can own templates, as returned by getTemplateClients. */
export type TemplateClient = { clientId: number; clientName: string };

export type Template = {
  templateId: number;
  createdAt: string;
  updatedAt: string;
  clientId: number;
  templateType: LibraryType;
  templateName: string;
  /** Empty string for SMS templates. */
  templateSubject: string;
  templateMessage: string;
  /** Call templates only — spoken when the call connects. Null elsewhere. */
  greetingMsg?: string | null;
};

export function getTemplateClients(): Promise<{
  emailClientList: TemplateClient[];
  smsClientList: TemplateClient[];
  callClientList: TemplateClient[];
}> {
  return apiPost("/tenant/getTemplateClients");
}

export async function getClientTemplate(input: {
  clientId: number;
  templateType: LibraryType;
}): Promise<Template[]> {
  const res = await apiPost<{ templateList: Template[] }>("/tenant/getClientTemplate", {
    ...input,
  });
  return res.templateList ?? [];
}

export function createTemplate(input: {
  clientId: number;
  templateType: LibraryType;
  templateName: string;
  templateSubject: string;
  templateMessage: string;
  greetingMsg?: string | null;
}): Promise<unknown> {
  return apiPost("/tenant/createTemplate", { greetingMsg: null, ...input });
}

export function updateTemplate(input: {
  templateId: number;
  /** Accepted by the backend but the stored type can never change. */
  templateType?: LibraryType;
  templateName: string;
  templateSubject: string;
  templateMessage: string;
  greetingMsg?: string | null;
}): Promise<unknown> {
  return apiPost("/tenant/updateTemplate", { ...input });
}

export function deleteTemplate(templateId: number): Promise<unknown> {
  return apiPost("/tenant/deleteTemplate", { templateId });
}
