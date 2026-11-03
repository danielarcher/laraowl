import type { UptimeDay } from '@/lib/domains';
import { formatDay } from '@/lib/domains';
import { cn } from '@/lib/utils';

function cellTone(ratio: number | null): string {
    if (ratio === null) {
        return 'bg-foreground/[0.07]';
    }

    // A failed check or two a day is noise; about 7 minutes down is not.
    if (ratio >= 0.995) {
        return 'bg-emerald-500/85';
    }

    return ratio >= 0.95 ? 'bg-amber-500' : 'bg-red-500';
}

/**
 * Thirty days of uptime checks, one cell a day, status-page style.
 */
export function UptimeStrip({ days }: { days: UptimeDay[] }) {
    return (
        <div
            className="flex h-5 items-stretch gap-px"
            role="img"
            aria-label={`Uptime, last ${days.length} days`}
        >
            {days.map((day) => (
                <span
                    key={day.date}
                    data-ratio={day.ratio ?? ''}
                    title={
                        day.ratio === null
                            ? `${formatDay(day.date)} · no checks`
                            : `${formatDay(day.date)} · ${(day.ratio * 100).toFixed(2)}% up · ${day.ms ?? '—'} ms avg`
                    }
                    className={cn(
                        'min-w-[3px] flex-1 rounded-[1px]',
                        cellTone(day.ratio),
                    )}
                />
            ))}
        </div>
    );
}

/**
 * Daily average response time over the same thirty days.
 */
export function LatencySpark({
    days,
    width = 120,
    height = 18,
}: {
    days: UptimeDay[];
    width?: number;
    height?: number;
}) {
    const values = days.map((day) => day.ms);
    const known = values.filter((v): v is number => v !== null);

    if (known.length < 2) {
        return (
            <span className="text-[10px] text-foreground/30">no checks</span>
        );
    }

    const max = Math.max(...known);
    const min = Math.min(...known);
    const span = Math.max(1, max - min);
    const step = width / (values.length - 1);
    let path = '';
    let pen = false;

    values.forEach((value, index) => {
        if (value === null) {
            pen = false;

            return;
        }

        const x = index * step;
        const y = height - 2 - ((value - min) / span) * (height - 4);
        path += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
        pen = true;
    });

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="overflow-visible"
            role="img"
            aria-label={`Response time ${min}–${max} ms`}
        >
            <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.25}
                strokeLinejoin="round"
                className="text-foreground/50"
            />
        </svg>
    );
}
