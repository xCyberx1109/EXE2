export function ChartRangeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = [
    { value: '7days', label: '7 ngày' },
    { value: '30days', label: '30 ngày' },
  ];
  return (
    <div className="flex gap-0.5 bg-muted p-0.5 rounded-md">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2 py-1 text-[10px] font-medium rounded-sm transition-all ${
            value === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
