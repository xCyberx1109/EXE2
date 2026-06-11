export function ChartRangeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = [
    { value: '7days', label: '7 ngày' },
    { value: '30days', label: '30 ngày' },
    { value: '12months', label: '12 tháng' },
  ];
  return (
    <div className="flex gap-1 bg-muted p-0.5 rounded-lg">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            value === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
