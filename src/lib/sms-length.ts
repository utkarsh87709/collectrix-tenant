// SMS length estimate for every screen where an SMS is written (Template
// Library, a customer's SMS tab, the Inbound Inbox reply box). Each segment of
// a message is sent — and charged — as its own text, so those screens show the
// character count, the estimated segments and the encoding, and warn past one
// segment. The warning never blocks saving or sending.
//
// Segment rules (GSM 03.38, as carriers and Twilio apply them):
//   • GSM-7: 160 units in one segment, 153 per segment when split. Characters
//     from the extension table (^ { } [ ] ~ \ | € and form feed) take 2 units.
//   • Any character outside the GSM-7 set makes the whole message Unicode
//     (UCS-2): 70 units in one segment, 67 per segment when split. Units are
//     UTF-16 code units, so most emoji take 2.
//   • A character is never split across two segments.

export type SmsEncoding = "GSM-7" | "Unicode";

export const SMS_LIMITS: Record<SmsEncoding, { single: number; perSegment: number }> = {
  "GSM-7": { single: 160, perSegment: 153 },
  Unicode: { single: 70, perSegment: 67 },
};

const GSM_BASIC = new Set(
  Array.from(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
      "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
  ),
);
const GSM_EXTENDED = new Set(Array.from("\f^{}\\[~]|€"));

const TOKEN = /\{\{([^{}]+)\}\}/g;

// A {{variable}} is counted at a typical length of the customer value it
// becomes, not the length of its token. Placeholders include each tenant's
// custom fields, so they're matched by keywords in the field name; the first
// match wins and anything unrecognised gets DEFAULT_SAMPLE_LENGTH. Values are
// assumed to be GSM-7 text.
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

export type SmsEstimate = {
  /** Characters once variables are filled in at their typical length. */
  characters: number;
  /** 0 for an empty message. */
  segments: number;
  encoding: SmsEncoding;
};

export function estimateSms(text: string): SmsEstimate {
  const chars = Array.from(
    text.replace(TOKEN, (_, name: string) => "x".repeat(sampleLength(name.trim()))),
  );
  const encoding: SmsEncoding = chars.every((c) => GSM_BASIC.has(c) || GSM_EXTENDED.has(c))
    ? "GSM-7"
    : "Unicode";
  const units = (c: string) => (encoding === "GSM-7" ? (GSM_EXTENDED.has(c) ? 2 : 1) : c.length);

  const { single, perSegment } = SMS_LIMITS[encoding];
  const total = chars.reduce((n, c) => n + units(c), 0);
  let segments = total === 0 ? 0 : 1;
  if (total > single) {
    let used = 0;
    for (const c of chars) {
      if (used + units(c) > perSegment) {
        segments += 1;
        used = 0;
      }
      used += units(c);
    }
  }
  return { characters: chars.length, segments, encoding };
}

export function hasSmsVariables(text: string): boolean {
  return /\{\{[^{}]+\}\}/.test(text);
}
