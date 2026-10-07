import { useMemo, useState } from "react";
import { Braces, ChevronDown, Loader2, RefreshCw, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { placeholderToken, usePlaceholders } from "@/lib/placeholders-api";

/**
 * "Insert variable" dropdown backed by getTenantPlaceholders. Picking a field
 * calls onInsert with its token ({{Field name}}); the caller decides where in
 * its own input the token goes.
 */
export function InsertVariableMenu({
  onInsert,
  disabled = false,
  align = "start",
}: {
  onInsert: (token: string) => void;
  disabled?: boolean;
  align?: "start" | "end";
}) {
  const { placeholders, error, reload } = usePlaceholders();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!placeholders) return [];
    return q ? placeholders.filter((p) => p.toLowerCase().includes(q)) : placeholders;
  }, [placeholders, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          // Keep focus (and the caret) in the field being edited.
          onMouseDown={(e) => e.preventDefault()}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Braces className="h-4 w-4 text-tenant" />
          Insert variable
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-80 p-0"
        // Don't steal focus from the editor on open; the search box is optional.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-border p-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fields…"
              className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {placeholders === null ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : error ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              <p>{error}</p>
              <button
                type="button"
                onClick={reload}
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              {placeholders.length === 0
                ? "No customer fields defined yet — add them under Settings → Data Fields."
                : "No field matches that search."}
            </p>
          ) : (
            <>
              <div className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Customer file fields
              </div>
              {filtered.map((name) => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onInsert(placeholderToken(name));
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="truncate">{name}</span>
                  <span className="shrink-0 truncate font-mono text-[11px] text-muted-foreground">
                    {placeholderToken(name)}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
        <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          Replaced with each customer's value when the message is sent.
        </div>
      </PopoverContent>
    </Popover>
  );
}
