import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SMS_LIMITS, estimateSms, hasSmsVariables } from "@/lib/sms-length";

/** "113 characters · 1 estimated segment · GSM-7" — turns the warning colour
 *  once the message needs more than one segment. */
export function SmsCount({ text, className }: { text: string; className?: string }) {
  const { characters, segments, encoding } = estimateSms(text);
  const variables = hasSmsVariables(text);
  return (
    <span
      className={cn(
        "tabular-nums",
        segments > 1 ? "font-semibold text-warning" : "text-muted-foreground",
        className,
      )}
      title={
        variables
          ? "Variables are counted at a typical length; the real count depends on each customer's values."
          : undefined
      }
    >
      {variables && "≈ "}
      {characters} {characters === 1 ? "character" : "characters"} · {segments} estimated{" "}
      {segments === 1 ? "segment" : "segments"} · {encoding}
    </span>
  );
}

/** Shown only past one segment. Informational — it never blocks saving or sending. */
export function SmsOverLimitWarning({ text, className }: { text: string; className?: string }) {
  const { segments } = estimateSms(text);
  if (segments <= 1) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground",
        className,
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px text-warning" />
      <span>
        This message will be sent as {segments} SMS segments and charged as {segments} messages.
      </span>
    </div>
  );
}

/** How segments and billing work — shown under the SMS template editor. */
export function SmsSegmentNote({ className }: { className?: string }) {
  const gsm = SMS_LIMITS["GSM-7"];
  const unicode = SMS_LIMITS.Unicode;
  return (
    <div className={cn("space-y-1 text-[11px] text-muted-foreground", className)}>
      <p>
        SMS messages allow up to {gsm.single} GSM-7 characters in a single segment. Longer messages
        allow {gsm.perSegment} per segment. Unicode messages allow {unicode.single} in a single
        segment, or {unicode.perSegment} per segment for longer messages.
      </p>
      <p>
        <span className="font-semibold">Note:</span> Each SMS segment is billed separately. A
        message using 2 segments is charged as 2 messages; 3 segments is charged as 3. Some symbols
        count as two units, and emoji can use multiple units. Personalised field values can change
        the final segment count and charge.
      </p>
    </div>
  );
}
