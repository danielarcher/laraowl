import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowUpRight, XCircle, Cpu, Zap } from 'lucide-react';
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
import { show as showJob } from '@/routes/jobs';

export default function JobsIndex({
    jobs,
    timeSeries = [],
    overview,
    period,
    from,
    to,
}: {
    jobs: any;
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

    const data = jobs.data || [];
    const jobDetailsHref = (hash: string | number) =>
        showJob.url(
            {
                current_team: teamSlug,
                project: projectSlug,
                hash,
            },
            monitoringQuery({ period, from, to }),
        );

    return (
        <>
            <Head title="Jobs" />

            <div className="mb-8 space-y-4"></div>

            <div className="space-y-8">
                <ActivityCharts
                    data={timeSeries}
                    title="Job attempts"
                    total={overview.total}
                    series={[
                        {
                            key: 'ok',
                            name: 'Processed',
                            color: seriesColor.good,
                            total: overview.processed,
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
                            <Cpu className="h-4 w-4 text-muted-foreground" />
                            <span>
                                {formatCompactNumber(jobs.total || 0)} Job Types
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
                                                Job
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Processed
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Failed
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Total
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Avg
                                            </TableHead>
                                            <TableHead className="text-right">
                                                P95
                                            </TableHead>
                                            <TableHead className="w-[50px] pr-6"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((job: any, index: number) => (
                                            <TableRow
                                                key={index}
                                                className="group border-border transition-colors hover:bg-muted/30"
                                            >
                                                <TableCell className="pl-6">
                                                    <Link
                                                        href={jobDetailsHref(
                                                            job.hash,
                                                        )}
                                                    >
                                                        <div className="flex cursor-pointer items-center gap-2">
                                                            <Zap className="h-3 w-3 text-muted-foreground/50" />
                                                            <span className="max-w-md truncate font-mono text-xs text-foreground/90 transition-colors group-hover:text-foreground">
                                                                {job.job_class}
                                                            </span>
                                                        </div>
                                                    </Link>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs font-bold text-emerald-500">
                                                    {formatCompactNumber(
                                                        job.processed_count ||
                                                            0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs font-bold text-red-500">
                                                    {job.failed_count > 0 ? (
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <XCircle className="h-3 w-3" />
                                                            {formatCompactNumber(
                                                                job.failed_count,
                                                            )}
                                                        </div>
                                                    ) : (
                                                        '0'
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                                                    {formatCompactNumber(
                                                        job.total || 0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-foreground/90">
                                                    {formatMicroSeconds(
                                                        job.avg_duration,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                                                    {formatMicroSeconds(
                                                        job.p95_duration,
                                                    )}
                                                </TableCell>
                                                <TableCell className="pr-6">
                                                    <Link
                                                        href={jobDetailsHref(
                                                            job.hash,
                                                        )}
                                                    >
                                                        <div className="cursor-pointer rounded border border-border bg-muted p-1 transition-all group-hover:border-border">
                                                            <ArrowUpRight className="h-3 w-3" />
                                                        </div>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <Pagination links={jobs.links} meta={jobs} />
                            </>
                        ) : (
                            <div className="p-12">
                                <EmptyState
                                    title="No Jobs Found"
                                    description="We haven't detected any background jobs running for this project yet."
                                    icon={Cpu}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

JobsIndex.layout = (page: any) => (
    <AppLayout children={page} breadcrumbs={[{ title: 'Jobs', href: '#' }]} />
);
