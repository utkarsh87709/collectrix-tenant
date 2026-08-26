import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { ArrowLeft, Plus, Mail, MessageSquare, Copy, Trash2, Eye, Save, ChevronRight, FileText, Upload, Sparkles, Download } from "lucide-react";
import { templates as seedTemplates, VARIABLE_LIBRARY, type Template } from "@/lib/comms-mock";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RichTextToolbar } from "@/components/tenant/RichTextToolbar";

export const Route = createFileRoute("/tenant/comms/templates")({
  head: () => ({ meta: [{ title: "Templates · Communications" }] }),
  component: TemplatesPage,
});

type ChannelTab = "email" | "sms" | "documents";

type DocTemplate = {
  id: string;
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

const SEED_DOC_TEMPLATES: DocTemplate[] = [
  {
    id: "doc-tpl-1",
    name: "Demand Letter Template",
    category: "Legal",
    description: "Standard pre-legal demand letter. AI fills customer, balance, deadline, attorney details.",
    fileName: "demand_letter_template.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 24576,
    dataUrl: "",
    uploadedBy: "Sarah Klein",
    uploadedAt: "2025-11-18",
    status: "active",
  },
  {
    id: "doc-tpl-2",
    name: "Settlement Offer Template",
    category: "Settlement",
    description: "Settlement-in-full offer with expiry. AI populates settlement amount and percentage.",
    fileName: "settlement_offer_template.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 18944,
    dataUrl: "",
    uploadedBy: "Maya Chen",
    uploadedAt: "2025-11-22",
    status: "active",
  },
];

function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(
    seedTemplates.filter((t) => t.channel === "email" || t.channel === "sms")
  );
  const [docTemplates, setDocTemplates] = useState<DocTemplate[]>(SEED_DOC_TEMPLATES);
  const [tab, setTab] = useState<ChannelTab>("email");
  const list = useMemo(() => templates.filter((t) => t.channel === (tab === "documents" ? "email" : tab) as Template["channel"]), [templates, tab]);
  const [selectedId, setSelectedId] = useState<string | null>(list[0]?.id ?? null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const selected = templates.find((t) => t.id === selectedId) ?? list[0] ?? null;
  const counts = {
    email: templates.filter((t) => t.channel === "email").length,
    sms: templates.filter((t) => t.channel === "sms").length,
    documents: docTemplates.length,
  };

  const switchTab = (c: ChannelTab) => {
    setTab(c);
    if (c === "documents") return;
    const first = templates.find((t) => t.channel === c);
    setSelectedId(first?.id ?? null);
  };

  const createNew = () => {
    const tpl: Template = {
      id: `tpl-${Date.now()}`,
      name: "New Template",
      channel: (tab === "documents" ? "email" : tab),
      category: "General",
      subject: tab === "email" ? "" : undefined,
      preview: "",
      variables: [],
      language: "en",
      status: "active",
      updatedAt: new Date().toISOString().slice(0, 10),
      sends30d: 0,
    };
    setTemplates((p) => [tpl, ...p]);
    setSelectedId(tpl.id);
    if (editorRef.current) editorRef.current.innerHTML = "";
  };

  const updateSelected = (patch: Partial<Template>) => {
    if (!selected) return;
    setTemplates((p) => p.map((t) => (t.id === selected.id ? { ...t, ...patch } : t)));
  };

  const duplicate = (t: Template) => {
    const copy: Template = { ...t, id: `tpl-${Date.now()}`, name: `${t.name} (copy)`, status: "active" };
    setTemplates((p) => [copy, ...p]);
    setSelectedId(copy.id);
    toast.success("Template duplicated");
  };

  const remove = (id: string) => {
    setTemplates((p) => p.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast.success("Template deleted");
  };

  const save = () => {
    if (!selected) return;
    const html = editorRef.current?.innerHTML ?? "";
    updateSelected({ preview: html.replace(/<[^>]+>/g, "").slice(0, 200), updatedAt: new Date().toISOString().slice(0, 10) });
    toast.success(`Saved "${selected.name}"`);
  };

  const insertVariable = (key: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand("insertText", false, key);
  };

  return (
    <Shell>
      <Topbar
        title="Template Library"
        subtitle="Reusable templates with variable substitution"
        action={
          <Link to="/tenant/comms" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      <section className="px-6 lg:px-10 py-6">
        <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
          {/* Channel tabs */}
          <div className="flex items-center gap-1 px-4 pt-3 border-b border-border">
            {([
              { id: "email" as const, label: "Email", icon: Mail, count: counts.email },
              { id: "sms" as const, label: "SMS", icon: MessageSquare, count: counts.sms },
              { id: "documents" as const, label: "Documents", icon: FileText, count: counts.documents },
            ]).map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                    active ? "border-tenant text-tenant" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {t.label}
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${active ? "bg-tenant-soft text-tenant" : "bg-muted text-muted-foreground"}`}>{t.count}</span>
                </button>
              );
            })}
          </div>

          {tab === "documents" ? (
            <DocumentsTemplatesPanel
              docs={docTemplates}
              setDocs={setDocTemplates}
              uploadOpen={uploadOpen}
              setUploadOpen={setUploadOpen}
            />
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] min-h-[600px]">
            {/* Left list */}
            <aside className="border-r border-border bg-muted/20">
              <div className="p-3">
                <button onClick={createNew} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-90">
                  <Plus className="h-4 w-4" /> New Template
                </button>
              </div>
              <ul className="px-2 pb-3 space-y-1">
                {list.length === 0 && (
                  <li className="text-xs text-muted-foreground px-3 py-6 text-center">No templates yet.</li>
                )}
                {list.map((t) => {
                  const active = selected?.id === t.id;
                  return (
                    <li key={t.id}>
                      <div
                        onClick={() => setSelectedId(t.id)}
                        className={`group cursor-pointer rounded-lg px-3 py-2.5 border ${
                          active ? "bg-tenant-soft border-[color:var(--tenant)]/30" : "bg-card border-border hover:border-[color:var(--tenant)]/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm font-semibold truncate ${active ? "text-tenant" : "text-foreground"}`}>{t.name}</div>
                            <div className="mt-1">
                              <span className={`inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                                t.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                              }`}>{t.status}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); duplicate(t); }} className="p-1 rounded hover:bg-background text-muted-foreground hover:text-tenant" title="Duplicate">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); remove(t.id); }} className="p-1 rounded hover:bg-background text-muted-foreground hover:text-destructive" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </aside>

            {/* Right editor */}
            <div className="flex flex-col">
              {!selected && (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-12">
                  Select a template from the left or create a new one.
                </div>
              )}
              {selected && (
                <>
                  <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Templates</span>
                      <ChevronRight className="h-3 w-3" />
                      <span className="capitalize">{selected.channel}</span>
                      <ChevronRight className="h-3 w-3" />
                      <span className="text-foreground font-semibold">Edit Template</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toast.message(`Preview ${selected.name}`)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted">
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </button>
                      <button onClick={save} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-tenant text-white text-xs font-semibold shadow-tenant hover:opacity-90">
                        <Save className="h-3.5 w-3.5" /> Save Template
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="block">
                        <div className="text-xs font-semibold mb-1.5">Template Name <span className="text-destructive">*</span></div>
                        <input
                          value={selected.name}
                          onChange={(e) => updateSelected({ name: e.target.value })}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-tenant"
                        />
                      </label>
                      <label className="block">
                        <div className="text-xs font-semibold mb-1.5">Status</div>
                        <select
                          value={selected.status}
                          onChange={(e) => updateSelected({ status: e.target.value as Template["status"] })}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-tenant"
                        >
                          
                          <option value="active">Active</option>
                          <option value="archived">Archived</option>
                        </select>
                      </label>
                    </div>

                    {selected.channel === "email" && (
                      <label className="block">
                        <div className="text-xs font-semibold mb-1.5">Subject Line <span className="text-destructive">*</span></div>
                        <input
                          value={selected.subject ?? ""}
                          onChange={(e) => updateSelected({ subject: e.target.value })}
                          placeholder="e.g. We'd love your feedback!"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-tenant"
                        />
                      </label>
                    )}

                    <div>
                      <div className="text-xs font-semibold mb-1.5">
                        Message Content <span className="text-destructive">*</span>
                      </div>
                      <div className="rounded-lg border border-border bg-background overflow-hidden">
                        {selected.channel === "email" && (
                          <div className="px-2 py-1.5 border-b border-border bg-muted/30">
                            <RichTextToolbar editorRef={editorRef} />
                          </div>
                        )}
                        <div
                          ref={editorRef}
                          contentEditable
                          suppressContentEditableWarning
                          className="min-h-[220px] px-4 py-3 text-sm outline-none prose prose-sm max-w-none"
                          style={{ whiteSpace: "pre-wrap" }}
                        >
                          {selected.preview}
                        </div>
                      </div>
                      {selected.channel === "sms" && (
                        <div className="text-[11px] text-muted-foreground mt-1.5">SMS messages are limited to 160 characters per segment.</div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2">Variables:</div>
                      <div className="flex flex-wrap gap-2">
                        {VARIABLE_LIBRARY.map((v) => (
                          <button
                            key={v.key}
                            onClick={() => insertVariable(v.key)}
                            className="inline-flex items-center px-2 py-1 rounded-md bg-tenant-soft text-tenant border border-[color:var(--tenant)]/20 text-[11px] font-mono font-semibold hover:bg-tenant hover:text-white transition-colors"
                            title={v.description}
                          >
                            {v.key}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          )}
        </div>
      </section>
    </Shell>
  );
}

function DocumentsTemplatesPanel({
  docs,
  setDocs,
  uploadOpen,
  setUploadOpen,
}: {
  docs: DocTemplate[];
  setDocs: React.Dispatch<React.SetStateAction<DocTemplate[]>>;
  uploadOpen: boolean;
  setUploadOpen: (v: boolean) => void;
}) {
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
    setDocs((p) =>
      p.map((d) => (d.id === id ? { ...d, status: d.status === "active" ? "archived" : "active" } : d))
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div>
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-tenant" /> Document Templates
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Upload document templates (DOCX, PDF, TXT). The AI uses these templates and merges the customer's details
            to generate documents from the customer file's Documents tab.
          </p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-90"
        >
          <Upload className="h-4 w-4" /> Upload template
        </button>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No document templates yet. Upload your first template to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {docs.map((d) => (
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
                <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                  d.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                }`}>{d.status}</span>
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
                  <button onClick={() => download(d)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Download">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => toggleStatus(d.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-tenant" title="Toggle status">
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(d.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadOpen && (
        <UploadTemplateDialog
          onClose={() => setUploadOpen(false)}
          onUpload={(doc) => {
            setDocs((p) => [doc, ...p]);
            setUploadOpen(false);
            toast.success(`Uploaded "${doc.name}"`);
          }}
        />
      )}
    </div>
  );
}

function UploadTemplateDialog({
  onClose,
  onUpload,
}: {
  onClose: () => void;
  onUpload: (doc: DocTemplate) => void;
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
          AI will use this template to generate documents, replacing merge variables with each customer's details.
        </p>

        <div className="space-y-4">
          <label className="block">
            <div className="text-xs font-semibold mb-1.5">Template name <span className="text-destructive">*</span></div>
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
              <div className="text-xs font-semibold mb-1.5">File <span className="text-destructive">*</span></div>
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
            <code className="font-mono">{`{{account_number}}`}</code>, etc. in your template — the AI will replace
            these with the customer's actual values during generation.
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
