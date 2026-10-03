import { Head, Link, usePage, usePoll } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    ArrowLeft,
    Clock,
    Cpu,
    Gauge,
    HardDrive,
    MemoryStick,
} from 'lucide-react';
import { categoryColors, seriesColor } from '@/components/charts/format';
import { ServerMetricChart } from '@/components/server-metric-chart';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import type {
    ServerPoint,
    ServerSample,
    ServerSummary,
} from '@/lib/server-metrics';
import {
    formatAgo,
    formatBytes,
    formatPercent,
    formatUptime,
    usageTone,
} from '@/lib/server-metrics';
import { cn } from '@/lib/utils';

type ServerShowProps = {
    server: ServerSummary;
    latest: ServerSample | null;
    history: ServerPoint[];
    bucket_seconds: number;
};

const percent = (value: number) => `${Math.round(value)}%`;

function StatTile({
    icon: Icon,
    label,
    value,
    tone,
    detail,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    tone?: string;
    detail: string;
}) {
    return (
        <Card className="group relative gap-0 overflow-hidden border-border bg-card p-6">
            <div className="absolute top-0 right-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
                <Icon className="size-20" />
            </div>
            <div className="mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase opacity-50">
                {label}
            </div>
            <div
                className={cn(
                    'mb-1 text-3xl font-semibold tracking-tight',
                    tone ?? 'text-foreground',
                )}
            >
                {value}
            </div>
            <div className="text-[11px] text-muted-foreground">{detail}</div>
        </Card>
    );
}

export default function ServerShow({
    server,
    latest,
    history,
    bucket_seconds,
}: ServerShowProps) {
    const { props }: any = usePage();
    const teamSlug: string = props.currentTeam?.slug ?? '';
    const spansDays =
        history.length > 1 &&
        history[history.length - 1].timestamp - history[0].timestamp > 86400;

    usePoll(60_000);

    const status = !server.last_seen_at
        ? {
              label: 'Waiting for agent',
              className: 'bg-muted text-muted-foreground',
          }
        : server.is_online
          ? { label: 'Online', className: 'bg-emerald-500/15 text-emerald-500' }
          : { label: 'Offline', className: 'bg-red-500/15 text-red-500' };

    return (
        <>
            <Head title={`${server.name} - Servers`} />

            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <Link
                        href={`/${teamSlug}/servers`}
                        className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase hover:text-foreground"
                    >
                        <ArrowLeft className="size-3" />
                        All servers
                    </Link>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            {server.name}
                        </h1>
                        <span
                            className={cn(
                                'rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-widest uppercase',
                                status.className,
                            )}
                        >
                            {status.label}
                        </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        {server.hostname && <span>{server.hostname}</span>}
                        {server.ip_address && <span>{server.ip_address}</span>}
                        {server.os && <span>{server.os}</span>}
                        {server.cpu_count && (
                            <span>{server.cpu_count} vCPU</span>
                        )}
                        <span>
                            Last sample {formatAgo(server.last_seen_at)}
                        </span>
                    </div>
                </div>
                {server.projects.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                            Apps
                        </span>
                        {server.projects.map((project) => (
                            <Link
                                key={project.slug}
                                href={`/${teamSlug}/${project.slug}/dashboard`}
                            >
                                <Badge variant="secondary">
                                    {project.name}
                                </Badge>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-6 lg:grid-cols-5">
                <StatTile
                    icon={Cpu}
                    label="CPU"
                    value={latest ? formatPercent(latest.cpu) : '—'}
                    tone={usageTone(latest?.cpu).text}
                    detail={
                        server.cpu_count
                            ? `${server.cpu_count} vCPU`
                            : 'Busy share'
                    }
                />
                <StatTile
                    icon={MemoryStick}
                    label="Memory"
                    value={formatPercent(latest?.memory)}
                    tone={usageTone(latest?.memory).text}
                    detail={
                        latest
                            ? `${formatBytes(latest.memory_used)} / ${formatBytes(latest.memory_total)}`
                            : '—'
                    }
                />
                <StatTile
                    icon={MemoryStick}
                    label="Swap"
                    value={
                        latest && latest.swap_total > 0
                            ? formatPercent(latest.swap)
                            : 'Off'
                    }
                    tone={usageTone(latest?.swap).text}
                    detail={
                        latest && latest.swap_total > 0
                            ? `${formatBytes(latest.swap_used)} / ${formatBytes(latest.swap_total)}`
                            : 'No swap configured'
                    }
                />
                <StatTile
                    icon={HardDrive}
                    label="Disk /"
                    value={formatPercent(latest?.disk)}
                    tone={usageTone(latest?.disk).text}
                    detail={
                        latest
                            ? `${formatBytes(latest.disk_used)} / ${formatBytes(latest.disk_total)}`
                            : '—'
                    }
                />
                <StatTile
                    icon={Gauge}
                    label="Load"
                    value={latest ? latest.load[0].toFixed(2) : '—'}
                    detail={
                        latest
                            ? `5m ${latest.load[1].toFixed(2)} · 15m ${latest.load[2].toFixed(2)} · up ${formatUptime(latest.uptime_seconds)}`
                            : '—'
                    }
                />
            </div>

            <div className="enter-stagger grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ServerMetricChart
                    title="CPU"
                    icon={Cpu}
                    data={history}
                    withDate={spansDays}
                    domain={[0, 100]}
                    format={percent}
                    series={[
                        {
                            key: 'cpu',
                            label: 'Avg',
                            color: seriesColor.avg,
                            kind: 'area',
                        },
                        {
                            key: 'cpu_max',
                            label: 'Peak',
                            color: seriesColor.p95,
                            kind: 'line',
                            dashed: true,
                        },
                    ]}
                />
                <ServerMetricChart
                    title="Memory"
                    icon={MemoryStick}
                    data={history}
                    withDate={spansDays}
                    domain={[0, 100]}
                    format={percent}
                    series={[
                        {
                            key: 'memory',
                            label: 'RAM',
                            color: categoryColors[1],
                            kind: 'area',
                        },
                        {
                            key: 'swap',
                            label: 'Swap',
                            color: categoryColors[7],
                            kind: 'line',
                        },
                    ]}
                />
                <ServerMetricChart
                    title="Load average"
                    icon={Gauge}
                    data={history}
                    withDate={spansDays}
                    format={(value) => value.toFixed(2)}
                    summary={
                        server.cpu_count
                            ? `${server.cpu_count} vCPU`
                            : undefined
                    }
                    series={[
                        {
                            key: 'load_1',
                            label: '1m',
                            color: seriesColor.good,
                            kind: 'area',
                        },
                        {
                            key: 'load_5',
                            label: '5m',
                            color: seriesColor.avg,
                            kind: 'line',
                        },
                        {
                            key: 'load_15',
                            label: '15m',
                            color: seriesColor.ok,
                            kind: 'line',
                            dashed: true,
                        },
                    ]}
                />
                <ServerMetricChart
                    title="Disk"
                    icon={HardDrive}
                    data={history}
                    withDate={spansDays}
                    domain={[0, 100]}
                    format={percent}
                    series={[
                        {
                            key: 'disk',
                            label: 'Root',
                            color: categoryColors[6],
                            kind: 'area',
                        },
                    ]}
                />
            </div>

            {latest && latest.disks.length > 0 && (
                <Card className="gap-0 overflow-hidden border-border bg-card">
                    <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-foreground uppercase">
                            <HardDrive className="size-3.5 text-muted-foreground" />
                            Filesystems
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Clock className="size-3" />
                            {bucket_seconds >= 3600
                                ? `${bucket_seconds / 3600}h`
                                : `${bucket_seconds / 60}m`}{' '}
                            chart buckets
                        </div>
                    </div>
                    <div className="divide-y divide-border/50">
                        {latest.disks.map((disk) => {
                            const tone = usageTone(disk.percent);

                            return (
                                <div
                                    key={disk.mount}
                                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 px-6 py-4 md:grid-cols-[200px_minmax(0,1fr)_160px]"
                                >
                                    <span className="truncate font-mono text-xs text-foreground">
                                        {disk.mount}
                                    </span>
                                    <span className="text-right text-[11px] text-muted-foreground md:order-last">
                                        {formatBytes(disk.used)} /{' '}
                                        {formatBytes(disk.total)}{' '}
                                        <span
                                            className={cn(
                                                'font-semibold',
                                                tone.text,
                                            )}
                                        >
                                            {formatPercent(disk.percent)}
                                        </span>
                                    </span>
                                    <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted md:col-span-1">
                                        <div
                                            className={cn(
                                                'h-full rounded-full',
                                                tone.bar,
                                            )}
                                            style={{
                                                width: `${Math.min(100, disk.percent ?? 0)}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}
        </>
    );
}

ServerShow.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[
            { title: 'Servers', href: '#' },
            { title: 'Details', href: '#' },
        ]}
    />
);
