import type { LucideIcon } from 'lucide-react';
import {
    Area,
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { LegendItem } from '@/components/charts/chart-card';
import { ChartTooltipCard } from '@/components/charts/chart-tooltip';
import { niceTicks } from '@/components/charts/format';
import type { ServerPoint } from '@/lib/server-metrics';
import { formatChartTime } from '@/lib/server-metrics';

export type ServerChartSeries = {
    key: keyof ServerPoint;
    label: string;
    color: string;
    kind: 'area' | 'line';
    dashed?: boolean;
};

type ServerMetricChartProps = {
    title: string;
    icon: LucideIcon;
    data: ServerPoint[];
    series: ServerChartSeries[];
    format: (value: number) => string;
    withDate: boolean;
    domain?: [number | string, number | string];
    summary?: string;
};

/**
 * A server metric over time, in the same frame as the app charts: hairline
 * grid, figures on the right, one crosshair shared by every server chart.
 */
export function ServerMetricChart({
    title,
    icon: Icon,
    data,
    series,
    format,
    withDate,
    domain = [0, 'auto'],
    summary,
}: ServerMetricChartProps) {
    const chartId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const slot = data.length > 1 ? data[1].timestamp - data[0].timestamp : 60;
    const points = data.map((point) => ({ ...point, t: point.timestamp }));
    const ticks = niceTicks(points, slot);
    const latest = data.length ? data[data.length - 1] : null;

    return (
        <section className="flex flex-col rounded-lg border border-border bg-card">
            <header className="flex items-start justify-between gap-4 px-4 pt-3.5">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Icon className="size-3.5" />
                        {title}
                    </h3>
                    {latest && latest[series[0].key] !== null && (
                        <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                            {format(Number(latest[series[0].key]))}
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex flex-wrap justify-end gap-x-4 gap-y-1">
                        {series.map((item) => (
                            <LegendItem
                                key={item.key}
                                color={item.color}
                                label={item.label}
                                dashed={item.dashed}
                            />
                        ))}
                    </div>
                    {summary && (
                        <span className="text-[11px] text-muted-foreground">
                            {summary}
                        </span>
                    )}
                </div>
            </header>
            <div className="px-2 pt-3 pb-2">
                <div className="chart-reveal h-[200px] w-full">
                    {data.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                            No samples in this period
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={points}
                                syncId="server-metrics"
                                margin={{
                                    top: 4,
                                    right: 0,
                                    bottom: 0,
                                    left: 0,
                                }}
                            >
                                <defs>
                                    {series
                                        .filter((item) => item.kind === 'area')
                                        .map((item) => (
                                            <linearGradient
                                                key={item.key}
                                                id={`server-${chartId}-${item.key}`}
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="0%"
                                                    stopColor={item.color}
                                                    stopOpacity={0.28}
                                                />
                                                <stop
                                                    offset="100%"
                                                    stopColor={item.color}
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
                                    type="number"
                                    domain={['dataMin', 'dataMax']}
                                    ticks={
                                        ticks.length >= 2 ? ticks : undefined
                                    }
                                    tickFormatter={(value: number) =>
                                        formatChartTime(value, withDate)
                                    }
                                    tick={{
                                        fontSize: 10,
                                        fill: 'var(--chart-axis)',
                                    }}
                                    tickLine={false}
                                    axisLine={{ stroke: 'var(--chart-grid)' }}
                                    tickMargin={6}
                                    minTickGap={40}
                                    height={22}
                                />
                                <YAxis
                                    orientation="right"
                                    domain={domain}
                                    tickFormatter={(value: number) =>
                                        format(value)
                                    }
                                    tick={{
                                        fontSize: 10,
                                        fill: 'var(--chart-axis)',
                                    }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickCount={5}
                                    width={52}
                                />
                                <Tooltip
                                    isAnimationActive={false}
                                    cursor={{
                                        stroke: 'var(--chart-axis)',
                                        strokeOpacity: 0.4,
                                        strokeDasharray: '3 3',
                                    }}
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) {
                                            return null;
                                        }

                                        const point = payload[0]
                                            .payload as ServerPoint;

                                        return (
                                            <ChartTooltipCard
                                                t={point.timestamp}
                                                slot={slot}
                                                rows={series.map((item) => ({
                                                    name: item.label,
                                                    color: item.color,
                                                    dashed: item.dashed,
                                                    value:
                                                        point[item.key] === null
                                                            ? '—'
                                                            : format(
                                                                  Number(
                                                                      point[
                                                                          item
                                                                              .key
                                                                      ],
                                                                  ),
                                                              ),
                                                }))}
                                            />
                                        );
                                    }}
                                />
                                {series.map((item) =>
                                    item.kind === 'area' ? (
                                        <Area
                                            key={item.key}
                                            type="monotone"
                                            dataKey={item.key}
                                            stroke={item.color}
                                            strokeWidth={1.5}
                                            fill={`url(#server-${chartId}-${item.key})`}
                                            dot={false}
                                            activeDot={{ r: 3, strokeWidth: 0 }}
                                            isAnimationActive={false}
                                            connectNulls
                                        />
                                    ) : (
                                        <Line
                                            key={item.key}
                                            type="monotone"
                                            dataKey={item.key}
                                            stroke={item.color}
                                            strokeWidth={1.5}
                                            strokeDasharray={
                                                item.dashed ? '4 3' : undefined
                                            }
                                            dot={false}
                                            activeDot={{ r: 3, strokeWidth: 0 }}
                                            isAnimationActive={false}
                                            connectNulls
                                        />
                                    ),
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </section>
    );
}
