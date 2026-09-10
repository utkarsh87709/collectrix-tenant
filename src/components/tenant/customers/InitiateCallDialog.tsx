import { useEffect, useState } from "react";
import { Loader2, PhoneCall, X } from "lucide-react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/tenant/ui";
import { callCustomerNumberList, initiateCustomerCall } from "@/lib/customers-api";

/** Place an outbound call to a customer from one of the tenant's caller-ID
 *  numbers (callCustomerNumberList → initiateCustomerCall). Shared by the
 *  customer profile's Calls tab and the Inbound Inbox header. */
export function InitiateCallDialog({
  uploadedDebtorId,
  defaultTo,
  customerName,
  onClose,
}: {
  uploadedDebtorId: number;
  /** The customer's number to dial — usually cellNo1. Editable in the dialog. */
  defaultTo?: string | null;
  customerName?: string;
  onClose: () => void;
}) {
  const [numbers, setNumbers] = useState<string[] | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(defaultTo ?? "");
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    callCustomerNumberList(uploadedDebtorId)
      .then((r) => {
        if (cancelled) return;
        setNumbers(r.phoneNoList);
        setFrom(r.phoneNoList[0] ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        setNumbers([]);
        toast.error("Couldn't load caller-ID numbers.");
      });
    return () => {
      cancelled = true;
    };
  }, [uploadedDebtorId]);

  const call = async () => {
    if (!from || !to.trim()) return;
    setCalling(true);
    try {
      await initiateCustomerCall({ uploadedDebtorId, callFrom: from, callTo: to.trim() });
      toast.success("Call initiated.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't place that call.");
    } finally {
      setCalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-elegant">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="font-display text-base font-bold">Initiate call</div>
            {customerName && (
              <div className="mt-0.5 text-xs text-muted-foreground">Calling {customerName}</div>
            )}
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Call from
            </span>
            <NativeSelect
              size="sm"
              className="mt-1"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={numbers === null || numbers.length === 0}
            >
              {numbers === null && <option value="">Loading numbers…</option>}
              {numbers?.length === 0 && <option value="">No caller-ID numbers available</option>}
              {numbers?.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Call to
            </span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Customer's number"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={call}
            disabled={!from || !to.trim() || calling}
            className="inline-flex items-center gap-1.5 rounded-lg bg-tenant px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {calling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PhoneCall className="h-4 w-4" />
            )}
            Call
          </button>
        </div>
      </div>
    </div>
  );
}
