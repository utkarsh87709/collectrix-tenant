// The signed-in user's permissions, at runtime.
//
// usePermissions() is the one hook every screen uses to decide what to show:
//   const { can } = usePermissions();
//   {can("customers.notes.create") && <AddNoteButton />}
// Hiding a control is a courtesy to the user, not the security boundary — the
// backend enforces every permission on its endpoints
// (docs/roles-and-permissions.md).
//
// Where the grants come from:
//   • the built-in tenantAdmin role (not a row in getAllRole) → everything;
//   • otherwise POST /tenant/myProfile's `permissions` (string keys), once the
//     backend sends them;
//   • until then (myProfile has no `permissions` as of 2026-10-14), the user's
//     roleId is looked up in getAllRole and that role's keys are used.
//
// One snapshot backs every mounted hook (useSyncExternalStore). It is cached in
// localStorage so a reload paints the right sidebar straight away, and is
// revalidated once per page load. Login and logout call resetPermissions() so a
// new session can never inherit the previous user's grants.
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AUTH_USER_KEY, PERMISSIONS_CACHE_KEY } from "../auth-token";
import { getMyProfile } from "../profile-api";
import { getAllRoles } from "../roles-api";
import { ALL_PERMISSION_KEYS, normalizePermissions, type PermissionKey } from "./catalog";

export type PermissionStatus = "loading" | "ready" | "error";

type Snapshot = {
  /** "loading" only until the first answer; a cached copy counts as ready. */
  status: PermissionStatus;
  /** The built-in tenant administrator — every permission is granted. */
  isTenantAdmin: boolean;
  granted: ReadonlySet<PermissionKey>;
  /** The user's custom role (null for the tenant administrator or when unknown). */
  roleId: number | null;
};

export type Permissions = Snapshot & {
  loading: boolean;
  can: (key: PermissionKey) => boolean;
  canAny: (...keys: PermissionKey[]) => boolean;
  /** Fetch the grants again (e.g. after a failed load, or after editing a role). */
  retry: () => void;
};

type StoredUser = { userId?: number; role?: string };

type CachedGrants = {
  userId: number;
  isTenantAdmin: boolean;
  roleId: number | null;
  permissions: string[];
};

const NONE: ReadonlySet<PermissionKey> = new Set();
const EVERYTHING: ReadonlySet<PermissionKey> = new Set(ALL_PERMISSION_KEYS);
const LOADING: Snapshot = {
  status: "loading",
  isTenantAdmin: false,
  granted: NONE,
  roleId: null,
};

/** getRoleList lists the built-in tenant administrator as roleId 0 ("Tenant Admin"). */
const TENANT_ADMIN_ROLE_ID = 0;

/** "tenantAdmin" as login/myProfile spell it, tolerant of "Tenant Admin" / "tenant_admin". */
export function isTenantAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").replace(/[\s_-]/g, "").toLowerCase() === "tenantadmin";
}

function storedUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

function ready(
  isTenantAdmin: boolean,
  permissions: readonly PermissionKey[],
  roleId: number | null,
): Snapshot {
  return {
    status: "ready",
    isTenantAdmin,
    granted: isTenantAdmin ? EVERYTHING : new Set(permissions),
    roleId,
  };
}

function readCache(userId: number | undefined): Snapshot | null {
  if (userId == null) return null;
  try {
    const raw = localStorage.getItem(PERMISSIONS_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as CachedGrants;
    if (c.userId !== userId) return null;
    return ready(c.isTenantAdmin, normalizePermissions(c.permissions ?? []), c.roleId);
  } catch {
    return null;
  }
}

function writeCache(snap: Snapshot): void {
  const userId = storedUser()?.userId;
  if (userId == null) return;
  const payload: CachedGrants = {
    userId,
    isTenantAdmin: snap.isTenantAdmin,
    roleId: snap.roleId,
    permissions: snap.isTenantAdmin ? [] : [...snap.granted],
  };
  try {
    localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore — the cache is only a first-paint hint */
  }
}

function initialSnapshot(): Snapshot {
  const user = storedUser();
  // The login record already names the tenant admin — no need to wait.
  if (user && isTenantAdminRole(user.role)) return ready(true, [], null);
  return readCache(user?.userId) ?? LOADING;
}

async function fetchSnapshot(): Promise<Snapshot> {
  const profile = await getMyProfile();
  const roleId = profile.roleId ?? null;
  if (isTenantAdminRole(profile.role) || roleId === TENANT_ADMIN_ROLE_ID) {
    return ready(true, [], null);
  }
  if (Array.isArray(profile.permissions)) {
    return ready(false, normalizePermissions(profile.permissions), roleId);
  }
  const role = (await getAllRoles()).find((r) => r.roleId === roleId);
  // A role that no longer exists grants nothing.
  return ready(false, role?.permissions ?? [], roleId);
}

/* --------------------------------- store --------------------------------- */

let snapshot: Snapshot = initialSnapshot();
let inflight: Promise<void> | null = null;
// Bumped by reset/refresh so an answer that belongs to an earlier session (or
// was requested before a role edit) can never overwrite a newer one.
let generation = 0;
let revalidated = false;
const listeners = new Set<() => void>();

function emit(next: Snapshot): void {
  snapshot = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

function load(): Promise<void> {
  if (inflight) return inflight;
  const gen = generation;
  const request = fetchSnapshot()
    .then((next) => {
      if (gen !== generation) return;
      writeCache(next);
      emit(next);
    })
    .catch(() => {
      if (gen !== generation) return;
      // A cached copy is still the best answer available; only surface the
      // failure when there is nothing to show.
      if (snapshot.status !== "ready") emit({ ...snapshot, status: "error" });
    })
    .finally(() => {
      if (inflight === request) inflight = null;
    });
  inflight = request;
  return request;
}

/** Fetch the signed-in user's grants again, superseding any request in flight. */
export function refreshPermissions(): Promise<void> {
  if (!storedUser()) return Promise.resolve();
  generation++;
  inflight = null;
  revalidated = true;
  if (snapshot.status === "error") emit({ ...snapshot, status: "loading" });
  return load();
}

/** Forget the current grants. Call on login and logout. */
export function resetPermissions(): void {
  generation++;
  inflight = null;
  revalidated = false;
  emit(initialSnapshot());
}

function ensureFresh(): void {
  if (revalidated || inflight || !storedUser()) return;
  revalidated = true;
  void load();
}

export function usePermissions(): Permissions {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(ensureFresh, []);
  return useMemo(() => {
    const can = (key: PermissionKey) => snap.isTenantAdmin || snap.granted.has(key);
    return {
      ...snap,
      loading: snap.status === "loading",
      can,
      canAny: (...keys: PermissionKey[]) => keys.some(can),
      retry: () => void refreshPermissions(),
    };
  }, [snap]);
}
