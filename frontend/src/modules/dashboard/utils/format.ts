import type { RevenueChartPoint } from '../../../app/types';

export function formatVND(n: number): string {
  return n.toLocaleString('vi-VN') + ' ₫';
}

export function formatNumber(n: number): string {
  return n.toLocaleString('vi-VN');
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getPresetDates(preset: string): { from: Date; to: Date } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case '7days': {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from, to: today };
    }
    case '30days': {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from, to: today };
    }
    default:
      return null;
  }
}

export function buildContinuousTimeline(
  apiData: RevenueChartPoint[],
  startDate: string,
  endDate: string,
): RevenueChartPoint[] {
  const s = new Date(startDate + 'T00:00:00');
  const e = new Date(endDate + 'T00:00:00');
  const count = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;

  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(s.getTime() + i * 86400000);
    dates.push(toDateInputValue(d));
  }

  const lookup = new Map<string, RevenueChartPoint>();
  for (const point of apiData) {
    const cost = point.cost ?? point.revenue - point.profit;
    lookup.set(point.date, { ...point, cost });
  }

  return dates.map((date) =>
    lookup.get(date) ?? { date, revenue: 0, cost: 0, profit: 0, orderCount: 0 },
  );
}
