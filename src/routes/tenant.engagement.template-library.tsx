import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import {
  Mail,
  MessageSquare,
  FileText,
  Plus,
  Trash2,
  Eye,
  Save,
  ChevronRight,
  ChevronsUpDown,
  Check,
  Loader2,
  AlertTriangle,
  RefreshCw,
  X,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RichTextToolbar } from "@/components/tenant/RichTextToolbar";
import { VARIABLE_LIBRARY } from "@/lib/comms-mock";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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

/* --------------------------------- helpers --------------------------------- */

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
  const [channel, setChannel] = useState<TemplateType>("email");

  // Client lists per channel (from getTemplateClients).
  const [clients, setClients] = useState<Record<TemplateType, TemplateClient[]> | null>(null);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [clientsLoading, setClientsLoading] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selected, setSelected] = useState<
    { kind: "template"; id: number } | { kind: "draft" } | null
  >(null);
  const [draftClientId, setDraftClientId] = useState<number | null>(null);

  // Templates for the currently selected client+channel. getClientTemplate only
  // returns one client's list, so we fetch exactly the selected client's
  // templates — one call per selection, never a fan-out across clients.
  const [templates, setTemplates] = useState<Template[] | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards that make loading exactly-once and race-proof without relying on
  // async state: `loadedKey` dedupes repeat effect runs for the same selection
  // (so a StrictMode double-invoke or an extra re-render can't double-fire the
  // call); `reqId` tags each request so a stale response from a selection you've
  // already switched away from is ignored.
  const loadedKey = useRef<string | null>(null);
  const reqId = useRef(0);
  // Ensures getTemplateClients fires exactly once, even under StrictMode's
  // dev-only double-invoke of effects.
  const clientsLoaded = useRef(false);

  const clientList = useMemo(() => clients?.[channel] ?? [], [clients, channel]);

  /* ------------------------------ data loading ------------------------------ */

  const loadClients = useCallback(async () => {
    setClientsLoading(true);
    setClientsError(null);
    try {
      const res = await getTemplateClients();
      setClients({ email: res.emailClientList ?? [], sms: res.smsClientList ?? [] });
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

  const loadTemplates = useCallback((ch: TemplateType, clientId: number) => {
    loadedKey.current = `${ch}:${clientId}`;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    setTemplates(undefined);
    getClientTemplate({ clientId, templateType: ch })
      .then((list) => {
        if (reqId.current === id) setTemplates(list);
      })
      .catch((e) => {
        if (reqId.current !== id) return;
        setError(e instanceof Error ? e.message : "Failed to load templates.");
        loadedKey.current = null; // let a retry re-fetch this selection
      })
      .finally(() => {
        if (reqId.current === id) setLoading(false);
      });
  }, []);

  // Fetch the selected client+channel's templates whenever the selection
  // changes — one call each time, always with the templateType of the active
  // tab. Wait until the selected client actually belongs to the current
  // channel's list so we never fetch with a stale client from the previous tab
  // (on a channel switch this effect runs in the render before the selection is
  // reconciled below). `loadedKey` skips a repeat run for the same selection so
  // the call fires exactly once, not twice.
  useEffect(() => {
    if (selectedClientId == null) return;
    if (!clientList.some((c) => c.clientId === selectedClientId)) return;
    const key = `${channel}:${selectedClientId}`;
    if (loadedKey.current === key) return;
    loadTemplates(channel, selectedClientId);
  }, [channel, selectedClientId, clientList, loadTemplates]);

  // Re-fetch the current selection after a create/update/delete.
  const refreshClient = useCallback(
    async (ch: TemplateType, clientId: number): Promise<Template[]> => {
      const id = ++reqId.current;
      const list = await getClientTemplate({ clientId, templateType: ch });
      if (reqId.current === id) setTemplates(list);
      return list;
    },
    [],
  );

  /* ------------------------------ selection ------------------------------ */

  // Keep a valid client selected as clients/channel change.
  useEffect(() => {
    if (clientList.length === 0) {
      setSelectedClientId(null);
      return;
    }
    setSelectedClientId((prev) =>
      prev != null && clientList.some((c) => c.clientId === prev) ? prev : clientList[0].clientId,
    );
  }, [clientList]);

  const clientTemplates = useMemo(
    () =>
      (templates ?? [])
        .slice()
        .sort((a, b) => a.templateName.localeCompare(b.templateName)),
    [templates],
  );

  const hasDraft = selected?.kind === "draft" && draftClientId === selectedClientId;

  const selectedTemplate =
    selected?.kind === "template"
      ? ((templates ?? []).find((t) => t.templateId === selected.id) ?? null)
      : null;

  const switchChannel = (ch: TemplateType) => {
    if (ch === channel) return;
    setChannel(ch);
    setSelected(null);
    setDraftClientId(null);
    setError(null); // don't carry the previous tab's error into the new one
  };

  const selectClient = (clientId: number) => {
    setSelectedClientId(clientId);
    setSelected(null);
    setDraftClientId(null);
  };

  const startDraft = () => {
    if (selectedClientId == null) return;
    setDraftClientId(selectedClientId);
    setSelected({ kind: "draft" });
  };

  /* -------------------------------- render -------------------------------- */

  return (
    <Shell>
      <Topbar
        title="Template Library"
        subtitle="Reusable email and SMS templates with variable substitution, organised by client"
      />

      <section className="px-6 lg:px-10 py-6">
        <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
          {/* Toolbar: channel segmented control + client picker */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-b border-border">
            <div className="inline-flex items-center gap-1 rounded-xl bg-muted p-1 self-start">
              {(
                [
                  { id: "email" as const, label: "Email", icon: Mail },
                  { id: "sms" as const, label: "SMS", icon: MessageSquare },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                const active = channel === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => switchChannel(t.id)}
                    className={cn(
                      "inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold transition-colors",
                      active
                        ? "bg-card text-tenant shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" /> {t.label}
                  </button>
                );
              })}
            </div>

            {!clientsError && clientList.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground hidden sm:inline">
                  Client
                </span>
                <ClientCombobox
                  clients={clientList}
                  value={selectedClientId}
                  onChange={selectClient}
                  loading={clientsLoading}
                />
              </div>
            )}
          </div>

          {/* Body */}
          {clientsError ? (
            <ErrorState message={clientsError} onRetry={loadClients} />
          ) : error ? (
            <ErrorState
              message={error}
              onRetry={() =>
                selectedClientId != null && loadTemplates(channel, selectedClientId)
              }
            />
          ) : clientsLoading ||
            (clientList.length > 0 && (loading || templates === undefined)) ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : clientList.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No clients available. Create a client first to add templates.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] min-h-[560px]">
              {/* Left list */}
              <aside className="border-b lg:border-b-0 lg:border-r border-border bg-muted/20 flex flex-col">
                <div className="px-3 pt-3 pb-2 flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                    Templates
                  </span>
                  <span className="min-w-5 px-1.5 rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {clientTemplates.length}
                  </span>
                </div>
                <div className="px-3 pb-2">
                  <button
                    onClick={startDraft}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-90 transition-opacity"
                  >
                    <Plus className="h-4 w-4" /> New Template
                  </button>
                </div>
                <ul className="px-2 pb-3 space-y-1 overflow-y-auto">
                  {hasDraft && (
                    <li>
                      <div className="rounded-lg px-3 py-2.5 border border-[color:var(--tenant)]/40 bg-[color:var(--tenant)]/10">
                        <div className="text-sm font-semibold truncate text-tenant">
                          New Template
                        </div>
                        <div className="mt-1">
                          <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-warning/15 text-warning-foreground">
                            Unsaved draft
                          </span>
                        </div>
                      </div>
                    </li>
                  )}
                  {clientTemplates.length === 0 && !hasDraft && (
                    <li className="flex flex-col items-center gap-1.5 text-muted-foreground px-3 py-10 text-center">
                      <FileText className="h-6 w-6 opacity-50" />
                      <span className="text-xs">No templates for this client yet.</span>
                    </li>
                  )}
                  {clientTemplates.map((t) => {
                    const active = selectedTemplate?.templateId === t.templateId;
                    return (
                      <li key={t.templateId}>
                        <button
                          onClick={() => {
                            setSelected({ kind: "template", id: t.templateId });
                            setDraftClientId(null);
                          }}
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
                          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {bodyPreview(t) || "—"}
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
                    Select a template from the left or create a new one.
                  </div>
                ) : (
                  <TemplateEditor
                    key={
                      selected.kind === "draft"
                        ? `draft-${channel}-${draftClientId}`
                        : `tpl-${selected.id}`
                    }
                    channel={channel}
                    clientId={
                      selected.kind === "draft" ? draftClientId! : selectedTemplate!.clientId
                    }
                    clientName={
                      clientList.find(
                        (c) =>
                          c.clientId ===
                          (selected.kind === "draft" ? draftClientId : selectedTemplate?.clientId),
                      )?.clientName ?? ""
                    }
                    template={selected.kind === "template" ? selectedTemplate : null}
                    onCancelDraft={() => {
                      setDraftClientId(null);
                      setSelected(null);
                    }}
                    onCreated={async (clientId) => {
                      setDraftClientId(null);
                      const list = await refreshClient(channel, clientId);
                      const newest = list.reduce<Template | null>(
                        (max, t) => (!max || t.templateId > max.templateId ? t : max),
                        null,
                      );
                      setSelected(newest ? { kind: "template", id: newest.templateId } : null);
                    }}
                    onUpdated={async (clientId) => {
                      await refreshClient(channel, clientId);
                    }}
                    onDeleted={async (clientId) => {
                      await refreshClient(channel, clientId);
                      setSelected(null);
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </Shell>
  );
}

/* ----------------------------- client combobox ----------------------------- */

function ClientCombobox({
  clients,
  value,
  onChange,
  loading,
}: {
  clients: TemplateClient[];
  value: number | null;
  onChange: (clientId: number) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = clients.find((c) => c.clientId === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          className="inline-flex items-center gap-2 h-9 min-w-[200px] max-w-[280px] px-3 rounded-lg border border-border bg-background text-sm font-medium hover:border-[color:var(--tenant)]/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--tenant)]/30 transition-colors"
        >
          <Building2 className="h-4 w-4 text-tenant shrink-0" />
          <span className="truncate flex-1 text-left">
            {current ? current.clientName : "Select a client"}
          </span>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-0">
        <Command>
          <CommandInput placeholder="Search clients…" />
          <CommandList>
            <CommandEmpty>{loading ? "Loading…" : "No clients found."}</CommandEmpty>
            <CommandGroup>
              {clients.map((c) => {
                const active = c.clientId === value;
                return (
                  <CommandItem
                    key={c.clientId}
                    value={c.clientName}
                    onSelect={() => {
                      onChange(c.clientId);
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <Check
                      className={cn("h-4 w-4 text-tenant", active ? "opacity-100" : "opacity-0")}
                    />
                    <span className="flex-1 truncate">{c.clientName}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------- error state ------------------------------- */

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
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

/* -------------------------------- editor ---------------------------------- */

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
  channel: TemplateType;
  clientId: number;
  clientName: string;
  template: Template | null;
  onCancelDraft: () => void;
  onCreated: (clientId: number) => void | Promise<void>;
  onUpdated: (clientId: number) => void | Promise<void>;
  onDeleted: (clientId: number) => void | Promise<void>;
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
        await onCreated(clientId);
      } else {
        await updateTemplate({
          templateId: template!.templateId,
          templateName: name.trim(),
          templateSubject: isEmail ? subject.trim() : "",
          templateMessage: message,
        });
        toast.success("Template updated.");
        await onUpdated(clientId);
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
      await onDeleted(clientId);
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
            {isNew ? "New Template" : "Edit Template"}
          </span>
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
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}{" "}
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
              Click to add it at the cursor — replaced with each debtor's real data when sent.
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
        <DeleteModal
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
            layout — real debtor values are merged in when the message is actually sent.
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

/* ------------------------------ delete modal ------------------------------- */

function DeleteModal({
  name,
  busy,
  onCancel,
  onConfirm,
}: {
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
        <h2 className="font-display text-xl font-bold tracking-tight mt-4">Delete Template</h2>
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
