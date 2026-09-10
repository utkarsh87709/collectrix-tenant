import { useEffect, useMemo, useState } from "react";
import { Flag, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { assignCustomerTag, deleteCustomerTag, getTagList } from "@/lib/customers-api";

/** Starter flag names offered on every file so the picker isn't empty for a
 *  brand-new tenant. They're plain tag names like any other — the backend has
 *  no "system" flag concept, so nothing is special-cased once assigned. */
const SUGGESTED_FLAGS = [
  "high-value",
  "disputed",
  "skip-trace",
  "hardship",
  "do-not-contact",
  "legal-hold",
];

type Option = { name: string; source: "file" | "tenant" | "suggested" };

/** "Flags" button + toggle list for a customer's tags. Backed by the tag
 *  endpoints in customers-api (assignCustomerTag / deleteCustomerTag by name). */
export function FlagsPopover({
  uploadedDebtorId,
  tags,
  canEdit,
  onChanged,
}: {
  uploadedDebtorId: number;
  /** The file's current tags (getCustomerDetails.customerTags, normalised). */
  tags: string[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [known, setKnown] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  // Tenant-wide tag names load lazily, only when the picker opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getTagList(uploadedDebtorId)
      .then((list) => {
        if (!cancelled) setKnown(list);
      })
      .catch(() => {
        /* suggestions are a nicety — the file's own tags still render */
      });
    return () => {
      cancelled = true;
    };
  }, [open, uploadedDebtorId]);

  const active = useMemo(() => new Set(tags.map((t) => t.toLowerCase())), [tags]);

  const options = useMemo(() => {
    const seen = new Set<string>();
    const out: Option[] = [];
    const add = (name: string, source: Option["source"]) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ name, source });
    };
    for (const t of tags) add(t, "file");
    for (const t of known) add(t, "tenant");
    for (const t of SUGGESTED_FLAGS) add(t, "suggested");
    return out;
  }, [tags, known]);

  const setFlag = async (name: string, on: boolean) => {
    setBusy(name);
    try {
      if (on) {
        await assignCustomerTag(uploadedDebtorId, name);
        toast.success(`Flag "${name}" added.`);
      } else {
        await deleteCustomerTag(uploadedDebtorId, name);
        toast.success(`Flag "${name}" removed.`);
      }
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update that flag.");
    } finally {
      setBusy(null);
    }
  };

  const addCustom = async () => {
    const name = custom.trim();
    if (!name) return;
    if (active.has(name.toLowerCase())) {
      toast.message(`"${name}" is already on this file.`);
      setCustom("");
      return;
    }
    await setFlag(name, true);
    setCustom("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted shrink-0">
          <Flag className="h-4 w-4" /> Flags
          {tags.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-tenant text-white text-[10px] font-bold">
              {tags.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
          {canEdit ? "Toggle flag on customer" : "Flags on this customer"}
        </div>
        <ul className="max-h-72 overflow-y-auto py-1">
          {options.map((o) => {
            const on = active.has(o.name.toLowerCase());
            const working = busy === o.name;
            return (
              <li key={o.name}>
                <label
                  className={`flex items-center gap-3 px-4 py-2 text-sm ${
                    canEdit ? "cursor-pointer hover:bg-muted/60" : ""
                  }`}
                >
                  {working ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-tenant"
                      checked={on}
                      disabled={!canEdit || busy !== null}
                      onChange={(e) => setFlag(o.name, e.target.checked)}
                    />
                  )}
                  <span className={`flex-1 ${on ? "font-semibold" : ""}`}>{o.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {o.source === "file"
                      ? "On file"
                      : o.source === "tenant"
                        ? "In use"
                        : "Suggested"}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {canEdit ? (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              placeholder="Add a custom flag…"
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm"
            />
            <button
              onClick={addCustom}
              disabled={!custom.trim() || busy !== null}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-tenant text-white text-xs font-semibold disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            Flags are read-only for your role.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
