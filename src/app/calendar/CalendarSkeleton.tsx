/**
 * CALENDAR SKELETON
 * Loading placeholder while the calendar component loads.
 */
export function CalendarSkeleton() {
  return (
    <div className="h-screen flex flex-col p-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-muted rounded animate-pulse" />
          <div className="h-10 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>

      {/* Calendar grid skeleton */}
      <div className="flex-1 grid grid-cols-7 gap-1">
        {/* Day headers */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`header-${i}`} className="h-8 bg-muted/50 rounded animate-pulse" />
        ))}

        {/* Calendar cells */}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={`cell-${i}`} className="h-24 bg-muted/30 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
