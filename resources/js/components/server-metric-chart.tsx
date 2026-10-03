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
import { Card, CardContent } from '@/components/ui/card';
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

    return (
        <Card className="overflow-hidden border-border bg-card">
            <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-foreground uppercase">
                    <Icon className="size-3.5 text-muted-foreground" />
                    {title}
                </div>
                <div className="flex items-center gap-3">
                    {series.map((item) => (
                        <div
                            key={item.key}
                            className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                        >
                            <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: item.color }}
                            />
                            {item.label}
                        </div>
                    ))}
                    {summary && (
                        <span className="text-xs font-semibold text-foreground">
                            {summary}
                        </span>
                    )}
                </div>
            </div>
            <CardContent className="p-4 pt-6">
                <div className="h-[220px] w-full">
                    {data.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-[10px] font-semibold tracking-widest text-muted-foreground uppercase opacity-50">
                            No samples in this period
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={data}
                                margin={{
                                    top: 4,
                                    right: 8,
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
                                                    offset="5%"
                                                    stopColor={item.color}
                                                    stopOpacity={0.25}
                                                />
                                                <stop
                                                    offset="95%"
                                                    stopColor={item.color}
                                                    stopOpacity={0}
                                                />
                                            </linearGradient>
                                        ))}
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="currentColor"
                                    className="text-border"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="timestamp"
                                    tickFormatter={(value: number) =>
                                        formatChartTime(value, withDate)
                                    }
                                    tick={{ fontSize: 10, fill: '#6b7280' }}
                                    tickLine={false}
                                    axisLine={false}
                                    minTickGap={40}
                                />
                                <YAxis
                                    domain={domain}
                                    tickFormatter={(value: number) =>
                                        format(value)
                                    }
                                    tick={{ fontSize: 10, fill: '#6b7280' }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={56}
                                />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) {
                                            return null;
                                        }

                                        const point = payload[0]
                                            .payload as ServerPoint;

                                        return (
                                            <div className="rounded-lg border border-border bg-background/95 p-2 shadow-xl backdrop-blur-sm">
                                                <div className="mb-1.5 border-b border-border/50 pb-1 text-[9px] font-bold tracking-tight text-muted-foreground uppercase">
                                                    {formatChartTime(
                                                        point.timestamp,
                                                        true,
                                                    )}
                                                </div>
                                                {series.map((item) => (
                                                    <div
                                                        key={item.key}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <div
                                                            className="h-2 w-2 rounded-full"
                                                            style={{
                                                                backgroundColor:
                                                                    item.color,
                                                            }}
                                                        />
                                                        <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                                            {item.label}:
                                                        </span>
                                                        <span className="text-[10px] font-bold text-foreground">
                                                            {point[item.key] ===
                                                            null
                                                                ? '—'
                                                                : format(
                                                                      Number(
                                                                          point[
                                                                              item
                                                                                  .key
                                                                          ],
                                                                      ),
                                                                  )}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
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
                                            strokeWidth={2}
                                            fill={`url(#server-${chartId}-${item.key})`}
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
                                                item.dashed ? '4 4' : undefined
                                            }
                                            dot={false}
                                            isAnimationActive={false}
                                            connectNulls
                                        />
                                    ),
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
