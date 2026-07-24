import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead } from "@/components/tenant/ui";
import { StatusPill } from "@/components/tenant/statuses/StatusPill";
import { StatusFormDrawer, type StatusDraft } from "@/components/tenant/statuses/StatusFormDrawer";
import {
  getAllStatus,
  createStatus,
  updateStatus,
  deleteStatus,
  type Status,
} from "@/lib/statuses-api";
import { AlertTriangle, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/tenant/settings/statuses")({
  head: () => ({ meta: [{ title: "Statuses · Tenant Admin" }] }),
  component: StatusesPage,
});

function StatusesPage() {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<Status | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const existingCodes = useMemo(
    () => statuses.map((s) => (s.statusCode ?? "").toUpperCase()),
    [statuses],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatuses(await getAllStatus());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load statuses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (s: Status) => {
    setEditing(s);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
    setEditing(null);
  };

  const handleSave = async (draft: StatusDraft) => {
    setSaving(true);
    try {
      if (editing) {
        await updateStatus({ statusId: editing.statusId, ...draft });
        toast.success(`Status “${draft.status}” updated`);
      } else {
        await createStatus(draft);
        toast.success(`Status “${draft.status}” created`);
      }
      setDrawerOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save status.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteStatus(deleting.statusId);
      toast.success(`Status “${deleting.status}” deleted`);
      setDeleting(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete status.");
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <Shell>
      <Topbar
        title="Statuses"
        subtitle="Define the account lifecycle for your firm."
        action={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-95 transition-opacity"
          >
            <Plus className="h-4 w-4" /> New Status
          </button>
        }
      />

      <section className="px-6 lg:px-10 pt-6 pb-12">
        <PageCard>
          <CardHead
            title="All statuses"
            action={
              <div className="flex items-center gap-2">
                <button
                  onClick={load}
                  disabled={loading}
                  aria-label="Refresh"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-muted px-2 text-sm font-semibold text-muted-foreground">
                  {statuses.length}
                </span>
              </div>
            }
          />

          {loading ? (
            <div className="px-6 py-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading statuses…
            </div>
          ) : error ? (
            <div className="px-6 py-16 text-center">
              <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={load}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : statuses.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No statuses yet. Create your first status to define the account lifecycle.
              </p>
              <button
                onClick={openCreate}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-95 transition-opacity"
              >
                <Plus className="h-4 w-4" /> New Status
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {statuses.map((s) => (
                <li
                  key={s.statusId}
                  className="group flex items-center justify-between gap-4 px-6 py-4"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusPill code={s.statusCode} name={s.status} color={s.statusColorCode} />
                    {!!s.initialStatusFlag && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
                        Initial
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(s)}
                      aria-label={`Edit ${s.status}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleting(s)}
                      aria-label={`Delete ${s.status}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PageCard>
      </section>

      <StatusFormDrawer
        open={drawerOpen}
        status={editing}
        existingCodes={existingCodes}
        saving={saving}
        onClose={closeDrawer}
        onSave={handleSave}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && !deletingBusy && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete status?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  This removes <span className="font-semibold">{deleting.statusCode}</span> ·{" "}
                  {deleting.status} from your account lifecycle. A status that is still assigned to
                  a debtor cannot be deleted.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deletingBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}
