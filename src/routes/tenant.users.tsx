import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { motion } from "motion/react";
import { UsersTableSkeleton } from "@/components/admin/Skeletons";
import { useCallback, useEffect, useState } from "react";
import {
  Plus, Search, X, Loader2, RefreshCw, KeyRound, PauseCircle, RotateCcw, Copy, ChevronLeft, ChevronRight, Mail, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  getUsers, getRoleList, createUser, updateUser, resetUserPassword, activateUser, disableUser,
  type TenantUser, type RoleListItem, type UserInput,
} from "@/lib/users-api";
import { getTeamList, type TeamListItem } from "@/lib/teams-api";
import PhoneInput, { isValidPhoneNumber, type Value as PhoneValue } from "react-phone-number-input";
import "react-phone-number-input/style.css";

export const Route = createFileRoute("/tenant/users")({
  head: () => ({ meta: [{ title: "Users · Tenant Admin" }] }),
  component: TenantUsersPage,
});

const PAGE_SIZE = 10;
type StatusFilter = "active" | "disabled" | "all";

function fullNameOf(u: { firstName: string; lastName: string | null }) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
}

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function teamNameOf(teamId: number | null, teams: TeamListItem[]) {
  if (!teamId) return "Unassigned";
  return teams.find((t) => t.teamId === teamId)?.teamName ?? `Team #${teamId}`;
}

function CalendarLogo({ provider }: { provider: "google" | "outlook" }) {
  if (provider === "google") {
    return (
      <div className="h-9 w-9 rounded-lg bg-white border border-border flex items-center justify-center overflow-hidden shrink-0">
        <svg viewBox="0 0 48 48" className="h-6 w-6" aria-hidden="true">
          <defs>
            <linearGradient id="google-logo-blue" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4285F4" />
              <stop offset="100%" stopColor="#1A73E8" />
            </linearGradient>
            <linearGradient id="google-logo-green" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34A853" />
              <stop offset="100%" stopColor="#188038" />
            </linearGradient>
          </defs>
          <path d="M44 24c0-1.4-.1-2.7-.4-4H24v8.5h11.4c-.5 2.6-2 4.8-4.2 6.3v5.2h6.8C41.8 35.8 44 30.3 44 24Z" fill="#4285F4" />
          <path d="M24 44c5.4 0 9.9-1.8 13.2-4.9l-6.8-5.2c-1.9 1.3-4.4 2-6.4 2-4.9 0-9-3.3-10.5-7.8H6.5v5.4C9.8 40.1 16.4 44 24 44Z" fill={"#34A853"} />
          <path d="M13.5 28.1c-.4-1.2-.6-2.4-.6-3.6s.2-2.4.6-3.6v-5.4H6.5C5.1 18.3 4 21 4 24s1.1 5.7 2.5 8.5l7-5.4Z" fill="#FBBC05" />
          <path d="M24 12.7c2.9 0 5.5 1 7.5 2.8l5.7-5.7C33.8 6.6 29.4 4.8 24 4.8 16.4 4.8 9.8 8.7 6.5 14.4l7 5.4c1.5-4.5 5.6-7.1 10.5-7.1Z" fill="#EA4335" />
          <path d="M44 24c0-1.4-.1-2.7-.4-4H24v8.5h11.4c-.5 2.6-2 4.8-4.2 6.3v5.2h6.8C41.8 35.8 44 30.3 44 24Z" fill="url(#google-logo-blue)" opacity="0.12" />
          <path d="M24 44c5.4 0 9.9-1.8 13.2-4.9l-6.8-5.2c-1.9 1.3-4.4 2-6.4 2-4.9 0-9-3.3-10.5-7.8H6.5v5.4C9.8 40.1 16.4 44 24 44Z" fill="url(#google-logo-green)" opacity="0.12" />
        </svg>
      </div>
    );
  }

  return (
    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#0F5BA7] to-[#0A447D] flex items-center justify-center text-white shrink-0 shadow-sm border border-[#0A447D]/20">
      <svg viewBox="0 0 48 48" className="h-6 w-6" aria-hidden="true">
        <rect x="8" y="10" width="32" height="28" rx="5" fill="white" opacity="0.14" />
        <path d="M14 16h20a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3Z" fill="white" opacity="0.95" />
        <path d="M14 19.2 24 26l10-6.8" fill="none" stroke="#0F5BA7" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="24" r="8.5" fill="none" stroke="#2B6CB0" strokeWidth="3" opacity="0.9" />
      </svg>
    </div>
  );
}

function CalendarOption({
  provider,
  title,
}: {
  provider: "google" | "outlook";
  title: string;
}) {
  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-3 text-left opacity-55 cursor-not-allowed">
      <CalendarLogo provider={provider} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <button type="button" disabled className="mt-1 inline-flex items-center rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          Not connected
        </button>
      </div>
    </div>
  );
}

function TenantUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const [searchText, setSearchText] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TenantUser | null>(null);
  const [resetLink, setResetLink] = useState<{ link: string; email: string } | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Debounce the search box into searchText.
  useEffect(() => {
    const t = setTimeout(() => setSearchText(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  // Reset to first page whenever the filter or search changes.
  useEffect(() => { setPage(0); }, [statusFilter, searchText]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getUsers({
        page,
        size: PAGE_SIZE,
        status: statusFilter === "all" ? null : statusFilter,
        searchText,
      });
      setUsers(res.users ?? []);
      setTotalCount(res.totalCount ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users.");
      setUsers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchText]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    getRoleList().then((r) => setRoles(r.roles ?? [])).catch(() => {});
    getTeamList().then((t) => setTeams(t.teamList ?? [])).catch(() => {});
  }, []);

  const teamNameById = new Map(teams.map((t) => [t.teamId, t.teamName]));

  return (
    <Shell>
      <Topbar
        title="User Management"
        subtitle="All users in your organization · tenant-scoped"
        action={
          <button
            onClick={() => setShowCreate(true)}
            disabled={roles.length === 0}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant hover:opacity-95 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add user
          </button>
        }
      />

      <section className="px-6 lg:px-10 py-6">
        <PageCard>
          <CardHead
            title={`${totalCount} ${totalCount === 1 ? "user" : "users"}`}
            subtitle="Manage roles, access and credentials"
            action={
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border w-64">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="bg-transparent text-sm flex-1 outline-none" />
                  {q && <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="px-3 py-2 rounded-lg bg-muted border border-border text-sm">
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
                <button onClick={fetchUsers} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50">
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            }
          />

          {loading ? (
            <div className="py-1"><UsersTableSkeleton /></div>
          ) : error ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-destructive font-medium">{error}</p>
              <button onClick={fetchUsers} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              {searchText ? `No users match "${searchText}".` : "No users found."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Team</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Calendar</th>
                    <th className="px-4 py-3 font-semibold">Last login</th>
                    <th className="px-4 py-3 font-semibold w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u, i) => (
                    <motion.tr
                      key={u.userId}
                      className="hover:bg-muted/30"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                    >
                      <td className="px-6 py-3">
                        <div className="font-semibold">{fullNameOf(u) || "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.emailId}</div>
                        {u.phoneNo && <div className="text-xs text-muted-foreground">{u.phoneNo}</div>}
                      </td>
                      <td className="px-4 py-3"><Pill tone="muted">{u.role}</Pill></td>
                      <td className="px-4 py-3">
                        <Pill tone="muted">{teamNameById.get(u.teamId ?? 0) ?? teamNameOf(u.teamId, teams)}</Pill>
                      </td>
                      <td className="px-4 py-3">
                        {u.status === "active" ? <Pill tone="success">Active</Pill> : <Pill tone="muted">Disabled</Pill>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" /> Not connected
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(u.loginAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditing(u)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-[var(--tenant)] hover:text-white hover:border-[var(--tenant)] transition"
                          >
                            Manage
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && totalCount > 0 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border text-xs text-muted-foreground">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
              </span>
              <div className="flex items-center gap-1">
                <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-40">
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <span className="px-2">Page {page + 1} of {totalPages}</span>
                <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-40">
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </PageCard>
      </section>

      {showCreate && (
        <UserFormModal
          roles={roles}
          teams={teams}
          onClose={() => setShowCreate(false)}
          onSaved={async (link, email) => {
            setShowCreate(false);
            if (link) setResetLink({ link, email });
            await fetchUsers();
          }}
        />
      )}

      {editing && (
        <UserFormModal
          roles={roles}
          teams={teams}
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await fetchUsers(); }}
          onStatusChanged={fetchUsers}
          canChangeStatus={me?.userId !== editing.userId}
          onResetLink={(link, email) => setResetLink({ link, email })}
        />
      )}

      {resetLink && <ResetLinkModal link={resetLink.link} email={resetLink.email} onClose={() => setResetLink(null)} />}
    </Shell>
  );
}

function UserFormModal({
  roles, teams, user, onClose, onSaved, onStatusChanged, canChangeStatus, onResetLink,
}: {
  roles: RoleListItem[];
  teams: TeamListItem[];
  user?: TenantUser;
  onClose: () => void;
  onSaved: (resetLink: string | null, email: string) => void | Promise<void>;
  onStatusChanged?: () => void | Promise<void>;
  canChangeStatus?: boolean;
  onResetLink?: (link: string, email: string) => void;
}) {
  const isEdit = !!user;
  const [fullName, setFullName] = useState(user ? fullNameOf(user) : "");
  const [emailId, setEmailId] = useState(user?.emailId ?? "");
  // E.164 phone value (e.g. "+14165550123"); the picker carries the country.
  const [phone, setPhone] = useState<PhoneValue | undefined>((user?.phoneNo as PhoneValue) ?? undefined);
  const [roleId, setRoleId] = useState<number>(user?.roleId ?? roles[0]?.roleId ?? 0);
  // Team is not required; null = unassigned.
  const [teamId, setTeamId] = useState<number | null>(user?.teamId ?? null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [accountStatus, setAccountStatus] = useState<UserStatus>(user?.status === "active" ? "active" : "disabled");

  useEffect(() => {
    setAccountStatus(user?.status === "active" ? "active" : "disabled");
  }, [user?.userId, user?.status]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailId.trim());
  const phoneValid = !!phone && isValidPhoneNumber(phone);
  const canSave = fullName.trim() && emailValid && phoneValid && !saving;

  // The backend stores the full name in firstName; lastName is unused here.
  // Phone is persisted in E.164 form (e.g. +14165550123).
  const buildInput = (): UserInput => ({
    roleId,
    teamId,
    emailId: emailId.trim(),
    phoneNo: phone ?? "",
    firstName: fullName.trim(),
    lastName: "",
  });

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isEdit && user) {
        await updateUser({ userId: user.userId, ...buildInput() });
        toast.success("User updated");
        await onSaved(null, emailId.trim());
      } else {
        const res = await createUser(buildInput());
        toast.success("User created");
        await onSaved(res.resetPasswordLink ?? null, emailId.trim());
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const doReset = async () => {
    if (!user) return;
    setResetting(true);
    try {
      const res = await resetUserPassword(user.userId);
      onResetLink?.(res.resetPasswordLink, user.emailId);
      toast.success("Password reset link generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  const toggleStatus = async () => {
    if (!user) return;
    setStatusBusy(true);
    try {
      if (accountStatus === "active") {
        await disableUser(user.userId);
        toast.success("User disabled");
        setAccountStatus("disabled");
      } else {
        await activateUser(user.userId);
        toast.success("User activated");
        setAccountStatus("active");
      }
      await onStatusChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setStatusBusy(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-tenant overflow-hidden" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-display font-bold text-lg">{isEdit ? "Manage user" : "Add new user"}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isEdit ? "Update profile, role, or account status" : "Creates the user and generates a password setup link"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isEdit && (accountStatus === "active" ? <Pill tone="success">Active</Pill> : <Pill tone="muted">Disabled</Pill>)}
            <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5 text-sm max-h-[70vh] overflow-y-auto">
          <Field label="Full name" required>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Sam Patel" className="w-full px-3 py-2 rounded-lg bg-muted border border-border outline-none focus:ring-2 ring-tenant" />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Email" required>
              <input value={emailId} onChange={(e) => setEmailId(e.target.value)} placeholder="sam.p@company.com" className="w-full px-3 py-2 rounded-lg bg-muted border border-border outline-none focus:ring-2 ring-tenant" />
              {emailId && !emailValid && <span className="text-[11px] text-destructive mt-1 block">Enter a valid email</span>}
            </Field>
            <Field label="Phone number" required>
              <PhoneInput
                international
                defaultCountry="CA"
                value={phone}
                onChange={setPhone}
                placeholder="Enter phone number"
                className="phone-input"
              />
              {phone && !phoneValid && <span className="text-[11px] text-destructive mt-1 block">Enter a valid phone number</span>}
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Role" required>
              <select value={roleId} onChange={(e) => setRoleId(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg bg-muted border border-border outline-none focus:ring-2 ring-tenant">
                {roles.map((r) => <option key={r.roleId} value={r.roleId}>{r.roleName}</option>)}
              </select>
            </Field>
            <Field label="Team">
              <select
                value={teamId ?? ""}
                onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border outline-none focus:ring-2 ring-tenant"
              >
                <option value="">No team</option>
                {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.teamName}</option>)}
              </select>
            </Field>
          </div>

          {isEdit && (
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Calendar sync</label>
              <div className="mt-2 grid sm:grid-cols-2 gap-3">
                <CalendarOption provider="google" title="Google Calendar" />
                <CalendarOption provider="outlook" title="Outlook Calendar" />
              </div>
            </div>
          )}

          {isEdit && (
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">Account actions</label>
              <div className="flex flex-wrap gap-2">
                <ActionBtn icon={KeyRound} label="Reset password" loading={resetting} disabled={resetting} onClick={doReset} />
                {canChangeStatus ? (
                  <ActionBtn
                    icon={accountStatus === "active" ? PauseCircle : RotateCcw}
                    label={accountStatus === "active" ? "Disable user" : "Enable user"}
                    tone={accountStatus === "active" ? "danger" : "success"}
                    loading={statusBusy}
                    disabled={statusBusy}
                    onClick={toggleStatus}
                  />
                ) : (
                  <span className="inline-flex items-center rounded-md border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                    You cannot disable your own account
                  </span>
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Manage credentials and account state from here.</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg text-sm hover:bg-muted disabled:opacity-50">Cancel</button>
          <button onClick={save} disabled={!canSave} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create user"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ResetLinkModal({ link, email, onClose }: { link: string; email: string; onClose: () => void }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast.success("Link copied"); }
    catch { toast.error("Could not copy"); }
  };
  return (
    <motion.div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-tenant overflow-hidden" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-tenant-soft text-tenant flex items-center justify-center"><Mail className="h-4 w-4" /></div>
            <h3 className="font-display font-bold text-lg">Password setup link</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-3 text-sm">
          <p className="text-muted-foreground">Share this one-time link with <span className="font-semibold text-foreground">{email}</span> so they can set their password.</p>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted border border-border">
            <input readOnly value={link} className="bg-transparent text-xs flex-1 outline-none font-mono truncate" />
            <button onClick={copy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-tenant text-white text-xs font-semibold shrink-0">
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
          <a href={link} target="_blank" rel="noreferrer" className="text-xs text-tenant font-semibold hover:underline">Open link in new tab →</a>
        </div>
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant">Done</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ActionBtn({
  icon: Icon, label, onClick, tone = "default", loading, disabled,
}: {
  icon: typeof KeyRound; label: string; onClick: () => void;
  tone?: "default" | "success" | "danger"; loading?: boolean; disabled?: boolean;
}) {
  const cls: Record<string, string> = {
    default: "border-border hover:bg-muted",
    success: "border-success/40 text-success hover:bg-success/10",
    danger: "border-destructive/40 text-destructive hover:bg-destructive/10",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border ${cls[tone]} transition disabled:opacity-50`}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />} {label}
    </button>
  );
}
