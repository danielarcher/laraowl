import { Head, Link, usePage } from '@inertiajs/react';
import { Globe, ArrowUpRight } from 'lucide-react';
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

            <div className="space-y-8">
                <ActivityCharts
                    data={timeSeries}
                    title="Outgoing requests"
                    total={overview.total}
                    series={[
                        {
                            key: 'ok',
                            name: '1/2/3xx',
                            color: seriesColor.ok,
                            total: overview.ok,
                        },
                        {
                            key: 'client_error',
                            name: '4xx',
                            color: seriesColor.warn,
                            total: overview.client_error,
                        },
                        {
                            key: 'server_error',
                            name: '5xx',
                            color: seriesColor.error,
                            total: overview.server_error,
                        },
                    ]}
                    latency={overview.latency}
                    histogram={overview.histogram}
                />

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
