import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export type DateRange = { start: string; end: string };

const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** A local (year, monthIndex, day) as an ISO yyyy-mm-dd string. */
export function isoDate(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function toIso(date: Date): string {
    return isoDate(date.getFullYear(), date.getMonth(), date.getDate());
}

/** yyyy-mm-dd → dd/mm/yyyy. */
export function formatDay(iso: string): string {
    const [year, month, day] = iso.slice(0, 10).split('-');

    return `${day}/${month}/${year}`;
}

/**
 * The day cells for one month, padded with nulls so the first row starts on
 * Monday. ISO strings sort lexicographically, so range checks are plain
 * string comparisons.
 */
function monthDays(year: number, month: number): (string | null)[] {
    const lead = (new Date(year, month, 1).getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();

    return [
        ...Array.from({ length: lead }, () => null),
        ...Array.from({ length: count }, (_, i) => isoDate(year, month, i + 1)),
    ];
}

function MonthGrid({
    year,
    month,
    range,
    hovered,
    today,
    onPick,
    onHover,
}: {
    year: number;
    month: number;
    range: DateRange;
    hovered: string | null;
    today: string;
    onPick: (date: string) => void;
    onHover: (date: string | null) => void;
}) {
    const days = useMemo(() => monthDays(year, month), [year, month]);

    // While picking the end, preview the span up to the hovered day.
    const end =
        range.start && !range.end && hovered && hovered >= range.start
            ? hovered
            : range.end;

    return (
        <div className="w-full">
            <p className="mb-2 text-center text-xs font-medium text-foreground">
                {MONTHS[month]} {year}
            </p>
            <div className="grid grid-cols-7 text-center">
                {WEEKDAYS.map((weekday) => (
                    <span
                        key={weekday}
                        className="pb-1.5 text-[10px] font-medium text-muted-foreground"
                    >
                        {weekday}
                    </span>
                ))}
                {days.map((day, i) => {
                    if (day === null) {
                        return <span key={`pad-${i}`} />;
                    }

                    const future = day > today;
                    const isStart = day === range.start;
                    const isEnd = day === end;
                    const between =
                        range.start && end && day > range.start && day < end;

                    return (
                        <button
                            key={day}
                            type="button"
                            aria-label={formatDay(day)}
                            aria-pressed={isStart || day === range.end}
                            disabled={future}
                            onClick={() => onPick(day)}
                            onMouseEnter={() => onHover(day)}
                            onMouseLeave={() => onHover(null)}
                            className={cn(
                                'relative flex h-8 items-center justify-center font-mono text-[11px] tabular-nums transition-colors duration-150',
                                (isStart || isEnd) &&
                                    'z-10 rounded-sm bg-foreground font-semibold text-background',
                                between && 'bg-foreground/10 text-foreground',
                                !isStart &&
                                    !isEnd &&
                                    !between &&
                                    !future &&
                                    'rounded-sm text-muted-foreground hover:bg-foreground/10 hover:text-foreground',
                                future && 'text-muted-foreground/30',
                                day === today &&
                                    !isStart &&
                                    !isEnd &&
                                    'font-semibold text-foreground underline decoration-series-avg underline-offset-4',
                            )}
                        >
                            {Number(day.slice(8))}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Flight-booking style range picker: two months side by side, the first
 * click sets the start and the second the end (a click before the start
 * starts over), with the span previewed while hovering.
 */
export function DateRangeCalendar({
    start,
    end,
    onChange,
}: {
    start: string;
    end: string;
    onChange: (range: DateRange) => void;
}) {
    const today = toIso(new Date());
    // Show the month before the range's end too, so a recent range sits on
    // the right with the month before it on the left.
    const [view, setView] = useState(() => {
        const anchor = new Date(
            `${(end || start || today).slice(0, 10)}T00:00`,
        );

        return new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
    });
    const [hovered, setHovered] = useState<string | null>(null);
    const next = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    const range = { start, end };

    function pick(day: string) {
        if (!start || end || day < start) {
            onChange({ start: day, end: '' });

            return;
        }

        onChange({ start, end: day });
    }

    const shift = (delta: number) =>
        setView(new Date(view.getFullYear(), view.getMonth() + delta, 1));
    const arrow =
        'absolute top-0 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent';

    return (
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
                disabled={
                    toIso(
                        new Date(next.getFullYear(), next.getMonth() + 1, 1),
                    ) > today
                }
                className={cn(arrow, 'right-0')}
            >
                <ChevronRight className="size-3.5" />
            </button>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="hidden sm:block">
                    <MonthGrid
                        year={view.getFullYear()}
                        month={view.getMonth()}
                        range={range}
                        hovered={hovered}
                        today={today}
                        onPick={pick}
                        onHover={setHovered}
                    />
                </div>
                <MonthGrid
                    year={next.getFullYear()}
                    month={next.getMonth()}
                    range={range}
                    hovered={hovered}
                    today={today}
                    onPick={pick}
                    onHover={setHovered}
                />
            </div>
        </div>
    );
}
