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
//
// Document templates (templateType "document") are a separate shape returned
// by the same getClientTemplate/deleteTemplate endpoints, but created/updated
// through their own multipart endpoints since they carry a file:
//   POST /tenant/createDocumentTemplate (multipart: clientId, templateType="document",
//     templateName, templateDescription, file)                 -> {}
//     file is mandatory and must be a .docx (server rejects other extensions
//     with "Only docx files are allowed."). There is no category field.
//   POST /tenant/updateDocumentTemplate (multipart: templateId, clientId,
//     templateType="document", templateName, templateDescription, file?)  -> {}
//     file is optional — omit it to keep the template's existing upload.
//   getClientTemplate({ templateType: "document" }) rows carry templateSubject/
//   templateMessage/greetingMsg as null, plus templateDescription,
//   templateOrignalFileName (backend's spelling) and fileUrl.
//   deleteTemplate works unchanged for document rows.
// All authenticated with the raw token (attached automatically by apiPost;
// multipart calls attach it by hand, matching upload-debtor-api.ts/customers-api.ts).
import { apiPost, apiUrl } from "./api-client";
import { getAuthToken } from "./auth-token";

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

/* ------------------------------ document templates --------------------------- */

/** A document template, as returned by getClientTemplate({ templateType: "document" }). */
export type DocumentTemplate = {
  templateId: number;
  createdAt: string;
  updatedAt: string;
  clientId: number;
  templateName: string;
  templateDescription: string;
  /** Original filename of the uploaded .docx. */
  templateOrignalFileName: string;
  /** Absolute URL to view/download the uploaded file. */
  fileUrl: string;
};

export async function getDocumentTemplates(clientId: number): Promise<DocumentTemplate[]> {
  const res = await apiPost<{ templateList: DocumentTemplate[] }>("/tenant/getClientTemplate", {
    clientId,
    templateType: "document",
  });
  return res.templateList ?? [];
}

// apiPost hardcodes JSON content-type, so multipart calls (file upload) attach
// the token by hand and let the browser set the multipart boundary itself —
// same pattern as upload-debtor-api.ts, mass-update-api.ts and customers-api.ts.
async function multipartPost(path: string, form: FormData): Promise<void> {
  const token = getAuthToken();
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: token ? { Authorization: token } : undefined,
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.meta?.status) {
    throw new Error(json?.meta?.message || "Request failed. Please try again.");
  }
}

export async function createDocumentTemplate(input: {
  clientId: number;
  templateName: string;
  templateDescription: string;
  file: File;
}): Promise<void> {
  const form = new FormData();
  form.append("clientId", String(input.clientId));
  form.append("templateType", "document");
  form.append("templateName", input.templateName);
  form.append("templateDescription", input.templateDescription);
  form.append("file", input.file);
  await multipartPost("/tenant/createDocumentTemplate", form);
}

export async function updateDocumentTemplate(input: {
  templateId: number;
  clientId: number;
  templateName: string;
  templateDescription: string;
  /** Omit to keep the template's existing file. */
  file?: File;
}): Promise<void> {
  const form = new FormData();
  form.append("templateId", String(input.templateId));
  form.append("clientId", String(input.clientId));
  form.append("templateType", "document");
  form.append("templateName", input.templateName);
  form.append("templateDescription", input.templateDescription);
  if (input.file) form.append("file", input.file);
  await multipartPost("/tenant/updateDocumentTemplate", form);
}
