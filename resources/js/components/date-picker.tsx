import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { formatDay, MonthGrid, toIso } from '@/components/date-range-calendar';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * One day, past or future, shown as dd/mm/yyyy. The value is an ISO
 * yyyy-mm-dd string, or empty when no day is set.
 */
export function DatePicker({
    id,
    value,
    onChange,
    placeholder = 'dd/mm/yyyy',
}: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState(() => {
        const anchor = new Date(`${value || toIso(new Date())}T00:00`);

        return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    });
    const shift = (delta: number) =>
        setView(new Date(view.getFullYear(), view.getMonth() + delta, 1));
    const arrow =
        'absolute top-0 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    className={cn(
                        'w-full justify-between font-normal',
                        value
                            ? 'font-mono tabular-nums'
                            : 'text-muted-foreground',
                    )}
                >
                    {value ? formatDay(value) : placeholder}
                    <CalendarDays className="size-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 gap-0 p-4">
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => shift(-1)}
                        aria-label="Previous month"
                        className={cn(arrow, 'left-0')}
                    >
                        <ChevronLeft className="size-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => shift(1)}
                        aria-label="Next month"
                        className={cn(arrow, 'right-0')}
                    >
                        <ChevronRight className="size-3.5" />
                    </button>
                    <MonthGrid
                        year={view.getFullYear()}
                        month={view.getMonth()}
                        range={{ start: value, end: value }}
                        hovered={null}
                        today={toIso(new Date())}
                        onPick={(day) => {
                            onChange(day);
                            setOpen(false);
                        }}
                        onHover={() => {}}
                    />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                    <div className="flex gap-1">
                        <button
                            type="button"
                            onClick={() => shift(-12)}
                            className="rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                        >
                            −1 year
                        </button>
                        <button
                            type="button"
                            onClick={() => shift(12)}
                            className="rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                        >
                            +1 year
                        </button>
                    </div>
                    {value && (
                        <button
                            type="button"
                            onClick={() => {
                                onChange('');
                                setOpen(false);
                            }}
                            className="rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
