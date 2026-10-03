import { Head, usePage } from '@inertiajs/react';
import { Database, Layers, FileCode } from 'lucide-react';
import { ActivityCharts } from '@/components/charts/activity-charts';
import { ChartCard } from '@/components/charts/chart-card';
import { formatPercent, seriesColor } from '@/components/charts/format';
import { TimeSeriesChart } from '@/components/charts/time-series-chart';
import { EmptyState } from '@/components/empty-state';
import { Pagination } from '@/components/pagination';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useLiveReload } from '@/hooks/use-live-reload';
import AppLayout from '@/layouts/app-layout';
import { formatCompactNumber } from '@/lib/utils';

export default function CacheIndex({
    keys,
    timeSeries = [],
    overview,
}: {
    keys: any;
    timeSeries: any;
    overview: any;
}) {
    const { props }: any = usePage();
    const currentProject = props.current_project || props.currentProject;

    useLiveReload(currentProject?.id);

    const data = keys.data || [];

    return (
        <>
            <Head title="Cache" />

            <div className="mb-8 space-y-4"></div>

            <div className="space-y-8">
                <ActivityCharts
                    data={timeSeries}
                    title="Cache events"
                    total={overview.total}
                    series={[
                        {
                            key: 'hits',
                            name: 'Hits',
                            color: seriesColor.good,
                            total: overview.hits,
                        },
                        {
                            key: 'misses',
                            name: 'Misses',
                            color: seriesColor.warn,
                            total: overview.misses,
                        },
                        {
                            key: 'writes',
                            name: 'Writes',
                            color: seriesColor.avg,
                            total: timeSeries.reduce(
                                (sum: number, point: any) =>
                                    sum + Number(point.writes ?? 0),
                                0,
                            ),
                        },
                    ]}
                    extra={
                        <ChartCard
                            title="Hit rate"
                            value={formatPercent(
                                overview.hits + overview.misses
                                    ? overview.hits /
                                          (overview.hits + overview.misses)
                                    : 0,
                                1,
                            )}
                            delta={
                                <span className="text-[11px] text-muted-foreground">
                                    of reads
                                </span>
                            }
                        >
                            <TimeSeriesChart
                                data={timeSeries.map((point: any) => ({
                                    ...point,
                                    hit_rate:
                                        point.hits + point.misses
                                            ? point.hits /
                                              (point.hits + point.misses)
                                            : null,
                                }))}
                                syncId="activity-Cache events"
                                height={180}
                                decimals
                                format={(value) => formatPercent(value, 1)}
                                series={[
                                    {
                                        key: 'hit_rate',
                                        name: 'Hit rate',
                                        color: seriesColor.good,
                                        kind: 'area',
                                    },
                                ]}
                            />
                        </ChartCard>
                    }
                />

                {/* Table Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-foreground">
                            <Layers className="h-4 w-4 text-muted-foreground" />
                            <span>
                                {formatCompactNumber(keys.total || 0)} Unique
                                Keys
                            </span>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                        {data.length > 0 ? (
                            <>
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="border-border text-[10px] font-bold text-muted-foreground uppercase hover:bg-transparent">
                                            <TableHead className="pl-6">
                                                Key
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Hit %
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Hits
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Misses
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Writes
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Deletes
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Failures
                                            </TableHead>
                                            <TableHead className="pr-6 text-right">
                                                Total
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((key: any, index: number) => (
                                            <TableRow
                                                key={index}
                                                className="group border-border transition-colors hover:bg-muted/30"
                                            >
                                                <TableCell className="pl-6">
                                                    <div className="flex items-center gap-2">
                                                        <FileCode className="h-3 w-3 text-muted-foreground/50" />
                                                        <span className="max-w-md truncate font-mono text-xs text-foreground/90">
                                                            {key.cache_key}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-foreground/60">
                                                    {Number(
                                                        key.hit_rate,
                                                    ).toFixed(1)}
                                                    %
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs font-bold text-blue-400">
                                                    {formatCompactNumber(
                                                        key.hits || 0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs font-bold text-red-500">
                                                    {formatCompactNumber(
                                                        key.misses || 0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs font-bold text-orange-500">
                                                    {formatCompactNumber(
                                                        key.writes,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                                    {formatCompactNumber(
                                                        key.deletes,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                                    0
                                                </TableCell>
                                                <TableCell className="pr-6 text-right font-mono text-xs font-bold text-foreground">
                                                    {formatCompactNumber(
                                                        key.total,
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <Pagination links={keys.links} meta={keys} />
                            </>
                        ) : (
                            <div className="p-12">
                                <EmptyState
                                    title="No Cache Activity"
                                    description="We haven't detected any cache hits, misses, or writes for this project yet."
                                    icon={Database}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

CacheIndex.layout = (page: any) => (
    <AppLayout children={page} breadcrumbs={[{ title: 'Cache', href: '#' }]} />
);
