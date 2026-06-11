export function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-7 bg-muted rounded w-32" />
          <div className="h-3 bg-muted rounded w-20" />
        </div>
        <div className="w-11 h-11 bg-muted rounded-xl" />
      </div>
    </div>
  );
}
