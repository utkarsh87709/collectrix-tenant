import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import {
  Mail,
  MessageSquare,
  FileText,
  PhoneCall,
  Bot,
  Plus,
  Trash2,
  Eye,
  Save,
  ChevronRight,
  Loader2,
  AlertTriangle,
  RefreshCw,
  X,
  Upload,
  Download,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RichTextToolbar } from "@/components/tenant/RichTextToolbar";
import { VARIABLE_LIBRARY } from "@/lib/comms-mock";
import {
  getTemplateClients,
  getClientTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  type Template,
  type TemplateClient,
  type TemplateType,
} from "@/lib/template-library-api";

export const Route = createFileRoute("/tenant/engagement/template-library")({
  head: () => ({ meta: [{ title: "Template Library · Tenant Admin" }] }),
  component: TemplateLibraryPage,
});

/* --------------------------------- types ------------------------------------ */

/** The three channels backed by the real templateLibrary API. */
type ApiTab = TemplateType;
/** All tabs on the page, including the two design-only ones with no API yet. */
type Tab = ApiTab | "documents" | "aiPrompt";

type DocTemplate = {
  id: string;
  clientId: number;
  name: string;
  category: string;
  description: string;
  fileName: string;
  mime: string;
  size: number;
  dataUrl: string;
  uploadedBy: string;
  uploadedAt: string;
  status: "active" | "archived";
};

/** Session-only AI messaging prompt — no backend API confirmed yet. */
type AiPromptSetting = {
  id: string;
  clientId: number;
  name: string;
  prompt: string;
};

const SEED_DOC_TEMPLATES: Omit<DocTemplate, "clientId">[] = [
  {
    id: "doc-tpl-1",
    name: "Demand Letter Template",
    category: "Legal",
    description:
      "Standard pre-legal demand letter. AI fills customer, balance, deadline, attorney details.",
    fileName: "demand_letter_template.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 24576,
    dataUrl: "",
    uploadedBy: "Priya Sharma",
    uploadedAt: "2025-11-18",
    status: "active",
  },
];

// Shown on the design-only tabs (Documents, AI Messaging Prompt) if the
// backend client list can't be loaded, so the layout stays reviewable.
const FALLBACK_CLIENTS: TemplateClient[] = [
  { clientId: -1, clientName: "RBC Bank" },
  { clientId: -2, clientName: "Airtel Bank" },
];

// Substitute {{var}} tokens with their sample values for the preview.
const SAMPLE_BY_KEY = new Map(VARIABLE_LIBRARY.map((v) => [v.key, v.sample]));
function withSamples(text: string): string {
  return text.replace(/\{\{[^}]+\}\}/g, (m) => SAMPLE_BY_KEY.get(m) ?? m);
}

/** Plain-text summary of a template body (strips HTML) for the list preview. */
function bodyPreview(t: Template): string {
  return t.templateMessage
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* --------------------------------- page ------------------------------------ */

function TemplateLibraryPage() {
  const [tab, setTab] = useState<Tab>("email");

  /* -------------------- clients (from getTemplateClients) -------------------- */

  const [apiClients, setApiClients] = useState<Record<ApiTab, TemplateClient[]> | null>(null);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  // Fire exactly once, even under StrictMode's dev-only double-invoke of effects.
  const clientsLoaded = useRef(false);

  const loadClients = useCallback(async () => {
    setClientsLoading(true);
    setClientsError(null);
    try {
      const res = await getTemplateClients();
      setApiClients({
        email: res.emailClientList ?? [],
        sms: res.smsClientList ?? [],
        call: res.callClientList ?? [],
      });
    } catch (e) {
      setClientsError(e instanceof Error ? e.message : "Failed to load clients.");
    } finally {
      setClientsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clientsLoaded.current) return;
    clientsLoaded.current = true;
    loadClients();
  }, [loadClients]);

  // Every client the tenant has, deduped across the three channel lists — used
  // by the design-only tabs (Documents, AI Messaging Prompt) that have no
  // per-channel client list of their own.
  const designClients = useMemo<TemplateClient[]>(() => {
    if (apiClients) {
      const byId = new Map<number, TemplateClient>();
      for (const c of [...apiClients.email, ...apiClients.sms, ...apiClients.call]) {
        if (!byId.has(c.clientId)) byId.set(c.clientId, c);
      }
      if (byId.size > 0) return [...byId.values()];
    }
    return clientsLoading ? [] : FALLBACK_CLIENTS;
  }, [apiClients, clientsLoading]);

  /* --------------------- templates cache (email / sms / call) ----------------- */

  // One getClientTemplate call per client per type, fetched up front — client
  // lists are small (a handful of clients), so prefetching keeps the tab
  // counts and per-client pill counts accurate without a spinner on every
  // pill click.
  const [cache, setCache] = useState<Record<ApiTab, Record<number, Template[]>>>({
    email: {},
    sms: {},
    call: {},
  });
  const [typeLoading, setTypeLoading] = useState<Record<ApiTab, boolean>>({
    email: true,
    sms: true,
    call: true,
  });
  const [typeError, setTypeError] = useState<Record<ApiTab, string | null>>({
    email: null,
    sms: null,
    call: null,
  });
  const prefetched = useRef<Record<ApiTab, boolean>>({ email: false, sms: false, call: false });

  const prefetchType = useCallback(async (type: ApiTab, clients: TemplateClient[]) => {
    setTypeLoading((p) => ({ ...p, [type]: true }));
    setTypeError((p) => ({ ...p, [type]: null }));
    try {
      const lists = await Promise.all(
        clients.map((c) => getClientTemplate({ clientId: c.clientId, templateType: type })),
      );
      setCache((prev) => {
        const next = { ...prev[type] };
        clients.forEach((c, i) => {
          next[c.clientId] = lists[i];
        });
        return { ...prev, [type]: next };
      });
    } catch (e) {
      setTypeError((p) => ({ ...p, [type]: e instanceof Error ? e.message : "Failed to load." }));
    } finally {
      setTypeLoading((p) => ({ ...p, [type]: false }));
    }
  }, []);

  useEffect(() => {
    if (!apiClients) return;
    (["email", "sms", "call"] as ApiTab[]).forEach((t) => {
      if (prefetched.current[t]) return;
      prefetched.current[t] = true;
      prefetchType(t, apiClients[t]);
    });
  }, [apiClients, prefetchType]);

  const refreshOne = useCallback(async (type: ApiTab, clientId: number): Promise<Template[]> => {
    const list = await getClientTemplate({ clientId, templateType: type });
    setCache((prev) => ({ ...prev, [type]: { ...prev[type], [clientId]: list } }));
    return list;
  }, []);

  /* --------------------------------- counts ---------------------------------- */

  const [docTemplates, setDocTemplates] = useState<DocTemplate[]>([]);
  const [aiPrompts, setAiPrompts] = useState<AiPromptSetting[]>([]);

  // Seed the sample document template onto the first real client once known.
  const docsSeeded = useRef(false);
  useEffect(() => {
    if (docsSeeded.current || designClients.length === 0) return;
    docsSeeded.current = true;
    setDocTemplates(SEED_DOC_TEMPLATES.map((d) => ({ ...d, clientId: designClients[0].clientId })));
  }, [designClients]);

  const counts: Record<Tab, number> = {
    email: Object.values(cache.email).reduce((n, l) => n + l.length, 0),
    sms: Object.values(cache.sms).reduce((n, l) => n + l.length, 0),
    call: Object.values(cache.call).reduce((n, l) => n + l.length, 0),
    documents: docTemplates.length,
    aiPrompt: aiPrompts.length,
  };

  const TABS: { id: Tab; label: string; icon: typeof Mail }[] = [
    { id: "email", label: "Email", icon: Mail },
    { id: "sms", label: "SMS", icon: MessageSquare },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "call", label: "AI Voice Call Agent", icon: PhoneCall },
    { id: "aiPrompt", label: "AI Messaging Prompt Setting", icon: Bot },
  ];

  /* -------------------------------- render -------------------------------- */

  return (
    <Shell>
      <Topbar title="Template Library" subtitle="Reusable templates with variable substitution" />

      <section className="px-6 lg:px-10 py-6">
        <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
          {/* Channel tabs */}
          <div className="flex items-center gap-1 px-4 pt-3 border-b border-border overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors",
                    active
                      ? "border-tenant text-tenant"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" /> {t.label}
                  <span
                    className={cn(
                      "text-[11px] px-1.5 py-0.5 rounded-md",
                      active ? "bg-tenant-soft text-tenant" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {counts[t.id]}
                  </span>
                </button>
              );
            })}
          </div>

          {tab === "email" || tab === "sms" || tab === "call" ? (
            <ApiChannelPanel
              tab={tab}
              clients={apiClients?.[tab] ?? []}
              clientsLoading={clientsLoading}
              clientsError={clientsError}
              onRetryClients={loadClients}
              byClient={cache[tab]}
              loading={typeLoading[tab]}
              error={typeError[tab]}
              onRetry={() => apiClients && prefetchType(tab, apiClients[tab])}
              refreshOne={refreshOne}
            />
          ) : tab === "documents" ? (
            <DocumentsPanel
              clients={designClients}
              clientsLoading={clientsLoading}
              docs={docTemplates}
              setDocs={setDocTemplates}
            />
          ) : (
            <AiPromptsPanel
              clients={designClients}
              clientsLoading={clientsLoading}
              prompts={aiPrompts}
              setPrompts={setAiPrompts}
            />
          )}
        </div>
      </section>
    </Shell>
  );
}

/* ----------------------------- by-client pills ------------------------------ */

function ClientPills({
  clients,
  counts,
  value,
  onChange,
}: {
  clients: TemplateClient[];
  counts: Record<number, number>;
  value: number | null;
  onChange: (clientId: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-border bg-muted/10 overflow-x-auto">
      <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground shrink-0">
        By client
      </span>
      <div className="flex items-center gap-2">
        {clients.map((c) => {
          const active = c.clientId === value;
          return (
            <button
              key={c.clientId}
              onClick={() => onChange(c.clientId)}
              className={cn(
                "inline-flex items-center gap-2 h-8 pl-3.5 pr-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors",
                active
                  ? "bg-gradient-tenant text-white border-transparent shadow-tenant"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-[color:var(--tenant)]/40",
              )}
            >
              {c.clientName}
              <span
                className={cn(
                  "min-w-5 h-5 px-1 inline-flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                  active ? "bg-white/25 text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {counts[c.clientId] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------- shared states ------------------------------ */

function PanelSpinner() {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
      >
        <RefreshCw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}

/* ------------------- email / sms / call panel (real API) -------------------- */

function ApiChannelPanel({
  tab,
  clients,
  clientsLoading,
  clientsError,
  onRetryClients,
  byClient,
  loading,
  error,
  onRetry,
  refreshOne,
}: {
  tab: ApiTab;
  clients: TemplateClient[];
  clientsLoading: boolean;
  clientsError: string | null;
  onRetryClients: () => void;
  byClient: Record<number, Template[]>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  refreshOne: (type: ApiTab, clientId: number) => Promise<Template[]>;
}) {
  const [clientId, setClientId] = useState<number | null>(null);
  const [selected, setSelected] = useState<{ kind: "item"; id: number } | { kind: "draft" } | null>(
    null,
  );

  useEffect(() => {
    if (clients.length === 0) {
      setClientId(null);
      return;
    }
    setClientId((prev) =>
      prev != null && clients.some((c) => c.clientId === prev) ? prev : clients[0].clientId,
    );
  }, [clients]);

  const items = useMemo(
    () => (clientId != null ? (byClient[clientId] ?? []) : []),
    [byClient, clientId],
  );
  const clientName = clients.find((c) => c.clientId === clientId)?.clientName ?? "";
  const pillCounts = Object.fromEntries(clients.map((c) => [c.clientId, byClient[c.clientId]?.length ?? 0]));

  // Reset the selection when the client changes; auto-pick the first item for
  // "call" (matches the design's always-something-selected voice agent list).
  useEffect(() => {
    setSelected(tab === "call" && items.length > 0 ? { kind: "item", id: items[0].templateId } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const selectedItem =
    selected?.kind === "item" ? (items.find((t) => t.templateId === selected.id) ?? null) : null;

  if (clientsError) return <PanelError message={clientsError} onRetry={onRetryClients} />;
  if (clientsLoading || loading) return <PanelSpinner />;
  if (error) return <PanelError message={error} onRetry={onRetry} />;
  if (clients.length === 0) {
    const label = tab === "call" ? "call-enabled" : tab;
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No {label} clients available. Enable this channel on a client first.
        </p>
      </div>
    );
  }

  const newLabel = tab === "call" ? "New Voice Agent" : "New Template";

  return (
    <>
      <ClientPills clients={clients} counts={pillCounts} value={clientId} onChange={setClientId} />
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] min-h-[560px]">
        {/* Left list */}
        <aside className="border-b lg:border-b-0 lg:border-r border-border bg-muted/20 flex flex-col">
          <div className="px-3 pt-3 pb-2 flex items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              {tab === "call" ? "Voice Agents" : "Templates"}
            </span>
            <span className="min-w-5 px-1.5 rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
              {items.length}
            </span>
          </div>
          <div className="px-3 pb-2">
            <button
              onClick={() => setSelected({ kind: "draft" })}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> {newLabel}
            </button>
          </div>
          <ul className="px-2 pb-3 space-y-1 overflow-y-auto">
            {selected?.kind === "draft" && (
              <li>
                <div className="rounded-lg px-3 py-2.5 border border-[color:var(--tenant)]/40 bg-[color:var(--tenant)]/10">
                  <div className="text-sm font-semibold truncate text-tenant">{newLabel}</div>
                  <div className="mt-1">
                    <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-warning/15 text-warning-foreground">
                      Unsaved draft
                    </span>
                  </div>
                </div>
              </li>
            )}
            {items.length === 0 && selected?.kind !== "draft" && (
              <li className="flex flex-col items-center gap-1.5 text-muted-foreground px-3 py-10 text-center">
                <FileText className="h-6 w-6 opacity-50" />
                <span className="text-xs">Nothing for this client yet.</span>
              </li>
            )}
            {items.map((t) => {
              const active = selectedItem?.templateId === t.templateId;
              return (
                <li key={t.templateId}>
                  <button
                    onClick={() => setSelected({ kind: "item", id: t.templateId })}
                    className={cn(
                      "w-full text-left cursor-pointer rounded-lg px-3 py-2.5 border transition-colors",
                      active
                        ? "bg-[color:var(--tenant)]/10 border-[color:var(--tenant)]/40"
                        : "bg-card border-border hover:border-[color:var(--tenant)]/30 hover:bg-muted/40",
                    )}
                  >
                    <div className={cn("text-sm font-semibold truncate", active ? "text-tenant" : "text-foreground")}>
                      {t.templateName}
                    </div>
                    {tab === "call" ? (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-tenant">
                        <PhoneCall className="h-3 w-3" /> {clientName}
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {bodyPreview(t) || "—"}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Right editor */}
        <div className="flex flex-col">
          {!selected || clientId == null ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-12 text-center">
              Select {tab === "call" ? "a voice agent" : "a template"} from the left or create a new
              one.
            </div>
          ) : tab === "call" ? (
            <VoiceAgentEditor
              key={selected.kind === "draft" ? `draft-${clientId}` : `agent-${selected.id}`}
              agent={selected.kind === "item" ? selectedItem : null}
              clientId={clientId}
              onCancelDraft={() => setSelected(null)}
              onCreated={async () => {
                const list = await refreshOne("call", clientId);
                const newest = list.reduce<Template | null>(
                  (max, t) => (!max || t.templateId > max.templateId ? t : max),
                  null,
                );
                setSelected(newest ? { kind: "item", id: newest.templateId } : null);
              }}
              onUpdated={async () => {
                await refreshOne("call", clientId);
              }}
              onDeleted={async () => {
                await refreshOne("call", clientId);
                setSelected(null);
              }}
            />
          ) : (
            <TemplateEditor
              key={selected.kind === "draft" ? `draft-${tab}-${clientId}` : `tpl-${selected.id}`}
              channel={tab}
              clientId={clientId}
              clientName={clientName}
              template={selected.kind === "item" ? selectedItem : null}
              onCancelDraft={() => setSelected(null)}
              onCreated={async () => {
                const list = await refreshOne(tab, clientId);
                const newest = list.reduce<Template | null>(
                  (max, t) => (!max || t.templateId > max.templateId ? t : max),
                  null,
                );
                setSelected(newest ? { kind: "item", id: newest.templateId } : null);
              }}
              onUpdated={async () => {
                await refreshOne(tab, clientId);
              }}
              onDeleted={async () => {
                await refreshOne(tab, clientId);
                setSelected(null);
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

/* -------------------------- email / sms editor ------------------------------ */

function TemplateEditor({
  channel,
  clientId,
  clientName,
  template,
  onCancelDraft,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  channel: "email" | "sms";
  clientId: number;
  clientName: string;
  template: Template | null;
  onCancelDraft: () => void;
  onCreated: () => void | Promise<void>;
  onUpdated: () => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}) {
  const isEmail = channel === "email";
  const isNew = template === null;

  const [name, setName] = useState(template?.templateName ?? "");
  const [subject, setSubject] = useState(template?.templateSubject ?? "");
  const [message, setMessage] = useState(template?.templateMessage ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const smsRef = useRef<HTMLTextAreaElement | null>(null);

  // Seed the rich-text editor once on mount (component is keyed per template).
  useEffect(() => {
    if (isEmail && editorRef.current) {
      editorRef.current.innerHTML = template?.templateMessage ?? "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orig = {
    name: template?.templateName ?? "",
    subject: template?.templateSubject ?? "",
    message: template?.templateMessage ?? "",
  };
  const dirty = name !== orig.name || subject !== orig.subject || message !== orig.message;

  const insertVariable = (key: string) => {
    if (isEmail) {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      document.execCommand("insertText", false, key);
      setMessage(el.innerHTML);
    } else {
      const el = smsRef.current;
      if (!el) {
        setMessage((m) => m + key);
        return;
      }
      const start = el.selectionStart ?? message.length;
      const end = el.selectionEnd ?? message.length;
      const next = message.slice(0, start) + key + message.slice(end);
      setMessage(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + key.length;
        el.setSelectionRange(pos, pos);
      });
    }
  };

  const validate = (): string | null => {
    if (!name.trim()) return "Template name is required.";
    if (isEmail && !subject.trim()) return "Subject line is required.";
    const plain = isEmail ? message.replace(/<[^>]+>/g, "").trim() : message.trim();
    if (!plain) return "Message content is required.";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await createTemplate({
          clientId,
          templateType: channel,
          templateName: name.trim(),
          templateSubject: isEmail ? subject.trim() : "",
          templateMessage: message,
        });
        toast.success("Template created.");
        await onCreated();
      } else {
        await updateTemplate({
          templateId: template!.templateId,
          templateType: channel,
          templateName: name.trim(),
          templateSubject: isEmail ? subject.trim() : "",
          templateMessage: message,
        });
        toast.success("Template updated.");
        await onUpdated();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save the template.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!template) return;
    setDeleting(true);
    try {
      await deleteTemplate(template.templateId);
      toast.success("Template deleted.");
      await onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete the template.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const smsLen = message.length;

  return (
    <>
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
          <span>{clientName}</span>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span className="capitalize">{channel}</span>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span className="text-foreground font-semibold">{isNew ? "New Template" : "Edit Template"}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          {!isNew && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          {isNew && (
            <button
              onClick={onCancelDraft}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10"
            >
              <X className="h-3.5 w-3.5" /> Discard
            </button>
          )}
          <button
            onClick={save}
            disabled={saving || (!isNew && !dirty)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-tenant text-white text-xs font-semibold shadow-tenant hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{" "}
            Save Template
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="p-6 space-y-5">
        <label className="block">
          <div className="text-xs font-semibold mb-1.5">
            Template Name <span className="text-destructive">*</span>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Initial Contact Email"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-tenant"
          />
        </label>

        {isEmail && (
          <label className="block">
            <div className="text-xs font-semibold mb-1.5">
              Subject Line <span className="text-destructive">*</span>
            </div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Your outstanding balance with {{creditor_client_name}}"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-tenant"
            />
          </label>
        )}

        <div>
          <div className="text-xs font-semibold mb-1.5">
            Message Content <span className="text-destructive">*</span>
          </div>
          <div className="rounded-lg border border-border bg-background overflow-hidden">
            {isEmail ? (
              <>
                <div className="px-2 py-1.5 border-b border-border bg-muted/30">
                  <RichTextToolbar editorRef={editorRef} />
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => setMessage((e.target as HTMLDivElement).innerHTML)}
                  className="min-h-[220px] px-4 py-3 text-sm outline-none prose prose-sm max-w-none"
                  style={{ whiteSpace: "pre-wrap" }}
                />
              </>
            ) : (
              <textarea
                ref={smsRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi {{first_name}}, your promised payment of {{ptp_amount}} is due {{ptp_date}}."
                className="w-full min-h-[220px] px-4 py-3 text-sm outline-none bg-background resize-y"
              />
            )}
          </div>
          {!isEmail && (
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5">
              <span>SMS messages are limited to 160 characters per segment.</span>
              <span className="tabular-nums">
                {smsLen} chars · {Math.max(1, Math.ceil(smsLen / 160))} segment
                {smsLen > 160 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-xs font-semibold text-foreground">Insert a variable</span>
            <span className="text-[11px] text-muted-foreground">
              Click to add it at the cursor — replaced with each customer's real data when sent.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {VARIABLE_LIBRARY.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(v.key)}
                title={v.description}
                className="inline-flex items-center px-2 py-1 rounded-md bg-[color:var(--tenant)]/10 text-tenant border border-[color:var(--tenant)]/20 text-[11px] font-mono font-semibold transition-colors hover:bg-[color:var(--tenant)] hover:text-[color:var(--tenant-foreground)] hover:border-[color:var(--tenant)]"
              >
                {v.key}
              </button>
            ))}
          </div>
        </div>
      </div>

      {previewOpen && (
        <PreviewModal
          isEmail={isEmail}
          name={name}
          subject={subject}
          message={message}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {confirmDelete && template && (
        <ConfirmDeleteDialog
          title="Delete Template"
          name={template.templateName}
          busy={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={remove}
        />
      )}
    </>
  );
}

/* ------------------------------ preview modal ------------------------------ */

function PreviewModal({
  isEmail,
  name,
  subject,
  message,
  onClose,
}: {
  isEmail: boolean;
  name: string;
  subject: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-elegant"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">Preview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{name || "Untitled"}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-4 rounded-lg border border-[color:var(--tenant)]/20 bg-[color:var(--tenant)]/5 px-3 py-2 text-[11px] text-muted-foreground">
            This is an example. Each <code className="font-mono text-tenant">{`{{variable}}`}</code>{" "}
            is shown with placeholder data (e.g. a sample name and balance) so you can see the layout
            — real customer values are merged in when the message is actually sent.
          </div>
          {isEmail && (
            <div className="mb-4">
              <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                Subject
              </div>
              <div className="text-sm font-semibold">{withSamples(subject) || "—"}</div>
            </div>
          )}
          <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
            Message
          </div>
          {isEmail ? (
            <div
              className="prose prose-sm max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: withSamples(message) || "—" }}
            />
          ) : (
            <div className="text-sm whitespace-pre-wrap">{withSamples(message) || "—"}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------- AI Voice Call Agent editor (real API) ---------------- */

function VoiceAgentEditor({
  agent,
  clientId,
  onCancelDraft,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  agent: Template | null;
  clientId: number;
  onCancelDraft: () => void;
  onCreated: () => void | Promise<void>;
  onUpdated: () => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}) {
  const isNew = agent === null;
  const [name, setName] = useState(agent?.templateName ?? "New Voice Agent");
  const [greeting, setGreeting] = useState(agent?.greetingMsg ?? "");
  const [prompt, setPrompt] = useState(agent?.templateMessage ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    isNew ||
    name !== agent.templateName ||
    greeting !== (agent.greetingMsg ?? "") ||
    prompt !== agent.templateMessage;

  const saveAgent = async () => {
    if (!name.trim()) {
      toast.error("Agent name is required.");
      return;
    }
    if (!prompt.trim()) {
      toast.error("System prompt is required.");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await createTemplate({
          clientId,
          templateType: "call",
          templateName: name.trim(),
          templateSubject: "",
          templateMessage: prompt,
          greetingMsg: greeting.trim() ? greeting : null,
        });
        toast.success("Voice agent created.");
        await onCreated();
      } else {
        await updateTemplate({
          templateId: agent.templateId,
          templateType: "call",
          templateName: name.trim(),
          templateSubject: agent.templateSubject ?? "",
          templateMessage: prompt,
          greetingMsg: greeting.trim() ? greeting : null,
        });
        toast.success("Voice agent updated.");
        await onUpdated();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save the voice agent.");
    } finally {
      setSaving(false);
    }
  };

  const removeAgent = async () => {
    if (!agent) return;
    setDeleting(true);
    try {
      await deleteTemplate(agent.templateId);
      toast.success("Voice agent deleted.");
      await onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete the voice agent.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 p-6">
      <div className="space-y-5 flex-1">
        <label className="block">
          <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
            Agent Name
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex — Collections Agent"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-tenant"
          />
        </label>

        <label className="block">
          <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
            Greeting Message
          </div>
          <textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            rows={3}
            placeholder="Hi, this is Alex calling on behalf of…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-tenant resize-y"
          />
          <div className="text-[11px] text-muted-foreground mt-1">
            Spoken to the customer when the call connects.
          </div>
        </label>

        <label className="block">
          <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
            System Prompt
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={11}
            placeholder="You are a professional, empathetic collections agent. Your goals are…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-mono outline-none focus:border-tenant resize-y"
          />
          <div className="text-[11px] text-muted-foreground mt-1">
            Instructions that steer the agent throughout the call.
          </div>
        </label>
      </div>

      <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">
          {dirty ? "Unsaved changes — save to apply." : "All changes saved."}
        </span>
        <div className="flex items-center gap-2">
          {isNew ? (
            <button
              onClick={onCancelDraft}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" /> Discard
            </button>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/30 text-sm font-semibold text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
          <button
            onClick={saveAgent}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
            {isNew ? "Create Agent" : "Save Changes"}
          </button>
        </div>
      </div>

      {confirmDelete && agent && (
        <ConfirmDeleteDialog
          title="Delete Voice Agent"
          name={agent.templateName}
          busy={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={removeAgent}
        />
      )}
    </div>
  );
}

/* ------------- AI Messaging Prompt Setting panel (design, no API) ----------- */

function AiPromptsPanel({
  clients,
  clientsLoading,
  prompts,
  setPrompts,
}: {
  clients: TemplateClient[];
  clientsLoading: boolean;
  prompts: AiPromptSetting[];
  setPrompts: React.Dispatch<React.SetStateAction<AiPromptSetting[]>>;
}) {
  const [clientId, setClientId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (clients.length === 0) {
      setClientId(null);
      return;
    }
    setClientId((prev) =>
      prev != null && clients.some((c) => c.clientId === prev) ? prev : clients[0].clientId,
    );
  }, [clients]);

  const clientPrompts = prompts.filter((p) => p.clientId === clientId);
  const pillCounts = Object.fromEntries(
    clients.map((c) => [c.clientId, prompts.filter((p) => p.clientId === c.clientId).length]),
  );

  useEffect(() => {
    if (!clientPrompts.some((p) => p.id === selectedId)) {
      setSelectedId(clientPrompts[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, prompts]);

  const selected = clientPrompts.find((p) => p.id === selectedId) ?? null;

  if (clientsLoading) return <PanelSpinner />;
  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <Bot className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No clients available yet.</p>
      </div>
    );
  }

  const createPrompt = () => {
    if (clientId == null) return;
    const p: AiPromptSetting = { id: `ai-prompt-${Date.now()}`, clientId, name: "New Prompt", prompt: "" };
    setPrompts((prev) => [p, ...prev]);
    setSelectedId(p.id);
  };

  const updatePrompt = (patch: Partial<AiPromptSetting>) => {
    if (!selected) return;
    setPrompts((prev) => prev.map((p) => (p.id === selected.id ? { ...p, ...patch } : p)));
  };

  const removePrompt = () => {
    if (!selected) return;
    setPrompts((prev) => prev.filter((p) => p.id !== selected.id));
    setSelectedId(null);
    toast.success("Prompt deleted");
  };

  return (
    <>
      <ClientPills clients={clients} counts={pillCounts} value={clientId} onChange={setClientId} />
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] min-h-[560px]">
        {/* Left list */}
        <aside className="border-b lg:border-b-0 lg:border-r border-border bg-muted/20 p-3 space-y-2">
          <button
            onClick={createPrompt}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New Prompt
          </button>
          <ul className="space-y-2">
            {clientPrompts.length === 0 && (
              <li className="flex flex-col items-center gap-1.5 text-muted-foreground px-3 py-10 text-center">
                <Bot className="h-6 w-6 opacity-50" />
                <span className="text-xs">No AI messaging prompts for this client yet.</span>
              </li>
            )}
            {clientPrompts.map((p) => {
              const active = selected?.id === p.id;
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "w-full text-left cursor-pointer rounded-lg px-3 py-2.5 border transition-colors",
                      active
                        ? "bg-[color:var(--tenant)]/10 border-[color:var(--tenant)]/40"
                        : "bg-card border-border hover:border-[color:var(--tenant)]/30 hover:bg-muted/40",
                    )}
                  >
                    <div className={cn("text-sm font-semibold truncate", active ? "text-tenant" : "text-foreground")}>
                      {p.name || "Untitled Prompt"}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-tenant">
                      <Bot className="h-3 w-3" /> {clients.find((c) => c.clientId === p.clientId)?.clientName}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Right editor */}
        <div className="flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-12 text-center">
              Select a prompt from the left or create a new one.
            </div>
          ) : (
            <div className="flex flex-col flex-1 p-6">
              <div className="space-y-5 flex-1">
                <label className="block">
                  <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
                    Prompt Name
                  </div>
                  <input
                    value={selected.name}
                    onChange={(e) => updatePrompt({ name: e.target.value })}
                    placeholder="e.g. Firm Reminder"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-tenant"
                  />
                </label>

                <label className="block">
                  <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
                    Prompt
                  </div>
                  <textarea
                    value={selected.prompt}
                    onChange={(e) => updatePrompt({ prompt: e.target.value })}
                    rows={13}
                    placeholder="Write the prompt content here…"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-mono outline-none focus:border-tenant resize-y"
                  />
                </label>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  Changes are saved automatically for this session.
                </span>
                <button
                  onClick={removePrompt}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/30 text-sm font-semibold text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* -------------------- Documents panel (design, no API yet) ------------------ */

function DocumentsPanel({
  clients,
  clientsLoading,
  docs,
  setDocs,
}: {
  clients: TemplateClient[];
  clientsLoading: boolean;
  docs: DocTemplate[];
  setDocs: React.Dispatch<React.SetStateAction<DocTemplate[]>>;
}) {
  const [clientId, setClientId] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    if (clients.length === 0) {
      setClientId(null);
      return;
    }
    setClientId((prev) =>
      prev != null && clients.some((c) => c.clientId === prev) ? prev : clients[0].clientId,
    );
  }, [clients]);

  const clientDocs = docs.filter((d) => d.clientId === clientId);
  const clientName = clients.find((c) => c.clientId === clientId)?.clientName ?? "";
  const pillCounts = Object.fromEntries(
    clients.map((c) => [c.clientId, docs.filter((d) => d.clientId === c.clientId).length]),
  );

  if (clientsLoading) return <PanelSpinner />;
  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No clients available yet.</p>
      </div>
    );
  }

  function remove(id: string) {
    setDocs((p) => p.filter((d) => d.id !== id));
    toast.success("Template removed");
  }
  function download(d: DocTemplate) {
    if (!d.dataUrl) {
      toast.message(`${d.fileName} is a seeded sample (no file attached)`);
      return;
    }
    const a = document.createElement("a");
    a.href = d.dataUrl;
    a.download = d.fileName;
    a.click();
  }
  function toggleStatus(id: string) {
    setDocs((p) => p.map((d) => (d.id === id ? { ...d, status: d.status === "active" ? "archived" : "active" } : d)));
  }

  return (
    <>
      <ClientPills clients={clients} counts={pillCounts} value={clientId} onChange={setClientId} />
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-tenant" /> Document Templates
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Upload document templates (DOCX, PDF, TXT). The AI uses these templates and merges the
              customer's details to generate documents from the customer file's Documents tab.
            </p>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-90"
          >
            <Upload className="h-4 w-4" /> Upload template
          </button>
        </div>

        {clientDocs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No document templates for {clientName || "this client"} yet. Upload your first template
            to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {clientDocs.map((d) => (
              <div key={d.id} className="rounded-xl border border-border bg-card p-4 hover:border-tenant/40 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-tenant-soft flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-tenant" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{d.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{d.fileName}</div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                      d.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {d.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{d.description}</p>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="px-2 py-0.5 rounded-md bg-muted">{d.category}</span>
                  <span>{(d.size / 1024).toFixed(1)} KB</span>
                  <span>· {d.uploadedAt}</span>
                </div>
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-[11px] text-muted-foreground">by {d.uploadedBy}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => download(d)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => toggleStatus(d.id)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-tenant"
                      title="Toggle status"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(d.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {uploadOpen && clientId != null && (
          <UploadTemplateDialog
            clientName={clientName}
            onClose={() => setUploadOpen(false)}
            onUpload={(doc) => {
              setDocs((p) => [{ ...doc, clientId }, ...p]);
              setUploadOpen(false);
              toast.success(`Uploaded "${doc.name}"`);
            }}
          />
        )}
      </div>
    </>
  );
}

function UploadTemplateDialog({
  clientName,
  onClose,
  onUpload,
}: {
  clientName: string;
  onClose: () => void;
  onUpload: (doc: Omit<DocTemplate, "clientId">) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Legal");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function submit() {
    if (!name.trim() || !file) {
      toast.error("Name and file are required");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    onUpload({
      id: `doc-tpl-${Date.now()}`,
      name: name.trim(),
      category,
      description: description.trim() || "—",
      fileName: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      dataUrl,
      uploadedBy: "You",
      uploadedAt: new Date().toISOString().slice(0, 10),
      status: "active",
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <Upload className="h-5 w-5 text-tenant" />
          <h3 className="font-display text-lg font-bold">Upload document template</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          AI will use this template to generate documents for{" "}
          <span className="font-semibold text-foreground">{clientName}</span>, replacing merge
          variables with each customer's details.
        </p>

        <div className="space-y-4">
          <label className="block">
            <div className="text-xs font-semibold mb-1.5">
              Template name <span className="text-destructive">*</span>
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Demand Letter — Ontario"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-tenant"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs font-semibold mb-1.5">Category</div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-tenant"
              >
                <option>Legal</option>
                <option>Settlement</option>
                <option>Payment</option>
                <option>Compliance</option>
                <option>General</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs font-semibold mb-1.5">
                File <span className="text-destructive">*</span>
              </div>
              <input
                type="file"
                accept=".docx,.pdf,.txt,.doc"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs"
              />
            </label>
          </div>

          <label className="block">
            <div className="text-xs font-semibold mb-1.5">Description</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What this template is used for, and which merge variables it expects (e.g. {{debtor_full_name}}, {{balance_due}})."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-tenant resize-none"
            />
          </label>

          <div className="rounded-lg bg-tenant-soft/50 border border-tenant/20 p-3 text-[11px] text-muted-foreground">
            <span className="font-semibold text-tenant">Tip:</span> Use{" "}
            <code className="font-mono">{`{{debtor_full_name}}`}</code>,{" "}
            <code className="font-mono">{`{{balance_due}}`}</code>,{" "}
            <code className="font-mono">{`{{account_number}}`}</code>, etc. in your template — the AI
            will replace these with the customer's actual values during generation.
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={submit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-90"
          >
            <Upload className="h-4 w-4" /> Upload template
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- delete confirmation ---------------------------- */

function ConfirmDeleteDialog({
  title,
  name,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  name: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elegant"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <button onClick={onCancel} className="p-1 rounded hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <h2 className="font-display text-xl font-bold tracking-tight mt-4">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You are about to delete <span className="font-semibold text-foreground">{name}</span>. This
          action cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-3 pt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}
