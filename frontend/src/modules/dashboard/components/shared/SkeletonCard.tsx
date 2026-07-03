export function SkeletonCard() {
  return (
    <div className="bg-card rounded-md border border-border p-3 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-muted rounded w-24" />
          <div className="h-5 bg-muted rounded w-32" />
          <div className="h-2 bg-muted rounded w-20" />
        </div>
        <div className="w-7 h-7 bg-muted rounded-md" />
      </div>
    </div>
  );
}
