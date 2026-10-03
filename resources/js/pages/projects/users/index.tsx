import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowUpRight, AlertCircle, Users } from 'lucide-react';
import { ActivityCharts } from '@/components/charts/activity-charts';
import { ChartCard } from '@/components/charts/chart-card';
import { seriesColor } from '@/components/charts/format';
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
import { monitoringQuery } from '@/lib/monitoring-query';
import { formatCompactNumber } from '@/lib/utils';
import { show as showUser } from '@/routes/users';

export default function UsersIndex({
    users,
    timeSeries = [],
    period,
    from,
    to,
    overview,
}: {
    users: any;
    timeSeries: any;
    period: string;
    from?: string | null;
    to?: string | null;
    overview: any;
}) {
    const { props }: any = usePage();
    const teamSlug = props.current_team?.slug || props.currentTeam?.slug;
    const currentProject = props.current_project || props.currentProject;
    const projectSlug =
        props.current_project?.slug || props.currentProject?.slug;

    useLiveReload(currentProject?.id);

    const data = users.data || [];
    const userDetailsHref = (hash: string | number) =>
        showUser.url(
            {
                current_team: teamSlug,
                project: projectSlug,
                hash,
            },
            {
                ...monitoringQuery({ period, from, to }),
            },
        );

    return (
        <>
            <Head title="Users" />

            <div className="mb-8 space-y-4"></div>

            <div className="space-y-8">
                <ActivityCharts
                    data={timeSeries}
                    title="Requests"
                    total={overview.auth_requests + overview.guest_requests}
                    series={[
                        {
                            key: 'authed',
                            name: 'Signed in',
                            color: seriesColor.good,
                            total: overview.auth_requests,
                        },
                        {
                            key: 'guest',
                            name: 'Guest',
                            color: seriesColor.ok,
                            total: overview.guest_requests,
                        },
                    ]}
                    extra={
                        <ChartCard
                            title="Active users"
                            value={formatCompactNumber(overview.auth_users)}
                            delta={
                                <span className="text-[11px] text-muted-foreground">
                                    signed in
                                </span>
                            }
                        >
                            <TimeSeriesChart
                                data={timeSeries}
                                syncId="activity-Requests"
                                height={180}
                                series={[
                                    {
                                        key: 'active_users',
                                        name: 'Active users',
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
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>
                                {formatCompactNumber(users.total || 0)} Users
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
                                                User
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
                                                Requests
                                            </TableHead>
                                            <TableHead className="text-center">
                                                Queued Jobs
                                            </TableHead>
                                            <TableHead className="text-center">
                                                Exceptions
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Last Seen
                                            </TableHead>
                                            <TableHead className="w-[50px] pr-6"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((u: any, index: number) => (
                                            <TableRow
                                                key={index}
                                                className="group border-border transition-colors hover:bg-muted/30"
                                            >
                                                <TableCell className="pl-6">
                                                    <Link
                                                        href={userDetailsHref(
                                                            u.hash,
                                                        )}
                                                    >
                                                        <div className="flex cursor-pointer items-center gap-3">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-foreground/90 transition-colors group-hover:text-foreground">
                                                                    {
                                                                        u.user_name
                                                                    }
                                                                </span>
                                                                <span className="font-mono text-[10px] text-muted-foreground">
                                                                    {u.user_email ||
                                                                        (u.user_name !==
                                                                            u.user_id &&
                                                                            `ID: ${u.user_id}`)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-xs text-foreground/60">
                                                    {formatCompactNumber(
                                                        (u.total_requests ||
                                                            0) -
                                                            (u.error_count ||
                                                                0),
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-xs font-bold text-orange-500">
                                                    {formatCompactNumber(
                                                        u.error_count || 0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-xs font-bold text-red-500">
                                                    0
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <span className="font-mono text-xs font-bold text-foreground">
                                                            {formatCompactNumber(
                                                                u.total_requests ||
                                                                    0,
                                                            )}
                                                        </span>
                                                        {u.error_count > 0 && (
                                                            <AlertCircle className="h-3 w-3 text-red-500" />
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                                    0
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-xs text-red-400">
                                                    {formatCompactNumber(
                                                        u.exception_count || 0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-xs whitespace-nowrap text-muted-foreground">
                                                    {new Date(
                                                        u.last_seen,
                                                    ).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="pr-6">
                                                    <Link
                                                        href={userDetailsHref(
                                                            u.hash,
                                                        )}
                                                    >
                                                        <div className="cursor-pointer rounded border border-border bg-muted p-1 text-muted-foreground transition-all group-hover:border-border group-hover:text-foreground">
                                                            <ArrowUpRight className="h-3 w-3" />
                                                        </div>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <Pagination links={users.links} meta={users} />
                            </>
                        ) : (
                            <div className="p-12">
                                <EmptyState
                                    title="No Users Tracked"
                                    description="We haven't captured any authenticated user activity for this project yet."
                                    icon={Users}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

UsersIndex.layout = (page: any) => (
    <AppLayout children={page} breadcrumbs={[{ title: 'Users', href: '#' }]} />
);
