import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react';
import type { DashboardDateRange, DatePreset } from '../types';

interface DashboardDateContextValue {
  dateRange: DashboardDateRange;
  setDateRange: (range: DashboardDateRange) => void;
  setPreset: (preset: DatePreset) => void;
  setCustomRange: (from: Date, to: Date) => void;
  apiParams: Record<string, string>;
  dateParams: { startDate?: string; endDate?: string };
  rangeLabel: string;
}

const DashboardDateContext = createContext<DashboardDateContextValue | null>(null);

function vietnamMidnight(date: Date): Date {
  const offset = 7 * 60 * 60 * 1000;
  const vietnamTime = new Date(date.getTime() + offset);
  const utcMidnight = new Date(Date.UTC(
    vietnamTime.getUTCFullYear(),
    vietnamTime.getUTCMonth(),
    vietnamTime.getUTCDate(),
  ));
  return new Date(utcMidnight.getTime() - offset);
}

function computeDateParams(range: DashboardDateRange): { startDate?: string; endDate?: string } {
  const now = new Date();
  let start: Date;

  switch (range.preset) {
    case 'today':
      start = vietnamMidnight(now);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    case '7days':
      start = vietnamMidnight(now);
      start.setDate(start.getDate() - 7);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    case '30days':
      start = vietnamMidnight(now);
      start.setDate(start.getDate() - 30);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    case 'thismonth': {
      const vnMidnight = vietnamMidnight(now);
      start = new Date(Date.UTC(vnMidnight.getUTCFullYear(), vnMidnight.getUTCMonth(), 1));
      start = new Date(start.getTime() - 7 * 60 * 60 * 1000);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    case '12months':
      start = vietnamMidnight(now);
      start.setMonth(start.getMonth() - 12);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    case 'custom':
      return {
        startDate: range.from?.toISOString(),
        endDate: range.to?.toISOString(),
      };
    default:
      return {};
  }
}

function computeApiParams(range: DashboardDateRange): Record<string, string> {
  switch (range.preset) {
    case 'today':
      return { chartRange: 'today' };
    case '7days':
      return { chartRange: '7days' };
    case '30days':
      return { chartRange: '30days' };
    case 'thismonth':
      return { chartRange: 'thismonth' };
    case '12months':
      return { chartRange: '12months' };
    case 'custom': {
      const params: Record<string, string> = {};
      if (range.from) params.startDate = range.from.toISOString();
      if (range.to) params.endDate = range.to.toISOString();
      return params;
    }
    default:
      return { chartRange: '7days' };
  }
}

function computeRangeLabel(range: DashboardDateRange): string {
  switch (range.preset) {
    case 'today': return 'Hôm nay';
    case '7days': return '7 ngày';
    case '30days': return '30 ngày';
    case 'thismonth': return 'Tháng này';
    case '12months': return '12 tháng';
    case 'custom':
      if (range.from && range.to) {
        const f = range.from.toLocaleDateString('vi-VN');
        const t = range.to.toLocaleDateString('vi-VN');
        return `${f} - ${t}`;
      }
      return 'Tùy chỉnh';
    default: return '';
  }
}

export function DashboardDateProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRange] = useState<DashboardDateRange>({ preset: '7days' });

  const setPreset = useCallback((preset: DatePreset) => {
    setDateRange({ preset });
  }, []);

  const setCustomRange = useCallback((from: Date, to: Date) => {
    setDateRange({ preset: 'custom', from, to });
  }, []);

  const apiParams = useMemo(() => computeApiParams(dateRange), [dateRange]);
  const dateParams = useMemo(() => computeDateParams(dateRange), [dateRange]);
  const rangeLabel = useMemo(() => computeRangeLabel(dateRange), [dateRange]);

  return (
    <DashboardDateContext.Provider value={{ dateRange, setDateRange, setPreset, setCustomRange, apiParams, dateParams, rangeLabel }}>
      {children}
    </DashboardDateContext.Provider>
  );
}

export function useDashboardDate(): DashboardDateContextValue {
  const ctx = useContext(DashboardDateContext);
  if (!ctx) throw new Error('useDashboardDate must be used within DashboardDateProvider');
  return ctx;
}