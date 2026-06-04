export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-7 bg-gray-200 rounded w-32" />
          <div className="h-3 bg-gray-200 rounded w-20" />
        </div>
        <div className="w-11 h-11 bg-gray-200 rounded-xl" />
      </div>
    </div>
  );
}
