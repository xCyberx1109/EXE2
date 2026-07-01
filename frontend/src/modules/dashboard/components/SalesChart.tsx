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

export function SalesChart({ data, chartRange }: { data: RevenueChartPoint[]; chartRange: string }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const chartColors = { revenue: '#3b82f6', profit: '#10b981' };
  const gridStroke = isDark ? '#374151' : '#f0f0f0';
  const tickFill = isDark ? '#9ca3af' : '#9ca3af';
  const tooltipBg = isDark ? '#1f2937' : '#ffffff';
  const tooltipBorder = isDark ? '#374151' : '#e5e7eb';

  if (!Array.isArray(data) || data.length === 0) {
    return <EmptyState message="Không có dữ liệu doanh thu" icon={BarChart3} />;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: tickFill }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => {
              if (chartRange === '12months') {
                const parts = v.split('-');
                return `T${parseInt(parts[1])}`;
              }
              return v.slice(5);
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: tickFill }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
          />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: `1px solid ${tooltipBorder}`, fontSize: '12px', backgroundColor: tooltipBg, color: isDark ? '#f3f4f6' : undefined }}
            formatter={(value: number, name: string) => [formatVND(value), name === 'revenue' ? 'Doanh thu' : 'Lợi nhuận']}
            labelFormatter={(label) => label}
          />
          <Bar dataKey="revenue" fill={chartColors.revenue} radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="profit" fill={chartColors.profit} radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
