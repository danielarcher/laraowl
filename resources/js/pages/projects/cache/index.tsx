import { Head, usePage } from '@inertiajs/react';
import { Database, Layers, FileCode } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
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
    const totalWrites = data.reduce(
        (acc: any, k: any) => acc + Number(k.writes),
        0,
    );

    return (
        <>
            <Head title="Cache" />

            <div className="mb-8 space-y-4"></div>

            <div className="space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card className="overflow-hidden border-border bg-card">
                        <CardContent className="p-6">
                            <div className="mb-6 flex items-start justify-between">
                                <div>
                                    <div className="mb-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                        Events (Current View)
                                    </div>
                                    <div className="text-3xl font-bold text-foreground">
                                        {formatCompactNumber(overview.total)}
                                    </div>
                                </div>
                                <div className="flex gap-4 text-[10px] font-bold tracking-tight uppercase">
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-red-500"></span>{' '}
                                        Miss{' '}
                                        <span className="ml-1 text-foreground">
                                            {formatCompactNumber(
                                                overview.misses,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-blue-500"></span>{' '}
                                        Hit{' '}
                                        <span className="ml-1 text-foreground">
                                            {formatCompactNumber(overview.hits)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-orange-500"></span>{' '}
                                        Write{' '}
                                        <span className="ml-1 text-foreground">
                                            {formatCompactNumber(totalWrites)}
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
                                            dataKey="hits"
                                            name="Hits"
                                            stackId="a"
                                            fill="rgba(59, 130, 246, 0.5)"
                                            radius={[0, 0, 0, 0]}
                                        />
                                        <Bar
                                            dataKey="misses"
                                            name="Misses"
                                            stackId="a"
                                            fill="rgba(239, 68, 68, 0.5)"
                                            radius={[0, 0, 0, 0]}
                                        />
                                        <Bar
                                            dataKey="writes"
                                            name="Writes"
                                            stackId="a"
                                            fill="rgba(249, 115, 22, 0.5)"
                                            radius={[2, 2, 0, 0]}
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
                                        {overview.hit_rate}%
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
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-2 w-2 rounded-full bg-orange-500" />
                                                                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                                                    Writes:
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
                                        <Bar
                                            dataKey="writes"
                                            name="Writes"
                                            fill="#f97316"
                                            radius={[2, 2, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

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
