import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { toast } from "sonner";
import { X, Pencil, Camera, Lock, KeyRound, Loader2, ShieldCheck, Check, Clock, Mail, UserRound, Sun, Moon, Palette, LogOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import {
  getMyProfile, getTimezoneList, updateProfile, uploadProfilePic, sendResetMyPasswordLink,
  type TimezoneItem,
} from "@/lib/profile-api";

type Props = { open: boolean; onClose: () => void };

type LocalProfile = {
  userId: number;
  fullName: string;
  phoneNo: string;
  emailId: string;
  role: string;
  timezone: string;
  profilePic: string | null;
  lastPasswordChanged: string | null;
};

const listV: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } };
const itemV: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "U";
}
function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function MyProfilePanel({ open, onClose }: Props) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>{open && <PanelInner key="my-profile" onClose={onClose} />}</AnimatePresence>,
    document.body,
  );
}

function PanelInner({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"profile" | "security">("profile");
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [timezones, setTimezones] = useState<TimezoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPwd, setSavingPwd] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const fileRef = useRef<HTMLInputElement>(null);
  const { logout } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, tz] = await Promise.all([getMyProfile(), getTimezoneList()]);
      setProfile({
        userId: p.userId,
        fullName: [p.firstName, p.lastName].filter(Boolean).join(" ").trim(),
        phoneNo: p.phoneNo ?? "",
        emailId: p.emailId,
        role: p.role,
        timezone: p.timezone ?? "",
        profilePic: p.profilePic ?? null,
        lastPasswordChanged: p.lastPasswordChanged ?? null,
      });
      setTimezones(tz.timezoneList ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const persist = useCallback(async (next: LocalProfile) => {
    try {
      await updateProfile({ firstName: next.fullName.trim(), lastName: "", phoneNo: next.phoneNo.trim(), timezone: next.timezone });
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update profile");
      load();
    }
  }, [load]);

  const save = (patch: Partial<Pick<LocalProfile, "fullName" | "phoneNo" | "timezone">>) => {
    if (!profile) return;
    const next = { ...profile, ...patch };
    setProfile(next);
    persist(next);
  };

  const changeTheme = (t: Theme) => { setThemeState(t); setTheme(t); };

  const handleLogout = () => {
    logout(); // clears token + session; AuthGate then redirects to /login
    onClose();
  };

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    try {
      await uploadProfilePic(f);
      await load();
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const changePassword = async () => {
    setSavingPwd(true);
    try {
      await sendResetMyPasswordLink();
      toast.success("Password reset link sent to your email");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send reset link");
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[99] bg-foreground/30 backdrop-blur-[3px]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        className="fixed top-0 right-0 z-[100] h-screen w-[420px] max-w-[94vw] bg-background border-l border-border flex flex-col shadow-2xl overflow-hidden"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        role="dialog"
        aria-label="My profile"
      >
        {/* HEADER */}
        <div className="relative shrink-0 px-5 py-5 border-b border-border">
          <button onClick={onClose} className="absolute top-4 right-4 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition" aria-label="Close">
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 320, damping: 20 }}
                className={`h-16 w-16 rounded-2xl ring-2 ring-border overflow-hidden flex items-center justify-center text-lg font-display font-bold text-white ${loading ? "bg-muted" : "bg-gradient-tenant"}`}
              >
                {uploading ? <Loader2 className="h-6 w-6 animate-spin" />
                  : loading ? <Skeleton className="h-full w-full rounded-none" />
                  : profile?.profilePic ? <img src={profile.profilePic} alt="" className="h-full w-full object-cover" />
                  : initials(profile?.fullName ?? "")}
              </motion.div>
              <button onClick={() => fileRef.current?.click()} disabled={uploading || loading}
                className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-tenant text-white flex items-center justify-center shadow-md ring-2 ring-background hover:scale-105 active:scale-95 transition disabled:opacity-50" aria-label="Upload photo">
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            </div>

            <div className="min-w-0 flex-1">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-44" />
                </div>
              ) : (
                <>
                  <div className="text-lg font-display font-bold leading-tight truncate text-foreground">{profile?.fullName || "My Profile"}</div>
                  <div className="text-[13px] text-muted-foreground truncate">{profile?.emailId ?? ""}</div>
                  {profile?.role && (
                    <span className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tenant-soft text-tenant text-[11px] font-semibold">
                      <ShieldCheck className="h-3 w-3" /> {profile.role}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* SEGMENTED TABS */}
        <div className="px-5 pt-4 shrink-0">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted">
            {(["profile", "security"] as const).map((t) => {
              const active = tab === t;
              return (
                <button key={t} onClick={() => setTab(t)} className="relative rounded-lg py-1.5 text-[13px] font-medium capitalize">
                  {active && (
                    <motion.span layoutId="profileTabPill" className="absolute inset-0 rounded-lg bg-background shadow-sm ring-1 ring-border" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                  )}
                  <span className={`relative z-10 ${active ? "text-tenant" : "text-muted-foreground"}`}>{t}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-sm text-destructive">{error}</p>
              <button onClick={load} className="mt-4 px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted">Try again</button>
            </div>
          ) : profile ? (
            <AnimatePresence mode="wait">
              <motion.div key={tab} variants={listV} initial="hidden" animate="show" exit={{ opacity: 0, y: -6 }} className="space-y-2.5">
                {tab === "profile" ? (
                  <>
                    <EditableRow label="Full name" value={profile.fullName} onSave={(v) => save({ fullName: v })} />
                    <EditableRow label="Phone number" value={profile.phoneNo} onSave={(v) => save({ phoneNo: v })} />
                    <ReadonlyRow label="Email address" icon={<Mail className="h-3.5 w-3.5" />}>
                      <a href={`mailto:${profile.emailId}`} className="text-tenant hover:underline">{profile.emailId}</a>
                    </ReadonlyRow>
                    <motion.div variants={itemV} className="rounded-xl border border-border bg-card px-3.5 py-2.5 hover:border-tenant/40 transition-colors">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        <Clock className="h-3.5 w-3.5" /> Timezone
                      </div>
                      <select value={profile.timezone} onChange={(e) => save({ timezone: e.target.value })} className="mt-1 w-full bg-transparent text-sm font-medium outline-none cursor-pointer">
                        {profile.timezone && !timezones.some((t) => t.timezone === profile.timezone) && (
                          <option value={profile.timezone}>{profile.timezone}</option>
                        )}
                        {timezones.map((tz) => <option key={tz.timezone} value={tz.timezone}>{tz.timezone}</option>)}
                      </select>
                    </motion.div>
                    <ReadonlyRow label="Role" icon={<UserRound className="h-3.5 w-3.5" />} hint="Admin-managed">{profile.role}</ReadonlyRow>

                    <motion.div variants={itemV} className="rounded-xl border border-border bg-card px-3.5 py-2.5">
                      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        <Palette className="h-3.5 w-3.5" /> Appearance
                      </span>
                      <div className="mt-1.5 grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted">
                        {(["light", "dark"] as const).map((m) => {
                          const active = theme === m;
                          return (
                            <button key={m} onClick={() => changeTheme(m)}
                              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium capitalize transition ${active ? "bg-background shadow-sm text-tenant" : "text-muted-foreground hover:text-foreground"}`}>
                              {m === "light" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} {m}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  </>
                ) : (
                  <>
                    <motion.div variants={itemV} className="rounded-xl border border-border bg-card px-3.5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-sm">
                        <div className="h-9 w-9 rounded-lg bg-gradient-tenant flex items-center justify-center text-white shrink-0">
                          <Lock className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">Password</div>
                          <div className="text-[11px] text-muted-foreground">Last changed {formatDate(profile.lastPasswordChanged)}</div>
                        </div>
                      </div>
                    </motion.div>
                    <motion.button
                      variants={itemV} onClick={changePassword} disabled={savingPwd} whileTap={{ scale: 0.98 }}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-60"
                    >
                      {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Change password
                    </motion.button>
                    <motion.div variants={itemV} className="flex items-start gap-2 rounded-xl border border-tenant/20 bg-tenant-soft px-3.5 py-3 text-xs text-foreground/70">
                      <ShieldCheck className="h-4 w-4 text-tenant shrink-0 mt-0.5" />
                      We'll email you a secure link to set a new password. Your current session stays active.
                    </motion.div>

                    <motion.button
                      variants={itemV} onClick={handleLogout} whileTap={{ scale: 0.98 }}
                      className="mt-1 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/10 transition"
                    >
                      <LogOut className="h-4 w-4" /> Log out
                    </motion.button>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border p-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted transition">Close</button>
        </div>
      </motion.div>
    </>
  );
}

function ReadonlyRow({ label, icon, hint, children }: { label: string; icon?: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <motion.div variants={itemV} className="rounded-xl border border-border bg-card px-3.5 py-2.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{icon} {label}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-0.5 text-sm font-medium text-foreground truncate">{children}</div>
    </motion.div>
  );
}

function EditableRow({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => { if (!editing) setV(value); }, [value, editing]);

  const commit = () => { setEditing(false); if (v.trim() !== value.trim()) onSave(v.trim()); };
  const cancel = () => { setEditing(false); setV(value); };

  return (
    <motion.div variants={itemV} className="rounded-xl border border-border bg-card px-3.5 py-2.5 hover:border-tenant/40 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-[11px] text-tenant font-semibold inline-flex items-center gap-0.5 hover:underline">
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <input autoFocus value={v} onChange={(e) => setV(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-background border border-border outline-none focus:ring-2 ring-tenant text-sm" />
          <button onClick={commit} className="h-8 w-8 rounded-lg bg-gradient-tenant text-white flex items-center justify-center shadow-tenant shrink-0" aria-label="Save">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={cancel} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted shrink-0" aria-label="Cancel">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mt-0.5 text-sm font-medium text-foreground truncate">{value || "—"}</div>
      )}
    </motion.div>
  );
}
