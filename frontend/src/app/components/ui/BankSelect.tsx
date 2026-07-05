import { useMemo, useState } from 'react';
import { Building2, Check, ChevronDown, X } from 'lucide-react';
import { BANKS, type BankOption } from '../../../data/banks';
import { cn } from './utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';

interface BankSelectProps {
  value: BankOption | null;
  onChange: (bank: BankOption | null) => void;
  disabled?: boolean;
  error?: boolean;
}

export function BankSelect({ value, onChange, disabled, error }: BankSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedName = value ? value.shortName : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-between rounded-[10px] border px-3 py-2.5 text-sm transition-colors duration-200',
            error
              ? 'border-destructive'
              : 'border-[#3a3a40] hover:border-[#52525b]',
            'bg-[#202024] text-white disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="size-4 shrink-0 text-[#8d8d95]" />
            {value ? (
              <span className="truncate">{selectedName}</span>
            ) : (
              <span className="text-[#8d8d95]">Chọn ngân hàng</span>
            )}
          </div>
          <ChevronDown className={cn('size-4 shrink-0 text-[#8d8d95] transition-transform duration-200', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-[#18181b] border border-[#2b2b31] rounded-[10px] shadow-[0_10px_30px_rgba(0,0,0,.35)]"
      >
        <Command>
          <CommandInput
            placeholder="Tìm ngân hàng..."
            className="text-white placeholder-[#8d8d95]"
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty className="py-6 text-center text-sm text-[#8d8d95]">
              Không tìm thấy ngân hàng
            </CommandEmpty>
            <CommandGroup>
              {BANKS.map((bank) => (
                <CommandItem
                  key={bank.code}
                  value={`${bank.shortName} ${bank.name} ${bank.code}`}
                  onSelect={() => {
                    onChange(bank);
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm text-white data-[selected=true]:bg-[#2563eb]/20 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Building2 className="size-4 shrink-0 text-[#8d8d95]" />
                    <div className="min-w-0">
                      <div className="truncate text-white font-medium">{bank.shortName}</div>
                      <div className="truncate text-[11px] text-[#8d8d95]">{bank.name}</div>
                    </div>
                  </div>
                  {value?.code === bank.code && (
                    <Check className="size-4 shrink-0 text-[#4f8cff]" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {value && (
          <div className="border-t border-[#2b2b31] p-1">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[#8d8d95] hover:bg-[#202024] transition-colors"
            >
              <X className="size-4" />
              Bỏ chọn
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
