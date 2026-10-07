import { FileText } from "lucide-react";

/** "…/1/167/Legal%20notice_5.pdf" → "Legal notice_5.pdf". */
function attachmentFileName(url: string): string {
  const last = url.split("?")[0].split("/").filter(Boolean).pop() ?? url;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/**
 * Documents sent with an email (getCustomerEmail's documentAttachmentList),
 * as chips that open the file in a new tab. `onTint` is for the coloured
 * outgoing bubble.
 */
export function AttachmentList({
  urls,
  onTint = false,
}: {
  urls: string[] | null | undefined;
  onTint?: boolean;
}) {
  if (!urls || urls.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {urls.map((url) => {
        const name = attachmentFileName(url);
        return (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={name}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
              onTint
                ? "border-white/30 bg-white/15 text-white hover:bg-white/25"
                : "border-border bg-muted/50 text-foreground hover:bg-muted"
            }`}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{name}</span>
          </a>
        );
      })}
    </div>
  );
}
