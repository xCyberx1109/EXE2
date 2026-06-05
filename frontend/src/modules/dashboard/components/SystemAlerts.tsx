import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router';
import { SectionHeader, EmptyState } from './shared';
import { APP_NAME } from '../../../shared/constants';
import type { SystemAlert } from '../types';

const SEVERITY_CONFIG = {
  critical: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Nghiêm trọng' },
  warning: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', label: 'Cảnh báo' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', label: 'Thông tin' },
  resolved: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-200', label: 'Đã xử lý' },
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function SystemAlerts({ alerts, criticalCount, warningCount, loading }: {
  alerts: SystemAlert[];
  criticalCount: number;
  warningCount: number;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-32 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const urgentCount = criticalCount + warningCount;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <SectionHeader
        title={`${APP_NAME}${urgentCount > 0 ? ` (${urgentCount})` : ''}`}
        actionLabel={urgentCount > 0 ? 'Xem chi tiết' : undefined}
        actionHref={urgentCount > 0 ? '#' : undefined}
      />
      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const config = SEVERITY_CONFIG[alert.severity];
            const Icon = config.icon;
            return (
              <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg border ${config.bg}`}>
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                    {alert.severity !== 'resolved' && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.color} ${config.bg}`}>
                        {config.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{alert.module}</span>
                    <span className="text-xs text-gray-300">•</span>
                    <span className="text-xs text-gray-400">{formatTime(alert.timestamp)}</span>
                  </div>
                </div>
                {alert.actionLabel && alert.actionHref && (
                  <Link to={alert.actionHref} className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0 mt-1">
                    {alert.actionLabel}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState message={`${APP_NAME} hoạt động bình thường`} icon={CheckCircle} />
      )}
    </div>
  );
}
