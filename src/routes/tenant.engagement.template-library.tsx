import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import {
  Mail,
  MessageSquare,
  Check,
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
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/lib/permissions/store";
import { cn } from "@/lib/utils";
import { RichTextToolbar } from "@/components/tenant/RichTextToolbar";
import { InsertVariableMenu } from "@/components/tenant/InsertVariableMenu";
import { insertIntoField } from "@/lib/placeholders-api";
import { plainText } from "@/components/tenant/inbox/inbox-utils";
import {
  getTemplateClients,
  getClientTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getDocumentTemplates,
  createDocumentTemplate,
  updateDocumentTemplate,
  type Template,
  type TemplateClient,
  type TemplateType,
  type DocumentTemplate,
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

// Shown on the design-only tabs (Documents, AI Messaging Prompt) if the
// backend client list can't be loaded, so the layout stays reviewable.
const FALLBACK_CLIENTS: TemplateClient[] = [
  { clientId: -1, clientName: "RBC Bank" },
  { clientId: -2, clientName: "Airtel Bank" },
];

const TOKEN = /\{\{([^{}]+)\}\}/g;

/** Preview text: {{Field}} tokens shown as [Field] so they read as slots. */
function previewText(text: string): string {
  return text.replace(TOKEN, (_, name: string) => `[${name.trim()}]`);
}

/** Preview HTML: tokens become highlighted chips. Token names are escaped —
 *  the surrounding markup is the template's own HTML, as before. */
function previewHtml(html: string): string {
  return html.replace(TOKEN, (_, name: string) => {
    const safe = name.trim().replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    return `<span style="padding:0 4px;border-radius:4px;background:color-mix(in oklab, var(--tenant) 15%, transparent);color:var(--tenant);font-weight:600">${safe}</span>`;
  });
}

/** Plain-text summary of a template body (strips HTML) for the list preview. */
function bodyPreview(t: Template): string {
  return plainText(t.templateMessage).replace(/\s+/g, " ").trim();
}

/** Names compare trimmed and case-insensitively, so "Initial Outreach " and
 *  "initial outreach" count as the same template name. */
function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
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

  /* ------------------- AI messaging prompts (per designClients) -------------- */
  // aiPrompt has no client list of its own on getTemplateClients, so — like
  // Documents — it's fetched per client across the deduped `designClients` set
  // rather than through the cache/prefetchType machinery above.

  const [aiPromptCache, setAiPromptCache] = useState<Record<number, Template[]>>({});
  const [aiPromptLoading, setAiPromptLoading] = useState(true);
  const [aiPromptError, setAiPromptError] = useState<string | null>(null);
  const aiPromptPrefetched = useRef(false);

  const prefetchAiPrompts = useCallback(async (clients: TemplateClient[]) => {
    setAiPromptLoading(true);
    setAiPromptError(null);
    try {
      const lists = await Promise.all(
        clients.map((c) => getClientTemplate({ clientId: c.clientId, templateType: "aiPrompt" })),
      );
      setAiPromptCache((prev) => {
        const next = { ...prev };
        clients.forEach((c, i) => {
          next[c.clientId] = lists[i];
        });
        return next;
      });
    } catch (e) {
      setAiPromptError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setAiPromptLoading(false);
    }
  }, []);

  useEffect(() => {
    if (aiPromptPrefetched.current || designClients.length === 0) return;
    aiPromptPrefetched.current = true;
    prefetchAiPrompts(designClients);
  }, [designClients, prefetchAiPrompts]);

  const refreshOneAiPrompt = useCallback(async (clientId: number): Promise<Template[]> => {
    const list = await getClientTemplate({ clientId, templateType: "aiPrompt" });
    setAiPromptCache((prev) => ({ ...prev, [clientId]: list }));
    return list;
  }, []);

  /* ----------------------- document templates (per designClients) ------------ */
  // Same shape as the aiPrompt block above: document templates have no
  // per-channel client list of their own on getTemplateClients, so they're
  // fetched per client across the deduped `designClients` set.

  const [docCache, setDocCache] = useState<Record<number, DocumentTemplate[]>>({});
  const [docLoading, setDocLoading] = useState(true);
  const [docError, setDocError] = useState<string | null>(null);
  const docPrefetched = useRef(false);

  const prefetchDocs = useCallback(async (clients: TemplateClient[]) => {
    setDocLoading(true);
    setDocError(null);
    try {
      const lists = await Promise.all(clients.map((c) => getDocumentTemplates(c.clientId)));
      setDocCache((prev) => {
        const next = { ...prev };
        clients.forEach((c, i) => {
          next[c.clientId] = lists[i];
        });
        return next;
      });
    } catch (e) {
      setDocError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setDocLoading(false);
    }
  }, []);

  useEffect(() => {
    if (docPrefetched.current || designClients.length === 0) return;
    docPrefetched.current = true;
    prefetchDocs(designClients);
  }, [designClients, prefetchDocs]);

  const refreshOneDoc = useCallback(async (clientId: number): Promise<DocumentTemplate[]> => {
    const list = await getDocumentTemplates(clientId);
    setDocCache((prev) => ({ ...prev, [clientId]: list }));
    return list;
  }, []);

  /* --------------------------------- counts ---------------------------------- */

  const counts: Record<Tab, number> = {
    email: Object.values(cache.email).reduce((n, l) => n + l.length, 0),
    sms: Object.values(cache.sms).reduce((n, l) => n + l.length, 0),
    call: Object.values(cache.call).reduce((n, l) => n + l.length, 0),
    documents: Object.values(docCache).reduce((n, l) => n + l.length, 0),
    aiPrompt: Object.values(aiPromptCache).reduce((n, l) => n + l.length, 0),
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
              // One instance per channel: sharing it let an open email
              // template's editor survive a switch to SMS and dump its HTML
              // into the plain-text box.
              key={tab}
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
              clientsError={clientsError}
              onRetryClients={loadClients}
              byClient={docCache}
              loading={docLoading}
              error={docError}
              onRetry={() => prefetchDocs(designClients)}
              refreshOne={refreshOneDoc}
            />
          ) : (
            <AiPromptsPanel
              clients={designClients}
              clientsLoading={clientsLoading}
              clientsError={clientsError}
              onRetryClients={loadClients}
              byClient={aiPromptCache}
              loading={aiPromptLoading}
              error={aiPromptError}
              onRetry={() => prefetchAiPrompts(designClients)}
              refreshOne={refreshOneAiPrompt}
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
  const canCreate = usePermissions().can("templates.create");
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
  const pillCounts = Object.fromEntries(
    clients.map((c) => [c.clientId, byClient[c.clientId]?.length ?? 0]),
  );

  // Reset the selection when the client changes; auto-pick the first item for
  // "call" (matches the design's always-something-selected voice agent list).
  useEffect(() => {
    setSelected(
      tab === "call" && items.length > 0 ? { kind: "item", id: items[0].templateId } : null,
    );
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
          {canCreate && (
            <div className="px-3 pb-2">
              <button
                onClick={() => setSelected({ kind: "draft" })}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" /> {newLabel}
              </button>
            </div>
          )}
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
                    <div
                      className={cn(
                        "text-sm font-semibold truncate",
                        active ? "text-tenant" : "text-foreground",
                      )}
                    >
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
          {!selected || clientId == null || (selected.kind === "item" && !selectedItem) ? (
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
              key={
                selected.kind === "draft" ? `draft-${tab}-${clientId}` : `tpl-${tab}-${selected.id}`
              }
              channel={tab}
              clientId={clientId}
              clientName={clientName}
              template={selected.kind === "item" ? selectedItem : null}
              siblings={items}
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
  siblings,
  onCancelDraft,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  channel: "email" | "sms";
  clientId: number;
  clientName: string;
  template: Template | null;
  /** The other templates of this channel for this client — names must be
   *  unique among them, on create and on edit alike. */
  siblings: Template[];
  onCancelDraft: () => void;
  onCreated: () => void | Promise<void>;
  onUpdated: () => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}) {
  const { can } = usePermissions();
  const canDelete = can("templates.delete");
  const isEmail = channel === "email";
  const isNew = template === null;
  // A saved template is read-only without templates.edit (new drafts need
  // templates.create, which gates the "New" button that opens them).
  const readOnly = !isNew && !can("templates.edit");

  const [name, setName] = useState(template?.templateName ?? "");
  const [subject, setSubject] = useState(template?.templateSubject ?? "");
  const [message, setMessage] = useState(template?.templateMessage ?? "");
  const [docIds, setDocIds] = useState<number[]>(template?.documentTemplateIdList ?? []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // The client's document templates, offered as email attachments.
  const [docTemplates, setDocTemplates] = useState<DocumentTemplate[] | null>(null);
  useEffect(() => {
    if (!isEmail) return;
    let cancelled = false;
    getDocumentTemplates(clientId)
      .then((list) => !cancelled && setDocTemplates(list))
      .catch(() => !cancelled && setDocTemplates([]));
    return () => {
      cancelled = true;
    };
  }, [isEmail, clientId]);

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
    docIds: template?.documentTemplateIdList ?? [],
  };
  const sameIds = (a: number[], b: number[]) =>
    a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");
  const dirty =
    name !== orig.name ||
    subject !== orig.subject ||
    message !== orig.message ||
    (isEmail && !sameIds(docIds, orig.docIds));

  // Variables go wherever the user was last typing: the subject line or the
  // body. The rich-text body remembers its caret, since opening the menu
  // moves the selection out of the editor.
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const lastField = useRef<"subject" | "body">("body");
  const savedRange = useRef<Range | null>(null);
  const saveRange = () => {
    const sel = window.getSelection();
    const el = editorRef.current;
    if (sel && sel.rangeCount > 0 && el && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const insertVariable = (token: string) => {
    if (isEmail && lastField.current === "subject") {
      insertIntoField(subjectRef.current, subject, setSubject, token);
      return;
    }
    if (isEmail) {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        if (savedRange.current) {
          sel.addRange(savedRange.current);
        } else {
          // Never clicked into the body yet — append at the end.
          const end = document.createRange();
          end.selectNodeContents(el);
          end.collapse(false);
          sel.addRange(end);
        }
      }
      document.execCommand("insertText", false, token);
      saveRange();
      setMessage(el.innerHTML);
    } else {
      insertIntoField(smsRef.current, message, setMessage, token);
    }
  };

  // Uniqueness is per channel: the same name may exist once as email and once
  // as SMS, but never twice within one channel. Checked here for edit too —
  // the backend only rejects duplicates on create.
  const duplicate =
    name.trim() !== "" &&
    siblings.some((t) => t.templateId !== template?.templateId && sameName(t.templateName, name));
  const duplicateMsg = `An ${isEmail ? "email" : "SMS"} template named "${name.trim()}" already exists for ${clientName || "this client"}.`;

  const validate = (): string | null => {
    if (!name.trim()) return "Template name is required.";
    if (duplicate) return duplicateMsg;
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
          ...(isEmail ? { documentTemplateIdList: docIds } : {}),
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
          ...(isEmail ? { documentTemplateIdList: docIds } : {}),
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
          <span className="text-foreground font-semibold">
            {isNew ? "New Template" : readOnly ? "View Template" : "Edit Template"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          {!isNew && canDelete && (
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
          {!readOnly && (
            <button
              onClick={save}
              disabled={saving || (!isNew && !dirty)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-tenant text-white text-xs font-semibold shadow-tenant hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}{" "}
              Save Template
            </button>
          )}
        </div>
      </div>

      {/* Form — a native fieldset disables every control in read-only mode. */}
      <fieldset disabled={readOnly} className="min-w-0 p-6 space-y-5">
        <label className="block">
          <div className="text-xs font-semibold mb-1.5">
            Template Name <span className="text-destructive">*</span>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Initial Contact Email"
            aria-invalid={duplicate}
            className={cn(
              "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none",
              duplicate
                ? "border-destructive focus:border-destructive"
                : "border-border focus:border-tenant",
            )}
          />
          {duplicate && <p className="mt-1 text-[11px] text-destructive">{duplicateMsg}</p>}
        </label>

        {isEmail && (
          <label className="block">
            <div className="text-xs font-semibold mb-1.5">
              Subject Line <span className="text-destructive">*</span>
            </div>
            <input
              ref={subjectRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => (lastField.current = "subject")}
              placeholder="e.g. Your account with {{Creditor name}}"
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
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onInput={(e) => {
                    setMessage((e.target as HTMLDivElement).innerHTML);
                    saveRange();
                  }}
                  onFocus={() => (lastField.current = "body")}
                  onKeyUp={saveRange}
                  onMouseUp={saveRange}
                  className="min-h-[220px] px-4 py-3 text-sm outline-none prose prose-sm max-w-none"
                  style={{ whiteSpace: "pre-wrap" }}
                />
              </>
            ) : (
              <textarea
                ref={smsRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi {{Debtor first name}}, your balance of {{Current outstanding balance}} is now due."
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

        {isEmail && (
          <AttachmentsField docTemplates={docTemplates} selected={docIds} onChange={setDocIds} />
        )}

        <VariableHint>
          <InsertVariableMenu onInsert={insertVariable} disabled={readOnly} />
        </VariableHint>
      </fieldset>

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

/* ------------------------------ variable hint ------------------------------ */

function VariableHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {children}
      <p className="text-[11px] text-muted-foreground">
        Variables are the customer-file fields defined in Settings → Data Fields. Each one is
        replaced with the customer's own value when the message is sent.
      </p>
    </div>
  );
}

/* ---------------------------- email attachments ---------------------------- */

/** Document templates attached to an email template (documentTemplateIdList).
 *  Each one is generated for the customer and sent with the email. */
function AttachmentsField({
  docTemplates,
  selected,
  onChange,
}: {
  docTemplates: DocumentTemplate[] | null;
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  // Ids saved on the template that are no longer in the client's library.
  const missing = docTemplates
    ? selected.filter((id) => !docTemplates.some((d) => d.templateId === id))
    : [];

  return (
    <div>
      <div className="text-xs font-semibold mb-1.5">Attachments</div>
      <p className="text-[11px] text-muted-foreground mb-2">
        Documents generated for the customer and attached every time this email is sent.
      </p>
      {docTemplates === null ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading document templates…
        </div>
      ) : docTemplates.length === 0 && missing.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border px-3 py-2.5">
          This client has no document templates yet — add one in the Documents tab to attach it
          here.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {docTemplates.map((d) => {
            const on = selected.includes(d.templateId);
            return (
              <button
                key={d.templateId}
                type="button"
                onClick={() => toggle(d.templateId)}
                title={d.templateOrignalFileName}
                aria-pressed={on}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed",
                  on
                    ? "border-[color:var(--tenant)]/40 bg-[color:var(--tenant)]/10 text-tenant"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {on ? <Check className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                {d.templateName}
              </button>
            );
          })}
          {missing.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              title="No longer in this client's library — click to remove"
              className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs font-medium text-warning-foreground"
            >
              <X className="h-3.5 w-3.5" /> Template #{id} (removed)
            </button>
          ))}
        </div>
      )}
    </div>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
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
            is shown with placeholder data (e.g. a sample name and balance) so you can see the
            layout — real customer values are merged in when the message is actually sent.
          </div>
          {isEmail && (
            <div className="mb-4">
              <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                Subject
              </div>
              <div className="text-sm font-semibold">{previewText(subject) || "—"}</div>
            </div>
          )}
          <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
            Message
          </div>
          {isEmail ? (
            <div
              className="prose prose-sm max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: previewHtml(message) || "—" }}
            />
          ) : (
            <div className="text-sm whitespace-pre-wrap">{previewText(message) || "—"}</div>
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
  const { can } = usePermissions();
  const canDelete = can("templates.delete");
  const isNew = agent === null;
  const readOnly = !isNew && !can("templates.edit");
  const [name, setName] = useState(agent?.templateName ?? "New Voice Agent");
  const [greeting, setGreeting] = useState(agent?.greetingMsg ?? "");
  const [prompt, setPrompt] = useState(agent?.templateMessage ?? "");
  const greetingRef = useRef<HTMLTextAreaElement | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const agentField = useRef<"greeting" | "prompt">("prompt");
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
      <fieldset disabled={readOnly} className="min-w-0 space-y-5 flex-1">
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
            ref={greetingRef}
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            onFocus={() => (agentField.current = "greeting")}
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
            ref={promptRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => (agentField.current = "prompt")}
            rows={11}
            placeholder="You are a professional, empathetic collections agent. Your goals are…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-mono outline-none focus:border-tenant resize-y"
          />
          <div className="text-[11px] text-muted-foreground mt-1">
            Instructions that steer the agent throughout the call.
          </div>
        </label>

        <VariableHint>
          <InsertVariableMenu
            disabled={readOnly}
            onInsert={(token) =>
              agentField.current === "greeting"
                ? insertIntoField(greetingRef.current, greeting, setGreeting, token)
                : insertIntoField(promptRef.current, prompt, setPrompt, token)
            }
          />
        </VariableHint>
      </fieldset>

      <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">
          {readOnly
            ? "View only — your role can't change this."
            : dirty
              ? "Unsaved changes — save to apply."
              : "All changes saved."}
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
            canDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/30 text-sm font-semibold text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )
          )}
          {!readOnly && (
            <button
              onClick={saveAgent}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
              {isNew ? "Create Agent" : "Save Changes"}
            </button>
          )}
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

/* ----------------------- AI Messaging Prompt Setting panel ------------------ */
// Backed by the same createTemplate/updateTemplate/deleteTemplate/getClientTemplate
// endpoints as email/sms/call, just with templateType "aiPrompt". Client list is
// `designClients` (the deduped union from getTemplateClients) since aiPrompt has
// no per-channel client list of its own.

function AiPromptsPanel({
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
  clients: TemplateClient[];
  clientsLoading: boolean;
  clientsError: string | null;
  onRetryClients: () => void;
  byClient: Record<number, Template[]>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  refreshOne: (clientId: number) => Promise<Template[]>;
}) {
  const canCreate = usePermissions().can("templates.create");
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
  const pillCounts = Object.fromEntries(
    clients.map((c) => [c.clientId, byClient[c.clientId]?.length ?? 0]),
  );

  // Reset the selection when the client changes.
  useEffect(() => {
    setSelected(null);
  }, [clientId]);

  const selectedItem =
    selected?.kind === "item" ? (items.find((t) => t.templateId === selected.id) ?? null) : null;

  if (clientsError) return <PanelError message={clientsError} onRetry={onRetryClients} />;
  if (clientsLoading || loading) return <PanelSpinner />;
  if (error) return <PanelError message={error} onRetry={onRetry} />;
  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <Bot className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No clients available yet.</p>
      </div>
    );
  }

  return (
    <>
      <ClientPills clients={clients} counts={pillCounts} value={clientId} onChange={setClientId} />
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] min-h-[560px]">
        {/* Left list */}
        <aside className="border-b lg:border-b-0 lg:border-r border-border bg-muted/20 p-3 space-y-2">
          {canCreate && (
            <button
              onClick={() => setSelected({ kind: "draft" })}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> New Prompt
            </button>
          )}
          <ul className="space-y-2">
            {selected?.kind === "draft" && (
              <li>
                <div className="rounded-lg px-3 py-2.5 border border-[color:var(--tenant)]/40 bg-[color:var(--tenant)]/10">
                  <div className="text-sm font-semibold truncate text-tenant">New Prompt</div>
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
                <Bot className="h-6 w-6 opacity-50" />
                <span className="text-xs">No AI messaging prompts for this client yet.</span>
              </li>
            )}
            {items.map((p) => {
              const active = selectedItem?.templateId === p.templateId;
              return (
                <li key={p.templateId}>
                  <button
                    onClick={() => setSelected({ kind: "item", id: p.templateId })}
                    className={cn(
                      "w-full text-left cursor-pointer rounded-lg px-3 py-2.5 border transition-colors",
                      active
                        ? "bg-[color:var(--tenant)]/10 border-[color:var(--tenant)]/40"
                        : "bg-card border-border hover:border-[color:var(--tenant)]/30 hover:bg-muted/40",
                    )}
                  >
                    <div
                      className={cn(
                        "text-sm font-semibold truncate",
                        active ? "text-tenant" : "text-foreground",
                      )}
                    >
                      {p.templateName || "Untitled Prompt"}
                    </div>
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
              Select a prompt from the left or create a new one.
            </div>
          ) : (
            <AiPromptEditor
              key={selected.kind === "draft" ? `draft-${clientId}` : `prompt-${selected.id}`}
              prompt={selected.kind === "item" ? selectedItem : null}
              clientId={clientId}
              onCancelDraft={() => setSelected(null)}
              onCreated={async () => {
                const list = await refreshOne(clientId);
                const newest = list.reduce<Template | null>(
                  (max, t) => (!max || t.templateId > max.templateId ? t : max),
                  null,
                );
                setSelected(newest ? { kind: "item", id: newest.templateId } : null);
              }}
              onUpdated={async () => {
                await refreshOne(clientId);
              }}
              onDeleted={async () => {
                await refreshOne(clientId);
                setSelected(null);
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

function AiPromptEditor({
  prompt,
  clientId,
  onCancelDraft,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  prompt: Template | null;
  clientId: number;
  onCancelDraft: () => void;
  onCreated: () => void | Promise<void>;
  onUpdated: () => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}) {
  const { can } = usePermissions();
  const canDelete = can("templates.delete");
  const isNew = prompt === null;
  const readOnly = !isNew && !can("templates.edit");
  const [name, setName] = useState(prompt?.templateName ?? "New Prompt");
  const [message, setMessage] = useState(prompt?.templateMessage ?? "");
  const aiPromptRef = useRef<HTMLTextAreaElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = isNew || name !== prompt.templateName || message !== prompt.templateMessage;

  const save = async () => {
    if (!name.trim()) {
      toast.error("Prompt name is required.");
      return;
    }
    if (!message.trim()) {
      toast.error("Prompt content is required.");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await createTemplate({
          clientId,
          templateType: "aiPrompt",
          templateName: name.trim(),
          templateSubject: "",
          templateMessage: message,
        });
        toast.success("AI prompt created.");
        await onCreated();
      } else {
        await updateTemplate({
          templateId: prompt.templateId,
          templateType: "aiPrompt",
          templateName: name.trim(),
          templateSubject: prompt.templateSubject ?? "",
          templateMessage: message,
        });
        toast.success("AI prompt updated.");
        await onUpdated();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save the AI prompt.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!prompt) return;
    setDeleting(true);
    try {
      await deleteTemplate(prompt.templateId);
      toast.success("AI prompt deleted.");
      await onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete the AI prompt.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 p-6">
      <fieldset disabled={readOnly} className="min-w-0 space-y-5 flex-1">
        <label className="block">
          <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
            Prompt Name
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Firm Reminder"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-tenant"
          />
        </label>

        <label className="block">
          <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
            Prompt
          </div>
          <textarea
            ref={aiPromptRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={13}
            placeholder="Write the prompt content here…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-mono outline-none focus:border-tenant resize-y"
          />
        </label>

        <VariableHint>
          <InsertVariableMenu
            disabled={readOnly}
            onInsert={(token) => insertIntoField(aiPromptRef.current, message, setMessage, token)}
          />
        </VariableHint>
      </fieldset>

      <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">
          {readOnly
            ? "View only — your role can't change this."
            : dirty
              ? "Unsaved changes — save to apply."
              : "All changes saved."}
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
            canDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/30 text-sm font-semibold text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )
          )}
          {!readOnly && (
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
              {isNew ? "Create Prompt" : "Save Changes"}
            </button>
          )}
        </div>
      </div>

      {confirmDelete && prompt && (
        <ConfirmDeleteDialog
          title="Delete AI Prompt"
          name={prompt.templateName}
          busy={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}

/* ----------------------------- Documents panel (real API) ------------------- */
// Backed by getClientTemplate/createDocumentTemplate/updateDocumentTemplate/
// deleteTemplate. Like AI Messaging Prompt, document templates have no
// per-channel client list of their own, so the client set is `designClients`
// and byClient/loading/error/refreshOne are supplied by the page above.

function DocumentsPanel({
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
  clients: TemplateClient[];
  clientsLoading: boolean;
  clientsError: string | null;
  onRetryClients: () => void;
  byClient: Record<number, DocumentTemplate[]>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  refreshOne: (clientId: number) => Promise<DocumentTemplate[]>;
}) {
  const { can } = usePermissions();
  const [clientId, setClientId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<
    { mode: "create" } | { mode: "edit"; doc: DocumentTemplate } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (clients.length === 0) {
      setClientId(null);
      return;
    }
    setClientId((prev) =>
      prev != null && clients.some((c) => c.clientId === prev) ? prev : clients[0].clientId,
    );
  }, [clients]);

  const docs = clientId != null ? (byClient[clientId] ?? []) : [];
  const clientName = clients.find((c) => c.clientId === clientId)?.clientName ?? "";
  const pillCounts = Object.fromEntries(
    clients.map((c) => [c.clientId, byClient[c.clientId]?.length ?? 0]),
  );

  if (clientsError) return <PanelError message={clientsError} onRetry={onRetryClients} />;
  if (clientsLoading || loading) return <PanelSpinner />;
  if (error) return <PanelError message={error} onRetry={onRetry} />;
  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No clients available yet.</p>
      </div>
    );
  }

  const removeDoc = async () => {
    if (!deleteTarget || clientId == null) return;
    setDeleting(true);
    try {
      await deleteTemplate(deleteTarget.templateId);
      toast.success("Template deleted.");
      await refreshOne(clientId);
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete the template.");
    } finally {
      setDeleting(false);
    }
  };

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
              Upload .docx templates — the AI merges each customer's details into them to generate
              documents from the customer file's Documents tab.
            </p>
          </div>
          {can("templates.create") && (
            <button
              onClick={() => setDialog({ mode: "create" })}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-90 shrink-0"
            >
              <Upload className="h-4 w-4" /> Upload template
            </button>
          )}
        </div>

        {docs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No document templates for {clientName || "this client"} yet. Upload your first template
            to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {docs.map((d) => (
              <DocumentCard
                key={d.templateId}
                doc={d}
                onEdit={
                  can("templates.edit") ? () => setDialog({ mode: "edit", doc: d }) : undefined
                }
                onDelete={can("templates.delete") ? () => setDeleteTarget(d) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {dialog && clientId != null && (
        <DocumentTemplateDialog
          clientId={clientId}
          clientName={clientName}
          doc={dialog.mode === "edit" ? dialog.doc : null}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            await refreshOne(clientId);
            setDialog(null);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteDialog
          title="Delete Template"
          name={deleteTarget.templateName}
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={removeDoc}
        />
      )}
    </>
  );
}

function DocumentCard({
  doc,
  onEdit,
  onDelete,
}: {
  doc: DocumentTemplate;
  /** Omitted when the role lacks the permission, hiding the control. */
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const updated = new Date(doc.updatedAt);
  const updatedLabel = Number.isNaN(updated.getTime())
    ? null
    : updated.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-tenant/40 transition">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-tenant-soft flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5 text-tenant" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{doc.templateName}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {doc.templateOrignalFileName}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3 line-clamp-2 min-h-[2rem]">
        {doc.templateDescription || "—"}
      </p>
      {updatedLabel && (
        <div className="mt-3 text-[11px] text-muted-foreground">Updated {updatedLabel}</div>
      )}
      <div className="mt-4 flex items-center justify-end gap-1 pt-3 border-t border-border">
        <a
          href={doc.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          title="View / download"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-tenant"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function DocumentTemplateDialog({
  clientId,
  clientName,
  doc,
  onClose,
  onSaved,
}: {
  clientId: number;
  clientName: string;
  doc: DocumentTemplate | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const isNew = doc === null;
  const [name, setName] = useState(doc?.templateName ?? "");
  const [description, setDescription] = useState(doc?.templateDescription ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const validate = (): string | null => {
    if (!name.trim()) return "Template name is required.";
    if (!description.trim()) return "Description is required.";
    if (isNew && !file) return "A .docx file is required.";
    if (file && !file.name.toLowerCase().endsWith(".docx")) return "Only .docx files are allowed.";
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await createDocumentTemplate({
          clientId,
          templateName: name.trim(),
          templateDescription: description.trim(),
          file: file!,
        });
        toast.success("Template uploaded.");
      } else {
        await updateDocumentTemplate({
          templateId: doc.templateId,
          clientId,
          templateName: name.trim(),
          templateDescription: description.trim(),
          file: file ?? undefined,
        });
        toast.success("Template updated.");
      }
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save the template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <Upload className="h-5 w-5 text-tenant" />
          <h3 className="font-display text-lg font-bold">
            {isNew ? "Upload document template" : "Edit document template"}
          </h3>
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

          <label className="block">
            <div className="text-xs font-semibold mb-1.5">
              {isNew ? "File" : "Replace file"}{" "}
              {isNew && <span className="text-destructive">*</span>}
            </div>
            <input
              type="file"
              accept=".docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs"
            />
            <div className="text-[11px] text-muted-foreground mt-1">
              {isNew
                ? "Word documents (.docx) only."
                : `Leave empty to keep the current file (${doc.templateOrignalFileName}).`}
            </div>
          </label>

          <label className="block">
            <div className="text-xs font-semibold mb-1.5">
              Description <span className="text-destructive">*</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What this template is used for, and which fields it expects (e.g. {{Debtor first name}}, {{Current outstanding balance}})."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-tenant resize-none"
            />
          </label>

          <div className="rounded-lg bg-tenant-soft/50 border border-tenant/20 p-3 text-[11px] text-muted-foreground">
            <span className="font-semibold text-tenant">Tip:</span> Write customer fields into the
            .docx as <code className="font-mono">{`{{Field name}}`}</code> — e.g.{" "}
            <code className="font-mono">{`{{Debtor first name}}`}</code> or{" "}
            <code className="font-mono">{`{{Current outstanding balance}}`}</code> — and they're
            filled with the customer's values when the document is generated. See every available
            field under Insert variable in the Email or SMS editor.
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isNew ? "Upload template" : "Save changes"}
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
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
          You are about to delete <span className="font-semibold text-foreground">{name}</span>.
          This action cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-3 pt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{" "}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
