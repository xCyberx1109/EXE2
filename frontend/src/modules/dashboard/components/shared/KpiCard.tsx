import { Link } from 'react-router';
import { TrendBadge } from './TrendBadge';

export function KpiCard({
  title,
  value,
  trend,
  subtitle,
  href,
}: {
  title: string;
  value: string;
  trend?: number;
  subtitle?: string;
  href?: string;
}) {
  const content = (
    <div className="bg-card rounded-md border border-border p-1 hover:shadow-md transition-all duration-200 group">
      <div className="flex flex-col gap-0.5">
        <p className="text-[11px] font-medium text-muted-foreground truncate leading-tight">
          {title}
        </p>

        <p className="text-lg font-bold text-foreground font-mono leading-tight tracking-tight">
          {value}
        </p>

        {trend !== undefined && (
          <div className="flex items-center">
            <TrendBadge value={trend} />
          </div>
        )}

        {subtitle && (
          <p className="text-[10px] text-muted-foreground truncate leading-tight">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );

  return href ? (
    <Link to={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}