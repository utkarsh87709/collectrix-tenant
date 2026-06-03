import { Skeleton } from "@/components/ui/skeleton";

export function UsersTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden">
      <div className="hidden sm:grid grid-cols-[1.8fr_1fr_0.8fr_1fr_auto] gap-4 px-6 py-3 bg-muted/40">
        {["User", "Role", "Status", "Last login", ""].map((h, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1.8fr_1fr_0.8fr_1fr_auto] gap-4 px-6 py-3.5 items-center">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-2.5 w-40" />
              </div>
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-24" />
            <div className="flex justify-end gap-2">
              <Skeleton className="h-7 w-20 rounded-md" />
              <Skeleton className="h-7 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RolesGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-elegant">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-10 rounded-md" />
          </div>
          <div className="mt-5 flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}
