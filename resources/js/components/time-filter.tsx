import { Link, router, usePage } from '@inertiajs/react';
import { Calendar as CalendarIcon, Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import {
    DateRangeCalendar,
    formatDay,
    toIso,
} from '@/components/date-range-calendar';
import type { DateRange } from '@/components/date-range-calendar';
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
import { cn } from '@/lib/utils';

export const filters = [
    { label: '1H', value: '1h' },
    { label: '24H', value: '24h' },
    { label: '7D', value: '7d' },
    { label: '14D', value: '14d' },
    { label: '30D', value: '30d' },
];

const visitOptions = {
    preserveState: true,
    preserveScroll: true,
    replace: true,
} as const;

/** The current URL with its period swapped. */
function periodUrl(url: string, period: string, range?: DateRange): string {
    const [path, query = ''] = url.split('?');
    const params = new URLSearchParams(query);
    params.set('period', period);
    params.delete('from');
    params.delete('to');

    if (range) {
        params.set('from', range.start);
        // The end day counts in full.
        params.set('to', `${range.end}T23:59:59`);
    }

    return `${path}?${params.toString()}`;
}

/** Quick ranges beside the calendar, as local dates. */
function presets(): Array<{ label: string; range: DateRange }> {
    const now = new Date();
    const day = (offset: number) =>
        toIso(
            new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset),
        );
    const weekday = (now.getDay() + 6) % 7;

    return [
        { label: 'Today', range: { start: day(0), end: day(0) } },
        { label: 'Yesterday', range: { start: day(-1), end: day(-1) } },
        { label: 'This week', range: { start: day(-weekday), end: day(0) } },
        {
            label: 'Last week',
            range: { start: day(-weekday - 7), end: day(-weekday - 1) },
        },
        {
            label: 'This month',
            range: { start: day(1 - now.getDate()), end: day(0) },
        },
        {
            label: 'Last month',
            range: {
                start: toIso(
                    new Date(now.getFullYear(), now.getMonth() - 1, 1),
                ),
                end: day(-now.getDate()),
            },
        },
    ];
}

function rangeLabel(from: string, to: string): string {
    const year = String(new Date().getFullYear());
    const sameYear = from.startsWith(year) && to.startsWith(year);
    const short = (iso: string) =>
        sameYear ? formatDay(iso).slice(0, 5) : formatDay(iso);

    return from.slice(0, 10) === to.slice(0, 10)
        ? short(from)
        : `${short(from)} – ${short(to)}`;
}

/**
 * The period presets as a segmented control whose marker slides to the
 * choice at once (before the page answers), with each preset prefetched on
 * hover so the switch usually lands from cache.
 */
function PeriodTabs({ period, url }: { period: string; url: string }) {
    const [chosen, setChosen] = useState<string | null>(null);
    const shown = chosen ?? period;
    const index = filters.findIndex((f) => f.value === shown);

    return (
        <div className="relative hidden h-8 items-center rounded-md border border-border bg-muted/50 p-0.5 lg:flex">
            <span
                aria-hidden
                className={cn(
                    'absolute inset-y-0.5 left-0.5 w-10 rounded-sm bg-background shadow-sm ring-1 ring-border transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none',
                    index < 0 && 'opacity-0',
                )}
                style={{
                    transform: `translateX(${Math.max(index, 0) * 100}%)`,
                }}
            />
            {filters.map((filter) => (
                <Link
                    key={filter.value}
                    href={periodUrl(url, filter.value)}
                    {...visitOptions}
                    prefetch
                    cacheFor="30s"
                    onClick={() => setChosen(filter.value)}
                    onFinish={() =>
                        setChosen((current) =>
                            current === filter.value ? null : current,
                        )
                    }
                    aria-current={shown === filter.value ? 'true' : undefined}
                    className={cn(
                        'relative z-10 flex h-full w-10 items-center justify-center text-[11px] font-medium tracking-tight transition-colors duration-200',
                        shown === filter.value
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {filter.label}
                </Link>
            ))}
        </div>
    );
}

export function TimeFilter() {
    const { props, url } = usePage<{
        period?: string;
        from?: string | null;
        to?: string | null;
    }>();
    const period = props.period || '24h';
    const isCustom = period === 'custom' && !!props.from && !!props.to;
    const selected = filters.find((f) => f.value === period);

    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<DateRange>({ start: '', end: '' });

    const openPicker = (next: boolean) => {
        if (next) {
            setDraft(
                isCustom
                    ? {
                          start: props.from!.slice(0, 10),
                          end: props.to!.slice(0, 10),
                      }
                    : { start: '', end: '' },
            );
        }

        setOpen(next);
    };

    const apply = (range: DateRange) => {
        setOpen(false);
        router.visit(periodUrl(url, 'custom', range), visitOptions);
    };

    return (
        <div className="flex items-center gap-2">
            <PeriodTabs period={period} url={url} />

            {/* Small screens: the presets in a menu. */}
            <div className="lg:hidden">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 px-2.5 text-[11px] font-medium"
                        >
                            {selected?.label ?? 'Custom'}
                            <ChevronDown className="size-3 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="min-w-[100px]" align="end">
                        {filters.map((filter) => (
                            <DropdownMenuItem
                                key={filter.value}
                                className="text-[11px] font-medium"
                                onClick={() =>
                                    router.visit(
                                        periodUrl(url, filter.value),
                                        visitOptions,
                                    )
                                }
                            >
                                <div className="flex w-full items-center justify-between">
                                    {filter.label}
                                    {period === filter.value && (
                                        <Check className="size-3" />
                                    )}
                                </div>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <Popover open={open} onOpenChange={openPicker}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                            'h-8 gap-1.5 px-2.5 text-[11px] font-medium',
                            isCustom
                                ? 'border-foreground/25 text-foreground'
                                : 'text-muted-foreground',
                        )}
                    >
                        <CalendarIcon className="size-3.5" />
                        {isCustom ? (
                            <span className="font-mono tabular-nums">
                                {rangeLabel(props.from!, props.to!)}
                            </span>
                        ) : (
                            <span className="hidden sm:inline">Custom</span>
                        )}
                        <ChevronDown className="size-3 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    align="end"
                    className="w-auto max-w-[calc(100vw-2rem)] gap-0 p-0"
                >
                    <div className="flex flex-col sm:flex-row">
                        <div className="flex flex-wrap gap-1 border-b border-border p-2 sm:w-32 sm:flex-col sm:flex-nowrap sm:border-r sm:border-b-0">
                            {presets().map((preset) => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => apply(preset.range)}
                                    className="rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                        <div className="p-4 sm:w-[480px]">
                            <DateRangeCalendar
                                start={draft.start}
                                end={draft.end}
                                onChange={setDraft}
                            />
                            <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-3">
                                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                                    {draft.start
                                        ? formatDay(draft.start)
                                        : 'dd/mm/yyyy'}
                                    {' – '}
                                    {draft.end
                                        ? formatDay(draft.end)
                                        : 'dd/mm/yyyy'}
                                </span>
                                <Button
                                    size="sm"
                                    className="h-7 px-3 text-xs"
                                    disabled={!draft.start || !draft.end}
                                    onClick={() => apply(draft)}
                                >
                                    Apply
                                </Button>
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
