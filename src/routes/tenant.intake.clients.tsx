import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead } from "@/components/tenant/ui";
import {
  Building2, Plus, Settings2, Trash2, X, Loader2, RefreshCw, AlertTriangle,
  MessageSquare, Mail, Phone, FileText, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  getAllClients,
  createClient,
  updateClient,
  deleteClient,
  type Client,
  type ClientChannels,
} from "@/lib/clients-api";

export const Route = createFileRoute("/tenant/intake/clients")({
  head: () => ({ meta: [{ title: "Client List · Tenant Admin" }] }),
  component: ClientListPage,
});

// Communication channels each client can opt into. `key` matches the API field.
const CHANNELS: { key: keyof ClientChannels; label: string; icon: LucideIcon }[] = [
  { key: "smsEnabled", label: "SMS", icon: MessageSquare },
  { key: "emailEnabled", label: "Email", icon: Mail },
  { key: "callEnabled", label: "Call", icon: Phone },
  { key: "documentEnabled", label: "Document", icon: FileText },
];

function ClientListPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `null` = closed; `"new"` = create; a Client = edit that client.
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAllClients();
      setClients(res.clients ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clients.");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return (
    <Shell>
      <Topbar
        title="Client List"
        subtitle="Clients / creditors in your data intake list"
        action={
          <button
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        }
      />

      <section className="px-6 lg:px-10 py-6">
        <PageCard>
          <CardHead
            title="Clients"
            subtitle={loading ? "Loading…" : `${clients.length} total`}
          />

          {error ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={fetchClients}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center px-6 py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No clients yet. Add your first client to get started.</p>
              <button
                onClick={() => setEditing("new")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
              >
                <Plus className="h-4 w-4" /> Add client
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-6 py-3 font-semibold w-12">#</th>
                    <th className="px-6 py-3 font-semibold">Client</th>
                    <th className="px-6 py-3 font-semibold">Client Number</th>
                    <th className="px-6 py-3 font-semibold">Files</th>
                    <th className="px-6 py-3 font-semibold">Channels</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c, i) => (
                    <tr key={c.clientId} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="px-6 py-4 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-4 w-4 text-tenant shrink-0" />
                          <span className="font-medium">{c.clientName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-muted-foreground">{c.clientNumber}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center justify-center min-w-7 px-2 py-0.5 rounded-md bg-muted text-xs font-semibold tabular-nums">
                          {c.totalFiles}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <TooltipProvider delayDuration={200}>
                          <div className="flex items-center gap-1.5">
                            {CHANNELS.map(({ key, label, icon: Icon }) => {
                              const on = c[key];
                              return (
                                <Tooltip key={key}>
                                  <TooltipTrigger asChild>
                                    <span
                                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${
                                        on ? "bg-tenant/10 text-tenant" : "bg-muted text-muted-foreground/40"
                                      }`}
                                    >
                                      <Icon className="h-3.5 w-3.5" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    {label} {on ? "enabled" : "disabled"}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </TooltipProvider>
                      </td>
                      <td className="px-6 py-4">
                        <TooltipProvider delayDuration={200}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditing(c)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted hover:border-tenant/40 transition-colors"
                            >
                              <Settings2 className="h-4 w-4 text-muted-foreground" /> Configure
                            </button>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setDeleting(c)}
                                  aria-label={`Remove ${c.clientName}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Remove client</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageCard>
      </section>

      {editing && (
        <ClientFormModal
          client={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchClients();
          }}
        />
      )}

      {deleting && (
        <DeleteClientModal
          client={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            fetchClients();
          }}
        />
      )}
    </Shell>
  );
}

/* ----------------------------- Create / edit modal ----------------------------- */

function ClientFormModal({
  client,
  onClose,
  onSaved,
}: {
  client: Client | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = client !== null;
  const [clientName, setClientName] = useState(client?.clientName ?? "");
  const [clientNumber, setClientNumber] = useState(client?.clientNumber ?? "");
  // New clients default every channel on; edits preserve the saved values.
  const [channels, setChannels] = useState<ClientChannels>({
    smsEnabled: client?.smsEnabled ?? true,
    emailEnabled: client?.emailEnabled ?? true,
    callEnabled: client?.callEnabled ?? true,
    documentEnabled: client?.documentEnabled ?? true,
  });
  const [saving, setSaving] = useState(false);

  const trimmedName = clientName.trim();
  const trimmedNumber = clientNumber.trim();
  const channelsDirty =
    isEdit && CHANNELS.some(({ key }) => channels[key] !== client[key]);
  const dirty =
    !isEdit ||
    trimmedName !== client.clientName ||
    trimmedNumber !== client.clientNumber ||
    channelsDirty;
  const canSubmit = trimmedName.length > 0 && trimmedNumber.length > 0 && dirty && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updateClient({ clientId: client.clientId, clientName: trimmedName, clientNumber: trimmedNumber, ...channels });
        toast.success("Client updated successfully.");
      } else {
        await createClient({ clientName: trimmedName, clientNumber: trimmedNumber, ...channels });
        toast.success("Client created successfully.");
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to ${isEdit ? "update" : "create"} client.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">
            {isEdit ? "Configure client" : "Add client"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEdit
              ? "Update this client / creditor's details."
              : "Add a new client / creditor to your data intake list."}
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Client name" required>
          <input
            autoFocus
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g. Airtel"
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-tenant/40"
          />
        </Field>
        <Field label="Client number" required>
          <input
            value={clientNumber}
            onChange={(e) => setClientNumber(e.target.value)}
            placeholder="e.g. CLT-004"
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-tenant/40"
          />
        </Field>

        <div>
          <span className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
            Communication channels
          </span>
          <div className="rounded-lg border border-border divide-y divide-border">
            {CHANNELS.map(({ key, label, icon: Icon }) => (
              <label key={key} className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer">
                <span className="flex items-center gap-2.5 text-sm">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {label}
                </span>
                <Switch
                  checked={channels[key]}
                  onCheckedChange={(v) => setChannels((c) => ({ ...c, [key]: v }))}
                  aria-label={`Toggle ${label}`}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEdit ? (
              <Settings2 className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}{" "}
            {isEdit ? "Save changes" : "Add client"}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

/* ------------------------------- Delete modal -------------------------------- */

function DeleteClientModal({
  client,
  onClose,
  onDeleted,
}: {
  client: Client;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    try {
      await deleteClient(client.clientId);
      toast.success("Client removed.");
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove client.");
      setDeleting(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">Remove client</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Remove <span className="font-semibold text-foreground">{client.clientName}</span> (
            {client.clientNumber})? This cannot be undone.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={confirm}
          disabled={deleting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-white text-sm font-semibold disabled:opacity-50"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove
        </button>
      </div>
    </Overlay>
  );
}

/* --------------------------------- helpers ---------------------------------- */

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elegant"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}
