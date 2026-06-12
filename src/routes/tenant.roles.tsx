import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { Pill } from "@/components/tenant/ui";
import { motion } from "motion/react";
import { RolesGridSkeleton } from "@/components/admin/Skeletons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, ChevronDown, Loader2, RefreshCw, ShieldCheck, Check } from "lucide-react";
import { toast } from "sonner";
import {
  getConfiguredRoles,
  getAllRoles,
  createRole,
  updateRole,
  type ConfiguredRoles,
  type Role,
} from "@/lib/roles-api";
import { getRoleDescription, setRoleDescription } from "@/lib/role-descriptions";

export const Route = createFileRoute("/tenant/roles")({
  head: () => ({ meta: [{ title: "Roles & Permissions · Tenant Admin" }] }),
  component: RolesPage,
});

function RolesPage() {
  const [catalog, setCatalog] = useState<ConfiguredRoles | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [totalConfiguration, setTotalConfiguration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);

  const catalogTotal = useMemo(
    () => catalog?.configuredRoles.reduce((acc, g) => acc + g.configuration.length, 0) ?? 0,
    [catalog],
  );
  const total = totalConfiguration || catalogTotal;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, all] = await Promise.all([getConfiguredRoles(), getAllRoles()]);
      setCatalog(cfg);
      setRoles(all.roles);
      setTotalConfiguration(all.totalConfiguration);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load roles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refreshRoles = useCallback(async () => {
    try {
      const all = await getAllRoles();
      setRoles(all.roles);
      setTotalConfiguration(all.totalConfiguration);
    } catch {
      /* keep existing list */
    }
  }, []);

  return (
    <Shell>
      <Topbar
        title="Roles & Permissions"
        subtitle="Custom roles enforced server-side — permissions apply to all assigned users"
        action={
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button
              onClick={() => setCreating(true)}
              disabled={loading || !catalog}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> New role
            </button>
          </div>
        }
      />

      <section className="px-6 lg:px-10 py-6">
        {loading ? (
          <RolesGridSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <p className="text-sm text-destructive font-medium">{error}</p>
            <button onClick={load} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : roles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">No roles yet.</p>
            <button onClick={() => setCreating(true)} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">
              <Plus className="h-4 w-4" /> Create your first role
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {roles.map((r, i) => {
              const enabled = r.allowedConfiguration.length;
              const pct = total > 0 ? Math.round((enabled / total) * 100) : 0;
              return (
                <motion.button
                  key={r.roleId}
                  onClick={() => setEditing(r)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.4), duration: 0.25 }}
                  whileHover={{ y: -2 }}
                  className="text-left rounded-2xl border border-border bg-card p-5 shadow-elegant hover:border-tenant transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-display font-bold">{r.roleName}</div>
                    <Pill tone="muted">#{r.roleId}</Pill>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{enabled}/{total} permissions</span>
                    <span className="font-semibold text-tenant">{r.userCount} {r.userCount === 1 ? "user" : "users"}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div className="h-full bg-gradient-tenant" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: Math.min(i * 0.05, 0.4) + 0.15, duration: 0.5, ease: "easeOut" }} />
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </section>

      {catalog && (editing || creating) && (
        <RoleEditor
          catalog={catalog}
          role={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={async () => {
            setEditing(null);
            setCreating(false);
            await refreshRoles();
          }}
        />
      )}
    </Shell>
  );
}

function RoleEditor({
  catalog,
  role,
  onClose,
  onSaved,
}: {
  catalog: ConfiguredRoles;
  role: Role | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const isEdit = !!role;
  const [name, setName] = useState(role?.roleName ?? "");
  const [description, setDescription] = useState(() => (role ? getRoleDescription(role.roleName) : ""));
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(role?.allowedConfiguration ?? []),
  );
  const [saving, setSaving] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(catalog.configuredRoles.map((g) => [g.header, true])),
  );

  const totalConfigs = catalog.configuredRoles.reduce((a, g) => a + g.configuration.length, 0);

  const toggle = (configId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(configId)) next.delete(configId);
      else next.add(configId);
      return next;
    });
  };

  const toggleGroup = (header: string) => {
    const group = catalog.configuredRoles.find((g) => g.header === header);
    if (!group) return;
    const ids = group.configuration.map((c) => c.configId);
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const save = async () => {
    const roleName = name.trim();
    if (!roleName) {
      toast.error("Role name is required");
      return;
    }
    const allowedConfiguration = [...selected].sort((a, b) => a - b);
    setSaving(true);
    try {
      if (isEdit && role) {
        await updateRole({ roleId: role.roleId, roleName, roleDescription: description.trim(), allowedConfiguration });
        setRoleDescription(roleName, description.trim(), role.roleName);
        toast.success(`Role "${roleName}" updated`);
      } else {
        await createRole({ roleName, roleDescription: description.trim(), allowedConfiguration });
        setRoleDescription(roleName, description.trim());
        toast.success(`Role "${roleName}" created`);
      }
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-tenant overflow-hidden" initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 28 }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-display font-bold text-lg">{isEdit ? "Edit role" : "Create role"}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{selected.size}/{totalConfigs} permissions enabled</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Role name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Senior Collections Agent"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-muted border border-border outline-none focus:ring-2 ring-tenant"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this role is for"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-muted border border-border outline-none focus:ring-2 ring-tenant"
              />
            </div>
          </div>

          <div className="flex gap-5 items-start">
          <div className="hidden md:block w-52 shrink-0 sticky top-0">
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2.5 bg-muted/40 border-b border-border">
                <span className="font-display font-semibold text-sm">Quick select</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">Toggle every permission in a group</span>
              </div>
              <div className="p-1.5 space-y-0.5">
                {catalog.configuredRoles.map((group) => {
                  const ids = group.configuration.map((c) => c.configId);
                  const onCount = ids.filter((id) => selected.has(id)).length;
                  const allOn = ids.length > 0 && onCount === ids.length;
                  return (
                    <button
                      key={group.header}
                      type="button"
                      onClick={() => toggleGroup(group.header)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-sm transition ${
                        allOn ? "bg-tenant/10 text-tenant" : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          allOn ? "bg-tenant border-tenant text-white" : "border-border"
                        }`}
                      >
                        {allOn && <Check className="h-3 w-3" />}
                      </span>
                      <span className="flex-1 min-w-0 truncate">{group.header}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{onCount}/{ids.length}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            {catalog.configuredRoles.map((group) => {
              const isOpen = openGroups[group.header];
              const ids = group.configuration.map((c) => c.configId);
              const onCount = ids.filter((id) => selected.has(id)).length;
              const allOn = onCount === ids.length;
              return (
                <div key={group.header} className="rounded-lg border border-border overflow-hidden">
                  <div className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40">
                    <button
                      type="button"
                      onClick={() => setOpenGroups((s) => ({ ...s, [group.header]: !isOpen }))}
                      className="flex items-center gap-2 flex-1 text-left hover:opacity-80"
                    >
                      <ChevronDown className={`h-4 w-4 transition ${isOpen ? "" : "-rotate-90"}`} />
                      <span className="font-display font-semibold text-sm">{group.header}</span>
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-muted-foreground">{onCount}/{ids.length}</span>
                      <label className="flex items-center gap-1.5 text-[11px] font-medium text-tenant cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="accent-tenant"
                          checked={allOn}
                          ref={(el) => { if (el) el.indeterminate = onCount > 0 && !allOn; }}
                          onChange={() => toggleGroup(group.header)}
                        />
                        Select all
                      </label>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="grid sm:grid-cols-2 gap-0.5 p-2">
                      {group.configuration.map((c) => (
                        <label
                          key={c.configId}
                          className="flex items-start gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(c.configId)}
                            onChange={() => toggle(c.configId)}
                            className="mt-0.5 accent-tenant"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block">{c.configName}</span>
                            <span className="mt-1 flex flex-wrap gap-1">
                              {c.tabsLinked.map((t) => (
                                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">{t}</span>
                              ))}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-between items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-tenant" /> Permissions are enforced server-side.
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg text-sm hover:bg-muted disabled:opacity-50">Cancel</button>
            <button
              disabled={!name.trim() || saving}
              onClick={save}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create role"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
