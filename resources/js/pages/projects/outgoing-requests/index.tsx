import { Head, Link, usePage } from '@inertiajs/react';
import { Globe, ArrowUpRight } from 'lucide-react';
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
import { show as showOutgoingRequest } from '@/routes/outgoing-requests';

export default function OutgoingRequestsIndex({
    hosts,
    timeSeries = [],
    overview,
    period,
    from,
    to,
}: {
    hosts: any;
    timeSeries: any;
    overview: any;
    period?: string | null;
    from?: string | null;
    to?: string | null;
}) {
    const { props }: any = usePage();
    const teamSlug = props.current_team?.slug || props.currentTeam?.slug;
    const currentProject = props.current_project || props.currentProject;
    const projectSlug =
        props.current_project?.slug || props.currentProject?.slug;

    useLiveReload(currentProject?.id);

    const data = hosts.data || [];
    const outgoingRequestDetailsHref = (hash: string | number) =>
        showOutgoingRequest.url(
            {
                current_team: teamSlug,
                project: projectSlug,
                hash,
            },
            monitoringQuery({ period, from, to }),
        );

    return (
        <>
            <Head title="Outgoing Requests" />

            <div className="mb-8 space-y-4"></div>

            <div className="space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card className="overflow-hidden border-border bg-card">
                        <CardContent className="p-6">
                            <div className="mb-6 flex items-start justify-between">
                                <div>
                                    <div className="mb-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                        Requests (Current View)
                                    </div>
                                    <div className="text-3xl font-bold text-foreground">
                                        {formatCompactNumber(overview.total)}
                                    </div>
                                </div>
                                <div className="flex gap-4 text-[10px] font-bold tracking-tight uppercase">
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40"></span>{' '}
                                        OK{' '}
                                        <span className="ml-1 text-foreground">
                                            {formatCompactNumber(overview.ok)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-red-500"></span>{' '}
                                        Failed{' '}
                                        <span className="ml-1 text-foreground">
                                            {formatCompactNumber(
                                                overview.failed,
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-[120px] w-full">
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

                    <Card className="overflow-hidden border-border bg-card">
                        <CardContent className="p-6">
                            <div className="mb-6 flex items-start justify-between">
                                <div>
                                    <div className="text-3xl font-bold text-foreground">
                                        {formatMicroSeconds(
                                            overview.avg_duration,
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="relative h-[120px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={timeSeries}>
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
                                                                <div className="h-2 w-2 rounded-full bg-orange-500" />
                                                                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                                                    Avg
                                                                    Duration:
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
                                            stroke="#f97316"
                                            fill="#f97316"
                                            fillOpacity={0.1}
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
                                {formatCompactNumber(hosts.total || 0)} Domains
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
                                                Host
                                            </TableHead>
                                            <TableHead className="text-center">
                                                1/2/3xx
                                            </TableHead>
                                            <TableHead className="text-center">
                                                4xx
                                            </TableHead>
                                            <TableHead className="text-center">
                                                5xx
                                            </TableHead>
                                            <TableHead className="text-center">
                                                Total
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Avg
                                            </TableHead>
                                            <TableHead className="pr-6 text-right">
                                                P95
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((h: any, index: number) => (
                                            <TableRow
                                                key={index}
                                                className="group border-border transition-colors hover:bg-muted/30"
                                            >
                                                <TableCell className="pl-6">
                                                    <Link
                                                        href={outgoingRequestDetailsHref(
                                                            h.hash,
                                                        )}
                                                    >
                                                        <div className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-80">
                                                            <Globe className="h-3 w-3 text-muted-foreground/50" />
                                                            <span className="font-mono text-xs text-foreground/90">
                                                                {h.host}
                                                            </span>
                                                        </div>
                                                    </Link>
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-xs text-foreground/60">
                                                    {formatCompactNumber(
                                                        h.ok_count || 0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-xs font-bold text-orange-500">
                                                    {formatCompactNumber(
                                                        h.client_error_count ||
                                                            0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-xs font-bold text-red-500">
                                                    {formatCompactNumber(
                                                        h.server_error_count ||
                                                            0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-xs font-bold text-foreground">
                                                    {formatCompactNumber(
                                                        h.total || 0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-foreground/90">
                                                    {formatMicroSeconds(
                                                        h.avg_duration,
                                                    )}
                                                </TableCell>
                                                <TableCell className="pr-6 text-right font-mono text-xs font-bold text-foreground">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span>
                                                            {formatMicroSeconds(
                                                                h.p95_duration,
                                                            )}
                                                        </span>
                                                        <Link
                                                            href={outgoingRequestDetailsHref(
                                                                h.hash,
                                                            )}
                                                        >
                                                            <div className="cursor-pointer rounded border border-border bg-muted p-1 transition-all group-hover:border-border">
                                                                <ArrowUpRight className="h-3 w-3" />
                                                            </div>
                                                        </Link>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <Pagination links={hosts.links} meta={hosts} />
                            </>
                        ) : (
                            <div className="p-12">
                                <EmptyState
                                    title="No Outgoing Requests"
                                    description="We haven't detected any external HTTP requests being sent from your application."
                                    icon={Globe}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

OutgoingRequestsIndex.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[{ title: 'Outgoing Requests', href: '#' }]}
    />
);
