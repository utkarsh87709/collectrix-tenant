import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Copy,
  Eye,
  Info,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { RolesGridSkeleton } from "@/components/admin/Skeletons";
import { Pill } from "@/components/tenant/ui";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RoleEditor,
  type RoleDraft,
  type RoleEditorMode,
} from "@/components/tenant/roles/RoleEditor";
import { MODULE_ICONS } from "@/components/tenant/roles/permission-ui";
import { ALL_PERMISSION_KEYS, PERMISSION_MODULES } from "@/lib/permissions/catalog";
import { moduleAccess } from "@/lib/permissions/summary";
import { refreshPermissions, usePermissions } from "@/lib/permissions/store";
import {
  createRole,
  deleteRole,
  getAllRoles,
  updateRole,
  type PermissionSchema,
  type Role,
  type RoleInput,
} from "@/lib/roles-api";

export const Route = createFileRoute("/tenant/roles")({
  head: () => ({ meta: [{ title: "Roles & Permissions · Tenant Admin" }] }),
  component: RolesPage,
});

const TOTAL = ALL_PERMISSION_KEYS.length;

type EditorState = { mode: RoleEditorMode; role: Role | null; draft: RoleDraft };

function RolesPage() {
  const perms = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [schema, setSchema] = useState<PermissionSchema>("v2");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await getAllRoles();
      setRoles(res.roles);
      setSchema(res.schema);
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : "Failed to load roles.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The old backend format can be displayed but not written back safely, so
  // every write is off until the backend serves the new one.
  const legacy = schema === "legacy";
  const canCreate = perms.can("roles.create") && !legacy;
  const canEdit = perms.can("roles.edit") && !legacy;
  const canDelete = perms.can("roles.delete") && !legacy;
  const assignedUsers = useMemo(() => roles.reduce((n, r) => n + r.userCount, 0), [roles]);

  const open = (mode: RoleEditorMode, role: Role | null, draft?: Partial<RoleDraft>) =>
    setEditor({
      mode,
      role,
      draft: {
        name: draft?.name ?? role?.roleName ?? "",
        description: draft?.description ?? role?.roleDescription ?? "",
        permissions: draft?.permissions ?? role?.permissions ?? [],
      },
    });

  const openRole = (role: Role) => open(canEdit ? "edit" : "view", role);

  const save = async (input: RoleInput) => {
    if (!editor) return;
    if (editor.mode === "edit" && editor.role) {
      await updateRole({ roleId: editor.role.roleId, ...input });
      toast.success(`Role "${input.roleName}" updated`);
    } else {
      await createRole(input);
      toast.success(`Role "${input.roleName}" created`);
    }
    setEditor(null);
    await load(true);
    // The signed-in user may be on the role that just changed.
    void refreshPermissions();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteRole(deleting.roleId);
      toast.success(`Role "${deleting.roleName}" deleted`);
      setDeleting(null);
      await load(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete the role.");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <Shell>
      <Topbar
        title="Roles & Permissions"
        subtitle="Decide what each role can see and do — changes apply to everyone on the role"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => load()}
              disabled={loading}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            {canCreate && (
              <button
                onClick={() => open("create", null)}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> New role
              </button>
            )}
          </div>
        }
      />

      <section className="px-6 lg:px-10 py-6 space-y-5">
        {loading ? (
          <RolesGridSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <p className="text-sm text-destructive font-medium">{error}</p>
            <button
              onClick={() => load()}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : (
          <>
            {legacy && (
              <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--tenant)]/25 bg-[color:var(--tenant)]/5 px-5 py-4 text-sm">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-tenant" />
                <div>
                  <div className="font-semibold">Roles are read-only for now</div>
                  <p className="mt-0.5 text-muted-foreground">
                    The server still stores roles in the old permission format. Each role below
                    shows what it can do today, mapped to the new permissions. Creating, editing and
                    deleting roles unlocks as soon as the backend switches to the new format.
                  </p>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {roles.length} custom {roles.length === 1 ? "role" : "roles"} · {assignedUsers}{" "}
              {assignedUsers === 1 ? "user" : "users"} assigned · {TOTAL} permissions across{" "}
              {PERMISSION_MODULES.length} modules
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <TenantAdminCard />
              {roles.map((r, i) => (
                <RoleCard
                  key={r.roleId}
                  role={r}
                  index={i}
                  isOwnRole={perms.roleId === r.roleId}
                  canEdit={canEdit}
                  canCreate={canCreate}
                  canDelete={canDelete}
                  onOpen={() => openRole(r)}
                  onDuplicate={() =>
                    open("create", null, {
                      name: `${r.roleName} (copy)`,
                      description: r.roleDescription,
                      permissions: r.permissions,
                    })
                  }
                  onDelete={() => setDeleting(r)}
                />
              ))}
              {roles.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-6 flex flex-col items-center justify-center text-center">
                  <p className="text-sm font-semibold">No custom roles yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create roles to give each part of your team exactly the access it needs.
                  </p>
                  {canCreate && (
                    <button
                      onClick={() => open("create", null)}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
                    >
                      <Plus className="h-4 w-4" /> Create a role
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {editor && (
        <RoleEditor
          mode={editor.mode}
          initial={editor.draft}
          takenNames={roles.filter((r) => r.roleId !== editor.role?.roleId).map((r) => r.roleName)}
          isOwnRole={!!editor.role && perms.roleId === editor.role.roleId}
          legacy={legacy}
          onClose={() => setEditor(null)}
          onSave={save}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && !deleteBusy && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  <span className="font-semibold">{deleting.roleName}</span> will be removed for
                  good. Nobody is on it, so no one loses access.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}

function TenantAdminCard() {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--tenant)]/40 bg-[color:var(--tenant)]/5 p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display font-bold">Tenant Administrator</div>
          <p className="mt-1 text-xs text-muted-foreground">
            The built-in owner role. It always holds every permission and can't be edited or
            deleted.
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap">
          <Pill tone="tenant">Built-in</Pill>
        </span>
      </div>
      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {TOTAL} of {TOTAL} permissions
          </span>
          <span className="font-semibold text-tenant">Full access</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-gradient-tenant" />
      </div>
    </div>
  );
}

function RoleCard({
  role,
  index,
  isOwnRole,
  canEdit,
  canCreate,
  canDelete,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  role: Role;
  index: number;
  isOwnRole: boolean;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const granted = useMemo(() => new Set(role.permissions), [role.permissions]);
  const held = role.permissions.length;
  const pct = Math.round((held / TOTAL) * 100);
  const modules = PERMISSION_MODULES.map((m) => ({ m, level: moduleAccess(m, granted) })).filter(
    (x) => x.level !== "none",
  );
  const inUse = role.userCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.25 }}
      className="group relative rounded-2xl border border-border bg-card p-5 shadow-elegant hover:border-[color:var(--tenant)]/60 transition-colors flex flex-col"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* The title's ::after stretches over the card, so the whole card opens the role. */}
          <button
            onClick={onOpen}
            className="text-left font-display font-bold truncate max-w-full after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[color:var(--tenant)]/60"
          >
            {role.roleName}
          </button>
          {isOwnRole && (
            <span className="ml-2 align-middle">
              <Pill tone="tenant">Your role</Pill>
            </span>
          )}
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {role.roleDescription || "No description"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative z-10 -mr-1.5 -mt-1 p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Actions for ${role.roleName}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onSelect={onOpen}>
              {canEdit ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {canEdit ? "Edit role" : "View permissions"}
            </DropdownMenuItem>
            {canCreate && (
              <DropdownMenuItem onSelect={onDuplicate}>
                <Copy className="h-4 w-4" /> Duplicate
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={inUse}
                  onSelect={onDelete}
                  className="text-destructive focus:text-destructive flex-col items-start gap-0.5"
                >
                  <span className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" /> Delete role
                  </span>
                  {inUse && (
                    <span className="text-[11px] text-muted-foreground">
                      Move its {role.userCount} {role.userCount === 1 ? "user" : "users"} to another
                      role first
                    </span>
                  )}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground tabular-nums">
            {held} of {TOTAL} permissions
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-tenant">
            <Users className="h-3.5 w-3.5" /> {role.userCount}{" "}
            {role.userCount === 1 ? "user" : "users"}
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-gradient-tenant"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{
              delay: Math.min(index * 0.04, 0.3) + 0.15,
              duration: 0.5,
              ease: "easeOut",
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {modules.length === 0 ? (
            <span className="text-[11px] text-muted-foreground">No access to any module yet</span>
          ) : (
            modules.map(({ m, level }) => {
              const Icon = MODULE_ICONS[m.id];
              return (
                <span
                  key={m.id}
                  title={`${m.label}: ${level === "full" ? "full access" : level === "view" ? "view only" : "custom"}`}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                    level === "full"
                      ? "bg-[color:var(--tenant)]/10 text-tenant"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {m.label}
                  {level === "view" && (
                    <Eye className="h-3 w-3 opacity-70" aria-label="view only" />
                  )}
                </span>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );
}
