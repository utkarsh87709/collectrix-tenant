// The permission grid inside the role editor: one card per module, one row per
// page (resource), with View / Create / Edit / Delete columns and any other
// actions as chips. Below md the columns collapse into labelled chips.
import { Check, Link2, Minus, ShieldAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  REQUIRES,
  permissionLabel,
  type PermissionAction,
  type PermissionKey,
  type PermissionModule,
  type PermissionResource,
} from "@/lib/permissions/catalog";
import { moduleAccess, moduleCount, type AccessLevel } from "@/lib/permissions/summary";
import { MODULE_ICONS, resourceMatches } from "./permission-ui";

const COLUMNS = ["view", "create", "edit", "delete"] as const;
const COLUMN_LABEL: Record<(typeof COLUMNS)[number], string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
};

// Shared by the header row and every resource row so the columns line up.
const GRID = "md:grid-cols-[minmax(0,1fr)_repeat(4,4.25rem)_minmax(0,1.3fr)]";

export function Tick({ state, small }: { state: "on" | "off" | "mixed"; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[5px] border transition-colors",
        small ? "h-3.5 w-3.5" : "h-[18px] w-[18px]",
        state === "off"
          ? "border-muted-foreground/40 bg-background"
          : "border-tenant bg-tenant text-white",
      )}
    >
      {state === "on" && <Check className={small ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={3} />}
      {state === "mixed" && <Minus className={small ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={3} />}
    </span>
  );
}

function ActionToggle({
  resource,
  action,
  checked,
  readOnly,
  variant,
  onToggle,
}: {
  resource: PermissionResource;
  action: PermissionAction;
  checked: boolean;
  readOnly: boolean;
  variant: "cell" | "chip";
  onToggle: (key: PermissionKey, on: boolean) => void;
}) {
  const needs = (REQUIRES[action.key] ?? []).map(permissionLabel);
  // aria-disabled rather than `disabled`, so the tooltip still explains the
  // permission in read-only mode.
  const button = (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={readOnly || undefined}
      aria-label={`${resource.label}: ${action.label}`}
      onClick={() => !readOnly && onToggle(action.key, !checked)}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tenant)]/50",
        readOnly ? "cursor-default" : "cursor-pointer",
        variant === "chip"
          ? cn(
              "rounded-full border px-2.5 py-1",
              checked
                ? "border-[color:var(--tenant)]/40 bg-[color:var(--tenant)]/10 text-tenant"
                : "border-border bg-background text-muted-foreground",
              !readOnly && !checked && "hover:bg-muted hover:text-foreground",
            )
          : cn(
              "rounded-full px-2.5 py-1 md:rounded-md md:p-1.5",
              "max-md:border max-md:border-border",
              checked
                ? "max-md:border-[color:var(--tenant)]/40 max-md:bg-[color:var(--tenant)]/10 max-md:text-tenant"
                : "",
              !readOnly && "hover:bg-muted",
            ),
      )}
    >
      <Tick state={checked ? "on" : "off"} small={variant === "chip"} />
      <span className={variant === "cell" ? "md:sr-only" : undefined}>{action.label}</span>
      {action.sensitive && <ShieldAlert className="h-3 w-3 shrink-0 text-warning" aria-hidden />}
    </button>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        <div className="space-y-1 py-0.5 leading-snug">
          <div className="font-semibold">
            {resource.label} · {action.label}
          </div>
          <div className="opacity-90">{action.description}</div>
          {needs.length > 0 && <div className="opacity-80">Also needs {needs.join(" and ")}.</div>}
          {action.sensitive && (
            <div className="font-semibold">
              Sensitive — lets someone change who can do what. Give it only to administrators.
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function ResourceRow({
  resource,
  selected,
  readOnly,
  onToggle,
}: {
  resource: PermissionResource;
  selected: ReadonlySet<PermissionKey>;
  readOnly: boolean;
  onToggle: (key: PermissionKey, on: boolean) => void;
}) {
  const others = resource.actions.filter((a) => a.kind === "other");
  const view = resource.actions.find((a) => a.kind === "view");
  const needs = view ? (REQUIRES[view.key] ?? []) : [];
  const sensitive = resource.actions.some((a) => a.sensitive);

  return (
    <div className={cn("grid gap-3 px-4 py-3.5 md:items-center", GRID)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{resource.label}</span>
          {sensitive && (
            <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground">
              <ShieldAlert className="h-3 w-3" aria-hidden /> Sensitive
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{resource.description}</p>
        {needs.length > 0 && (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Link2 className="h-3 w-3 shrink-0" aria-hidden />
            Needs {needs.map(permissionLabel).join(" and ")}
          </p>
        )}
      </div>

      {/* Below md this wrapper is a row of labelled chips; from md up it
          dissolves (md:contents) so each child lands in its grid column. */}
      <div className="flex flex-wrap items-center gap-2 md:contents">
        {COLUMNS.map((kind) => {
          const action = resource.actions.find((a) => a.kind === kind);
          return (
            <div
              key={kind}
              className={action ? "md:flex md:justify-center" : "hidden md:flex md:justify-center"}
            >
              {action ? (
                <ActionToggle
                  resource={resource}
                  action={action}
                  checked={selected.has(action.key)}
                  readOnly={readOnly}
                  variant="cell"
                  onToggle={onToggle}
                />
              ) : (
                <span className="text-sm text-muted-foreground/40" aria-hidden>
                  —
                </span>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap gap-1.5">
          {others.map((action) => (
            <ActionToggle
              key={action.key}
              resource={resource}
              action={action}
              checked={selected.has(action.key)}
              readOnly={readOnly}
              variant="chip"
              onToggle={onToggle}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AccessLevelControl({
  module,
  level,
  readOnly,
  onChange,
}: {
  module: PermissionModule;
  level: AccessLevel;
  readOnly: boolean;
  onChange: (level: Exclude<AccessLevel, "custom">) => void;
}) {
  const options = [
    { value: "none", label: "None" },
    { value: "view", label: "View only" },
    { value: "full", label: "Full" },
  ] as const;
  return (
    <div className="flex items-center gap-2">
      {level === "custom" && (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-tenant">
          Custom
        </span>
      )}
      <div
        role="radiogroup"
        aria-label={`${module.label} access`}
        className="inline-flex rounded-lg border border-border bg-background p-0.5"
      >
        {options.map((o) => {
          const active = level === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={readOnly || undefined}
              onClick={() => !readOnly && !active && onChange(o.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                active ? "bg-tenant text-white shadow-sm" : "text-muted-foreground",
                !active && !readOnly && "hover:bg-muted hover:text-foreground",
                readOnly && "cursor-default",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ModuleSection({
  module,
  selected,
  readOnly,
  query,
  onToggle,
  onLevel,
}: {
  module: PermissionModule;
  selected: ReadonlySet<PermissionKey>;
  readOnly: boolean;
  query: string;
  onToggle: (key: PermissionKey, on: boolean) => void;
  onLevel: (module: PermissionModule, level: Exclude<AccessLevel, "custom">) => void;
}) {
  const resources = module.resources.filter((r) => resourceMatches(r, query));
  if (resources.length === 0) return null;
  const Icon = MODULE_ICONS[module.id];
  const level = moduleAccess(module, selected);
  const { held, total } = moduleCount(module, selected);

  return (
    <section
      id={`permissions-${module.id}`}
      data-module={module.id}
      className="scroll-mt-20 overflow-hidden rounded-2xl border border-border bg-card"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--tenant)]/10 text-tenant">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-[11rem] flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="font-display text-sm font-bold">{module.label}</h3>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {held}/{total}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{module.description}</p>
        </div>
        <AccessLevelControl
          module={module}
          level={level}
          readOnly={readOnly}
          onChange={(l) => onLevel(module, l)}
        />
      </div>

      <div
        className={cn(
          "hidden border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid md:gap-3",
          GRID,
        )}
      >
        <span>Page</span>
        {COLUMNS.map((c) => (
          <span key={c} className="text-center">
            {COLUMN_LABEL[c]}
          </span>
        ))}
        <span>Other actions</span>
      </div>

      <div className="divide-y divide-border">
        {resources.map((r) => (
          <ResourceRow
            key={r.id}
            resource={r}
            selected={selected}
            readOnly={readOnly}
            onToggle={onToggle}
          />
        ))}
      </div>
    </section>
  );
}
