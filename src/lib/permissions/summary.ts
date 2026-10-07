// Set operations the role editor and role cards share. Every change goes
// through here so a role's permissions stay a CLOSED set: turning a key on
// also turns on what it needs, turning a key off also turns off what needs it.
import {
  closureOf,
  dependentsOf,
  locatePermission,
  moduleKeys,
  sortPermissions,
  type PermissionKey,
  type PermissionModule,
} from "./catalog";

/** How much of a module a role holds. "custom" is anything between the presets. */
export type AccessLevel = "none" | "view" | "full" | "custom";

export type Change = {
  next: Set<PermissionKey>;
  added: PermissionKey[];
  removed: PermissionKey[];
};

function diff(before: ReadonlySet<PermissionKey>, next: Set<PermissionKey>): Change {
  return {
    next,
    added: sortPermissions([...next].filter((k) => !before.has(k))),
    removed: sortPermissions([...before].filter((k) => !next.has(k))),
  };
}

export function isViewKey(key: PermissionKey): boolean {
  return locatePermission(key).action.kind === "view";
}

/** Turn `on` keys on and `off` keys off, keeping the set closed. */
export function applyChange(
  current: ReadonlySet<PermissionKey>,
  on: readonly PermissionKey[],
  off: readonly PermissionKey[],
): Change {
  const next = new Set(current);
  for (const key of off) for (const d of dependentsOf(key)) next.delete(d);
  for (const key of on) for (const r of closureOf(key)) next.add(r);
  return diff(current, next);
}

export function toggleKey(
  current: ReadonlySet<PermissionKey>,
  key: PermissionKey,
  on: boolean,
): Change {
  return on ? applyChange(current, [key], []) : applyChange(current, [], [key]);
}

export function moduleAccess(
  module: PermissionModule,
  granted: ReadonlySet<PermissionKey>,
): AccessLevel {
  const keys = moduleKeys(module);
  const held = keys.filter((k) => granted.has(k));
  if (held.length === 0) return "none";
  if (held.length === keys.length) return "full";
  const views = keys.filter(isViewKey);
  if (held.length === views.length && views.every((k) => granted.has(k))) return "view";
  return "custom";
}

export function setModuleAccess(
  current: ReadonlySet<PermissionKey>,
  module: PermissionModule,
  level: Exclude<AccessLevel, "custom">,
): Change {
  const keys = moduleKeys(module);
  if (level === "none") return applyChange(current, [], keys);
  if (level === "full") return applyChange(current, keys, []);
  return applyChange(
    current,
    keys.filter(isViewKey),
    keys.filter((k) => !isViewKey(k)),
  );
}

/** Held / total permissions in a module. */
export function moduleCount(
  module: PermissionModule,
  granted: ReadonlySet<PermissionKey>,
): { held: number; total: number } {
  const keys = moduleKeys(module);
  return { held: keys.filter((k) => granted.has(k)).length, total: keys.length };
}
