import { Head, Link, usePage } from '@inertiajs/react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ArrowRight, Globe } from 'lucide-react';
import { Fragment } from 'react';
import {
    ChartCard,
    Delta,
    LegendItem,
    Sparkline,
    StatCell,
} from '@/components/charts/chart-card';
import {
    formatCount,
    formatDuration,
    formatPercent,
    seriesColor,
} from '@/components/charts/format';
import type { SeriesPoint } from '@/components/charts/format';
import { LatencyHistogram } from '@/components/charts/latency-histogram';
import type { HistogramBucket } from '@/components/charts/latency-histogram';
import { TimeSeriesChart } from '@/components/charts/time-series-chart';
import { useLiveReload } from '@/hooks/use-live-reload';
import AppLayout from '@/layouts/app-layout';
import { appendMonitoringQuery } from '@/lib/monitoring-query';
import { cn } from '@/lib/utils';

type Latency = {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
};

type UserRow = {
    user_identifier: string;
    user_email?: string | null;
    user_id?: string | null;
    request_count?: number;
    error_count?: number;
};

type Props = {
    total_requests: number;
    request_breakdown: {
        ok: number;
        client_error: number;
        server_error: number;
    };
    duration_stats: Latency;
    latency_histogram: HistogramBucket[];
    previous?: {
        requests: number;
        server_error: number;
        p95: number;
        exceptions: number;
        jobs: number;
        failed_jobs: number;
    };
    total_exceptions: number;
    recent_issues: Array<{
        id: number;
        title: string;
        message?: string | null;
        occurrences_count: number;
        last_seen_at: string | null;
    }>;
    timeSeries: SeriesPoint[];
    exceptionTimeSeries: SeriesPoint[];
    jobTimeSeries: SeriesPoint[];
    job_stats: {
        total: number;
        processed: number;
        failed: number;
        released: number;
        avg_duration: number;
        p95_duration: number;
    };
    impacted_users: UserRow[];
    active_users: UserRow[];
    auth_users_count: number;
    guest_users_count: number;
    uptime_status: {
        current: string;
        last_check: string | null;
        url: string | null;
    };
    period: string;
    from?: string | null;
    to?: string | null;
};

const SYNC = 'project-dashboard';

export default function Dashboard({
    total_requests,
    request_breakdown,
    duration_stats,
    latency_histogram,
    previous,
    total_exceptions,
    recent_issues,
    timeSeries,
    exceptionTimeSeries,
    jobTimeSeries,
    job_stats,
    impacted_users,
    active_users,
    auth_users_count,
    guest_users_count,
    uptime_status,
    period,
    from,
    to,
}: Props) {
    const { props }: any = usePage();
    const project = props.current_project || props.currentProject;
    const teamSlug = props.current_team?.slug || props.currentTeam?.slug;
    const href = (path: string) =>
        appendMonitoringQuery(`/${teamSlug}/${project?.slug}/${path}`, {
            period,
            from,
            to,
        });

    useLiveReload(project?.id);

    const series = timeSeries ?? [];
    const errorRate = total_requests
        ? request_breakdown.server_error / total_requests
        : 0;
    const previousErrorRate = previous?.requests
        ? previous.server_error / previous.requests
        : undefined;
    const withRates = series.map((point) => ({
        ...point,
        error_rate: Number(point.total)
            ? Number(point.server_error) / Number(point.total)
            : 0,
    }));
    const latency = duration_stats ?? ({} as Latency);
    const uptimeEnabled = project?.uptime_monitoring_enabled ?? true;

    return (
        <>
            <Head title={`Dashboard - ${project?.name}`} />

            <div className="enter-stagger space-y-4">
                <ProjectHeader
                    name={project?.name}
                    url={uptime_status?.url ?? project?.url}
                    uptime={uptimeEnabled ? uptime_status?.current : 'disabled'}
                    lastCheck={uptime_status?.last_check}
                />

                {/* Headline figures, each against the window just before. */}
                <div className="grid grid-cols-2 divide-border overflow-hidden rounded-lg border border-border bg-card max-lg:divide-y sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
                    <StatCell
                        label="Requests"
                        value={formatCount(total_requests)}
                        delta={
                            <Delta
                                current={total_requests}
                                previous={previous?.requests}
                            />
                        }
                    >
                        <Sparkline
                            data={series}
                            dataKey="total"
                            color={seriesColor.avg}
                        />
                    </StatCell>
                    <StatCell
                        label="5xx rate"
                        value={formatPercent(errorRate)}
                        tone={errorRate >= 0.01 ? 'error' : undefined}
                        delta={
                            <Delta
                                current={errorRate}
                                previous={previousErrorRate}
                                higherIsWorse
                            />
                        }
                    >
                        <Sparkline
                            data={withRates}
                            dataKey="error_rate"
                            color={seriesColor.error}
                        />
                    </StatCell>
                    <StatCell
                        label="p95 latency"
                        value={formatDuration(latency.p95)}
                        delta={
                            <Delta
                                current={latency.p95}
                                previous={previous?.p95}
                                higherIsWorse
                            />
                        }
                    >
                        <Sparkline
                            data={series}
                            dataKey="p95_duration"
                            color={seriesColor.p95}
                        />
                    </StatCell>
                    <StatCell
                        label="Average"
                        value={formatDuration(latency.avg)}
                        hint={`p50 ${formatDuration(latency.p50)}`}
                    >
                        <Sparkline
                            data={series}
                            dataKey="avg_duration"
                            color={seriesColor.avg}
                        />
                    </StatCell>
                    <StatCell
                        label="Exceptions"
                        value={formatCount(total_exceptions)}
                        tone={total_exceptions > 0 ? 'warn' : undefined}
                        delta={
                            <Delta
                                current={total_exceptions}
                                previous={previous?.exceptions}
                                higherIsWorse
                            />
                        }
                    >
                        <Sparkline
                            data={exceptionTimeSeries ?? []}
                            dataKey="total"
                            color={seriesColor.warn}
                        />
                    </StatCell>
                    <StatCell
                        label="Failed jobs"
                        value={formatCount(job_stats?.failed ?? 0)}
                        tone={
                            (job_stats?.failed ?? 0) > 0 ? 'error' : undefined
                        }
                        delta={
                            <Delta
                                current={job_stats?.failed ?? 0}
                                previous={previous?.failed_jobs}
                                higherIsWorse
                            />
                        }
                        hint={`of ${formatCount(job_stats?.total ?? 0)} jobs`}
                    >
                        <Sparkline
                            data={jobTimeSeries ?? []}
                            dataKey="server_error"
                            color={seriesColor.error}
                        />
                    </StatCell>
                </div>

                <ChartCard
                    title="Requests"
                    href={href('requests')}
                    linkLabel="All requests"
                    value={formatCount(total_requests)}
                    legend={
                        <>
                            <LegendItem
                                color={seriesColor.ok}
                                label="1/2/3xx"
                                value={formatCount(request_breakdown?.ok)}
                            />
                            <LegendItem
                                color={seriesColor.warn}
                                label="4xx"
                                value={formatCount(
                                    request_breakdown?.client_error,
                                )}
                            />
                            <LegendItem
                                color={seriesColor.error}
                                label="5xx"
                                value={formatCount(
                                    request_breakdown?.server_error,
                                )}
                            />
                        </>
                    }
                >
                    <TimeSeriesChart
                        data={series}
                        syncId={SYNC}
                        height={210}
                        series={[
                            {
                                key: 'ok',
                                name: '1/2/3xx',
                                color: seriesColor.ok,
                                kind: 'bar',
                                stack: 'status',
                            },
                            {
                                key: 'client_error',
                                name: '4xx',
                                color: seriesColor.warn,
                                kind: 'bar',
                                stack: 'status',
                            },
                            {
                                key: 'server_error',
                                name: '5xx',
                                color: seriesColor.error,
                                kind: 'bar',
                                stack: 'status',
                            },
                        ]}
                        footer={(point) => ({
                            name: 'Total',
                            value: formatCount(Number(point.total)),
                        })}
                    />
                </ChartCard>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                    <ChartCard
                        className="xl:col-span-3"
                        title="Latency"
                        value={formatDuration(latency.p95)}
                        delta={
                            <span className="text-[11px] text-muted-foreground">
                                p95
                            </span>
                        }
                        legend={
                            <>
                                <LegendItem
                                    color={seriesColor.p95}
                                    label="p95"
                                    value={formatDuration(latency.p95)}
                                />
                                <LegendItem
                                    color={seriesColor.avg}
                                    label="avg"
                                    value={formatDuration(latency.avg)}
                                />
                                <LegendItem
                                    color={seriesColor.ok}
                                    label="p50"
                                    value={formatDuration(latency.p50)}
                                    dashed
                                />
                            </>
                        }
                    >
                        <TimeSeriesChart
                            data={series}
                            syncId={SYNC}
                            height={200}
                            format={formatDuration}
                            series={[
                                {
                                    key: 'avg_duration',
                                    name: 'avg',
                                    color: seriesColor.avg,
                                    kind: 'area',
                                },
                                {
                                    key: 'p50_duration',
                                    name: 'p50',
                                    color: seriesColor.ok,
                                    kind: 'line',
                                    dashed: true,
                                },
                                {
                                    key: 'p95_duration',
                                    name: 'p95',
                                    color: seriesColor.p95,
                                    kind: 'line',
                                },
                            ]}
                            footer={(point) => ({
                                name: 'Slowest',
                                value: formatDuration(
                                    Number(point.max_duration),
                                ),
                            })}
                        />
                    </ChartCard>

                    <ChartCard
                        className="xl:col-span-2"
                        title="Latency distribution"
                        value={formatDuration(latency.p99)}
                        delta={
                            <span className="text-[11px] text-muted-foreground">
                                p99
                            </span>
                        }
                        legend={
                            <>
                                <LegendItem
                                    color={seriesColor.avg}
                                    label="≤ p95"
                                />
                                <LegendItem
                                    color={seriesColor.p95}
                                    label="slow tail"
                                />
                            </>
                        }
                    >
                        <LatencyHistogram
                            buckets={latency_histogram ?? []}
                            p95={latency.p95}
                            height={200}
                        />
                    </ChartCard>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <ChartCard
                        title="Exceptions"
                        href={href('exceptions')}
                        value={formatCount(total_exceptions)}
                        delta={
                            <Delta
                                current={total_exceptions}
                                previous={previous?.exceptions}
                                higherIsWorse
                            />
                        }
                    >
                        <TimeSeriesChart
                            data={exceptionTimeSeries ?? []}
                            syncId={SYNC}
                            height={120}
                            compact
                            series={[
                                {
                                    key: 'total',
                                    name: 'Exceptions',
                                    color: seriesColor.warn,
                                    kind: 'bar',
                                },
                            ]}
                        />
                        <IssueList issues={recent_issues ?? []} href={href} />
                    </ChartCard>

                    <ChartCard
                        title="Jobs"
                        href={href('jobs')}
                        value={formatCount(job_stats?.total ?? 0)}
                        delta={
                            <Delta
                                current={job_stats?.total ?? 0}
                                previous={previous?.jobs}
                            />
                        }
                        legend={
                            <>
                                <LegendItem
                                    color={seriesColor.good}
                                    label="done"
                                    value={formatCount(
                                        job_stats?.processed ?? 0,
                                    )}
                                />
                                <LegendItem
                                    color={seriesColor.error}
                                    label="failed"
                                    value={formatCount(job_stats?.failed ?? 0)}
                                />
                            </>
                        }
                    >
                        <TimeSeriesChart
                            data={jobTimeSeries ?? []}
                            syncId={SYNC}
                            height={120}
                            compact
                            series={[
                                {
                                    key: 'ok',
                                    name: 'Processed',
                                    color: seriesColor.good,
                                    kind: 'bar',
                                    stack: 'jobs',
                                },
                                {
                                    key: 'server_error',
                                    name: 'Failed',
                                    color: seriesColor.error,
                                    kind: 'bar',
                                    stack: 'jobs',
                                },
                            ]}
                        />
                        <dl className="mt-2 grid grid-cols-3 border-t border-border px-2 pt-2.5 pb-1 text-[11px]">
                            <Figure
                                label="avg"
                                value={formatDuration(
                                    (job_stats?.avg_duration ?? 0) * 1000,
                                )}
                            />
                            <Figure
                                label="p95"
                                value={formatDuration(
                                    (job_stats?.p95_duration ?? 0) * 1000,
                                )}
                            />
                            <Figure
                                label="released"
                                value={formatCount(job_stats?.released ?? 0)}
                            />
                        </dl>
                    </ChartCard>

                    <ChartCard
                        title="Users"
                        href={href('users')}
                        value={formatCount(auth_users_count)}
                        delta={
                            <span className="text-[11px] text-muted-foreground">
                                signed in
                            </span>
                        }
                        legend={
                            <>
                                <LegendItem
                                    color={seriesColor.good}
                                    label="auth"
                                />
                                <LegendItem
                                    color={seriesColor.ok}
                                    label="guest"
                                />
                            </>
                        }
                    >
                        <TimeSeriesChart
                            data={series}
                            syncId={SYNC}
                            height={120}
                            compact
                            series={[
                                {
                                    key: 'authed',
                                    name: 'Signed-in requests',
                                    color: seriesColor.good,
                                    kind: 'bar',
                                    stack: 'who',
                                },
                                {
                                    key: 'guest',
                                    name: 'Guest requests',
                                    color: seriesColor.ok,
                                    kind: 'bar',
                                    stack: 'who',
                                },
                            ]}
                        />
                        <AuthSplit
                            authed={total_requests - guest_users_count}
                            guest={guest_users_count}
                        />
                    </ChartCard>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <UserTable
                        title="Most active users"
                        rows={active_users ?? []}
                        figure={(row) => row.request_count ?? 0}
                        figureLabel="requests"
                        href={href('users')}
                    />
                    <UserTable
                        title="Users hit by exceptions"
                        rows={impacted_users ?? []}
                        figure={(row) => row.error_count ?? 0}
                        figureLabel="exceptions"
                        tone="error"
                        href={href('users')}
                    />
                </div>
            </div>
        </>
    );
}

function ProjectHeader({
    name,
    url,
    uptime,
    lastCheck,
}: {
    name?: string;
    url?: string | null;
    uptime?: string;
    lastCheck?: string | null;
}) {
    const state =
        uptime === 'up'
            ? { label: 'Up', dot: 'bg-series-good', text: 'text-series-good' }
            : uptime === 'down'
              ? {
                    label: 'Down',
                    dot: 'bg-series-error',
                    text: 'text-series-error',
                }
              : uptime === 'disabled'
                ? {
                      label: 'Uptime off',
                      dot: 'bg-muted-foreground/40',
                      text: 'text-muted-foreground',
                  }
                : {
                      label: 'No check yet',
                      dot: 'bg-muted-foreground/40',
                      text: 'text-muted-foreground',
                  };

    return (
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight">
                    {name}
                </h1>
                {url && (
                    <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <Globe className="size-3" />
                        {url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                )}
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-xs">
                <span
                    className={cn(
                        'size-1.5 rounded-full',
                        state.dot,
                        uptime === 'up' && 'animate-pulse',
                    )}
                />
                <span className={state.text}>{state.label}</span>
                {lastCheck && (
                    <span className="text-muted-foreground">
                        · checked{' '}
                        {formatDistanceToNowStrict(new Date(lastCheck))} ago
                    </span>
                )}
            </div>
        </div>
    );
}

function Figure({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono font-medium text-foreground tabular-nums">
                {value}
            </dd>
        </div>
    );
}

function AuthSplit({ authed, guest }: { authed: number; guest: number }) {
    const total = Math.max(authed + guest, 0);
    const share = total ? Math.max(0, authed) / total : 0;

    return (
        <div className="mt-2 border-t border-border px-2 pt-2.5 pb-1">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-series-muted">
                <div
                    className="bg-series-good"
                    style={{ width: `${share * 100}%` }}
                />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                <span>
                    <span className="font-mono text-foreground tabular-nums">
                        {formatPercent(share, 0)}
                    </span>{' '}
                    signed in
                </span>
                <span>
                    <span className="font-mono text-foreground tabular-nums">
                        {formatCount(Math.max(0, guest))}
                    </span>{' '}
                    guest requests
                </span>
            </div>
        </div>
    );
}

function IssueList({
    issues,
    href,
}: {
    issues: Props['recent_issues'];
    href: (path: string) => string;
}) {
    if (!issues.length) {
        return (
            <p className="mt-2 border-t border-border px-2 pt-2.5 pb-1 text-[11px] text-muted-foreground">
                No open issues.
            </p>
        );
    }

    return (
        <ul className="mt-2 divide-y divide-border border-t border-border">
            <li className="px-2 pt-2 pb-1 text-[11px] text-muted-foreground">
                Open issues
            </li>
            {issues.slice(0, 3).map((issue) => (
                <li key={issue.id}>
                    <Link
                        href={href(`issues/${issue.id}`)}
                        className="group flex items-center gap-2 px-2 py-1.5 text-[11px] hover:bg-muted/40"
                    >
                        <span className="min-w-0 flex-1 truncate text-foreground">
                            {issue.title}
                        </span>
                        <span className="font-mono text-muted-foreground tabular-nums">
                            {formatCount(issue.occurrences_count)}×
                        </span>
                        <ArrowRight className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                </li>
            ))}
        </ul>
    );
}

function UserTable({
    title,
    rows,
    figure,
    figureLabel,
    tone,
    href,
}: {
    title: string;
    rows: UserRow[];
    figure: (row: UserRow) => number;
    figureLabel: string;
    tone?: 'error';
    href: string;
}) {
    const top = rows.slice(0, 5);
    const max = Math.max(1, ...top.map(figure));

    return (
        <section className="rounded-lg border border-border bg-card">
            <header className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <h3 className="text-xs font-medium text-muted-foreground">
                    {title}
                </h3>
                <Link
                    href={href}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                    All users <ArrowRight className="size-3" />
                </Link>
            </header>
            {top.length === 0 ? (
                <p className="px-4 pb-4 text-xs text-muted-foreground">
                    Nobody in this period.
                </p>
            ) : (
                <ul className="pb-2">
                    {top.map((row, index) => (
                        <Fragment key={`${row.user_identifier}-${index}`}>
                            <li className="relative mx-2 flex items-center gap-3 rounded-sm px-2 py-1.5">
                                <div
                                    className={cn(
                                        'absolute inset-y-0.5 left-0 rounded-sm',
                                        tone === 'error'
                                            ? 'bg-series-error/10'
                                            : 'bg-foreground/[0.05]',
                                    )}
                                    style={{
                                        width: `${(figure(row) / max) * 100}%`,
                                    }}
                                />
                                <div className="relative min-w-0 flex-1">
                                    <div className="truncate text-xs text-foreground">
                                        {row.user_identifier}
                                    </div>
                                    {(row.user_email || row.user_id) && (
                                        <div className="truncate text-[11px] text-muted-foreground">
                                            {row.user_email ||
                                                `ID ${row.user_id}`}
                                        </div>
                                    )}
                                </div>
                                <div className="relative text-right font-mono text-xs text-foreground tabular-nums">
                                    {formatCount(figure(row))}
                                    <span className="ml-1 font-sans text-[11px] text-muted-foreground">
                                        {figureLabel}
                                    </span>
                                </div>
                            </li>
                        </Fragment>
                    ))}
                </ul>
            )}
        </section>
    );
}

Dashboard.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[{ title: 'Dashboard', href: '#' }]}
    />
);
