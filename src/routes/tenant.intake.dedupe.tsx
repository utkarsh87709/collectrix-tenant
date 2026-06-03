import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard, CardHead, Pill } from "@/components/tenant/ui";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  GitMerge,
  Trash2,
  Copy,
  X,
  CheckCircle2,
  ShieldAlert,
  FileSearch,
  History,
  Undo2,
  Sparkles,
} from "lucide-react";
import {
  dedupeCandidates,
  type DedupeCandidate,
  type DedupeMatches,
  type MatchLevel,
  type MatchTier,
  type MergeAuditEntry,
} from "@/lib/intake-mock";

export const Route = createFileRoute("/tenant/intake/dedupe")({
  head: () => ({ meta: [{ title: "Deduplication · Tenant Admin" }] }),
  component: DedupePage,
});

type Rec = DedupeCandidate["a"];
type Resolution = "merged" | "deleted" | "kept_both" | "not_duplicate" | "manager_review";

const COMPARED_FIELDS: (keyof Rec)[] = [
  "name", "dob", "address", "postalCode", "phone", "email", "creditorRef", "govId", "employer",
];

function diffFields(a: Rec, b: Rec): string[] {
  return COMPARED_FIELDS.filter((k) => a[k] !== b[k]) as string[];
}

const MATCH_TONE: Record<MatchLevel, "success" | "warning" | "danger" | "muted"> = {
  exact: "success",
  partial: "warning",
  different: "danger",
  missing: "muted",
};
const MATCH_LABEL: Record<MatchLevel, string> = {
  exact: "Exact",
  partial: "Partial",
  different: "Different",
  missing: "Missing",
};

const TIER_LABEL: Record<MatchTier, string> = {
  high: "High confidence",
  medium: "Possible match",
  low: "Investigative",
};
const TIER_TONE: Record<MatchTier, "success" | "warning" | "danger" | "info"> = {
  high: "success",
  medium: "warning",
  low: "info",
};
const TIER_BLURB: Record<MatchTier, string> = {
  high: "Strong identifiers align (Gov ID, DOB, account ref). Safe to merge after review.",
  medium: "Some strong overlaps but conflicts exist. Recommend manual verification.",
  low: "Weak signals only — likely household or coincidence. Investigate before merging.",
};

const INDICATORS: { key: keyof DedupeMatches; label: string }[] = [
  { key: "name", label: "Full name" },
  { key: "dob", label: "Date of birth" },
  { key: "govId", label: "Gov ID" },
  { key: "creditorRef", label: "Creditor ref" },
  { key: "postalCode", label: "Postal code" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "employer", label: "Employer" },
];

function MatchBreakdown({ matches, similarity, tier, signals }: { matches: DedupeMatches; similarity: number; tier: MatchTier; signals: string[] }) {
  return (
    <div className="px-6 py-4 border-t border-border bg-muted/30">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Why we think these match
        </div>
        <Pill tone={TIER_TONE[tier]}>{TIER_LABEL[tier]} · {Math.round(similarity * 100)}%</Pill>
      </div>
      {signals.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {signals.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-border bg-background text-foreground">
              <Sparkles className="h-3 w-3 text-tenant" />
              {s}
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
        {INDICATORS.map((i) => {
          if (i.key === "name") {
            const score = matches.name;
            const tone: "success" | "warning" | "danger" = score >= 85 ? "success" : score >= 60 ? "warning" : "danger";
            return (
              <div key={i.key} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-border bg-background">
                <span className="text-muted-foreground">{i.label}</span>
                <Pill tone={tone}>{score}%</Pill>
              </div>
            );
          }
          const level = matches[i.key] as MatchLevel;
          return (
            <div key={i.key} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-border bg-background">
              <span className="text-muted-foreground">{i.label}</span>
              <Pill tone={MATCH_TONE[level]}>{MATCH_LABEL[level]}</Pill>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-xs text-muted-foreground italic">{TIER_BLURB[tier]}</div>
    </div>
  );
}

const RESOLUTION_LABEL: Record<Resolution, string> = {
  merged: "Merged",
  deleted: "Record deleted",
  kept_both: "Kept separate",
  not_duplicate: "Not a duplicate",
  manager_review: "Sent for manager review",
};
const RESOLUTION_TONE: Record<Resolution, "success" | "danger" | "info" | "muted" | "warning"> = {
  merged: "success",
  deleted: "danger",
  kept_both: "info",
  not_duplicate: "muted",
  manager_review: "warning",
};

type ConfirmState =
  | null
  | { candidateId: string; action: Resolution; target?: "A" | "B" };

type ResolutionRecord = { action: Resolution; target?: "A" | "B"; at: string; actor: string };

const TIER_FILTERS: { key: "all" | MatchTier; label: string }[] = [
  { key: "all", label: "All" },
  { key: "high", label: "High confidence" },
  { key: "medium", label: "Possible match" },
  { key: "low", label: "Investigative" },
];

function DedupePage() {
  const [resolutions, setResolutions] = useState<Record<string, ResolutionRecord>>({});
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [tierFilter, setTierFilter] = useState<"all" | MatchTier>("all");
  const [sourceOpenFor, setSourceOpenFor] = useState<string | null>(null);
  const [historyOpenFor, setHistoryOpenFor] = useState<string | null>(null);
  // Per-candidate appended audit entries (manager review, undo etc.)
  const [audit, setAudit] = useState<Record<string, MergeAuditEntry[]>>({});

  const list = dedupeCandidates;
  const filtered = useMemo(
    () => (tierFilter === "all" ? list : list.filter((c) => c.tier === tierFilter)),
    [list, tierFilter],
  );
  const pending = useMemo(() => filtered.filter((c) => !resolutions[c.id]), [filtered, resolutions]);

  const counts = useMemo(() => {
    const c: Record<"all" | MatchTier, number> = { all: list.length, high: 0, medium: 0, low: 0 };
    list.forEach((x) => { c[x.tier]++; });
    return c;
  }, [list]);

  function appendAudit(id: string, entry: Omit<MergeAuditEntry, "id">) {
    setAudit((prev) => {
      const existing = prev[id] ?? [];
      return { ...prev, [id]: [...existing, { id: `m_${existing.length + 1}`, ...entry }] };
    });
  }

  function applyResolution(id: string, action: Resolution, target?: "A" | "B") {
    const at = "just now";
    const actor = "Maya Lindstrom";
    setResolutions((prev) => ({ ...prev, [id]: { action, target, at, actor } }));
    const auditAction: MergeAuditEntry["action"] =
      action === "merged" ? "merged"
      : action === "kept_both" ? "kept_separate"
      : action === "not_duplicate" ? "not_duplicate"
      : action === "manager_review" ? "manager_review"
      : "flagged";
    appendAudit(id, {
      when: at,
      actor,
      action: auditAction,
      note:
        action === "deleted"
          ? `Record ${target} deleted from tenant`
          : action === "merged"
            ? `Record B merged into Record A (reversible for 30 days)`
            : action === "manager_review"
              ? "Escalated to manager queue"
              : action === "kept_both"
                ? "Both records retained as distinct debtors"
                : "Marked as not a duplicate; will be suppressed in future scans",
    });
    const msg =
      action === "merged" ? "Records merged"
      : action === "deleted" ? `Record ${target} deleted`
      : action === "kept_both" ? "Both records kept as separate debtors"
      : action === "manager_review" ? "Sent to manager review queue"
      : "Marked as not a duplicate";
    toast.success(msg);
    setConfirm(null);
  }

  function undoResolution(id: string) {
    const prev = resolutions[id];
    if (!prev) return;
    setResolutions((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
    appendAudit(id, {
      when: "just now",
      actor: "Maya Lindstrom",
      action: "unmerged",
      note: prev.action === "merged" ? "Merge reversed — Record B restored from snapshot" : `Reverted ${RESOLUTION_LABEL[prev.action]}`,
    });
    toast.success("Action reversed");
  }

  return (
    <Shell>
      <Topbar
        title="Deduplication Queue"
        subtitle={`${pending.length} pending · ${filtered.length - pending.length} resolved · ${list.length} total`}
      />
      <section className="px-6 lg:px-10 py-6 space-y-4">
        <PageCard>
          <div className="px-6 py-3 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground mr-2">Confidence tier:</span>
            {TIER_FILTERS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTierFilter(t.key)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  tierFilter === t.key
                    ? "bg-tenant text-tenant-foreground border-tenant"
                    : "bg-background border-border hover:bg-muted"
                }`}
              >
                {t.label} <span className="opacity-70">({counts[t.key]})</span>
              </button>
            ))}
          </div>
        </PageCard>

        {filtered.length === 0 && (
          <PageCard>
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              <GitMerge className="h-10 w-10 mx-auto mb-3 text-tenant" />
              No candidates in this tier.
            </div>
          </PageCard>
        )}

        {filtered.map((c) => {
          const diffs = diffFields(c.a, c.b);
          const resolved = resolutions[c.id];
          return (
            <PageCard key={c.id} className={resolved ? "opacity-80" : ""}>
              <CardHead
                title={`${TIER_LABEL[c.tier]} · ${(c.similarity * 100).toFixed(0)}% similarity`}
                subtitle={c.tierSignals.join(" · ")}
                action={
                  <div className="flex items-center gap-2">
                    <Pill tone={TIER_TONE[c.tier]}>{TIER_LABEL[c.tier]}</Pill>
                    {resolved ? (
                      <Pill tone={RESOLUTION_TONE[resolved.action]}>
                        {RESOLUTION_LABEL[resolved.action]}
                        {resolved.target ? ` · Record ${resolved.target}` : ""}
                      </Pill>
                    ) : (
                      <Pill tone={diffs.length === 0 ? "success" : "warning"}>
                        {diffs.length === 0 ? "Identical" : `${diffs.length} field${diffs.length === 1 ? "" : "s"} differ`}
                      </Pill>
                    )}
                  </div>
                }
              />
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                {[c.a, c.b].map((rec, i) => {
                  const label: "A" | "B" = i === 0 ? "A" : "B";
                  return (
                    <div key={i} className="px-6 py-4 text-sm space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold">{rec.name}</span>
                          <Pill tone={i === 0 ? "tenant" : "info"}>Record {label}</Pill>
                        </div>
                        {!resolved && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => setConfirm({ candidateId: c.id, action: "deleted", target: label })}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Delete this
                          </Button>
                        )}
                      </div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        Source · <span className="font-mono normal-case text-foreground">{rec.sourceSystem}</span>
                      </div>
                      <FieldRow label="External ID" value={rec.ext} highlight={diffs.includes("ext")} mono />
                      <FieldRow label="Name" value={rec.name} highlight={diffs.includes("name")} />
                      <FieldRow label="Date of birth" value={rec.dob} highlight={diffs.includes("dob")} />
                      <FieldRow label="Gov ID" value={rec.govId} highlight={diffs.includes("govId")} mono />
                      <FieldRow label="Address" value={rec.address} highlight={diffs.includes("address")} />
                      <FieldRow label="Postal code" value={rec.postalCode} highlight={diffs.includes("postalCode")} mono />
                      <FieldRow label="Phone" value={rec.phone || "—"} highlight={diffs.includes("phone")} mono />
                      <FieldRow label="Email" value={rec.email || "—"} highlight={diffs.includes("email")} />
                      <FieldRow label="Employer" value={rec.employer || "—"} highlight={diffs.includes("employer")} />
                      <FieldRow label="Creditor" value={rec.creditor} highlight={false} />
                      <FieldRow label="Creditor ref" value={rec.creditorRef} highlight={diffs.includes("creditorRef")} mono />
                      <FieldRow
                        label="Balance"
                        value={`$${rec.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        highlight={false}
                      />
                    </div>
                  );
                })}
              </div>

              <MatchBreakdown matches={c.matches} similarity={c.similarity} tier={c.tier} signals={c.tierSignals} />

              {!resolved ? (
                <div className="px-6 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setSourceOpenFor(c.id)}>
                      <FileSearch className="h-3.5 w-3.5 mr-1.5" />
                      View source records
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setHistoryOpenFor(c.id)}>
                      <History className="h-3.5 w-3.5 mr-1.5" />
                      Audit history
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => applyResolution(c.id, "not_duplicate")}>
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      Not a Duplicate
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => applyResolution(c.id, "kept_both")}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Keep Separate
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => applyResolution(c.id, "manager_review")}>
                      <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                      Manager Review
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      disabled={c.tier === "low"}
                      title={c.tier === "low" ? "Low-confidence pairs must go through manager review before merging" : undefined}
                      onClick={() => setConfirm({ candidateId: c.id, action: "merged" })}
                    >
                      <GitMerge className="h-3.5 w-3.5 mr-1.5" />
                      Merge
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="px-6 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    {RESOLUTION_LABEL[resolved.action]}
                    {resolved.target ? ` (Record ${resolved.target})` : ""} · by {resolved.actor} · {resolved.at}
                    {resolved.action === "merged" && (
                      <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded border border-border bg-background">
                        Reversible for 30 days
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setHistoryOpenFor(c.id)}>
                      <History className="h-3.5 w-3.5 mr-1.5" />
                      Audit history
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => undoResolution(c.id)}>
                      <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                      {resolved.action === "merged" ? "Reverse merge" : "Undo"}
                    </Button>
                  </div>
                </div>
              )}
            </PageCard>
          );
        })}
      </section>

      {/* Merge confirm */}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "merged"
                ? "Merge these records?"
                : confirm?.action === "deleted"
                  ? `Delete Record ${confirm?.target}?`
                  : "Confirm"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "merged"
                ? "Record A keeps its identifiers. Record B is merged in where Record A is missing values. A snapshot of Record B is retained so the merge can be reversed for 30 days."
                : "This will permanently remove the selected debtor record from this tenant."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirm?.action === "merged" && (() => {
            const cand = list.find((x) => x.id === confirm.candidateId);
            return cand ? <MatchBreakdown matches={cand.matches} similarity={cand.similarity} tier={cand.tier} signals={cand.tierSignals} /> : null;
          })()}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && applyResolution(confirm.candidateId, confirm.action, confirm.target)}>
              {confirm?.action === "deleted" ? "Delete" : "Merge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Source records dialog */}
      <Dialog open={!!sourceOpenFor} onOpenChange={(o) => !o && setSourceOpenFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Source records & lineage</DialogTitle>
            <DialogDescription>Where each record originated, and the upstream system that owns it.</DialogDescription>
          </DialogHeader>
          {(() => {
            const c = list.find((x) => x.id === sourceOpenFor);
            if (!c) return null;
            return (
              <div className="space-y-3">
                {[c.a, c.b].map((rec, i) => {
                  const label: "A" | "B" = i === 0 ? "A" : "B";
                  return (
                    <div key={i} className="border border-border rounded p-3 text-sm space-y-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-display font-bold">{rec.name}</span>
                        <Pill tone={i === 0 ? "tenant" : "info"}>Record {label}</Pill>
                      </div>
                      <Row k="Source system" v={rec.sourceSystem} mono />
                      <Row k="External ID" v={rec.ext} mono />
                      <Row k="Creditor" v={rec.creditor} />
                      <Row k="Creditor ref" v={rec.creditorRef} mono />
                      <Row k="Placed via" v={rec.sourceSystem.startsWith("Import") ? "Bulk import" : rec.sourceSystem.startsWith("REST") ? "REST API" : rec.sourceSystem.startsWith("CRM") ? "CRM sync" : "Manual entry"} />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Merge audit history dialog */}
      <Dialog open={!!historyOpenFor} onOpenChange={(o) => !o && setHistoryOpenFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Merge audit history</DialogTitle>
            <DialogDescription>Every detection, review, merge, and reversal for this candidate pair.</DialogDescription>
          </DialogHeader>
          {(() => {
            const c = list.find((x) => x.id === historyOpenFor);
            if (!c) return null;
            const entries = [...c.mergeHistory, ...(audit[c.id] ?? [])];
            return (
              <div className="space-y-2 text-sm max-h-[60vh] overflow-y-auto">
                {entries.map((e) => (
                  <div key={e.id} className="border border-border rounded p-3 flex items-start gap-3">
                    <div className="mt-0.5">
                      {e.action === "merged" && <GitMerge className="h-4 w-4 text-success" />}
                      {e.action === "unmerged" && <Undo2 className="h-4 w-4 text-warning" />}
                      {e.action === "manager_review" && <ShieldAlert className="h-4 w-4 text-warning" />}
                      {e.action === "kept_separate" && <Copy className="h-4 w-4 text-info" />}
                      {e.action === "not_duplicate" && <X className="h-4 w-4 text-muted-foreground" />}
                      {e.action === "flagged" && <Sparkles className="h-4 w-4 text-tenant" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold capitalize">{e.action.replace("_", " ")}</span>
                        <span className="text-xs text-muted-foreground">· {e.actor} · {e.when}</span>
                      </div>
                      {e.note && <div className="text-xs text-muted-foreground mt-0.5">{e.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

function FieldRow({ label, value, highlight, mono }: { label: string; value: string; highlight: boolean; mono?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 px-2 py-1 rounded ${highlight ? "bg-warning/10" : ""}`}>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground w-24 shrink-0">{label}</span>
      <span className={`flex-1 ${mono ? "font-mono text-xs" : "text-sm"} ${highlight ? "font-semibold" : ""}`}>{value}</span>
      {highlight && <Pill tone="warning">differs</Pill>}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground w-28 shrink-0">{k}</span>
      <span className={`flex-1 ${mono ? "font-mono text-xs" : "text-sm"}`}>{v}</span>
    </div>
  );
}
