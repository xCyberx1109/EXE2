import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { EmptyState } from './shared';
import type { RevenueChartPoint } from '../../app/types';

const formatVND = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₫`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K ₫`;
  return `${n} ₫`;
};

const formatDateLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

function buildHourlyTimeline(apiData: RevenueChartPoint[]): RevenueChartPoint[] {
  const hours = Array.from({ length: 24 }, (_, i) =>
    `${String(i).padStart(2, '0')}:00`,
  );
  const lookup = new Map<string, RevenueChartPoint>();
  for (const point of apiData) {
    const cost = point.cost ?? point.revenue - point.profit;
    lookup.set(point.date, { ...point, cost });
  }
  return hours.map((hour) =>
    lookup.get(hour) ?? { date: hour, revenue: 0, cost: 0, profit: 0, orderCount: 0 },
  );
}

export function SalesChart({ data, chartRange, chartType = 'daily', startDate, endDate }: { data: RevenueChartPoint[]; chartRange: string; chartType?: 'hourly' | 'daily'; startDate?: string; endDate?: string }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const chartColors = { revenue: '#3b82f6', cost: '#F59E0B', profit: '#10b981' };
  const gridStroke = isDark ? '#374151' : '#f0f0f0';
  const tickFill = isDark ? '#9ca3af' : '#9ca3af';

  const chartData = useMemo(() => {
    if (chartType === 'hourly') return buildHourlyTimeline(data);
    return data;
  }, [data, chartType]);

  if (!Array.isArray(data) || data.length === 0) {
    if (chartData.every((p) => p.revenue === 0 && p.cost === 0 && p.profit === 0)) {
      return <EmptyState message="Không có dữ liệu doanh thu" icon={BarChart3} />;
    }
  }

  return (
    <div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: tickFill }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => chartType === 'hourly' ? v : formatDateLabel(v)}
              interval="preserveStartEnd"
              minTickGap={chartType === 'hourly' ? 0 : 40}
            />
            <YAxis
              tick={{ fontSize: 11, fill: tickFill }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                fontSize: '13px',
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                color: isDark ? '#f3f4f6' : '#111827',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                padding: '8px 12px',
              }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = { revenue: 'Doanh thu', cost: 'Vốn', profit: 'Lợi nhuận' };
                return [formatVND(value), labels[name] ?? name];
              }}
              labelFormatter={(label) => {
                if (chartType === 'hourly') return `Giờ ${label}`;
                const d = new Date(label);
                return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
              }}
              cursor={{ fill: isDark ? '#374151' : '#f3f4f6', opacity: 0.3 }}
            />
            <Bar dataKey="revenue" fill={chartColors.revenue} radius={[4, 4, 0, 0]} maxBarSize={chartType === 'hourly' ? 16 : 28} />
            <Bar dataKey="cost" fill={chartColors.cost} radius={[4, 4, 0, 0]} maxBarSize={chartType === 'hourly' ? 16 : 28} />
            <Bar dataKey="profit" fill={chartColors.profit} radius={[4, 4, 0, 0]} maxBarSize={chartType === 'hourly' ? 16 : 28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: chartColors.revenue }} />
          <span className="text-[11px] text-muted-foreground">Doanh thu</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: chartColors.cost }} />
          <span className="text-[11px] text-muted-foreground">Vốn</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: chartColors.profit }} />
          <span className="text-[11px] text-muted-foreground">Lợi nhuận</span>
        </div>
      </div>
    </div>
  );
}
