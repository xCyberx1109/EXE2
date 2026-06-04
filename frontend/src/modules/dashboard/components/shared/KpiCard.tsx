import { Link } from 'react-router';
import { TrendBadge } from './TrendBadge';

export function KpiCard({
  title, value, trend, icon: Icon, color, subtitle, href,
}: {
  title: string; value: string; trend?: number; icon: React.ComponentType<{ className?: string }>; color: string; subtitle?: string; href?: string;
}) {
  const content = (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all duration-200 group">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1.5 font-mono">{value}</p>
          {trend !== undefined && (
            <div className="mt-1.5">
              <TrendBadge value={trend} />
            </div>
          )}
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color} shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link to={href} className="block">{content}</Link>;
  }
  return content;
}
