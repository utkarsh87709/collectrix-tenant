// Frontend-side regrouping of the permission catalog by MODULE.
//
// /tenant/getConfiguredRoles returns permissions grouped by functional category
// (`header`, e.g. "Debtor File Access") and tags each permission with the
// product modules it belongs to (`tabsLinked`, e.g. "Debtor Management"). That
// response is authoritative — this module does NOT invent any mapping. It only
// re-buckets the catalog by module for the role editor, emitting a permission
// under EACH module in its tabsLinked.
//
// Because role selection is keyed by `configId`, a permission rendered under
// several modules stays in sync: checking it in one place checks it everywhere.
import type { ConfiguredRoles, PermissionConfig, PermissionGroup } from "./roles-api";

// Preferred display order (matches the Dependency sheet columns). Any module
// the backend exposes but isn't listed here is appended afterwards.
export const MODULE_ORDER = [
  "Analytics",
  "Data Intake",
  "Customer Management",
  "Inbound Inbox",
  "Appointments",
] as const;

const UNTAGGED = "Other";

/** Modules a permission belongs to, straight from the backend tags. */
export function modulesForPermission(c: PermissionConfig): string[] {
  return c.tabsLinked?.length ? c.tabsLinked : [UNTAGGED];
}

/** Count of distinct permissions in the catalog (configIds are unique keys). */
export function uniquePermissionCount(catalog: ConfiguredRoles): number {
  const ids = new Set<number>();
  for (const g of catalog.configuredRoles)
    for (const c of g.configuration) ids.add(c.configId);
  return ids.size;
}

/**
 * Re-group the backend catalog by module. A permission linked to N modules is
 * emitted in all N groups (same configId, so selection stays in sync). Module
 * order follows MODULE_ORDER first, then any other module the backend tagged,
 * then an "Other" bucket for permissions with no tabsLinked.
 */
export function regroupByModule(catalog: ConfiguredRoles): PermissionGroup[] {
  const byId = new Map<number, PermissionConfig>();
  for (const g of catalog.configuredRoles)
    for (const c of g.configuration) if (!byId.has(c.configId)) byId.set(c.configId, c);

  const order: string[] = [...MODULE_ORDER];
  const buckets = new Map<string, PermissionConfig[]>();
  for (const perm of byId.values()) {
    for (const mod of modulesForPermission(perm)) {
      if (!buckets.has(mod)) {
        buckets.set(mod, []);
        if (!order.includes(mod)) order.push(mod);
      }
      buckets.get(mod)!.push(perm);
    }
  }
  // Keep the catch-all bucket last.
  if (buckets.has(UNTAGGED)) {
    order.splice(order.indexOf(UNTAGGED), 1);
    order.push(UNTAGGED);
  }

  return order
    .filter((m) => buckets.has(m))
    .map((m) => ({ header: m, configuration: buckets.get(m)! }));
}
