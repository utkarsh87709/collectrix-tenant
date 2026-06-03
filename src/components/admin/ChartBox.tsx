import { useEffect, useState } from "react";

/** Defer chart rendering to client-side after mount to avoid SSR -1 measurement. */
export function ChartBox({ height, children }: { height: number; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div style={{ width: "100%", height, minWidth: 0 }}>
      {mounted ? children : <div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />}
    </div>
  );
}
