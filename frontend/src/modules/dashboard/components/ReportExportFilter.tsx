import { useState, useEffect } from 'react';
import { CalendarDays, Download, FileSpreadsheet, FileText, Search } from 'lucide-react';
import { Button } from '../../../app/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '../../../app/components/ui/popover';
import { Calendar } from '../../../app/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../../../app/components/ui/dropdown-menu';
import type { DateRangeState } from '../hooks/useDashboardData';
import { toDateInputValue, getPresetDates } from '../utils';

const rangeOptions = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7days', label: '7 ngày' },
  { value: '30days', label: '30 ngày' },
];

function formatDisplayDate(isoValue: string): string {
  if (!isoValue) return '';
  const [y, m, d] = isoValue.split('-');
  return `${d}/${m}/${y}`;
}

interface DatePickerFieldProps {
  value: string;
  onChange: (date: Date) => void;
  placeholder?: string;
}

function DatePickerField({ value, onChange, placeholder = 'dd/mm/yyyy' }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const selectedDate = value ? new Date(value + 'T00:00:00') : undefined;
  const display = formatDisplayDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 h-7 px-2 w-[120px] rounded-md border border-input bg-input-background text-[11px] transition-colors outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${
            display ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          <CalendarDays className="size-3 shrink-0" />
          {display || placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate}
          onSelect={(day) => {
            if (day) {
              onChange(day);
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

interface ReportExportFilterProps {
  dateRange: DateRangeState;
  setChartRange: (preset: string) => void;
  setCustomDateRange: (from: Date, to: Date) => void;
  onExport: (format: 'xlsx' | 'pdf') => void;
}

export function ReportExportFilter({
  dateRange,
  setChartRange,
  setCustomDateRange,
  onExport,
}: ReportExportFilterProps) {
  const [localFrom, setLocalFrom] = useState('');
  const [localTo, setLocalTo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    const presetDates = getPresetDates(dateRange.preset);
    if (presetDates) {
      setLocalFrom(toDateInputValue(presetDates.from));
      setLocalTo(toDateInputValue(presetDates.to));
    } else if (dateRange.startDate && dateRange.endDate) {
      setLocalFrom(toDateInputValue(new Date(dateRange.startDate)));
      setLocalTo(toDateInputValue(new Date(dateRange.endDate)));
    }
  }, [dateRange.preset, dateRange.startDate, dateRange.endDate]);

  const handleApply = () => {
    if (!localFrom || !localTo) {
      setError('Vui lòng chọn đầy đủ ngày');
      return;
    }
    const from = new Date(localFrom + 'T00:00:00');
    const to = new Date(localTo + 'T00:00:00');
    if (from > to) {
      setError('Ngày bắt đầu không được sau ngày kết thúc');
      return;
    }
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 365) {
      setError('Khoảng thời gian tối đa là 365 ngày');
      return;
    }
    setError('');
    setCustomDateRange(from, to);
  };

  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      {/* Left: Custom date range */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Từ</span>
        <DatePickerField
          value={localFrom}
          onChange={(d) => { setLocalFrom(toDateInputValue(d)); setError(''); }}
        />
        <span className="text-[10px] text-muted-foreground">Đến</span>
        <DatePickerField
          value={localTo}
          onChange={(d) => { setLocalTo(toDateInputValue(d)); setError(''); }}
        />
        <Button size="sm" className="h-7 px-2" onClick={handleApply}>
          <Search className="size-3" />
          Lọc
        </Button>
        {error && (
          <span className="text-[10px] text-red-500 dark:text-red-400">{error}</span>
        )}
      </div>

      {/* Right: Quick filters + Export */}
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5 bg-muted p-0.5 rounded-md">
          {rangeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setChartRange(opt.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                dateRange.preset === opt.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-muted text-muted-foreground hover:text-foreground border border-border hover:border-border/80 transition-all">
              <Download className="size-3.5 shrink-0" />
              Xuất
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Xuất báo cáo</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onExport('xlsx')}>
              <FileSpreadsheet className="size-3.5 text-green-600 dark:text-green-400" />
              Xuất Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('pdf')}>
              <FileText className="size-3.5 text-red-600 dark:text-red-400" />
              Xuất PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
