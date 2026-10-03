import { Head, Link, usePage } from '@inertiajs/react';
import { Terminal, ArrowUpRight, XCircle, LayoutGrid } from 'lucide-react';
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
import { show as showCommand } from '@/routes/commands';

export default function CommandsIndex({
    commands,
    timeSeries = [],
    overview,
    period,
    from,
    to,
}: {
    commands: any;
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

    const data = commands.data || [];
    const commandDetailsHref = (hash: string | number) =>
        showCommand.url(
            {
                current_team: teamSlug,
                project: projectSlug,
                hash,
            },
            monitoringQuery({ period, from, to }),
        );

    return (
        <>
            <Head title="Commands" />

            <div className="space-y-8">
                <ActivityCharts
                    data={timeSeries}
                    title="Commands"
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
                            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                            <span>{commands.total || 0} Commands</span>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                        {data.length > 0 ? (
                            <>
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="border-border text-[10px] font-bold text-muted-foreground uppercase hover:bg-transparent">
                                            <TableHead className="pl-6">
                                                Command
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Success
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
                                            <TableHead className="pr-6 text-right">
                                                P95
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((cmd: any, index: number) => (
                                            <TableRow
                                                key={index}
                                                className="group border-border transition-colors hover:bg-muted/30"
                                            >
                                                <TableCell className="pl-6">
                                                    <Link
                                                        href={commandDetailsHref(
                                                            cmd.hash,
                                                        )}
                                                    >
                                                        <div className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-80">
                                                            <Terminal className="h-3 w-3 text-muted-foreground/50" />
                                                            <span className="font-mono text-xs text-foreground/90">
                                                                {
                                                                    cmd.command_name
                                                                }
                                                            </span>
                                                        </div>
                                                    </Link>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-foreground/60">
                                                    {formatCompactNumber(
                                                        cmd.success_count || 0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs font-bold text-red-500">
                                                    {cmd.failed_count > 0 ? (
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <XCircle className="h-3 w-3" />
                                                            {formatCompactNumber(
                                                                cmd.failed_count,
                                                            )}
                                                        </div>
                                                    ) : (
                                                        '0'
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                                                    {formatCompactNumber(
                                                        cmd.total || 0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-foreground/90">
                                                    {formatMicroSeconds(
                                                        cmd.avg_duration,
                                                    )}
                                                </TableCell>
                                                <TableCell className="pr-6 text-right font-mono text-xs font-bold text-foreground">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span>
                                                            {formatMicroSeconds(
                                                                cmd.p95_duration,
                                                            )}
                                                        </span>
                                                        <Link
                                                            href={commandDetailsHref(
                                                                cmd.hash,
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
                                <Pagination
                                    links={commands.links}
                                    meta={commands}
                                />
                            </>
                        ) : (
                            <div className="p-12">
                                <EmptyState
                                    title="No Commands Tracked"
                                    description="We haven't detected any Artisan command executions for this project yet."
                                    icon={Terminal}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

CommandsIndex.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[{ title: 'Commands', href: '#' }]}
    />
);
