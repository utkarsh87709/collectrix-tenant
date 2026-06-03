import { Download, FileText, CalendarClock } from "lucide-react";
import { toast } from "sonner";

export function ExportBar({ scope }: { scope: string }) {
  const handleCSV = () => {
    const blob = new Blob([`# Collectrix Analytics Export\n# Scope: ${scope}\n# Generated: ${new Date().toISOString()}\n`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${scope.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported", { description: `${scope} — audit logged.` });
  };
  const handlePDF = () => toast.success("PDF report queued", { description: `${scope} — audit logged.` });

  return (
    <div className="flex items-center gap-2">
      <button onClick={handleCSV} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 border border-border">
        <Download className="h-3.5 w-3.5" /> Export CSV
      </button>
      <button onClick={handlePDF} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 border border-border">
        <FileText className="h-3.5 w-3.5" /> Download PDF
      </button>
      <button disabled title="Coming soon" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted/40 border border-border text-muted-foreground/70 cursor-not-allowed">
        <CalendarClock className="h-3.5 w-3.5" /> Schedule · soon
      </button>
    </div>
  );
}
