import type { NoteVisibility } from "@/lib/notes-mock";
import { Eye, Lock } from "lucide-react";

export function VisibilityBadge({ visibility }: { visibility: NoteVisibility }) {
  if (visibility === "internal") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-destructive/15 text-destructive">
        <Lock className="h-3 w-3" /> Internal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-success/15 text-success">
      <Eye className="h-3 w-3" /> Creditor visible
    </span>
  );
}
