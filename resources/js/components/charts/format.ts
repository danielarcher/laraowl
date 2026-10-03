import { format } from 'date-fns';
import { formatCompactNumber, formatMicroSeconds } from '@/lib/utils';

/**
 * A chart point as the server sends it: `t` is the slot's start in unix
 * seconds, so labels come out in the viewer's own time zone.
 */
export type SeriesPoint = { t: number; [key: string]: number | string | null };

/** Seconds between two points, or a minute when there is only one. */
export function slotOf(data: SeriesPoint[]): number {
    return data.length > 1 ? data[1].t - data[0].t : 60;
}

/** Axis label: clock time inside a day, the date once ticks are days apart. */
export function tickLabel(t: number, step: number, span: number): string {
    const date = new Date(t * 1000);

    // A day's window plus a point or two of overhang still reads as clock time.
    if (span <= 90_000) {
        return format(date, 'HH:mm');
    }

    return step >= 86_400 || (date.getHours() === 0 && date.getMinutes() === 0)
        ? format(date, 'dd/MM')
        : format(date, 'dd/MM HH:mm');
}

const STEPS = [
    300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400, 172800, 432000,
    604800,
];

/** Seconds since the epoch on the viewer's wall clock. */
const localSeconds = (t: number) =>
    t - new Date(t * 1000).getTimezoneOffset() * 60;

/** The label spacing that fits about `target` labels across the data. */
export function tickStep(
    data: SeriesPoint[],
    slot: number,
    target = 7.5,
): number {
    const span = data.length * slot;

    return (
        STEPS.find(
            (candidate) => candidate >= slot && span / candidate <= target,
        ) ?? STEPS[STEPS.length - 1]
    );
}

/**
 * The points that get an axis label: the first point of each round local
 * stretch (hour, six hours, day...). Slots that start on UTC hours never
 * hit a local midnight exactly, so a boundary counts once it is crossed.
 */
export function niceTicks(
    data: SeriesPoint[],
    slot: number,
    target = 7.5,
): number[] {
    if (data.length < 2) {
        return data.map((point) => point.t);
    }

    const step = tickStep(data, slot, target);
    const stretch = (t: number) => Math.floor(localSeconds(t) / step);

    return data
        .filter((point, index) =>
            index === 0
                ? localSeconds(point.t) % step === 0
                : stretch(point.t) !== stretch(data[index - 1].t),
        )
        .map((point) => point.t);
}

/** Tooltip title: the slot's whole range, dd/mm and 24h. */
export function rangeLabel(t: number, slot: number): string {
    const start = new Date(t * 1000);

    if (slot <= 60) {
        return format(start, 'dd/MM/yyyy HH:mm');
    }

    const end = new Date((t + slot) * 1000);

    return `${format(start, 'dd/MM/yyyy HH:mm')} – ${format(end, 'HH:mm')}`;
}

export const formatCount = (value: number) => formatCompactNumber(value);

/** Microseconds, trimmed for an axis: no decimals once past ten. */
export function formatDuration(value: number): string {
    const label = formatMicroSeconds(value);

    return label.replace(/^(\d{2,})\.\d/, '$1');
}

export function formatPercent(value: number, digits = 2): string {
    if (!Number.isFinite(value) || value === 0) {
        return '0%';
    }

    if (value < 0.0001) {
        return '<0.01%';
    }

    const fixed = (value * 100).toFixed(digits);

    return `${fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed}%`;
}

/** Distinct hues for series that are categories (one per app), not outcomes. */
export const categoryColors = [
    'oklch(0.746 0.16 232.661)',
    'oklch(0.714 0.203 305.504)',
    'oklch(0.765 0.177 163.223)',
    'oklch(0.828 0.189 84.429)',
    'oklch(0.712 0.194 13.428)',
    'oklch(0.789 0.154 211.53)',
    'oklch(0.768 0.233 130.85)',
    'oklch(0.667 0.295 322.15)',
];

/** Series colours, one meaning each, from the --series-* tokens. */
export const seriesColor = {
    ok: 'var(--series-ok)',
    warn: 'var(--series-warn)',
    error: 'var(--series-error)',
    avg: 'var(--series-avg)',
    p95: 'var(--series-p95)',
    good: 'var(--series-good)',
    muted: 'var(--series-muted)',
} as const;
