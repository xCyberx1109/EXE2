import { ArrowUp, ArrowDown } from 'lucide-react';

export function TrendBadge({ value, suffix = '%' }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const isUp = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {isUp ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}
