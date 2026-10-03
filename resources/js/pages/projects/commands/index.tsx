import { Head, Link, usePage } from '@inertiajs/react';
import { Terminal, ArrowUpRight, XCircle, LayoutGrid } from 'lucide-react';
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

            <div className="mb-8 space-y-4"></div>

            <div className="space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card className="overflow-hidden border-border bg-card">
                        <CardContent className="p-6">
                            <div className="mb-6 flex items-start justify-between">
                                <div>
                                    <div className="mb-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                        Calls (Current View)
                                    </div>
                                    <div className="text-3xl font-bold text-foreground">
                                        {formatCompactNumber(overview.total)}
                                    </div>
                                </div>
                                <div className="flex gap-4 text-[10px] font-bold tracking-tight uppercase">
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-red-500"></span>{' '}
                                        Unsuccessful{' '}
                                        <span className="ml-1 text-foreground">
                                            {formatCompactNumber(
                                                overview.failed,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-muted-foreground"></span>{' '}
                                        Successful{' '}
                                        <span className="ml-1 text-foreground">
                                            {formatCompactNumber(
                                                overview.success,
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
                                            name="Success"
                                            fill="rgba(255,255,255,0.4)"
                                            radius={[2, 2, 0, 0]}
                                            stackId="a"
                                        />
                                        <Bar
                                            dataKey="server_error"
                                            name="Failed"
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
                                                                    Calls:
                                                                </span>
                                                                <span className="text-[10px] font-bold text-foreground">
                                                                    {formatCompactNumber(
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
                                            dataKey="total"
                                            name="Total Calls"
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
