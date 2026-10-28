// SMS length estimate for every screen where an SMS is written (Template
// Library, a customer's SMS tab, the Inbound Inbox reply box). A message over
// the single-SMS limit is sent — and charged — as more than one text, so those
// screens show the count against the limit and warn past it. The warning never
// blocks saving or sending.
//
// The limit is flat: no separate limit for accented characters or emoji
// (product, 2026-10-28). Whether it becomes a tenant setting is with backend.

/** Characters that fit in one SMS (US/Canada). */
export const SMS_SINGLE_LIMIT = 160;

const TOKEN = /\{\{([^{}]+)\}\}/g;

// A {{variable}} is counted at a typical length of the customer value it
// becomes, not the length of its token. Placeholders include each tenant's
// custom fields, so they're matched by keywords in the field name; the first
// match wins and anything unrecognised gets DEFAULT_SAMPLE_LENGTH.
const SAMPLE_LENGTHS: [RegExp, number][] = [
  [/first name/i, 7], // Michael
  [/middle name/i, 5],
  [/last name/i, 8], // Thompson
  [/(creditor|client).*name|creditor$/i, 20], // Royal Bank of Canada
  [/email/i, 24],
  [/phone|mobile/i, 12], // 416-555-0182
  [/date|birth/i, 10], // 28/10/2026
  [/balance|amount|payment|paid|due/i, 9], // $1,234.56
  [/address/i, 24],
  [/city/i, 9],
  [/postal|zip/i, 7],
  [/province|state/i, 2],
  [/name/i, 16], // Michael Thompson
  [/number|\bno\b|#|\bid\b/i, 10],
];
const DEFAULT_SAMPLE_LENGTH = 10;

function sampleLength(field: string): number {
  return SAMPLE_LENGTHS.find(([re]) => re.test(field))?.[1] ?? DEFAULT_SAMPLE_LENGTH;
}

/** Estimated characters once variables are filled in. */
export function smsLength(text: string): number {
  let variables = 0;
  const rest = text.replace(TOKEN, (_, name: string) => {
    variables += sampleLength(name.trim());
    return "";
  });
  return Array.from(rest).length + variables;
}

export function hasSmsVariables(text: string): boolean {
  return /\{\{[^{}]+\}\}/.test(text);
}
