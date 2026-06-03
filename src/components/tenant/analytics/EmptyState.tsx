import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export type EmptyReason =
  | "no_data_period"
  | "no_calls"
  | "legal_only"
  | "collection_only"
  | "support_team"
  | "no_agents_in_team"
  | "no_production_teams"
  | "no_filter_results"
  | "no_collection_production"
  | "no_legal_production";

const MESSAGES: Record<EmptyReason, string> = {
  no_data_period:           "No KPI data available for this period.",
  no_calls:                 "This metric will appear once calls are logged.",
  legal_only:               "Legal metrics are available only for legal production teams.",
  collection_only:          "Collection metrics are available only for collection production teams.",
  support_team:             "Support teams do not have collection or legal recovery KPIs. These teams are used for user grouping, permissions, and operational organization.",
  no_agents_in_team:        "No agents are assigned to this team yet.",
  no_production_teams:      "No production teams are configured yet.",
  no_filter_results:        "No data is available for the selected filters.",
  no_collection_production: "No collection production teams are configured yet.",
  no_legal_production:      "No legal production teams are configured yet.",
};

export function EmptyState({ reason, action }: { reason: EmptyReason; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Inbox className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{MESSAGES[reason]}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
