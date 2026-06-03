import { Pill } from "@/components/tenant/ui";
import type { ProductionCategory, TeamType } from "@/lib/analytics-types";

export function TeamTypeBadge({ type }: { type: TeamType }) {
  return type === "production"
    ? <Pill tone="tenant">Production Team</Pill>
    : <Pill tone="info">Support Team</Pill>;
}

export function CategoryBadge({ category }: { category: ProductionCategory }) {
  if (category === "na") return <Pill tone="muted">Not Applicable</Pill>;
  const map = { collection: "success", legal: "warning", other: "muted" } as const;
  const labels = { collection: "Collection", legal: "Legal", other: "Other" } as const;
  return <Pill tone={map[category]}>{labels[category]}</Pill>;
}
