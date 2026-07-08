export function SkeletonCard() {
  return (
    <div className="bg-card rounded-md border border-border p-1 animate-pulse">
      <div className="flex flex-col gap-1.5">
        <div className="h-3 bg-muted rounded w-24" />
        <div className="h-6 bg-muted rounded w-32" />
        <div className="h-2 bg-muted rounded w-20" />
      </div>
    </div>
  );
}
