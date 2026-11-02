import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { Clock, Gauge, HardDrive, MemoryStick } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { ServerFlags } from '@/components/servers/server-flags';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { CostSplit, ServerCost } from '@/lib/costs';
import { formatMoney, shareCents } from '@/lib/costs';
import type { ServerOverview } from '@/lib/server-metrics';
import {
    formatAgo,
    formatBytes,
    formatPercent,
    formatUptime,
    usageTone,
} from '@/lib/server-metrics';
import { cn } from '@/lib/utils';

function UsageRow({
    icon: Icon,
    label,
    percent,
    detail,
}: {
    icon: LucideIcon;
    label: string;
    percent: number | null;
    detail: string;
}) {
    const tone = usageTone(percent);

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-semibold tracking-widest uppercase">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon className="size-3" />
                    {label}
                </span>
                <span className="flex items-center gap-2">
                    <span className="font-medium tracking-normal text-muted-foreground normal-case">
                        {detail}
                    </span>
                    <span className={tone.text}>{formatPercent(percent)}</span>
                </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                    className={cn(
                        'h-full rounded-full transition-all',
                        tone.bar,
                    )}
                    style={{ width: `${Math.min(100, percent ?? 0)}%` }}
                />
            </div>
        </div>
    );
}

export function StatusDot({ server }: { server: ServerOverview }) {
    if (!server.last_seen_at) {
        return (
            <span className="size-2.5 rounded-full bg-muted-foreground/40" />
        );
    }

    return server.is_online ? (
        <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
        </span>
    ) : (
        <span className="size-2.5 rounded-full bg-red-500" />
    );
}

/**
 * The server's apps with their share of its monthly price.
 */
function AppShares({ cost, split }: { cost: ServerCost; split: CostSplit }) {
    if (cost.apps.length === 0) {
        return (
            <div className="text-[11px] text-muted-foreground">
                No apps · {formatMoney(cost.monthly_cents)} not split
            </div>
        );
    }

    return (
        <ul className="w-full space-y-1">
            <li className="flex items-center justify-between gap-3 text-[9px] font-semibold tracking-widest text-muted-foreground uppercase">
                <span>App</span>
                <span className="flex shrink-0 items-center gap-3">
                    <span className="w-12 text-right">Traffic</span>
                    <span className="w-16 text-right">Monthly</span>
                </span>
            </li>
            {cost.apps.map((app) => (
                <li
                    key={app.slug}
                    className="flex items-center justify-between gap-3 text-[11px]"
                >
                    <span className="truncate text-foreground/80">
                        {app.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-3 tabular-nums">
                        <span className="w-12 text-right text-muted-foreground">
                            {app.traffic_share === null
                                ? '—'
                                : `${app.traffic_share}%`}
                        </span>
                        <span className="w-16 text-right font-medium text-foreground">
                            {formatMoney(shareCents(app, split))}
                        </span>
                    </span>
                </li>
            ))}
        </ul>
    );
}

export function ServerCard({
    server,
    cost,
    split,
    teamSlug,
}: {
    server: ServerOverview;
    cost: ServerCost | null;
    split: CostSplit;
    teamSlug: string;
}) {
    const latest = server.latest;
    const cpuTone = usageTone(latest?.cpu);

    return (
        <Link
            href={`/${teamSlug}/servers/${server.id}`}
            prefetch
            className="group block"
        >
            <Card className="h-full gap-0 border-border bg-card p-6 transition-colors group-hover:border-foreground/20">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                            <StatusDot server={server} />
                            <h3 className="truncate text-lg font-semibold tracking-tight text-foreground">
                                {server.name}
                            </h3>
                        </div>
                        <div className="mt-1 truncate text-[11px] text-muted-foreground">
                            {cost && (
                                <span
                                    className="font-medium text-foreground tabular-nums"
                                    data-test="server-price"
                                >
                                    {formatMoney(cost.monthly_cents)}/mo
                                    {' · '}
                                </span>
                            )}
                            {[server.hostname, server.ip_address]
                                .filter(Boolean)
                                .join(' · ') || 'Waiting for the agent'}
                        </div>
                        <ServerFlags
                            insights={server.insights}
                            className="mt-2"
                        />
                    </div>
                    <div className="text-right">
                        <div
                            className={cn(
                                'text-3xl font-semibold tracking-tight',
                                cpuTone.text,
                            )}
                        >
                            {latest ? `${Math.round(latest.cpu)}%` : '—'}
                        </div>
                        <div className="text-[9px] font-semibold tracking-widest text-muted-foreground uppercase">
                            CPU
                            {server.cpu_count
                                ? ` · ${server.cpu_count} vCPU`
                                : ''}
                        </div>
                    </div>
                </div>

                <div className="-mx-2 mb-5 h-12">
                    {server.sparkline.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={server.sparkline}>
                                <defs>
                                    <linearGradient
                                        id={`spark-${server.id}`}
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="5%"
                                            stopColor={cpuTone.hex}
                                            stopOpacity={0.3}
                                        />
                                        <stop
                                            offset="95%"
                                            stopColor={cpuTone.hex}
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>
                                <YAxis hide domain={[0, 100]} />
                                <Area
                                    type="monotone"
                                    dataKey="cpu"
                                    stroke={cpuTone.hex}
                                    strokeWidth={1.5}
                                    fill={`url(#spark-${server.id})`}
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-[9px] font-semibold tracking-widest text-muted-foreground uppercase opacity-40">
                            CPU sparkline fills in over the first hour
                        </div>
                    )}
                </div>

                {latest ? (
                    <div className="space-y-3.5">
                        <UsageRow
                            icon={MemoryStick}
                            label="Memory"
                            percent={latest.memory}
                            detail={`${formatBytes(latest.memory_used)} / ${formatBytes(latest.memory_total)}`}
                        />
                        <UsageRow
                            icon={HardDrive}
                            label="Disk"
                            percent={latest.disk}
                            detail={`${formatBytes(latest.disk_used)} / ${formatBytes(latest.disk_total)}`}
                        />
                        {latest.swap_total > 0 && (
                            <UsageRow
                                icon={MemoryStick}
                                label="Swap"
                                percent={latest.swap}
                                detail={`${formatBytes(latest.swap_used)} / ${formatBytes(latest.swap_total)}`}
                            />
                        )}
                        <div className="flex items-center justify-between pt-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                            <span className="flex items-center gap-1.5">
                                <Gauge className="size-3" />
                                Load{' '}
                                <span className="font-mono tracking-normal text-foreground">
                                    {latest.load
                                        .map((value) => value.toFixed(2))
                                        .join(' · ')}
                                </span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Clock className="size-3" />
                                Up {formatUptime(latest.uptime_seconds)}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                        No samples yet
                    </div>
                )}

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/50 pt-4">
                    {cost ? (
                        <div className="min-w-0 flex-1">
                            <AppShares cost={cost} split={split} />
                        </div>
                    ) : (
                        <div className="flex min-w-0 flex-wrap gap-1.5">
                            {server.projects.length > 0 ? (
                                server.projects.map((project) => (
                                    <Badge
                                        key={project.slug}
                                        variant="secondary"
                                        className="text-[10px]"
                                    >
                                        {project.name}
                                    </Badge>
                                ))
                            ) : (
                                <span className="text-[10px] text-muted-foreground">
                                    {server.os ?? 'No apps reporting'}
                                </span>
                            )}
                        </div>
                    )}
                    <span className="shrink-0 self-start text-[10px] text-muted-foreground">
                        {formatAgo(server.last_seen_at)}
                    </span>
                </div>
            </Card>
        </Link>
    );
}
