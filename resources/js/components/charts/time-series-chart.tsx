import { useId } from 'react';
import {
    Area,
    Bar,
    CartesianGrid,
    ComposedChart,
    Line,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { ChartTooltipCard } from '@/components/charts/chart-tooltip';
import type { SeriesPoint } from '@/components/charts/format';
import {
    formatCount,
    niceTicks,
    tickStep,
    slotOf,
    tickLabel,
} from '@/components/charts/format';

export type ChartSeries = {
    key: string;
    name: string;
    color: string;
    kind: 'bar' | 'line' | 'area';
    /** Bars sharing a stack pile up; the last one gets the rounded top. */
    stack?: string;
    dashed?: boolean;
    format?: (value: number) => string;
};

type Props = {
    data: SeriesPoint[];
    series: ChartSeries[];
    height?: number;
    /** Formats the axis and, unless a series has its own, the tooltip. */
    format?: (value: number) => string;
    /** Charts with the same sync id share one crosshair. */
    syncId?: string;
    /** A row under the series in the tooltip, such as a total. */
    footer?: (
        point: SeriesPoint,
    ) => { name: string; value: string } | undefined;
    reference?: { value: number; label: string; color?: string };
    /** Hides the time axis for compact charts. */
    compact?: boolean;
    /** Lets the value axis tick between whole numbers (rates, ratios). */
    decimals?: boolean;
};

/**
 * Every time chart in the app: hairline grid, figures on the right, local
 * time along the bottom, one crosshair tooltip with all series.
 */
export function TimeSeriesChart({
    data,
    series,
    height = 200,
    format = formatCount,
    syncId,
    footer,
    reference,
    compact = false,
    decimals = false,
}: Props) {
    const gradientId = useId().replace(/:/g, '');
    const slot = slotOf(data);
    const span = data.length * slot;
    const ticks = niceTicks(data, slot);
    const step = tickStep(data, slot);
    const hasBars = series.some((s) => s.kind === 'bar');
    const lastInStack = new Map<string, string>();
    series.forEach((s) => s.stack && lastInStack.set(s.stack, s.key));

    return (
        <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                    data={data}
                    syncId={syncId}
                    margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                    barCategoryGap={data.length > 100 ? 1 : '18%'}
                >
                    <defs>
                        {series
                            .filter((s) => s.kind === 'area')
                            .map((s) => (
                                <linearGradient
                                    key={s.key}
                                    id={`${gradientId}-${s.key}`}
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="0%"
                                        stopColor={s.color}
                                        stopOpacity={0.28}
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor={s.color}
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            ))}
                    </defs>
                    <CartesianGrid
                        vertical={false}
                        stroke="var(--chart-grid)"
                    />
                    <XAxis
                        dataKey="t"
                        hide={compact}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--chart-grid)' }}
                        tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                        tickFormatter={(t: number) => tickLabel(t, step, span)}
                        ticks={ticks.length >= 2 ? ticks : undefined}
                        interval={ticks.length >= 2 ? 0 : 'preserveStartEnd'}
                        minTickGap={ticks.length >= 2 ? 0 : 56}
                        tickMargin={6}
                        height={compact ? 0 : 22}
                    />
                    <YAxis
                        orientation="right"
                        width={compact ? 0 : 46}
                        hide={compact}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                        tickFormatter={(value: number) => format(value)}
                        tickCount={4}
                        allowDecimals={decimals}
                    />
                    <Tooltip
                        isAnimationActive={false}
                        cursor={
                            hasBars
                                ? { fill: 'var(--series-muted)' }
                                : {
                                      stroke: 'var(--chart-axis)',
                                      strokeOpacity: 0.4,
                                      strokeDasharray: '3 3',
                                  }
                        }
                        content={({ active, payload }) => {
                            if (!active || !payload?.length) {
                                return null;
                            }

                            const point = payload[0].payload as SeriesPoint;

                            return (
                                <ChartTooltipCard
                                    t={point.t}
                                    slot={slot}
                                    rows={series.map((s) => ({
                                        name: s.name,
                                        color: s.color,
                                        dashed: s.dashed,
                                        value:
                                            point[s.key] === null ||
                                            point[s.key] === undefined
                                                ? '—'
                                                : (s.format ?? format)(
                                                      Number(point[s.key]),
                                                  ),
                                    }))}
                                    footer={footer?.(point)}
                                />
                            );
                        }}
                    />
                    {reference && (
                        <ReferenceLine
                            y={reference.value}
                            stroke={reference.color ?? 'var(--chart-axis)'}
                            strokeDasharray="4 4"
                            strokeOpacity={0.6}
                            label={{
                                value: reference.label,
                                position: 'insideTopLeft',
                                fontSize: 10,
                                fill: 'var(--chart-axis)',
                            }}
                        />
                    )}
                    {series.map((s) => {
                        if (s.kind === 'bar') {
                            return (
                                <Bar
                                    key={s.key}
                                    dataKey={s.key}
                                    name={s.name}
                                    stackId={s.stack}
                                    fill={s.color}
                                    maxBarSize={14}
                                    radius={
                                        !s.stack ||
                                        lastInStack.get(s.stack) === s.key
                                            ? [1.5, 1.5, 0, 0]
                                            : 0
                                    }
                                    isAnimationActive={false}
                                />
                            );
                        }

                        if (s.kind === 'area') {
                            return (
                                <Area
                                    key={s.key}
                                    dataKey={s.key}
                                    name={s.name}
                                    type="monotone"
                                    stroke={s.color}
                                    strokeWidth={1.5}
                                    fill={`url(#${gradientId}-${s.key})`}
                                    dot={false}
                                    activeDot={{ r: 3, strokeWidth: 0 }}
                                    isAnimationActive={false}
                                />
                            );
                        }

                        return (
                            <Line
                                key={s.key}
                                dataKey={s.key}
                                name={s.name}
                                type="monotone"
                                stroke={s.color}
                                strokeWidth={1.5}
                                strokeDasharray={s.dashed ? '4 3' : undefined}
                                dot={false}
                                activeDot={{ r: 3, strokeWidth: 0 }}
                                isAnimationActive={false}
                            />
                        );
                    })}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
