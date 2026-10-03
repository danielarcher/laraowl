import { Head, Link, usePage, usePoll } from '@inertiajs/react';
import { ArrowUpRight, Radar, Server as ServerIcon } from 'lucide-react';
import { useState } from 'react';
import { Area, AreaChart, Tooltip, YAxis } from 'recharts';
import {
    ChartCard,
    LegendItem,
    ShowAllSeries,
} from '@/components/charts/chart-card';
import { ChartTooltipCard } from '@/components/charts/chart-tooltip';
import { categoryColors, seriesColor } from '@/components/charts/format';
import { TimeSeriesChart } from '@/components/charts/time-series-chart';
import { ProjectTile } from '@/components/project-tile';
import { Card } from '@/components/ui/card';
import { useHiddenSeries } from '@/hooks/use-hidden-series';
import AppLayout from '@/layouts/app-layout';
import type { ServerSample, ServerSummary } from '@/lib/server-metrics';
import { formatPercent, usageTone } from '@/lib/server-metrics';
import { cn } from '@/lib/utils';

type TrendPoint = { t: number; requests: number; errors: number };

type Uptime = 'up' | 'down' | 'unknown' | 'off';

type OverviewApp = {
    id: number;
    name: string;
    slug: string;
    url: string | null;
    logo_url: string | null;
    server_id: number | null;
    uptime: Uptime;
    last_uptime_check_at: string | null;
    requests: number;
    server_errors: number;
    client_errors: number;
    error_rate: number | null;
    avg_ms: number | null;
    p95_ms: number | null;
    exceptions: number;
    jobs: number;
    failed_jobs: number;
    trend: TrendPoint[];
};

type OverviewGroup = {
    server: (ServerSummary & { latest: ServerSample | null }) | null;
    projects: OverviewApp[];
};

type OverviewTotals = {
    apps: number;
    apps_up: number;
    apps_down: number;
    apps_quiet: number;
    requests: number;
    server_errors: number;
    error_rate: number | null;
    p95_ms: number | null;
    exceptions: number;
    jobs: number;
    failed_jobs: number;
};

type OverviewProps = {
    totals: OverviewTotals;
    groups: OverviewGroup[];
    period: string;
    slot_seconds: number;
};

const PERIOD_LABELS: Record<string, string> = {
    '1h': 'last hour',
    '24h': 'last 24 hours',
    '7d': 'last 7 days',
    '14d': 'last 14 days',
    '30d': 'last 30 days',
    custom: 'selected range',
};

function formatCount(value: number): string {
    return value >= 10_000
        ? new Intl.NumberFormat('en-GB', {
              notation: 'compact',
              maximumFractionDigits: 1,
          }).format(value)
        : value.toLocaleString('en-GB');
}

function formatMs(value: number | null, upperBound = false): string {
    if (value === null) {
        return '—';
    }

    if (upperBound) {
        return `≤ ${formatMs(value)}`;
    }

    return value >= 1000
        ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} s`
        : `${Math.round(value)} ms`;
}

function errorTone(rate: number | null): string {
    if (rate === null || rate === 0) {
        return 'text-foreground/40';
    }

    if (rate >= 5) {
        return 'text-red-500';
    }

    return rate >= 1 ? 'text-amber-500' : 'text-foreground/70';
}

function latencyTone(ms: number | null): string {
    if (ms === null) {
        return 'text-foreground/40';
    }

    if (ms >= 2500) {
        return 'text-red-500';
    }

    return ms >= 1000 ? 'text-amber-500' : 'text-foreground/70';
}

function UptimeDot({ uptime }: { uptime: Uptime }) {
    const label = {
        up: 'Up',
        down: 'Down',
        unknown: 'Not checked yet',
        off: 'No uptime check',
    }[uptime];

    if (uptime === 'down') {
        return (
            <span title={label} className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
        );
    }

    return (
        <span
            title={label}
            className={cn(
                'size-2 shrink-0 rounded-full',
                uptime === 'up' && 'bg-emerald-500',
                uptime === 'unknown' && 'bg-foreground/25',
                uptime === 'off' && 'border border-foreground/25',
            )}
        />
    );
}

function Trend({ app, slot }: { app: OverviewApp; slot: number }) {
    const hasTraffic = app.trend.some((point) => point.requests > 0);
    const hasErrors = app.trend.some((point) => point.errors > 0);

    if (!hasTraffic) {
        return (
            <div className="flex h-8 w-40 items-center text-[11px] text-foreground/30">
                No requests
            </div>
        );
    }

    return (
        <div className="chart-reveal h-8 w-40">
            <AreaChart
                width={160}
                height={32}
                data={app.trend}
                margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
            >
                <defs>
                    <linearGradient
                        id={`trend-${app.id}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="0%"
                            stopColor={seriesColor.avg}
                            stopOpacity={0.3}
                        />
                        <stop
                            offset="100%"
                            stopColor={seriesColor.avg}
                            stopOpacity={0}
                        />
                    </linearGradient>
                </defs>
                <YAxis hide domain={[0, 'dataMax']} />
                <Tooltip
                    isAnimationActive={false}
                    cursor={{ stroke: 'var(--chart-axis)', strokeOpacity: 0.4 }}
                    allowEscapeViewBox={{ x: true, y: true }}
                    wrapperStyle={{ zIndex: 20 }}
                    content={({ active, payload }) => {
                        if (!active || !payload?.length) {
                            return null;
                        }

                        const point = payload[0].payload as TrendPoint;

                        return (
                            <ChartTooltipCard
                                t={point.t}
                                slot={slot}
                                rows={[
                                    {
                                        name: 'Requests',
                                        color: seriesColor.avg,
                                        value: formatCount(point.requests),
                                    },
                                    {
                                        name: '5xx',
                                        color: seriesColor.error,
                                        value: formatCount(point.errors),
                                    },
                                ]}
                            />
                        );
                    }}
                />
                <Area
                    type="monotone"
                    dataKey="requests"
                    stroke={seriesColor.avg}
                    strokeWidth={1.25}
                    fill={`url(#trend-${app.id})`}
                    dot={false}
                    activeDot={{ r: 2.5, strokeWidth: 0 }}
                    isAnimationActive={false}
                />
                {hasErrors && (
                    <Area
                        type="monotone"
                        dataKey="errors"
                        stroke={seriesColor.error}
                        strokeWidth={1.25}
                        fill={seriesColor.error}
                        fillOpacity={0.15}
                        dot={false}
                        activeDot={{ r: 2.5, strokeWidth: 0 }}
                        isAnimationActive={false}
                    />
                )}
            </AreaChart>
        </div>
    );
}

/**
 * Every app's requests (or 5xx) stacked over time: the busiest apps get a
 * colour each, the rest share one band.
 */
function TeamTraffic({ apps }: { apps: OverviewApp[] }) {
    const [metric, setMetric] = useState<'requests' | 'errors'>('requests');
    const ranked = [...apps]
        .filter((app) => app.trend.some((point) => point[metric] > 0))
        .sort((a, b) =>
            metric === 'requests'
                ? b.requests - a.requests
                : b.server_errors - a.server_errors,
        );
    const named = ranked.slice(0, categoryColors.length - 1);
    const rest = ranked.slice(categoryColors.length - 1);
    const timeline = apps.find((app) => app.trend.length)?.trend ?? [];

    const data = timeline.map((point, index) => {
        const row: { t: number; [key: string]: number } = { t: point.t };
        named.forEach((app) => {
            row[`app_${app.id}`] = app.trend[index]?.[metric] ?? 0;
        });

        if (rest.length) {
            row.other = rest.reduce(
                (sum, app) => sum + (app.trend[index]?.[metric] ?? 0),
                0,
            );
        }

        return row;
    });

    const series = [
        ...named.map((app, index) => ({
            key: `app_${app.id}`,
            name: app.name,
            color: categoryColors[index],
            total: metric === 'requests' ? app.requests : app.server_errors,
        })),
        ...(rest.length
            ? [
                  {
                      key: 'other',
                      name: `${rest.length} other${rest.length === 1 ? '' : 's'}`,
                      color: seriesColor.ok,
                      total: rest.reduce(
                          (sum, app) =>
                              sum +
                              (metric === 'requests'
                                  ? app.requests
                                  : app.server_errors),
                          0,
                      ),
                  },
              ]
            : []),
    ];
    const legend = useHiddenSeries(
        'overview-apps',
        series.map((item) => item.key),
    );
    const shown = legend.visible(series);
    const total = shown.reduce((sum, item) => sum + item.total, 0);

    return (
        <ChartCard
            title={metric === 'requests' ? 'Requests by app' : '5xx by app'}
            value={formatCount(total)}
            legend={
                <div className="flex rounded-md border border-border p-0.5 text-[11px]">
                    {(['requests', 'errors'] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setMetric(option)}
                            className={cn(
                                'rounded-sm px-2 py-0.5 transition-colors',
                                metric === option
                                    ? 'bg-muted text-foreground'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {option === 'requests' ? 'Requests' : '5xx'}
                        </button>
                    ))}
                </div>
            }
        >
            {series.length === 0 ? (
                <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground">
                    {metric === 'requests'
                        ? 'No requests in this period'
                        : 'No server errors in this period'}
                </div>
            ) : (
                <>
                    <TimeSeriesChart
                        data={data}
                        height={200}
                        series={shown.map((item) => ({
                            key: item.key,
                            name: item.name,
                            color: item.color,
                            kind: 'bar',
                            stack: 'apps',
                        }))}
                        footer={(point) => ({
                            name: legend.anyHidden ? 'Shown apps' : 'All apps',
                            value: formatCount(
                                shown.reduce(
                                    (sum, item) =>
                                        sum + Number(point[item.key] ?? 0),
                                    0,
                                ),
                            ),
                        })}
                    />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pt-2 pb-1">
                        {series.map((item) => (
                            <LegendItem
                                key={item.key}
                                color={item.color}
                                label={item.name}
                                value={formatCount(item.total)}
                                {...legend.itemProps(item.key)}
                            />
                        ))}
                        {legend.anyHidden && (
                            <ShowAllSeries onClick={legend.showAll} />
                        )}
                    </div>
                </>
            )}
        </ChartCard>
    );
}

function Stat({
    label,
    value,
    detail,
    tone,
}: {
    label: string;
    value: string;
    detail?: string;
    tone?: string;
}) {
    return (
        <div className="min-w-0 px-5 py-4">
            <div className="text-[11px] font-medium text-foreground/45">
                {label}
            </div>
            <div
                className={cn(
                    'mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums',
                    tone ?? 'text-foreground',
                )}
            >
                {value}
            </div>
            {detail && (
                <div className="mt-0.5 truncate text-[11px] text-foreground/40">
                    {detail}
                </div>
            )}
        </div>
    );
}

function Meter({ label, percent }: { label: string; percent: number | null }) {
    const tone = usageTone(percent);

    return (
        <span
            className="flex items-center gap-1.5"
            title={`${label} ${formatPercent(percent)}`}
        >
            <span className="text-foreground/40">{label}</span>
            <span className="h-1 w-10 overflow-hidden rounded-full bg-foreground/10">
                <span
                    className={cn('block h-full rounded-full', tone.bar)}
                    style={{ width: `${Math.min(100, percent ?? 0)}%` }}
                />
            </span>
            <span className={cn('tabular-nums', tone.text)}>
                {percent === null ? '—' : `${Math.round(percent)}%`}
            </span>
        </span>
    );
}

function GroupHeader({
    group,
    teamSlug,
}: {
    group: OverviewGroup;
    teamSlug: string;
}) {
    const server = group.server;

    if (!server) {
        return (
            <div className="flex items-center gap-2 px-4 py-3 text-[13px] font-medium text-foreground/50">
                <ServerIcon className="size-3.5" />
                No server
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
            <Link
                href={`/${teamSlug}/servers/${server.id}`}
                prefetch
                className="group flex min-w-0 items-center gap-2 text-[13px] font-medium text-foreground"
            >
                <ServerIcon className="size-3.5 text-foreground/40" />
                <span className="truncate">{server.name}</span>
                <span
                    title={server.is_online ? 'Online' : 'Offline'}
                    className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        server.is_online ? 'bg-emerald-500' : 'bg-red-500',
                    )}
                />
                <ArrowUpRight className="size-3.5 text-foreground/0 transition-colors group-hover:text-foreground/50" />
            </Link>
            {server.latest ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                    <Meter label="CPU" percent={server.latest.cpu} />
                    <Meter label="Mem" percent={server.latest.memory} />
                    <Meter label="Disk" percent={server.latest.disk} />
                </div>
            ) : (
                <span className="text-[11px] text-foreground/40">
                    No samples yet
                </span>
            )}
        </div>
    );
}

function AppRow({
    app,
    teamSlug,
    period,
    slot,
}: {
    app: OverviewApp;
    teamSlug: string;
    period: string;
    slot: number;
}) {
    const href = `/${teamSlug}/${app.slug}/dashboard?period=${encodeURIComponent(period)}`;

    return (
        <tr className="group border-t border-border/60 transition-colors hover:bg-foreground/[0.03]">
            <td className="py-2 pr-3 pl-4">
                <Link
                    href={href}
                    prefetch
                    className="flex min-w-0 items-center gap-2.5"
                >
                    <ProjectTile project={app} />
                    <span className="truncate text-[13px] font-medium text-foreground">
                        {app.name}
                    </span>
                    <UptimeDot uptime={app.uptime} />
                </Link>
            </td>
            <td className="px-3 py-1">
                <Link href={href} tabIndex={-1} className="block">
                    <Trend app={app} slot={slot} />
                </Link>
            </td>
            <td className="px-3 py-2 text-right text-[13px] text-foreground tabular-nums">
                {formatCount(app.requests)}
            </td>
            <td
                className={cn(
                    'px-3 py-2 text-right text-[13px] tabular-nums',
                    errorTone(app.error_rate),
                )}
                title={`${app.server_errors.toLocaleString('en-GB')} server errors, ${app.client_errors.toLocaleString('en-GB')} client errors`}
            >
                {app.error_rate === null ? '—' : `${app.error_rate}%`}
            </td>
            <td
                className={cn(
                    'px-3 py-2 text-right text-[13px] tabular-nums',
                    latencyTone(app.p95_ms),
                )}
                title={
                    app.avg_ms === null
                        ? undefined
                        : `Average ${formatMs(app.avg_ms)}`
                }
            >
                {formatMs(app.p95_ms, true)}
            </td>
            <td
                className={cn(
                    'px-3 py-2 text-right text-[13px] tabular-nums',
                    app.exceptions > 0
                        ? 'text-foreground/80'
                        : 'text-foreground/40',
                )}
            >
                {formatCount(app.exceptions)}
            </td>
            <td
                className={cn(
                    'py-2 pr-4 pl-3 text-right text-[13px] tabular-nums',
                    app.failed_jobs > 0 ? 'text-red-500' : 'text-foreground/40',
                )}
                title={`${app.jobs.toLocaleString('en-GB')} jobs`}
            >
                {formatCount(app.failed_jobs)}
            </td>
        </tr>
    );
}

export default function Overview({
    totals,
    groups,
    period,
    slot_seconds,
}: OverviewProps) {
    const { props }: any = usePage();
    const teamSlug: string = props.currentTeam?.slug ?? '';
    const servers = groups.filter((group) => group.server !== null).length;

    usePoll(60_000);

    return (
        <>
            <Head title="Overview" />

            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    Overview
                </h1>
                <p className="mt-1 text-[13px] text-foreground/45">
                    {totals.apps} app{totals.apps === 1 ? '' : 's'} on {servers}{' '}
                    server{servers === 1 ? '' : 's'} ·{' '}
                    {PERIOD_LABELS[period] ?? 'selected range'} · refreshes
                    every minute
                </p>
            </div>

            {totals.apps === 0 ? (
                <Card className="items-center gap-3 border-border bg-card p-10 text-center">
                    <Radar className="size-10 text-foreground/20" />
                    <div className="text-lg font-semibold text-foreground">
                        No apps yet
                    </div>
                    <Link
                        href={`/${teamSlug}/projects/create`}
                        className="text-[13px] text-foreground/60 underline-offset-4 hover:text-foreground hover:underline"
                    >
                        Add your first application
                    </Link>
                </Card>
            ) : (
                <>
                    <Card className="grid grid-cols-2 gap-0 divide-border/60 overflow-hidden border-border bg-card p-0 sm:grid-cols-3 sm:divide-x xl:grid-cols-6">
                        <Stat
                            label="Requests"
                            value={formatCount(totals.requests)}
                        />
                        <Stat
                            label="Error rate"
                            value={
                                totals.error_rate === null
                                    ? '—'
                                    : `${totals.error_rate}%`
                            }
                            detail={`${totals.server_errors.toLocaleString('en-GB')} server errors`}
                            tone={
                                totals.error_rate
                                    ? errorTone(totals.error_rate)
                                    : undefined
                            }
                        />
                        <Stat
                            label="p95 response"
                            value={formatMs(totals.p95_ms, true)}
                            detail="95% of requests finish within"
                        />
                        <Stat
                            label="Exceptions"
                            value={formatCount(totals.exceptions)}
                        />
                        <Stat
                            label="Failed jobs"
                            value={formatCount(totals.failed_jobs)}
                            detail={`of ${formatCount(totals.jobs)} jobs`}
                            tone={
                                totals.failed_jobs > 0
                                    ? 'text-red-500'
                                    : undefined
                            }
                        />
                        <Stat
                            label="Uptime"
                            value={`${totals.apps_up} up`}
                            detail={
                                totals.apps_down > 0
                                    ? `${totals.apps_down} down`
                                    : 'nothing down'
                            }
                            tone={
                                totals.apps_down > 0
                                    ? 'text-red-500'
                                    : undefined
                            }
                        />
                    </Card>

                    <TeamTraffic
                        apps={groups.flatMap((group) => group.projects)}
                    />

                    <div className="enter-stagger space-y-4">
                        {groups.map((group) => (
                            <Card
                                key={group.server?.id ?? 'none'}
                                className="gap-0 overflow-hidden border-border bg-card p-0"
                            >
                                <GroupHeader
                                    group={group}
                                    teamSlug={teamSlug}
                                />
                                {group.projects.length === 0 ? (
                                    <div className="border-t border-border/60 px-4 py-3 text-[12px] text-foreground/40">
                                        No apps linked to this server
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[720px]">
                                            <thead>
                                                <tr className="border-t border-border/60 text-[11px] text-foreground/40">
                                                    <th className="py-2 pr-3 pl-4 text-left font-medium">
                                                        App
                                                    </th>
                                                    <th className="w-44 px-3 py-2 text-left font-medium">
                                                        Traffic
                                                    </th>
                                                    <th className="w-24 px-3 py-2 text-right font-medium">
                                                        Requests
                                                    </th>
                                                    <th className="w-24 px-3 py-2 text-right font-medium">
                                                        5xx
                                                    </th>
                                                    <th className="w-24 px-3 py-2 text-right font-medium">
                                                        p95
                                                    </th>
                                                    <th className="w-24 px-3 py-2 text-right font-medium">
                                                        Exceptions
                                                    </th>
                                                    <th className="w-28 py-2 pr-4 pl-3 text-right font-medium">
                                                        Failed jobs
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.projects.map((app) => (
                                                    <AppRow
                                                        key={app.id}
                                                        app={app}
                                                        teamSlug={teamSlug}
                                                        period={period}
                                                        slot={slot_seconds}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                </>
            )}
        </>
    );
}

Overview.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[{ title: 'Overview', href: '#' }]}
    />
);
