import { usePage, router } from '@inertiajs/react';
import { Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

export const filters = [
    { label: '1H', value: '1h' },
    { label: '24H', value: '24h' },
    { label: '7D', value: '7d' },
    { label: '14D', value: '14d' },
    { label: '30D', value: '30d' },
];

export function TimeFilter() {
    const { props }: any = usePage();
    const period = props.period || '24h';
    const selected = filters.find((f) => f.value === period) || {
        label: 'Custom',
        value: 'custom',
    };
    const isCustom = period === 'custom';

    const [fromDate, setFromDate] = useState(props.from || '');
    const [toDate, setToDate] = useState(props.to || '');

    const handleFilterChange = (filter: any) => {
        const searchParams = new URLSearchParams(window.location.search);
        searchParams.set('period', filter.value);
        searchParams.delete('from');
        searchParams.delete('to');

        router.visit(window.location.pathname + '?' + searchParams.toString(), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const handleCustomSubmit = () => {
        if (!fromDate || !toDate) {
            return;
        }

        const searchParams = new URLSearchParams(window.location.search);
        searchParams.set('period', 'custom');
        searchParams.set('from', fromDate);
        searchParams.set('to', toDate);

        router.visit(window.location.pathname + '?' + searchParams.toString(), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    return (
        <div className="flex items-center gap-2">
            {/* Desktop Preset Filters */}
            <div className="hidden rounded-md border border-border bg-muted p-1 backdrop-blur-sm lg:flex">
                {filters.map((filter) => (
                    <Button
                        key={filter.value}
                        variant={
                            selected.value === filter.value
                                ? 'secondary'
                                : 'ghost'
                        }
                        size="sm"
                        className={`h-7 px-3 text-[10px] font-bold tracking-tight uppercase ${selected.value === filter.value ? 'bg-primary text-primary-foreground shadow-lg hover:bg-primary/90' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => handleFilterChange(filter)}
                    >
                        {filter.label}
                    </Button>
                ))}
            </div>

            {/* Mobile/Small Screen Preset Dropdown */}
            <div className="lg:hidden">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2 border-border bg-muted px-3 text-[10px] font-bold tracking-tight uppercase"
                        >
                            <span>{selected.label}</span>
                            <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="min-w-[100px] border-border bg-background"
                        align="end"
                    >
                        {filters.map((filter) => (
                            <DropdownMenuItem
                                key={filter.value}
                                className={`text-[10px] font-bold tracking-tight uppercase ${selected.value === filter.value ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                                onClick={() => handleFilterChange(filter)}
                            >
                                <div className="flex w-full items-center justify-between">
                                    {filter.label}
                                    {selected.value === filter.value && (
                                        <Check className="h-3 w-3" />
                                    )}
                                </div>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Custom Range Button */}
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={isCustom ? 'secondary' : 'outline'}
                        size="sm"
                        className={`h-8 gap-2 border-border bg-muted px-3 text-foreground hover:bg-primary/10 md:h-9 md:px-4 ${isCustom ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500' : ''}`}
                    >
                        <CalendarIcon className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold tracking-tight uppercase md:text-[11px]">
                            <span className="hidden sm:inline">
                                {isCustom ? 'Custom Range' : 'Custom'}
                            </span>
                            <span className="sm:hidden">
                                {isCustom ? 'Range' : ''}
                            </span>
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[280px] border border-border bg-background p-4 shadow-2xl backdrop-blur-xl sm:w-80 sm:p-5"
                    align="end"
                >
                    <div className="space-y-4 sm:space-y-5">
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
                                Time Range Selection
                            </h4>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-semibold tracking-tight text-muted-foreground uppercase">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={fromDate}
                                        onChange={(e) =>
                                            setFromDate(e.target.value)
                                        }
                                        className="w-full rounded-md border border-border bg-muted p-2 text-xs text-foreground focus:ring-1 focus:ring-primary/30 focus:outline-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-semibold tracking-tight text-muted-foreground uppercase">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        value={toDate}
                                        onChange={(e) =>
                                            setToDate(e.target.value)
                                        }
                                        className="w-full rounded-md border border-border bg-muted p-2 text-xs text-foreground focus:ring-1 focus:ring-primary/30 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <Button
                            className="h-9 w-full bg-primary text-[10px] font-semibold tracking-widest text-primary-foreground uppercase transition-all hover:bg-primary/90 sm:h-10 sm:text-[11px]"
                            onClick={handleCustomSubmit}
                        >
                            Apply Filter
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
