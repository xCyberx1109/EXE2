import { CalendarDays } from 'lucide-react';
import { useDashboardDate } from '../context/DashboardDateContext';
import { Popover, PopoverTrigger, PopoverContent } from '../../../app/components/ui/popover';
import { Calendar } from '../../../app/components/ui/calendar';
import type { DatePreset } from '../types';

const presets: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7days', label: '7 ngày' },
  { value: '30days', label: '30 ngày' },
  { value: 'thismonth', label: 'Tháng này' },
  { value: '12months', label: '12 tháng' },
  { value: 'custom', label: 'Tùy chỉnh' },
];

export function GlobalDateFilter() {
  const { dateRange, setPreset, setCustomRange, rangeLabel } = useDashboardDate();

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5 bg-muted p-0.5 rounded-md">
        {presets.map((opt) => {
          if (opt.value === 'custom') {
            return (
              <Popover key="custom">
                <PopoverTrigger asChild>
                  <button
                    className={`px-2 py-1 text-[10px] font-medium rounded-sm transition-all whitespace-nowrap inline-flex items-center gap-1 ${
                      dateRange.preset === 'custom'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <CalendarDays className="size-3" />
                    {rangeLabel}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={
                      dateRange.from && dateRange.to
                        ? { from: dateRange.from, to: dateRange.to }
                        : undefined
                    }
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setCustomRange(range.from, range.to);
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            );
          }
          return (
            <button
              key={opt.value}
              onClick={() => setPreset(opt.value)}
              className={`px-2 py-1 text-[10px] font-medium rounded-sm transition-all whitespace-nowrap ${
                dateRange.preset === opt.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}