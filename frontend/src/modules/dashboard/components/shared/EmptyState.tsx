import { BarChart3 } from 'lucide-react';

export function EmptyState({ message, icon: Icon }: { message: string; icon?: React.ComponentType<{ className?: string }> }) {
  const I = Icon || BarChart3;
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <I className="w-10 h-10 mb-3 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
