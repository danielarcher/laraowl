import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    formatCount,
    formatPercent,
    seriesColor,
} from '@/components/charts/format';

export type HistogramBucket = { le: number | null; count: number };

const bound = (us: number) =>
    us >= 1_000_000 ? `${us / 1_000_000}s` : `${us / 1000}ms`;

/** Axis labels drop the unit under a second; the first one carries it. */
const short = (us: number) =>
    us >= 1_000_000 ? `${us / 1_000_000}s` : `${us / 1000}`;

/**
 * How many requests landed in each latency band. Bands past the p95 are
 * drawn in the p95 colour, so the slow tail stands out at a glance.
 */
export function LatencyHistogram({
    buckets,
    p95,
    height = 200,
}: {
    buckets: HistogramBucket[];
    p95: number;
    height?: number;
}) {
    const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
    const rows = buckets.map((bucket, index) => {
        const lower = index === 0 ? 0 : (buckets[index - 1].le ?? 0);
        const cumulative = buckets
            .slice(0, index + 1)
            .reduce((sum, earlier) => sum + earlier.count, 0);

        return {
            label: bucket.le === null ? `>${short(lower)}` : short(bucket.le),
            le: bucket.le,
            range:
                bucket.le === null
                    ? `over ${bound(lower)}`
                    : lower === 0
                      ? `up to ${bound(bucket.le)}`
                      : `${bound(lower)} – ${bound(bucket.le)}`,
            count: bucket.count,
            share: total ? bucket.count / total : 0,
            cumulative: total ? cumulative / total : 0,
            slow: bucket.le === null || bucket.le > p95,
        };
    });

    // Trim empty bands at both ends, keeping one either side for context.
    const first = rows.findIndex((row) => row.count > 0);
    const last =
        rows.length - 1 - [...rows].reverse().findIndex((row) => row.count > 0);
    const visible =
        first === -1
            ? rows
            : rows.slice(
                  Math.max(0, first - 1),
                  Math.min(rows.length, last + 2),
              );

    return (
        <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={visible}
                    margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                    barCategoryGap="12%"
                >
                    <CartesianGrid
                        vertical={false}
                        stroke="var(--chart-grid)"
                    />
                    <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={{ stroke: 'var(--chart-grid)' }}
                        tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                        interval={0}
                        tickFormatter={(label: string, index: number) =>
                            index === 0 && !label.endsWith('s')
                                ? `${label}ms`
                                : label
                        }
                        tickMargin={6}
                        height={22}
                    />
                    <YAxis
                        orientation="right"
                        width={46}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                        tickFormatter={(value: number) => formatCount(value)}
                        tickCount={4}
                        allowDecimals={false}
                    />
                    <Tooltip
                        isAnimationActive={false}
                        cursor={{ fill: 'var(--series-muted)' }}
                        content={({ active, payload }) => {
                            if (!active || !payload?.length) {
                                return null;
                            }

                            const row = payload[0]
                                .payload as (typeof rows)[number];

                            return (
                                <div className="min-w-44 rounded-md border border-border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
                                    <div className="mb-1.5 font-mono text-[10px] text-muted-foreground">
                                        {row.range}
                                    </div>
                                    <Row
                                        name="Requests"
                                        value={formatCount(row.count)}
                                    />
                                    <Row
                                        name="Share"
                                        value={formatPercent(row.share, 1)}
                                    />
                                    <Row
                                        name="At or faster"
                                        value={formatPercent(row.cumulative, 1)}
                                    />
                                </div>
                            );
                        }}
                    />
                    <Bar
                        dataKey="count"
                        radius={[1.5, 1.5, 0, 0]}
                        isAnimationActive={false}
                    >
                        {visible.map((row) => (
                            <Cell
                                key={`${row.le}`}
                                fill={
                                    row.slow ? seriesColor.p95 : seriesColor.avg
                                }
                                fillOpacity={row.slow ? 0.9 : 0.55}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

function Row({ name, value }: { name: string; value: string }) {
    return (
        <div className="flex items-center">
            <span className="text-muted-foreground">{name}</span>
            <span className="ml-auto pl-4 font-mono font-medium text-foreground tabular-nums">
                {value}
            </span>
        </div>
    );
}
