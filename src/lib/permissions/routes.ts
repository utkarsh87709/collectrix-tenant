// Which permission opens which page. One table drives the route guard
// (PermissionGate in __root.tsx), the sidebar and the ⌘K palette, so a page a
// user can't open never shows up as a link either.
//
// A route needs ANY ONE of its keys. Rules are checked most specific first; a
// path with no rule (Overview, the profile drawer) is open to every signed-in user.
import type { PermissionKey } from "./catalog";

type RouteRule = { pattern: RegExp; anyOf: readonly PermissionKey[] };

/** Matches `path` itself and anything nested under it. */
function under(path: string): RegExp {
  return new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/|$)`);
}

const ROUTE_RULES: readonly RouteRule[] = [
  // Customer profile sub-pages first, so they don't fall through to the profile rule.
  { pattern: /^\/tenant\/debtors\/[^/]+\/notes(\/|$)/, anyOf: ["customers.notes.view"] },
  { pattern: /^\/tenant\/debtors\/[^/]+\/calls(\/|$)/, anyOf: ["customers.calls.view"] },
  { pattern: under("/tenant/debtors"), anyOf: ["customers.view"] },
  { pattern: under("/tenant/team-deck"), anyOf: ["teamDeck.view"] },
  { pattern: under("/tenant/moved-files"), anyOf: ["movedFiles.view"] },
  { pattern: under("/tenant/archive"), anyOf: ["archive.view"] },
  {
    pattern: under("/tenant/case-files"),
    anyOf: ["customers.view", "teamDeck.view", "movedFiles.view", "archive.view"],
  },
  { pattern: under("/tenant/inbox"), anyOf: ["inbox.view"] },
  { pattern: under("/tenant/engagement/phone-numbers"), anyOf: ["phoneNumbers.view"] },
  { pattern: under("/tenant/engagement/template-library"), anyOf: ["templates.view"] },
  { pattern: under("/tenant/intake/clients"), anyOf: ["clients.view"] },
  { pattern: under("/tenant/intake/upload"), anyOf: ["imports.view"] },
  { pattern: under("/tenant/intake/mass-update"), anyOf: ["massUpdate.view"] },
  { pattern: under("/tenant/audit"), anyOf: ["audit.view"] },
  { pattern: under("/tenant/users"), anyOf: ["users.view"] },
  { pattern: under("/tenant/teams"), anyOf: ["teams.view"] },
  { pattern: under("/tenant/roles"), anyOf: ["roles.view"] },
  { pattern: under("/tenant/settings/statuses"), anyOf: ["statuses.view"] },
  { pattern: under("/tenant/settings/status-automation"), anyOf: ["statusAutomation.view"] },
  // Tenant Settings hosts Data Fields as a tab, so either grant opens the page.
  { pattern: under("/tenant/settings"), anyOf: ["settings.view", "dataFields.view"] },
];

/** The keys that open `pathname` (any one is enough), or null when it is open to everyone. */
export function requiredPermissions(pathname: string): readonly PermissionKey[] | null {
  for (const rule of ROUTE_RULES) if (rule.pattern.test(pathname)) return rule.anyOf;
  return null;
}

/** Whether a user with these grants may open `pathname`. */
export function canOpen(pathname: string, canAny: (...keys: PermissionKey[]) => boolean): boolean {
  const required = requiredPermissions(pathname);
  return !required || canAny(...required);
}
