import { useState } from "react";
import { X, PauseCircle } from "lucide-react";
import type { EngagementChannel, EngagementDuration } from "@/lib/engagement-store";

export function StopEngagementDialog({
  open, onClose, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { reason: string; duration: EngagementDuration; channels: EngagementChannel[]; effectiveDate: string; note?: string }) => void;
}) {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<EngagementDuration>("temporary");
  const [channels, setChannels] = useState<EngagementChannel[]>(["all"]);
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  if (!open) return null;

  const toggleChannel = (c: EngagementChannel) => {
    setChannels((prev) => {
      if (c === "all") return prev.includes("all") ? [] : ["all"];
      const without = prev.filter((x) => x !== "all");
      return without.includes(c) ? without.filter((x) => x !== c) : [...without, c];
    });
  };

  const submit = () => {
    if (!reason.trim() || channels.length === 0) return;
    onConfirm({ reason: reason.trim(), duration, channels, effectiveDate, note: note.trim() || undefined });
    setReason(""); setChannels(["all"]); setNote("");
  };

  const channelOptions: { v: EngagementChannel; label: string }[] = [
    { v: "all", label: "All channels" },
    { v: "ai_calls", label: "AI calls" },
    { v: "sms", label: "SMS" },
    { v: "email", label: "Email" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-elegant w-full max-w-lg my-8">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2"><PauseCircle className="h-4 w-4 text-warning" /><div className="font-display font-bold text-sm">Stop engagement</div></div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Reason (required)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
              placeholder="e.g. Customer requested pause, hardship verified, legal hold"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Duration</label>
              <div className="mt-1 flex rounded-lg border border-border overflow-hidden text-xs">
                {(["temporary", "permanent"] as EngagementDuration[]).map((d) => (
                  <button key={d} onClick={() => setDuration(d)} className={`flex-1 px-3 py-2 capitalize ${duration === d ? "bg-tenant text-white" : "hover:bg-muted"}`}>{d}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Effective date</label>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Channels to stop</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {channelOptions.map((c) => (
                <button key={c.v} onClick={() => toggleChannel(c.v)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold ${channels.includes(c.v) ? "bg-tenant text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
          <button onClick={submit} disabled={!reason.trim() || channels.length === 0}
            className="px-3 py-1.5 rounded-lg bg-warning text-warning-foreground text-sm font-semibold disabled:opacity-50">Stop engagement</button>
        </div>
      </div>
    </div>
  );
}
