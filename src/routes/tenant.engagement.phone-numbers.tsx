import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/admin/Shell";
import { Topbar } from "@/components/admin/Topbar";
import { PageCard } from "@/components/tenant/ui";
import {
  Phone,
  Plus,
  Search,
  MessageSquare,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Check,
  MapPin,
  X,
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  getNumberList,
  getTwilioCountries,
  getNumbers,
  buyNumber,
  enableNumber,
  disableNumber,
  updateNumberConfig,
  releaseNumber,
  numberFor,
  localityFor,
  type PhoneNumber,
  type NumberType,
  type TwilioCountry,
  type AvailableNumber,
} from "@/lib/phone-numbers-api";

export const Route = createFileRoute("/tenant/engagement/phone-numbers")({
  head: () => ({ meta: [{ title: "Phone Numbers · Tenant Admin" }] }),
  component: PhoneNumbersPage,
});

/* --------------------------------- helpers --------------------------------- */

/** "+14284366030" -> "+1 (428) 436-6030"; falls back to the raw string. */
function formatPhone(e164: string): string {
  const digits = (e164 ?? "").replace(/[^\d]/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return e164 || "—";
}

const typeLabel = (t: NumberType) => (t === "tollFree" ? "Toll-Free" : "Local");

/** Subtitle under the number, built from the real fields the API returns. */
function numberSubtitle(n: PhoneNumber): string {
  if (n.numberType === "tollFree") return `Toll-Free — ${n.countryCode}`;
  return [n.areaCode && `Area ${n.areaCode}`, n.countryCode].filter(Boolean).join(" · ");
}

type StatusMeta = { label: string; dot: string; text: string };
const STATUS_META: Record<string, StatusMeta> = {
  active: { label: "Active", dot: "bg-success", text: "text-foreground" },
  pending: { label: "Pending", dot: "bg-warning", text: "text-foreground" },
  inactive: { label: "Inactive", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
  released: { label: "Released", dot: "bg-destructive/60", text: "text-muted-foreground" },
};
const statusMeta = (s: string): StatusMeta =>
  STATUS_META[s] ?? {
    label: s || "Unknown",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
  };

// Order in which status filter chips appear (only those present are shown).
const STATUS_ORDER = ["active", "pending", "inactive", "released"];

/** Centered modal shell — matches the dialog pattern used across the app. */
function Modal({
  onClose,
  className,
  children,
}: {
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-h-[88vh] flex flex-col rounded-2xl border border-border bg-card shadow-elegant",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* --------------------------------- page ------------------------------------ */

function PhoneNumbersPage() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [configuring, setConfiguring] = useState<PhoneNumber | null>(null);
  const [releasing, setReleasing] = useState<PhoneNumber | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);

  const fetchNumbers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNumberList();
      setNumbers(res.phoneNoList ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load phone numbers.");
      setNumbers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNumbers();
  }, [fetchNumbers]);

  // Status filter chips: "All" plus each status actually present, with counts.
  const statusChips = useMemo(() => {
    const present = STATUS_ORDER.filter((s) => numbers.some((n) => n.status === s));
    return [
      { key: "all", label: "All", count: numbers.length },
      ...present.map((s) => ({
        key: s,
        label: statusMeta(s).label,
        count: numbers.filter((n) => n.status === s).length,
      })),
    ];
  }, [numbers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return numbers.filter((n) => {
      if (statusFilter !== "all" && n.status !== statusFilter) return false;
      if (!q) return true;
      return [
        n.phoneNo,
        formatPhone(n.phoneNo),
        typeLabel(n.numberType),
        n.status,
        n.areaCode,
        n.countryCode,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [numbers, search, statusFilter]);

  return (
    <Shell>
      <Topbar
        title="Phone Numbers"
        subtitle="Purchase and manage the numbers used for SMS and voice"
        action={
          <button
            onClick={() => setBuyOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
          >
            <Plus className="h-4 w-4" /> Buy Numbers
          </button>
        }
      />

      <section className="px-6 lg:px-10 py-6">
        <PageCard>
          {error ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={fetchNumbers}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center px-6 py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : numbers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <Phone className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No numbers yet. Buy your first number to get started.
              </p>
              <button
                onClick={() => setBuyOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
              >
                <Plus className="h-4 w-4" /> Buy Numbers
              </button>
            </div>
          ) : (
            <>
              {/* Filter + search toolbar */}
              <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 border-b border-border flex-wrap">
                <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
                  {statusChips.map((chip) => {
                    const active = statusFilter === chip.key;
                    return (
                      <button
                        key={chip.key}
                        onClick={() => setStatusFilter(chip.key)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-colors",
                          active
                            ? "bg-card text-tenant shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {chip.label}
                        <span
                          className={cn(
                            "min-w-5 px-1.5 rounded-full text-xs font-semibold tabular-nums",
                            active
                              ? "bg-tenant/10 text-tenant"
                              : "bg-border/60 text-muted-foreground",
                          )}
                        >
                          {chip.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by number…"
                    className="w-full h-9 pl-9 pr-8 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-tenant/30"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="px-6 py-16 text-center text-sm text-muted-foreground">
                  No numbers match this view{search ? ` and “${search}”` : ""}.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <TooltipProvider delayDuration={200}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                          <th className="px-6 py-3 font-semibold align-middle">Phone Number</th>
                          <th className="px-6 py-3 font-semibold align-middle">Type</th>
                          <th className="px-6 py-3 font-semibold align-middle">Status</th>
                          <th className="px-6 py-3 font-semibold text-right align-middle">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((n) => {
                          const sm = statusMeta(n.status);
                          const released = n.status === "released";
                          return (
                            <tr
                              key={n.phoneNoId}
                              className="border-b border-border last:border-0 hover:bg-muted/40"
                            >
                              <td className="px-6 py-4 align-middle">
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-tenant/10 text-tenant shrink-0">
                                    <Phone className="h-4 w-4" />
                                  </span>
                                  <div className="min-w-0">
                                    <div className="font-semibold">{formatPhone(n.phoneNo)}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {numberSubtitle(n)}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 align-middle">
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                                    n.numberType === "tollFree"
                                      ? "bg-warning/15 text-warning-foreground"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {typeLabel(n.numberType)}
                                </span>
                              </td>
                              <td className="px-6 py-4 align-middle">
                                <span
                                  className={`inline-flex items-center gap-2 text-sm ${sm.text}`}
                                >
                                  <span className={`h-2 w-2 rounded-full ${sm.dot}`} />
                                  {sm.label}
                                </span>
                              </td>
                              <td className="px-6 py-4 align-middle">
                                <div className="flex items-center justify-end gap-2">
                                  {released ? (
                                    <span className="text-xs text-muted-foreground">
                                      No actions
                                    </span>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => setConfiguring(n)}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted hover:border-tenant/40 transition-colors"
                                      >
                                        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />{" "}
                                        Configure
                                      </button>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            onClick={() => setReleasing(n)}
                                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                          >
                                            Release
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          Release this number back to Twilio
                                        </TooltipContent>
                                      </Tooltip>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </TooltipProvider>
                </div>
              )}
            </>
          )}
        </PageCard>
      </section>

      {configuring && (
        <ConfigureModal
          number={configuring}
          onClose={() => setConfiguring(null)}
          onSaved={() => {
            setConfiguring(null);
            fetchNumbers();
          }}
        />
      )}

      {releasing && (
        <ReleaseModal
          number={releasing}
          onClose={() => setReleasing(null)}
          onReleased={() => {
            setReleasing(null);
            fetchNumbers();
          }}
        />
      )}

      {buyOpen && (
        <BuyNumbersModal
          onClose={() => setBuyOpen(false)}
          onPurchased={() => {
            setBuyOpen(false);
            fetchNumbers();
          }}
        />
      )}
    </Shell>
  );
}

/* ----------------------------- configure modal ----------------------------- */

function ConfigureModal({
  number,
  onClose,
  onSaved,
}: {
  number: PhoneNumber;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [active, setActive] = useState(number.status === "active");
  const [sms, setSms] = useState(number.smsEnabled === 1);
  const [call, setCall] = useState(number.callEnabled === 1);
  const [saving, setSaving] = useState(false);

  const orig = {
    active: number.status === "active",
    sms: number.smsEnabled === 1,
    call: number.callEnabled === 1,
  };
  const dirty = orig.active !== active || orig.sms !== sms || orig.call !== call;

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      // Apply only what changed: activation toggle and/or permission config.
      if (orig.active !== active) {
        await (active ? enableNumber(number.phoneNoId) : disableNumber(number.phoneNoId));
      }
      if (orig.sms !== sms || orig.call !== call) {
        await updateNumberConfig({
          phoneNoId: number.phoneNoId,
          smsEnabled: sms ? 1 : 0,
          callEnabled: call ? 1 : 0,
        });
      }
      toast.success("Number updated.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update this number.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} className="max-w-lg">
      <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Configure Number</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage settings for this number.</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Identity card */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-tenant/10 text-tenant shrink-0">
            <Phone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="font-bold text-lg">{formatPhone(number.phoneNo)}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className={`px-2 py-0.5 rounded-md font-semibold ${
                  number.numberType === "tollFree"
                    ? "bg-warning/15 text-warning-foreground"
                    : "bg-muted"
                }`}
              >
                {typeLabel(number.numberType)}
              </span>
              {numberSubtitle(number)}
            </div>
          </div>
        </div>

        {/* Status */}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Status
          </p>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold">Number Active</div>
              <p className="text-sm text-muted-foreground">
                When inactive, this number cannot send or receive.
              </p>
            </div>
            <Switch
              checked={active}
              onCheckedChange={setActive}
              aria-label="Toggle number active"
            />
          </div>
          <p className="text-sm mt-2">
            Status:{" "}
            <span
              className={
                active ? "text-success font-semibold" : "text-muted-foreground font-semibold"
              }
            >
              {active ? "Active" : "Inactive"}
            </span>
          </p>
        </div>

        {/* Permissions */}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Permissions
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            Choose what this number is allowed to do.
          </p>
          <div className="space-y-3">
            <PermissionCard
              selected={sms}
              onToggle={() => setSms((v) => !v)}
              icon={<MessageSquare className="h-4 w-4" />}
              title="Messaging"
              desc="Send and receive SMS and MMS messages."
            />
            <PermissionCard
              selected={call}
              onToggle={() => setCall((v) => !v)}
              icon={<Phone className="h-4 w-4" />}
              title="Calling"
              desc="Make and receive voice calls."
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{" "}
          Save Changes
        </button>
      </div>
    </Modal>
  );
}

function PermissionCard({
  selected,
  onToggle,
  icon,
  title,
  desc,
}: {
  selected: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        selected ? "border-tenant bg-tenant/5" : "border-border hover:bg-muted/40"
      }`}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border shrink-0 ${
          selected
            ? "bg-tenant border-tenant text-white"
            : "border-muted-foreground/40 text-transparent"
        }`}
      >
        <Check className="h-3 w-3" />
      </span>
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
          selected ? "bg-tenant text-white" : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}

/* ------------------------------- release modal ------------------------------ */

function ReleaseModal({
  number,
  onClose,
  onReleased,
}: {
  number: PhoneNumber;
  onClose: () => void;
  onReleased: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await releaseNumber(number.phoneNoId);
      toast.success("Number released.");
      onReleased();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to release this number.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elegant"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <h2 className="font-display text-xl font-bold tracking-tight mt-4">Release Number</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You are about to release{" "}
          <span className="font-semibold text-foreground">{formatPhone(number.phoneNo)}</span>. This
          action cannot be undone.
        </p>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          This number will be permanently removed and you will lose access to it immediately.
        </div>
        <div className="flex items-center justify-end gap-3 pt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Release Number
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- buy wizard --------------------------------- */

const BUY_STEPS = ["Country & Type", "Select Numbers", "Confirm"];

function BuyNumbersModal({
  onClose,
  onPurchased,
}: {
  onClose: () => void;
  onPurchased: () => void;
}) {
  const [step, setStep] = useState(1);
  const [countries, setCountries] = useState<TwilioCountry[]>([]);
  const [countryCode, setCountryCode] = useState("CA");
  const [numberType, setNumberType] = useState<NumberType>("local");
  const [areaCode, setAreaCode] = useState("");

  const [refine, setRefine] = useState("");
  const [available, setAvailable] = useState<AvailableNumber[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [buying, setBuying] = useState(false);

  // Load the country list once on mount.
  useEffect(() => {
    getTwilioCountries()
      .then((res) => {
        setCountries(res.countryList ?? []);
        if (
          res.countryList?.length &&
          !res.countryList.some((c) => c.countryCode === countryCode)
        ) {
          setCountryCode(res.countryList[0].countryCode);
        }
      })
      .catch(() => {
        /* dropdown stays empty; default CA still usable */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = useCallback(async () => {
    setSearching(true);
    setSelected(new Set());
    try {
      const list = await getNumbers({ numberType, countryCode, areaCode: areaCode.trim() });
      setAvailable(list);
    } catch (e) {
      setAvailable([]);
      toast.error(e instanceof Error ? e.message : "Could not search numbers.");
    } finally {
      setSearching(false);
    }
  }, [numberType, countryCode, areaCode]);

  const goToSelect = async () => {
    setStep(2);
    await runSearch();
  };

  const refined = useMemo(() => {
    const q = refine.replace(/[^\d]/g, "");
    if (!q) return available;
    return available.filter((n) => numberFor(n).replace(/[^\d]/g, "").includes(q));
  }, [available, refine]);

  const toggle = (num: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const purchase = async () => {
    setBuying(true);
    try {
      await buyNumber({
        numberType,
        countryCode,
        areaCode: areaCode.trim(),
        numberList: [...selected],
      });
      toast.success(`Purchased ${selected.size} number${selected.size === 1 ? "" : "s"}.`);
      onPurchased();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to purchase the selected numbers.");
    } finally {
      setBuying(false);
    }
  };

  return (
    <Modal onClose={onClose} className="max-w-xl">
      <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Buy Numbers</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Find and purchase one or more numbers for SMS and voice.
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-border text-sm">
        {BUY_STEPS.map((label, i) => {
          const n = i + 1;
          const done = step > n;
          const current = step === n;
          return (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  done
                    ? "bg-success text-white"
                    : current
                      ? "bg-tenant text-white"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </span>
              <span className={current ? "font-semibold" : "text-muted-foreground"}>{label}</span>
              {n < BUY_STEPS.length && <span className="mx-1 h-px w-6 bg-border" />}
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {step === 1 && (
          <div className="space-y-5">
            <label className="block">
              <span className="block text-sm font-semibold mb-1.5">Country</span>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-tenant/30"
              >
                {countries.length === 0 && <option value={countryCode}>{countryCode}</option>}
                {countries.map((c) => (
                  <option key={c.countryCode} value={c.countryCode}>
                    {c.countryName}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="block text-sm font-semibold mb-1.5">Number Type</span>
              <div className="grid grid-cols-2 gap-3">
                <TypeCard
                  selected={numberType === "local"}
                  onClick={() => setNumberType("local")}
                  icon={<MapPin className="h-4 w-4" />}
                  title="Local"
                  desc="Tied to a specific city or area code. Best for regional presence."
                />
                <TypeCard
                  selected={numberType === "tollFree"}
                  onClick={() => setNumberType("tollFree")}
                  icon={<Phone className="h-4 w-4" />}
                  title="Toll-Free"
                  desc="Free for callers. Nationwide reach. Suits branded business lines."
                />
              </div>
            </div>

            <label className="block">
              <span className="block text-sm font-semibold mb-1.5">
                Area Code <span className="text-muted-foreground font-normal">(Optional)</span>
              </span>
              <input
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value)}
                placeholder="e.g. 416, 647, 800…"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-tenant/30"
              />
            </label>

            <div className="rounded-lg border border-tenant/20 bg-tenant/5 px-4 py-3 text-sm text-muted-foreground">
              Every number you buy works for both SMS and voice calling.
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Available Numbers
            </p>
            <div className="flex items-center gap-2">
              <input
                value={refine}
                onChange={(e) => setRefine(e.target.value)}
                placeholder="Refine by digits…"
                className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-tenant/30"
              />
              <button
                onClick={runSearch}
                disabled={searching}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}{" "}
                Search
              </button>
            </div>

            {searching ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : refined.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Search className="h-5 w-5" />
                </span>
                <p className="font-semibold">No numbers available</p>
                <p className="text-sm text-muted-foreground">
                  Try a different country or number type.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {refined.map((n) => {
                  const num = numberFor(n);
                  const on = selected.has(num);
                  const loc = localityFor(n);
                  return (
                    <li key={num}>
                      <button
                        type="button"
                        onClick={() => toggle(num)}
                        className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                          on ? "border-tenant bg-tenant/5" : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full border shrink-0 ${
                            on
                              ? "bg-tenant border-tenant text-white"
                              : "border-muted-foreground/40 text-transparent"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold">{formatPhone(num)}</span>
                          {loc && (
                            <span className="block text-xs text-muted-foreground">{loc}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Confirm purchase
            </p>
            <div className="rounded-lg border border-border divide-y divide-border">
              <Row
                label="Country"
                value={
                  countries.find((c) => c.countryCode === countryCode)?.countryName ?? countryCode
                }
              />
              <Row label="Type" value={typeLabel(numberType)} />
              {areaCode.trim() && <Row label="Area code" value={areaCode.trim()} />}
              <Row label="Numbers" value={`${selected.size} selected`} />
            </div>
            <ul className="space-y-2">
              {[...selected].map((num) => (
                <li
                  key={num}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-tenant/10 text-tenant">
                    <Phone className="h-4 w-4" />
                  </span>
                  <span className="font-semibold">{formatPhone(num)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border">
        <button
          onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
        >
          {step === 1 ? (
            "Cancel"
          ) : (
            <>
              <ArrowLeft className="h-4 w-4" /> Back
            </>
          )}
        </button>

        {step === 1 && (
          <button
            onClick={goToSelect}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
          >
            Search Numbers <ArrowRight className="h-4 w-4" />
          </button>
        )}
        {step === 2 && (
          <button
            onClick={() => setStep(3)}
            disabled={selected.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
          >
            Review <ArrowRight className="h-4 w-4" />
          </button>
        )}
        {step === 3 && (
          <button
            onClick={purchase}
            disabled={buying || selected.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-50"
          >
            {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Buy {selected.size} number{selected.size === 1 ? "" : "s"}
          </button>
        )}
      </div>
    </Modal>
  );
}

function TypeCard({
  selected,
  onClick,
  icon,
  title,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors ${
        selected ? "border-tenant bg-tenant/5" : "border-border hover:bg-muted/40"
      }`}
    >
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
          selected ? "bg-tenant text-white" : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <span className="font-semibold">{title}</span>
      <span className="text-xs text-muted-foreground">{desc}</span>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
