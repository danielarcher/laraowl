import { Head, Link, usePage, router } from '@inertiajs/react';
import {
    Activity,
    AlertCircle,
    ArrowUpRight,
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    Globe,
} from 'lucide-react';
import { ActivityCharts } from '@/components/charts/activity-charts';
import { seriesColor } from '@/components/charts/format';
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
import { monitoringQuery } from '@/lib/monitoring-query';
import { formatMicroSeconds, formatCompactNumber } from '@/lib/utils';
import { show as showRequest } from '@/routes/requests';

export default function RequestsIndex({
    requests,
    timeSeries,
    stats,
    overview,
    period,
    from,
    to,
    sort: currentSort = 'total',
    direction: currentDirection = 'desc',
}: {
    requests: any;
    timeSeries: any;
    stats: any;
    overview: any;
    period?: string | null;
    from?: string | null;
    to?: string | null;
    sort?: string;
    direction?: string;
}) {
    const { props }: any = usePage();
    const teamSlug = props.current_team?.slug || props.currentTeam?.slug;
    const currentProject = props.current_project || props.currentProject;
    const projectSlug =
        props.current_project?.slug || props.currentProject?.slug;

    useLiveReload(currentProject?.id);

    const data = requests.data || [];
    const requestDetailsHref = (hash: string | number) =>
        showRequest.url(
            {
                current_team: teamSlug,
                project: projectSlug,
                hash,
            },
            monitoringQuery({ period, from, to }),
        );

    const handleSort = (column: string) => {
        const newDirection =
            currentSort === column && currentDirection === 'desc'
                ? 'asc'
                : 'desc';
        router.get(
            window.location.pathname,
            {
                ...Object.fromEntries(
                    new URLSearchParams(window.location.search),
                ),
                sort: column,
                direction: newDirection,
            },
            { preserveScroll: true, preserveState: true },
        );
    };

    const renderSortIcon = (column: string) => {
        if (currentSort !== column) {
            return (
                <ChevronsUpDown className="ml-1 inline h-3 w-3 opacity-40" />
            );
        }

        return currentDirection === 'asc' ? (
            <ChevronUp className="ml-1 inline h-3 w-3" />
        ) : (
            <ChevronDown className="ml-1 inline h-3 w-3" />
        );
    };

    const getMethodColor = (method: string) => {
        switch (method?.toUpperCase()) {
            case 'POST':
                return 'text-emerald-400 font-bold';
            case 'GET':
                return 'text-blue-400 font-bold';
            case 'DELETE':
                return 'text-red-400 font-bold';
            case 'PUT':
                return 'text-yellow-400 font-bold';
            default:
                return 'text-muted-foreground';
        }
    };

    return (
        <>
            <Head title="Requests Monitoring" />

            <div className="space-y-8">
                <ActivityCharts
                    data={timeSeries}
                    title="Requests"
                    total={stats.requests}
                    series={[
                        {
                            key: 'ok',
                            name: '1/2/3xx',
                            color: seriesColor.ok,
                            total: overview?.ok,
                        },
                        {
                            key: 'client_error',
                            name: '4xx',
                            color: seriesColor.warn,
                            total: overview?.client_error,
                        },
                        {
                            key: 'server_error',
                            name: '5xx',
                            color: seriesColor.error,
                            total: overview?.server_error,
                        },
                    ]}
                    latency={overview?.latency}
                    histogram={overview?.histogram}
                />

                {/* Table Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-foreground">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <span>
                                {formatCompactNumber(data.length)} Routes
                            </span>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                        {data.length > 0 ? (
                            <>
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="border-border hover:bg-transparent">
                                            <TableHead
                                                className="cursor-pointer text-[10px] font-bold text-muted-foreground uppercase select-none hover:text-foreground"
                                                onClick={() =>
                                                    handleSort('method')
                                                }
                                            >
                                                Method
                                                {renderSortIcon('method')}
                                            </TableHead>
                                            <TableHead
                                                className="cursor-pointer text-[10px] font-bold text-muted-foreground uppercase select-none hover:text-foreground"
                                                onClick={() =>
                                                    handleSort('path')
                                                }
                                            >
                                                Path
                                                {renderSortIcon('path')}
                                            </TableHead>
                                            <TableHead
                                                className="cursor-pointer text-center text-[10px] font-bold text-muted-foreground uppercase select-none hover:text-foreground"
                                                onClick={() =>
                                                    handleSort('ok_count')
                                                }
                                            >
                                                1/2/3xx
                                                {renderSortIcon('ok_count')}
                                            </TableHead>
                                            <TableHead
                                                className="cursor-pointer text-center text-[10px] font-bold text-muted-foreground uppercase select-none hover:text-foreground"
                                                onClick={() =>
                                                    handleSort(
                                                        'client_error_count',
                                                    )
                                                }
                                            >
                                                4xx
                                                {renderSortIcon(
                                                    'client_error_count',
                                                )}
                                            </TableHead>
                                            <TableHead
                                                className="cursor-pointer text-center text-[10px] font-bold text-muted-foreground uppercase select-none hover:text-foreground"
                                                onClick={() =>
                                                    handleSort(
                                                        'server_error_count',
                                                    )
                                                }
                                            >
                                                5xx
                                                {renderSortIcon(
                                                    'server_error_count',
                                                )}
                                            </TableHead>
                                            <TableHead
                                                className="cursor-pointer text-right text-[10px] font-bold text-muted-foreground uppercase select-none hover:text-foreground"
                                                onClick={() =>
                                                    handleSort('total')
                                                }
                                            >
                                                Total
                                                {renderSortIcon('total')}
                                            </TableHead>
                                            <TableHead
                                                className="cursor-pointer text-right text-[10px] font-bold text-muted-foreground uppercase select-none hover:text-foreground"
                                                onClick={() =>
                                                    handleSort('avg_duration')
                                                }
                                            >
                                                Avg
                                                {renderSortIcon('avg_duration')}
                                            </TableHead>
                                            <TableHead
                                                className="cursor-pointer text-right text-[10px] font-bold text-muted-foreground uppercase select-none hover:text-foreground"
                                                onClick={() =>
                                                    handleSort('p95_duration')
                                                }
                                            >
                                                P95
                                                {renderSortIcon('p95_duration')}
                                            </TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((req: any, index: number) => (
                                            <TableRow
                                                key={index}
                                                className="group border-border transition-colors hover:bg-muted/30"
                                            >
                                                <TableCell
                                                    className={`text-[10px] font-bold uppercase ${getMethodColor(req.method)}`}
                                                >
                                                    {req.method}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Globe className="h-3 w-3 text-muted-foreground/50" />
                                                        <span className="font-mono text-xs text-foreground/90">
                                                            {req.path}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-xs text-foreground/60">
                                                    {formatCompactNumber(
                                                        req.ok_count || 0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-xs text-foreground/60">
                                                    {formatCompactNumber(
                                                        req.client_error_count ||
                                                            0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-xs font-bold text-red-500">
                                                    {req.server_error_count >
                                                    0 ? (
                                                        <span className="flex items-center justify-center gap-1">
                                                            <AlertCircle className="h-3 w-3" />{' '}
                                                            {formatCompactNumber(
                                                                req.server_error_count,
                                                            )}
                                                        </span>
                                                    ) : (
                                                        '0'
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                                                    {formatCompactNumber(
                                                        req.total || 0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-foreground/90">
                                                    {formatMicroSeconds(
                                                        req.avg_duration,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs font-bold text-foreground/90">
                                                    {formatMicroSeconds(
                                                        req.p95_duration,
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Link
                                                        href={requestDetailsHref(
                                                            req.hash,
                                                        )}
                                                    >
                                                        <div className="rounded border border-border bg-muted p-1 transition-all group-hover:border-border">
                                                            <ArrowUpRight className="h-3 w-3" />
                                                        </div>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <Pagination
                                    links={requests.links}
                                    meta={requests}
                                />
                            </>
                        ) : (
                            <div className="p-12">
                                <EmptyState
                                    title="No Requests Tracked"
                                    description="We haven't captured any requests for this project yet. Make sure your application is sending data to Laraowl."
                                    icon={Activity}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

RequestsIndex.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[{ title: 'Requests', href: '#' }]}
    />
);
