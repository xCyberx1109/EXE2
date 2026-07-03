export function QuickStatCard({ icon: Icon, label, value, color, bg }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="flex items-center gap-1.5">
        <div className={`p-2 rounded-md ${bg} ${color}`}>
          <Icon className="size-[18px]" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xs font-bold text-foreground font-mono mt-0.5">{value}</p>
      </div>
    </div>
  );
}
