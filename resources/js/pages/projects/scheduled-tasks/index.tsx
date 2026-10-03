import { Head, Link, usePage } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import { Calendar, ArrowUpRight, Terminal, Timer } from 'lucide-react';
import { ActivityCharts } from '@/components/charts/activity-charts';
import { seriesColor } from '@/components/charts/format';
import { EmptyState } from '@/components/empty-state';
import { Pagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
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
import { show as showScheduledTask } from '@/routes/scheduled-tasks';

export default function ScheduledTasksIndex({
    tasks,
    timeSeries = [],
    overview,
    period,
    from,
    to,
}: {
    tasks: any;
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

    const data = tasks.data || [];
    const scheduledTaskDetailsHref = (hash: string | number) =>
        showScheduledTask.url(
            {
                current_team: teamSlug,
                project: projectSlug,
                hash,
            },
            monitoringQuery({ period, from, to }),
        );

    const formatNextRun = (dateStr: string) => {
        if (!dateStr || dateStr === 'N/A' || dateStr === 'Invalid Schedule') {
            return dateStr;
        }

        try {
            return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
        } catch {
            return dateStr;
        }
    };

    return (
        <>
            <Head title="Scheduled Tasks" />

            <div className="mb-8 space-y-4"></div>

            <div className="space-y-8">
                <ActivityCharts
                    data={timeSeries}
                    title="Runs"
                    total={overview.total}
                    series={[
                        {
                            key: 'ok',
                            name: 'Success',
                            color: seriesColor.good,
                            total: overview.success,
                        },
                        {
                            key: 'server_error',
                            name: 'Failed',
                            color: seriesColor.error,
                            total: overview.failed,
                        },
                    ]}
                    latency={overview.latency}
                    histogram={overview.histogram}
                />

                {/* Table Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-foreground">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>
                                {formatCompactNumber(tasks.total || 0)} Task
                                Types
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
                                                Task
                                            </TableHead>
                                            <TableHead>Schedule</TableHead>
                                            <TableHead>Next Run</TableHead>
                                            <TableHead className="text-center">
                                                Processed
                                            </TableHead>
                                            <TableHead className="text-center">
                                                Failed
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
                                        {data.map(
                                            (task: any, index: number) => (
                                                <TableRow
                                                    key={index}
                                                    className="group border-border transition-colors hover:bg-muted/30"
                                                >
                                                    <TableCell className="pl-6">
                                                        <div className="flex items-center gap-2">
                                                            <Terminal className="h-3 w-3 text-muted-foreground/50" />
                                                            <span className="font-mono text-xs text-foreground/90">
                                                                {task.command}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className="border-border bg-muted font-mono text-[10px] text-blue-400"
                                                        >
                                                            {task.schedule ||
                                                                'N/A'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                                                        <div className="flex items-center gap-1.5">
                                                            <Timer className="h-3 w-3 text-muted-foreground/40" />
                                                            {formatNextRun(
                                                                task.next_run,
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-xs text-foreground/60">
                                                        {formatCompactNumber(
                                                            task.processed_count ||
                                                                0,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-xs font-bold text-red-500">
                                                        {formatCompactNumber(
                                                            task.failed_count ||
                                                                0,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-xs text-foreground/90">
                                                        {formatMicroSeconds(
                                                            task.avg_duration,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="pr-6 text-right font-mono text-xs font-bold text-foreground/90">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span>
                                                                {formatMicroSeconds(
                                                                    task.p95_duration,
                                                                )}
                                                            </span>
                                                            <Link
                                                                href={scheduledTaskDetailsHref(
                                                                    task.hash,
                                                                )}
                                                            >
                                                                <div className="rounded border border-border bg-muted p-1 transition-all group-hover:border-border">
                                                                    <ArrowUpRight className="h-3 w-3" />
                                                                </div>
                                                            </Link>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ),
                                        )}
                                    </TableBody>
                                </Table>
                                <Pagination links={tasks.links} meta={tasks} />
                            </>
                        ) : (
                            <div className="p-12">
                                <EmptyState
                                    title="No Scheduled Tasks"
                                    description="We haven't detected any scheduled tasks or cron jobs for this project yet."
                                    icon={Calendar}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

ScheduledTasksIndex.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[{ title: 'Scheduled Tasks', href: '#' }]}
    />
);
