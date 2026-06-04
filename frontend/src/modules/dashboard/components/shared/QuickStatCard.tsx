export function QuickStatCard({ icon: Icon, label, value, color, bg }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-xl ${bg} ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900 font-mono mt-0.5">{value}</p>
      </div>
    </div>
  );
}
