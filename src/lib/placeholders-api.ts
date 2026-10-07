// Tenant merge placeholders — the customer-file fields (default CSV columns
// plus the tenant's custom fields) that templates can reference.
//   POST /tenant/getTenantPlaceholders {} -> { placeholders: string[] }
// Verified live 2026-10-07: a flat, alphabetical list of field display names
// ("Creditor name", "Debtor first name", custom fields like "Court Namee").
// Templates reference them as {{<name>}} — the exact display name, spaces and
// case included — which is the form already stored on existing templates
// (e.g. "Hi {{Debtor first name}}"). The backend substitutes each customer's
// value when the message or document is generated.
//
// Use this list wherever a template body can carry placeholders (email, SMS,
// voice agent, AI prompt, document templates) instead of a hard-coded set.
import { useEffect, useState } from "react";
import { apiPost } from "./api-client";

export async function getTenantPlaceholders(): Promise<string[]> {
  const res = await apiPost<{ placeholders?: string[] }>("/tenant/getTenantPlaceholders", {});
  return res?.placeholders ?? [];
}

/** The token a placeholder is written as inside a template. */
export function placeholderToken(name: string): string {
  return `{{${name}}}`;
}

// One request per page load, shared by every editor that mounts. A failed
// load is dropped from the cache so the next mount retries.
let cached: Promise<string[]> | null = null;

function loadPlaceholders(): Promise<string[]> {
  if (!cached) {
    cached = getTenantPlaceholders().catch((e) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}

/** Fields renamed or added in Settings → Data Fields should show up without a
 *  full reload, so callers can force a refetch. */
export function invalidatePlaceholders() {
  cached = null;
}

export function usePlaceholders(): {
  placeholders: string[] | null;
  error: string | null;
  reload: () => void;
} {
  const [placeholders, setPlaceholders] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadPlaceholders()
      .then((list) => !cancelled && setPlaceholders(list))
      .catch((e) => {
        if (cancelled) return;
        setPlaceholders([]);
        setError(e instanceof Error ? e.message : "Couldn't load variables.");
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return {
    placeholders,
    error,
    reload: () => {
      invalidatePlaceholders();
      setPlaceholders(null);
      setNonce((n) => n + 1);
    },
  };
}

/** Splices a token into a textarea/input value at its caret (or the end) and
 *  puts the caret after it. */
export function insertIntoField(
  el: HTMLTextAreaElement | HTMLInputElement | null,
  value: string,
  setValue: (next: string) => void,
  token: string,
) {
  if (!el) {
    setValue(value + token);
    return;
  }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  setValue(value.slice(0, start) + token + value.slice(end));
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + token.length;
    el.setSelectionRange(pos, pos);
  });
}
