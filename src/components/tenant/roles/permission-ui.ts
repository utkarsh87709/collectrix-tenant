// Non-component helpers shared by the role editor, the permission grid and the
// role cards (kept out of the .tsx files so Fast Refresh keeps working).
import {
  Database,
  FolderOpen,
  Inbox,
  Megaphone,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { ModuleId, PermissionResource } from "@/lib/permissions/catalog";
import type { AccessLevel } from "@/lib/permissions/summary";

export const MODULE_ICONS: Record<ModuleId, LucideIcon> = {
  caseFiles: FolderOpen,
  inbox: Inbox,
  engagement: Megaphone,
  dataIntake: Database,
  compliance: ScrollText,
  accessControl: ShieldCheck,
  configuration: Settings,
  systemConfiguration: SlidersHorizontal,
};

export const ACCESS_LABEL: Record<AccessLevel, string> = {
  none: "No access",
  view: "View only",
  full: "Full access",
  custom: "Custom",
};

/** Does a resource match the editor's search box? */
export function resourceMatches(resource: PermissionResource, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    resource.label,
    resource.description,
    ...resource.actions.flatMap((a) => [a.label, a.description, a.key]),
  ];
  return haystack.some((text) => text.toLowerCase().includes(q));
}
