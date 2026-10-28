import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SMS_SINGLE_LIMIT, hasSmsVariables, smsLength } from "@/lib/sms-length";

/** "142 / 160" — turns the warning colour once the message won't fit in one SMS. */
export function SmsCount({ text, className }: { text: string; className?: string }) {
  const length = smsLength(text);
  const over = length > SMS_SINGLE_LIMIT;
  return (
    <span
      className={cn(
        "tabular-nums",
        over ? "font-semibold text-warning" : "text-muted-foreground",
        className,
      )}
      title={
        hasSmsVariables(text)
          ? "Variables are counted at a typical length; the real count depends on each customer's values."
          : undefined
      }
    >
      {hasSmsVariables(text) && "≈ "}
      {length} / {SMS_SINGLE_LIMIT}
    </span>
  );
}

/** Shown only past the limit. Informational — it never blocks saving or sending. */
export function SmsOverLimitWarning({ text, className }: { text: string; className?: string }) {
  if (smsLength(text) <= SMS_SINGLE_LIMIT) return null;
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
        Over {SMS_SINGLE_LIMIT} characters — this will be sent as more than one SMS and may cost
        more.
      </span>
    </div>
  );
}
