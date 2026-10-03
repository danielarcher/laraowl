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
import {
    BarChart,
    Bar,
    ResponsiveContainer,
    AreaChart,
    Area,
    Tooltip,
    XAxis,
} from 'recharts';
import { EmptyState } from '@/components/empty-state';
import { Pagination } from '@/components/pagination';
import { Card, CardContent } from '@/components/ui/card';
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
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card className="group overflow-hidden border-border bg-card">
                        <CardContent className="p-6">
                            <div className="mb-6 flex items-start justify-between">
                                <div>
                                    <div className="mb-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                        Requests
                                    </div>
                                    <div className="text-3xl font-bold text-foreground">
                                        {formatCompactNumber(stats.requests)}
                                    </div>
                                </div>
                                <div className="flex gap-4 text-[10px] font-bold tracking-tight uppercase">
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-white/40"></span>{' '}
                                        1/2/3xx{' '}
                                        <span className="ml-1 text-foreground">
                                            {formatCompactNumber(
                                                overview?.ok || 0,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-orange-500"></span>{' '}
                                        4xx{' '}
                                        <span className="ml-1 text-foreground">
                                            {formatCompactNumber(
                                                overview?.client_error || 0,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-red-600"></span>{' '}
                                        5xx{' '}
                                        <span className="ml-1 text-foreground">
                                            {formatCompactNumber(
                                                overview?.server_error || 0,
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-[150px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={timeSeries}>
                                        <XAxis dataKey="minute" hide />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (
                                                    active &&
                                                    payload &&
                                                    payload.length
                                                ) {
                                                    return (
                                                        <div className="rounded-lg border border-border bg-background/95 p-2 shadow-xl backdrop-blur-sm">
                                                            <div className="mb-1.5 border-b border-border/50 pb-1 text-[9px] font-bold tracking-tight text-muted-foreground uppercase">
                                                                {
                                                                    payload[0]
                                                                        .payload
                                                                        .minute
                                                                }
                                                            </div>
                                                            <div className="grid gap-1">
                                                                {payload.map(
                                                                    (
                                                                        entry: any,
                                                                        index: number,
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                index
                                                                            }
                                                                            className="flex items-center gap-2"
                                                                        >
                                                                            <div
                                                                                className="h-2 w-2 rounded-full"
                                                                                style={{
                                                                                    backgroundColor:
                                                                                        entry.color,
                                                                                }}
                                                                            />
                                                                            <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                                                                {
                                                                                    entry.name
                                                                                }

                                                                                :
                                                                            </span>
                                                                            <span className="text-[10px] font-bold text-foreground">
                                                                                {formatCompactNumber(
                                                                                    entry.value,
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    ),
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return null;
                                            }}
                                        />
                                        <Bar
                                            dataKey="ok"
                                            name="1/2/3xx"
                                            fill="rgba(255,255,255,0.4)"
                                            radius={[2, 2, 0, 0]}
                                            stackId="a"
                                        />
                                        <Bar
                                            dataKey="client_error"
                                            name="4xx"
                                            fill="#f97316"
                                            radius={[2, 2, 0, 0]}
                                            stackId="a"
                                        />
                                        <Bar
                                            dataKey="server_error"
                                            name="5xx"
                                            fill="#ef4444"
                                            radius={[2, 2, 0, 0]}
                                            stackId="a"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="group overflow-hidden border-border bg-card">
                        <CardContent className="p-6">
                            <div className="mb-6 flex items-start justify-between">
                                <div>
                                    <div className="mb-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                        Duration
                                    </div>
                                    <div className="text-3xl font-bold text-foreground">
                                        {formatMicroSeconds(
                                            overview.min_duration,
                                        )}{' '}
                                        -{' '}
                                        {formatMicroSeconds(
                                            overview.max_duration,
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-4 text-[10px] font-bold tracking-tight uppercase">
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-blue-500"></span>{' '}
                                        Avg{' '}
                                        <span className="ml-1 text-foreground">
                                            {formatMicroSeconds(
                                                overview.avg_duration,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-orange-500"></span>{' '}
                                        Max{' '}
                                        <span className="ml-1 text-foreground">
                                            {formatMicroSeconds(
                                                overview.max_duration,
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-[150px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={timeSeries}>
                                        <defs>
                                            <linearGradient
                                                id="colorAvg"
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="5%"
                                                    stopColor="#3b82f6"
                                                    stopOpacity={0.3}
                                                />
                                                <stop
                                                    offset="95%"
                                                    stopColor="#3b82f6"
                                                    stopOpacity={0}
                                                />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="minute" hide />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (
                                                    active &&
                                                    payload &&
                                                    payload.length
                                                ) {
                                                    return (
                                                        <div className="rounded-lg border border-border bg-background/95 p-2 shadow-xl backdrop-blur-sm">
                                                            <div className="mb-1.5 border-b border-border/50 pb-1 text-[9px] font-bold tracking-tight text-muted-foreground uppercase">
                                                                {
                                                                    payload[0]
                                                                        .payload
                                                                        .minute
                                                                }
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                                                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                                                    Avg:
                                                                </span>
                                                                <span className="text-[10px] font-bold text-foreground">
                                                                    {formatMicroSeconds(
                                                                        payload[0]
                                                                            .value,
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return null;
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="avg_duration"
                                            name="Avg Duration"
                                            stroke="#3b82f6"
                                            fillOpacity={1}
                                            fill="url(#colorAvg)"
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

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
