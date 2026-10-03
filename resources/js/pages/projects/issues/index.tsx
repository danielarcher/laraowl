import { Head, usePage, router } from '@inertiajs/react';
import {
    Search,
    TrendingUp,
    CheckCircle,
    Clock,
    AlertCircle,
    LayoutGrid,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { EmptyState } from '@/components/empty-state';
import { IssueTable } from '@/components/issue-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useLiveReload } from '@/hooks/use-live-reload';
import AppLayout from '@/layouts/app-layout';
import { formatCompactNumber } from '@/lib/utils';

export default function Issues({
    issues,
    filters,
    counts,
    team_members,
    performance,
}: {
    issues: any;
    filters: any;
    counts: any;
    team_members: any;
    performance: any;
}) {
    const { props }: any = usePage();
    const teamSlug = props.currentTeam?.slug || props.current_team?.slug;
    const currentProject = props.current_project || props.currentProject;
    const projectSlug =
        props.currentProject?.slug || props.current_project?.slug;

    const [search, setSearch] = useState(filters.search || '');

    useLiveReload(currentProject?.id);
    const [view, setView] = useState('exceptions'); // 'exceptions' or 'performance'

    const data = issues.data || [];

    const updateFilter = useCallback(
        (newFilters: any) => {
            router.get(
                `/${teamSlug}/${projectSlug}/issues`,
                {
                    ...filters,
                    ...newFilters,
                },
                {
                    preserveState: true,
                    replace: true,
                },
            );
        },
        [teamSlug, projectSlug, filters],
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            if (search !== (filters.search || '')) {
                updateFilter({ search });
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [search, filters.search, updateFilter]);

    return (
        <>
            <Head title="Issues" />

            <div className="mb-6 space-y-4">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="scrollbar-hide flex w-fit items-center gap-2 overflow-x-auto rounded-lg border border-border bg-muted p-1">
                        <button
                            onClick={() => setView('exceptions')}
                            className={`flex-1 rounded-md px-4 py-1.5 text-xs font-medium whitespace-nowrap transition-all sm:flex-none ${view === 'exceptions' ? 'border border-border bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                        >
                            Exceptions
                        </button>
                        <button
                            onClick={() => setView('performance')}
                            className={`flex-1 rounded-md px-4 py-1.5 text-xs font-medium whitespace-nowrap transition-all sm:flex-none ${view === 'performance' ? 'border border-border bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                        >
                            Performance
                        </button>
                    </div>

                    {view === 'exceptions' && (
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search issues..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 w-full border-input bg-muted pl-10 text-sm text-foreground focus-visible:ring-primary"
                            />
                        </div>
                    )}
                </div>

                {view === 'exceptions' && (
                    <div className="scrollbar-hide flex w-fit items-center gap-1 overflow-x-auto rounded-lg border border-border bg-muted p-1">
                        {[
                            'open',
                            'unassigned',
                            'mine',
                            'resolved',
                            'ignored',
                        ].map((status) => (
                            <button
                                key={status}
                                onClick={() => updateFilter({ status })}
                                className={`rounded-md px-4 py-1.5 text-[11px] font-medium whitespace-nowrap capitalize transition-all sm:text-xs ${filters.status === status ? 'border border-border bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                            >
                                {status}
                                {(status === 'open' ||
                                    status === 'unassigned') &&
                                    counts[status] !== undefined && (
                                        <span className="ml-1 text-[10px] opacity-50">
                                            {formatCompactNumber(
                                                counts[status],
                                            )}
                                        </span>
                                    )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-6">
                {view === 'exceptions' ? (
                    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
                        {data.length > 0 ? (
                            <IssueTable
                                issues={issues}
                                team_members={team_members}
                            />
                        ) : (
                            <div className="p-12">
                                <EmptyState
                                    title="No Issues Found"
                                    description="No exceptions or performance issues match your current filters. Looking good!"
                                    icon={LayoutGrid}
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Card className="border-border bg-card">
                                <CardContent className="p-6">
                                    <div className="mb-4 flex items-center justify-between">
                                        <TrendingUp className="h-5 w-5 text-blue-500" />
                                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-500">
                                            EFFICIENCY
                                        </span>
                                    </div>
                                    <div className="text-3xl font-bold text-foreground">
                                        {performance.resolution_rate}%
                                    </div>
                                    <div className="mt-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                        Resolution Rate
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border bg-card">
                                <CardContent className="p-6">
                                    <div className="mb-4 flex items-center justify-between">
                                        <Clock className="h-5 w-5 text-orange-500" />
                                    </div>
                                    <div className="text-3xl font-bold text-foreground">
                                        {performance.avg_resolution_time}h
                                    </div>
                                    <div className="mt-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                        Avg Time to Resolve
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border bg-card">
                                <CardContent className="p-6">
                                    <div className="mb-4 flex items-center justify-between">
                                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                                    </div>
                                    <div className="text-3xl font-bold text-foreground">
                                        {formatCompactNumber(
                                            performance.total_resolved,
                                        )}
                                    </div>
                                    <div className="mt-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                        Total Resolved
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border bg-card">
                                <CardContent className="p-6">
                                    <div className="mb-4 flex items-center justify-between">
                                        <AlertCircle className="h-5 w-5 text-red-500" />
                                    </div>
                                    <div className="text-3xl font-bold text-foreground">
                                        {formatCompactNumber(
                                            performance.open_issues,
                                        )}
                                    </div>
                                    <div className="mt-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                        Currently Open
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="overflow-hidden border-border bg-card">
                            <CardHeader className="p-6 pb-0">
                                <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-widest text-foreground uppercase">
                                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                    Issue Trends (30 Days)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="mt-6 h-[300px] w-full px-4">
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <AreaChart
                                            data={performance.daily_trend}
                                        >
                                            <defs>
                                                <linearGradient
                                                    id="colorCount"
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
                                            <XAxis dataKey="date" hide />
                                            <YAxis hide />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor:
                                                        'var(--card)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '8px',
                                                    fontSize: '12px',
                                                }}
                                                itemStyle={{
                                                    color: 'var(--foreground)',
                                                }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="count"
                                                stroke="#3b82f6"
                                                fillOpacity={1}
                                                fill="url(#colorCount)"
                                                strokeWidth={2}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </>
    );
}

Issues.layout = (page: any) => (
    <AppLayout children={page} breadcrumbs={[{ title: 'Issues', href: '#' }]} />
);
