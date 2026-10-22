// Create, edit or inspect a role. The permission grid is grouped the way the
// sidebar is (module → page → action), every change keeps the set closed under
// its requirements (permissions/summary.ts), and closing with unsaved changes
// asks first.
import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Info, Layers, Loader2, Search, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { cn } from "@/lib/utils";
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_MODULES,
  locatePermission,
  permissionLabel,
  sortPermissions,
  type PermissionKey,
  type PermissionModule,
} from "@/lib/permissions/catalog";
import {
  applyChange,
  moduleAccess,
  moduleCount,
  setModuleAccess,
  toggleKey,
  type AccessLevel,
  type Change,
} from "@/lib/permissions/summary";
import type { RoleInput } from "@/lib/roles-api";
import { ModuleSection, Tick } from "@/components/tenant/roles/PermissionMatrix";
import {
  ACCESS_LABEL,
  MODULE_ICONS,
  resourceMatches,
} from "@/components/tenant/roles/permission-ui";

export type RoleEditorMode = "create" | "edit" | "view";

export type RoleDraft = { name: string; description: string; permissions: PermissionKey[] };

const TOTAL = ALL_PERMISSION_KEYS.length;

/** "A, B and 2 more" — keeps cascade toasts short. */
function listLabels(keys: PermissionKey[]): string {
  const labels = keys.map(permissionLabel);
  if (labels.length <= 2) return labels.join(" and ");
  return `${labels.slice(0, 2).join(", ")} and ${labels.length - 2} more`;
}

export function RoleEditor({
  mode,
  initial,
  takenNames,
  isOwnRole,
  onClose,
  onSave,
}: {
  mode: RoleEditorMode;
  initial: RoleDraft;
  /** Names of the OTHER roles — a role name must be unique. */
  takenNames: string[];
  /** The signed-in user holds this role, so removing role access locks them out. */
  isOwnRole: boolean;
  onClose: () => void;
  /** Persist the role; throw to keep the editor open with the error shown. */
  onSave: (input: RoleInput) => Promise<void>;
}) {
  const readOnly = mode === "view";
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [selected, setSelected] = useState<Set<PermissionKey>>(() => new Set(initial.permissions));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [touchedName, setTouchedName] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [activeModule, setActiveModule] = useState<string>(PERMISSION_MODULES[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);

  const initialSet = useMemo(() => new Set(initial.permissions), [initial.permissions]);
  const added = useMemo(
    () => sortPermissions([...selected].filter((k) => !initialSet.has(k))),
    [selected, initialSet],
  );
  const removed = useMemo(
    () => sortPermissions([...initialSet].filter((k) => !selected.has(k))),
    [selected, initialSet],
  );
  const dirty =
    !readOnly &&
    (name.trim() !== initial.name.trim() ||
      description.trim() !== initial.description.trim() ||
      added.length > 0 ||
      removed.length > 0);

  const trimmedName = name.trim();
  const nameTaken = takenNames.some((n) => n.trim().toLowerCase() === trimmedName.toLowerCase());
  const nameError = !trimmedName
    ? "Give the role a name."
    : nameTaken
      ? "Another role already uses this name."
      : null;
  const locksSelfOut = isOwnRole && initialSet.has("roles.edit") && !selected.has("roles.edit");
  const modulesWithAccess = PERMISSION_MODULES.filter(
    (m) => moduleAccess(m, selected) !== "none",
  ).length;
  const anyMatch = PERMISSION_MODULES.some((m) =>
    m.resources.some((r) => resourceMatches(r, query)),
  );

  // Highlight the module nearest the top of the grid in the rail.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const id = visible[0]?.target.getAttribute("data-module");
        if (id) setActiveModule(id);
      },
      { root, rootMargin: "-15% 0px -70% 0px" },
    );
    root.querySelectorAll("[data-module]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [query]);

  /** Apply a change and mention anything it pulled in from OTHER pages. */
  const commit = (change: Change, targets: readonly PermissionKey[]) => {
    setSelected(change.next);
    const targetResources = new Set(targets.map((k) => locatePermission(k).resource.id));
    const elsewhere = (k: PermissionKey) => !targetResources.has(locatePermission(k).resource.id);
    const extraOn = change.added.filter(elsewhere);
    const extraOff = change.removed.filter(elsewhere);
    if (extraOn.length) {
      toast.message(`Also turned on ${listLabels(extraOn)}`, {
        description: `What you selected needs ${extraOn.length === 1 ? "it" : "them"}.`,
      });
    }
    if (extraOff.length) {
      toast.message(`Also turned off ${listLabels(extraOff)}`, {
        description: `${extraOff.length === 1 ? "It needs" : "They need"} what you turned off.`,
      });
    }
  };

  const onToggle = (key: PermissionKey, on: boolean) => commit(toggleKey(selected, key, on), [key]);

  const onLevel = (module: PermissionModule, level: Exclude<AccessLevel, "custom">) =>
    commit(
      setModuleAccess(selected, module, level),
      module.resources.flatMap((r) => r.actions.map((a) => a.key)),
    );

  const jumpTo = (moduleId: string) => {
    setQuery("");
    // After the search clears, the section is back in the DOM.
    requestAnimationFrame(() =>
      document
        .getElementById(`permissions-${moduleId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const requestClose = () => {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  const save = async () => {
    setTouchedName(true);
    if (nameError) return;
    setSaving(true);
    try {
      await onSave({
        roleName: trimmedName,
        roleDescription: description.trim(),
        permissions: sortPermissions(selected),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the role.");
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode === "create" ? "Create role" : mode === "edit" ? "Edit role" : initial.name || "Role";

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && requestClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby="role-editor-summary"
          // Toasts (cascade notices) live outside the dialog; clicking one
          // shouldn't count as clicking away from the editor.
          onInteractOutside={(e) => {
            if ((e.target as HTMLElement | null)?.closest?.("[data-sonner-toaster]")) {
              e.preventDefault();
            }
          }}
          className="fixed inset-x-0 bottom-0 z-50 flex h-[94dvh] flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-tenant focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[90vh] sm:w-[calc(100vw-2rem)] sm:max-w-6xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        >
          <TooltipProvider delayDuration={250}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--tenant)]/10 text-tenant">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <DialogPrimitive.Title className="truncate font-display text-lg font-bold tracking-tight">
                    {title}
                  </DialogPrimitive.Title>
                  <p id="role-editor-summary" className="mt-0.5 text-xs text-muted-foreground">
                    {selected.size} of {TOTAL} permissions · access to {modulesWithAccess} of{" "}
                    {PERMISSION_MODULES.length} modules
                  </p>
                </div>
              </div>
              <button
                onClick={requestClose}
                className="rounded-lg p-1.5 hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1">
              {/* Module rail */}
              <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-muted/20 lg:flex">
                <div className="flex items-center gap-2 px-5 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" /> Modules
                </div>
                <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
                  {PERMISSION_MODULES.map((m) => {
                    const Icon = MODULE_ICONS[m.id];
                    const level = moduleAccess(m, selected);
                    const { held, total } = moduleCount(m, selected);
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors",
                          activeModule === m.id
                            ? "bg-[color:var(--tenant)]/10"
                            : "hover:bg-muted/60",
                        )}
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={
                            level === "full" ? true : level === "none" ? false : "mixed"
                          }
                          aria-disabled={readOnly || undefined}
                          aria-label={`Grant all of ${m.label}`}
                          onClick={() =>
                            !readOnly && onLevel(m, level === "full" ? "none" : "full")
                          }
                          className={cn("rounded p-0.5", readOnly && "cursor-default")}
                        >
                          <Tick
                            state={level === "full" ? "on" : level === "none" ? "off" : "mixed"}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => jumpTo(m.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              level === "none" ? "text-muted-foreground" : "text-tenant",
                            )}
                          />
                          <span className="min-w-0">
                            <span
                              className={cn(
                                "block truncate text-sm font-semibold",
                                activeModule === m.id && "text-tenant",
                              )}
                            >
                              {m.label}
                            </span>
                            <span className="block text-[11px] text-muted-foreground tabular-nums">
                              {held}/{total} · {ACCESS_LABEL[level]}
                            </span>
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </nav>
              </aside>

              {/* `relative` keeps the matrix's absolutely-positioned sr-only labels
                  inside this scroller; otherwise they overflow the dialog itself
                  and scrollIntoView scrolls the whole dialog out of place. */}
              <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-y-auto">
                {/* Role details */}
                <div className="grid gap-4 px-5 pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] sm:px-6">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Role name
                    </span>
                    <input
                      value={name}
                      readOnly={readOnly}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => setTouchedName(true)}
                      placeholder="e.g. Senior collections agent"
                      aria-invalid={touchedName && !!nameError}
                      className={cn(
                        "mt-1.5 h-10 w-full rounded-lg border bg-muted px-3 text-sm outline-none focus:ring-2 ring-tenant read-only:cursor-default read-only:focus:ring-0",
                        touchedName && nameError ? "border-destructive" : "border-border",
                      )}
                    />
                    {touchedName && nameError && !readOnly && (
                      <span className="mt-1 block text-xs text-destructive">{nameError}</span>
                    )}
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Description
                    </span>
                    <input
                      value={description}
                      readOnly={readOnly}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={readOnly ? "No description" : "Who this role is for"}
                      className="mt-1.5 h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm outline-none focus:ring-2 ring-tenant read-only:cursor-default read-only:focus:ring-0"
                    />
                  </label>
                </div>

                {(locksSelfOut || (!readOnly && selected.size === 0)) && (
                  <div className="space-y-2 px-5 pt-4 sm:px-6">
                    {locksSelfOut && (
                      <Notice tone="warning">
                        This is your own role. Without Roles &amp; permissions · Edit you won't be
                        able to change it back — another administrator would have to.
                      </Notice>
                    )}
                    {!readOnly && selected.size === 0 && (
                      <Notice tone="info">
                        With no permissions, people on this role can only open Overview.
                      </Notice>
                    )}
                  </div>
                )}

                {/* Toolbar */}
                <div className="sticky top-0 z-10 mt-4 flex flex-wrap items-center gap-2 border-y border-border bg-card/95 px-5 py-3 backdrop-blur sm:px-6">
                  <div className="relative min-w-48 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search permissions"
                      aria-label="Search permissions"
                      className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 ring-tenant"
                    />
                  </div>
                  {!readOnly && (
                    <>
                      <button
                        onClick={() =>
                          setSelected(applyChange(selected, ALL_PERMISSION_KEYS, []).next)
                        }
                        disabled={selected.size === TOTAL}
                        className="h-9 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                      >
                        Select all
                      </button>
                      <button
                        onClick={() => setSelected(new Set())}
                        disabled={selected.size === 0}
                        className="h-9 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>

                {/* Permission grid */}
                <div className="space-y-5 px-5 py-5 sm:px-6">
                  {PERMISSION_MODULES.map((m) => (
                    <ModuleSection
                      key={m.id}
                      module={m}
                      selected={selected}
                      readOnly={readOnly}
                      query={query}
                      onToggle={onToggle}
                      onLevel={onLevel}
                    />
                  ))}
                  {!anyMatch && (
                    <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                      No permissions match "{query.trim()}".
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-5 py-3.5 sm:px-6">
              <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <ShieldCheck className="h-3.5 w-3.5 text-tenant" /> Permissions are enforced
                server-side.
              </div>
              {dirty && (added.length > 0 || removed.length > 0) && (
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {added.length > 0 && <span className="text-success">+{added.length}</span>}
                  {added.length > 0 && removed.length > 0 && " "}
                  {removed.length > 0 && (
                    <span className="text-destructive">−{removed.length}</span>
                  )}{" "}
                  unsaved
                </span>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={requestClose}
                  disabled={saving}
                  className="rounded-lg px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                >
                  {readOnly ? "Close" : "Cancel"}
                </button>
                {!readOnly && (
                  <button
                    onClick={save}
                    disabled={saving || (mode === "edit" && !dirty)}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-tenant px-4 py-2 text-sm font-semibold text-white shadow-tenant disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {mode === "create" ? "Create role" : "Save changes"}
                  </button>
                )}
              </div>
            </div>
          </TooltipProvider>

          <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
                <AlertDialogDescription>
                  {mode === "create"
                    ? "This role hasn't been created yet. Closing now loses what you've set up."
                    : "Your edits to this role haven't been saved. Closing now loses them."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep editing</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onClose}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Discard
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Notice({ tone, children }: { tone: "info" | "warning"; children: React.ReactNode }) {
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed",
        tone === "warning"
          ? "border-warning/40 bg-warning/10 text-warning-foreground"
          : "border-[color:var(--tenant)]/25 bg-[color:var(--tenant)]/5 text-foreground/80",
      )}
    >
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", tone === "info" && "text-tenant")} />
      <span>{children}</span>
    </div>
  );
}
