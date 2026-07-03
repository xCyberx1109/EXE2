import { BarChart3 } from 'lucide-react';

export function EmptyState({ message, icon: Icon }: { message: string; icon?: React.ComponentType<{ className?: string }> }) {
  const I = Icon || BarChart3;
  return (
    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
      <I className="size-6 mb-2 opacity-50" />
      <p className="text-xs">{message}</p>
    </div>
  );
}
