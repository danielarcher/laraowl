import type { ReactNode } from 'react';
import { ChartCard, LegendItem } from '@/components/charts/chart-card';
import {
    formatCount,
    formatDuration,
    seriesColor,
} from '@/components/charts/format';
import type { SeriesPoint } from '@/components/charts/format';
import { LatencyHistogram } from '@/components/charts/latency-histogram';
import type { HistogramBucket } from '@/components/charts/latency-histogram';
import { TimeSeriesChart } from '@/components/charts/time-series-chart';
import type { ChartSeries } from '@/components/charts/time-series-chart';
import { cn } from '@/lib/utils';

export type Latency = {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
};

export type CountSeries = {
    key: string;
    name: string;
    color: string;
    /** The period total shown in the legend. */
    total?: number;
};

/**
 * The charts on top of a monitoring page: volume split by outcome, then
 * latency (avg, p50, p95) and, when given, its distribution. All three
 * share one crosshair.
 */
export function ActivityCharts({
    data,
    title,
    total,
    series,
    latency,
    latencyTitle = 'Duration',
    histogram,
    extra,
}: {
    data: SeriesPoint[];
    title: string;
    total: number;
    series: CountSeries[];
    latency?: Latency | null;
    latencyTitle?: string;
    histogram?: HistogramBucket[] | null;
    /** A panel of the page's own, placed after the latency chart. */
    extra?: ReactNode;
}) {
    const sync = `activity-${title}`;
    const panels =
        1 +
        (latency ? 1 : 0) +
        (latency && histogram ? 1 : 0) +
        (extra ? 1 : 0);

    return (
        <div
            className={cn(
                'enter-stagger grid grid-cols-1 gap-4',
                panels === 2 && 'xl:grid-cols-2',
                panels >= 3 && 'lg:grid-cols-2 2xl:grid-cols-3',
            )}
        >
            <ChartCard
                title={title}
                value={formatCount(total)}
                legend={
                    series.length > 1
                        ? series.map((s) => (
                              <LegendItem
                                  key={s.key}
                                  color={s.color}
                                  label={s.name}
                                  value={
                                      s.total === undefined
                                          ? undefined
                                          : formatCount(s.total)
                                  }
                              />
                          ))
                        : undefined
                }
            >
                <TimeSeriesChart
                    data={data}
                    syncId={sync}
                    height={180}
                    series={series.map(
                        (s): ChartSeries => ({
                            key: s.key,
                            name: s.name,
                            color: s.color,
                            kind: 'bar',
                            stack: 'count',
                        }),
                    )}
                    footer={
                        series.length > 1
                            ? (point) => ({
                                  name: 'Total',
                                  value: formatCount(
                                      series.reduce(
                                          (sum, s) =>
                                              sum + Number(point[s.key] ?? 0),
                                          0,
                                      ),
                                  ),
                              })
                            : undefined
                    }
                />
            </ChartCard>

            {latency && (
                <ChartCard
                    title={latencyTitle}
                    value={formatDuration(latency.p95)}
                    delta={
                        <span className="text-[11px] text-muted-foreground">
                            p95
                        </span>
                    }
                    legend={
                        <>
                            <LegendItem
                                color={seriesColor.p95}
                                label="p95"
                                value={formatDuration(latency.p95)}
                            />
                            <LegendItem
                                color={seriesColor.avg}
                                label="avg"
                                value={formatDuration(latency.avg)}
                            />
                            <LegendItem
                                color={seriesColor.ok}
                                label="p50"
                                value={formatDuration(latency.p50)}
                                dashed
                            />
                        </>
                    }
                >
                    <TimeSeriesChart
                        data={data}
                        syncId={sync}
                        height={180}
                        format={formatDuration}
                        series={[
                            {
                                key: 'avg_duration',
                                name: 'avg',
                                color: seriesColor.avg,
                                kind: 'area',
                            },
                            {
                                key: 'p50_duration',
                                name: 'p50',
                                color: seriesColor.ok,
                                kind: 'line',
                                dashed: true,
                            },
                            {
                                key: 'p95_duration',
                                name: 'p95',
                                color: seriesColor.p95,
                                kind: 'line',
                            },
                        ]}
                        footer={(point) =>
                            point.max_duration === null
                                ? undefined
                                : {
                                      name: 'Slowest',
                                      value: formatDuration(
                                          Number(point.max_duration),
                                      ),
                                  }
                        }
                    />
                </ChartCard>
            )}

            {latency && histogram && (
                <ChartCard
                    title="Distribution"
                    value={formatDuration(latency.p99)}
                    delta={
                        <span className="text-[11px] text-muted-foreground">
                            p99
                        </span>
                    }
                    legend={
                        <>
                            <LegendItem color={seriesColor.avg} label="≤ p95" />
                            <LegendItem
                                color={seriesColor.p95}
                                label="slow tail"
                            />
                        </>
                    }
                >
                    <LatencyHistogram
                        buckets={histogram}
                        p95={latency.p95}
                        height={180}
                    />
                </ChartCard>
            )}

            {extra}
        </div>
    );
}
