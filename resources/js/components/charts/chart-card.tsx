import { Link } from '@inertiajs/react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { Swatch } from '@/components/charts/chart-tooltip';
import { cn } from '@/lib/utils';

/**
 * A titled panel for a chart: label and optional link on top, the headline
 * figure with its legend, then the chart edge to edge.
 */
export function ChartCard({
    title,
    href,
    linkLabel = 'View',
    value,
    delta,
    legend,
    children,
    className,
}: {
    title: string;
    href?: string;
    linkLabel?: string;
    value?: ReactNode;
    delta?: ReactNode;
    legend?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn(
                'flex flex-col rounded-lg border border-border bg-card transition-colors duration-200 hover:border-foreground/15',
                className,
            )}
        >
            <header className="flex items-start justify-between gap-4 px-4 pt-3.5">
                <div className="min-w-0">
                    <h3 className="text-xs font-medium text-muted-foreground">
                        {title}
                    </h3>
                    {value !== undefined && (
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                                <Ticker value={value} />
                            </span>
                            {delta}
                        </div>
                    )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                    {href && (
                        <Link
                            href={href}
                            className="group/link inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {linkLabel}
                            <ArrowRight className="size-3 transition-transform duration-200 group-hover/link:translate-x-0.5" />
                        </Link>
                    )}
                    {legend && (
                        <div className="flex flex-wrap justify-end gap-x-4 gap-y-1">
                            {legend}
                        </div>
                    )}
                </div>
            </header>
            <div className="flex-1 px-2 pt-3 pb-2">{children}</div>
        </section>
    );
}

/**
 * A figure that slides into place when it changes (a new period, a live
 * refresh), keyed on its formatted text.
 */
export function Ticker({ value }: { value: ReactNode }) {
    if (typeof value !== 'string' && typeof value !== 'number') {
        return <>{value}</>;
    }

    return (
        <span key={String(value)} className="value-in">
            {value}
        </span>
    );
}

/** A legend entry with the series' figure for the whole period. */
export function LegendItem({
    color,
    label,
    value,
    dashed,
    hidden = false,
    onToggle,
}: {
    color: string;
    label: string;
    value?: ReactNode;
    dashed?: boolean;
    /** Greys the entry out while its series is switched off. */
    hidden?: boolean;
    /** Makes the entry a button that switches its series (useHiddenSeries). */
    onToggle?: (event: MouseEvent) => void;
}) {
    const content = (
        <>
            <Swatch color={color} dashed={dashed} />
            <span
                className={cn(
                    'text-muted-foreground',
                    hidden && 'line-through decoration-muted-foreground/60',
                )}
            >
                {label}
            </span>
            {value !== undefined && (
                <span className="font-mono font-medium text-foreground tabular-nums">
                    {value}
                </span>
            )}
        </>
    );

    if (!onToggle) {
        return (
            <div className="flex items-center gap-1.5 text-[11px]">
                {content}
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={!hidden}
            title={`${hidden ? 'Show' : 'Hide'} ${label} · Alt-click to show only ${label}`}
            className={cn(
                '-mx-1 flex items-center gap-1.5 rounded-sm px-1 text-[11px] transition-[opacity,background-color] duration-150 hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                hidden && 'opacity-40 hover:opacity-70',
            )}
        >
            {content}
        </button>
    );
}

/** Brings back every series of a chart once any is switched off. */
export function ShowAllSeries({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
            Show all
        </button>
    );
}

/**
 * How a figure moved against the window before. `higherIsWorse` turns a
 * rise red (errors, latency); plain volume stays neutral either way.
 */
export function Delta({
    current,
    previous,
    higherIsWorse,
}: {
    current: number;
    previous: number | undefined | null;
    higherIsWorse?: boolean;
}) {
    if (previous === undefined || previous === null) {
        return null;
    }

    if (previous === 0) {
        return current === 0 ? null : (
            <span className="text-[11px] text-muted-foreground">new</span>
        );
    }

    const change = (current - previous) / previous;

    if (Math.abs(change) < 0.005) {
        return (
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                ±0%
            </span>
        );
    }

    const rising = change > 0;
    const tone =
        higherIsWorse === undefined
            ? 'text-muted-foreground'
            : rising === higherIsWorse
              ? 'text-series-error'
              : 'text-series-good';
    const Icon = rising ? ArrowUpRight : ArrowDownRight;
    const percent =
        Math.abs(change) >= 10 ? '>999' : Math.round(Math.abs(change) * 100);

    return (
        <span
            className={cn(
                'inline-flex items-center font-mono text-[11px] tabular-nums',
                tone,
            )}
            title="Against the same length of time just before"
        >
            <Icon className="size-3" />
            {percent}%
        </span>
    );
}

/** A tiny area under a KPI, no axes. */
export function Sparkline({
    data,
    dataKey,
    color,
    height = 28,
}: {
    data: Array<Record<string, number | string | null>>;
    dataKey: string;
    color: string;
    height?: number;
}) {
    const id = `spark-${dataKey}-${color.replace(/[^a-z0-9]/gi, '')}`;

    return (
        <div style={{ height }} className="chart-reveal w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
                >
                    <defs>
                        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                            <stop
                                offset="0%"
                                stopColor={color}
                                stopOpacity={0.25}
                            />
                            <stop
                                offset="100%"
                                stopColor={color}
                                stopOpacity={0}
                            />
                        </linearGradient>
                    </defs>
                    <YAxis hide domain={[0, 'dataMax']} />
                    <Area
                        dataKey={dataKey}
                        type="monotone"
                        stroke={color}
                        strokeWidth={1.25}
                        fill={`url(#${id})`}
                        dot={false}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

/** One cell of a KPI strip: label, figure, delta, sparkline. */
export function StatCell({
    label,
    value,
    delta,
    hint,
    tone,
    children,
}: {
    label: string;
    value: ReactNode;
    delta?: ReactNode;
    hint?: ReactNode;
    tone?: 'error' | 'warn';
    children?: ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="flex items-baseline gap-2">
                <span
                    className={cn(
                        'text-xl font-semibold tracking-tight tabular-nums',
                        tone === 'error' && 'text-series-error',
                        tone === 'warn' && 'text-series-warn',
                    )}
                >
                    <Ticker value={value} />
                </span>
                {delta}
            </div>
            {hint && (
                <div className="truncate text-[11px] text-muted-foreground">
                    {hint}
                </div>
            )}
            {children && <div className="mt-1">{children}</div>}
        </div>
    );
}
