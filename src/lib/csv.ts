// Tiny client-side CSV writer. No backend export endpoint exists for customer
// files, so screens export what they've already loaded rather than faking a
// call — used by the customer detail page's Export and the Archive tab's
// Export CSV.

/** Quote a cell only when it needs it (comma, quote or newline inside). */
export function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Header row + data rows → one CSV string (LF line endings, no trailing newline). */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, csv: string): void {
  downloadTextFile(filename, csv, "text/csv;charset=utf-8;");
}
