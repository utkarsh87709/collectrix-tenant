import { Pill } from "@/components/tenant/ui";
import { Globe, AlertTriangle } from "lucide-react";
import type { DetectionResult } from "@/lib/jurisdiction-detect";

export function JurisdictionBadge({ detection }: { detection: DetectionResult }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <Pill tone="tenant"><Globe className="h-3 w-3" /> {detection.primary}</Pill>
      <Pill tone="muted">{detection.federal}</Pill>
      {detection.mismatch && (
        <Pill tone="warning"><AlertTriangle className="h-3 w-3" /> address/phone mismatch</Pill>
      )}
    </div>
  );
}
