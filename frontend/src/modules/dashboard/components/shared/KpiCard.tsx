import { Link } from 'react-router';
import { TrendBadge } from './TrendBadge';

export function KpiCard({
  title,
  value,
  trend,
  icon: Icon,
  color,
  subtitle,
  href,
}: {
  title: string;
  value: string;
  trend?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  subtitle?: string;
  href?: string;
}) {
  const content = (
    <div className="bg-card rounded-md border border-border p-1.5 hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground truncate">
            {title}
          </p>

          <p className="mt-0.5 text-sm font-bold text-foreground font-mono leading-none">
            {value}
          </p>

          {trend !== undefined && (
            <div className="mt-0.5">
              <TrendBadge value={trend} />
            </div>
          )}

          {subtitle && (
            <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
              {subtitle}
            </p>
          )}
        </div>

        <div className={`p-0.5 rounded-md ${color} shrink-0`}>
          <Icon className="size-3" />
        </div>
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