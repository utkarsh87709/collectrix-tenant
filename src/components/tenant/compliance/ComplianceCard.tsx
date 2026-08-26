import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { JurisdictionBadge } from "./JurisdictionBadge";
import { detectJurisdiction } from "@/lib/jurisdiction-detect";
import { validateCallTime } from "@/lib/calling-hours-engine";
import { checkFrequency } from "@/lib/frequency-limit-engine";
import { checkCease, useCeaseRecords } from "@/lib/cease-desist-store";
import { isCollectionsPaused, useValidationRequests } from "@/lib/debt-validation-store";
import { disclosureCoverage } from "@/lib/disclosure-engine";
import { ShieldCheck, AlertTriangle, Clock, Ban, FileCheck2 } from "lucide-react";

export function ComplianceCard({
  debtorId, address, phone,
}: {
  debtorId: string;
  address: { postal?: string; province?: string; state?: string; country?: string };
  phone?: string;
}) {
  const detection = detectJurisdiction({ ...address, phone });
  const codes = [detection.primary, detection.federal].filter((v, i, a) => a.indexOf(v) === i);
  const hours = validateCallTime(detection.primary);
  const frequency = checkFrequency(debtorId, detection.primary);
  const cease = checkCease(debtorId, "call");
  const paused = isCollectionsPaused(debtorId);
  const coverage = disclosureCoverage(debtorId, codes, "call");

  // subscribe to changes
  useCeaseRecords(debtorId);
  useValidationRequests(debtorId);

  return (
    <PageCard>
      <CardHead title="Compliance" subtitle="Jurisdiction-aware enforcement" action={<JurisdictionBadge detection={detection} />} />
      <div className="px-6 py-4 space-y-3 text-sm">
        <Row icon={<Clock className="h-4 w-4 text-tenant" />} label="Calling hours">
          {hours.allowed
            ? <Pill tone="success">Allowed · customer local {hours.debtorLocalTime}</Pill>
            : <span><Pill tone="danger">Blocked</Pill> <span className="text-xs text-muted-foreground ml-1">{hours.reason}</span></span>}
        </Row>
        <Row icon={<ShieldCheck className="h-4 w-4 text-tenant" />} label="Contact frequency">
          {frequency.window === "none"
            ? <Pill>No limit</Pill>
            : <Pill tone={frequency.allowed ? "success" : "danger"}>
                {frequency.used}/{frequency.max} per {frequency.window}
              </Pill>}
        </Row>
        <Row icon={<Ban className="h-4 w-4 text-destructive" />} label="Cease & desist">
          {cease.blocked ? <Pill tone="danger">{cease.reason}</Pill> : <Pill tone="success">None on file</Pill>}
        </Row>
        <Row icon={<FileCheck2 className="h-4 w-4 text-warning" />} label="Debt validation">
          {paused ? <Pill tone="warning">Collections paused — validation in progress</Pill> : <Pill>Not active</Pill>}
        </Row>
        <Row icon={<AlertTriangle className="h-4 w-4 text-warning" />} label="Required disclosures">
          {coverage.missing.length === 0
            ? <Pill tone="success">All {coverage.required.length} provided</Pill>
            : <Pill tone="warning">{coverage.missing.length} of {coverage.required.length} missing</Pill>}
        </Row>
        {coverage.missing.length > 0 && (
          <ul className="ml-6 text-xs text-muted-foreground space-y-0.5">
            {coverage.missing.map((d) => <li key={d.code}>• {d.title}</li>)}
          </ul>
        )}
      </div>
    </PageCard>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-border/60 pb-2 last:border-0">
      {icon}
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold w-44 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
