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
          <div
            key={i}
            className="grid grid-cols-1 sm:grid-cols-[1.8fr_1fr_0.8fr_1fr_auto] gap-4 px-6 py-3.5 items-center"
          >
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

export function SettingsSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <>
      {/* Shortcuts */}
      <section className="px-6 lg:px-10 pt-6">
        <Skeleton className="h-3 w-20 mb-2" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-elegant">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-2.5 w-48" />
            </div>
          </div>
        </div>
      </section>

      {/* Tabs + active card */}
      <section className="px-6 lg:px-10 py-6">
        <div className="grid grid-cols-3 w-full max-w-3xl mb-5 gap-1 rounded-lg bg-muted/60 p-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 rounded-md" />
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-elegant">
          {/* Card header */}
          <div className="flex items-start gap-3 px-6 py-5 border-b border-border">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          {/* Field grid */}
          <div className="px-6 py-6">
            <div className="grid md:grid-cols-2 gap-5">
              {Array.from({ length: fields }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
            <div className="mt-6 pt-5 border-t border-border flex justify-end">
              <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
          </div>
        </div>
      </section>
    </>
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
