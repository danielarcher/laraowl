import { router } from '@inertiajs/react';
import { Area, AreaChart, YAxis } from 'recharts';
import { StatusDot } from '@/components/servers/server-card';
import { ServerFlags } from '@/components/servers/server-flags';
import { Card } from '@/components/ui/card';
import type { CostSplit, ServerCost } from '@/lib/costs';
import { formatMoney, shareCents } from '@/lib/costs';
import type { ServerOverview } from '@/lib/server-metrics';
import { formatAgo, formatBytes, usageTone } from '@/lib/server-metrics';
import { cn } from '@/lib/utils';

function Percent({
    value,
    detail,
}: {
    value: number | null | undefined;
    detail?: string;
}) {
    const tone = usageTone(value ?? null);

    return (
        <div className="space-y-1">
            <div className="flex items-baseline justify-end gap-1.5">
                {detail && (
                    <span className="text-[10px] text-muted-foreground">
                        {detail}
                    </span>
                )}
                <span className={cn('font-medium', tone.text)}>
                    {value === null || value === undefined
                        ? '—'
                        : `${Math.round(value)}%`}
                </span>
            </div>
            <div className="ml-auto h-1 w-16 overflow-hidden rounded-full bg-muted">
                <div
                    className={cn('h-full rounded-full', tone.bar)}
                    style={{ width: `${Math.min(100, value ?? 0)}%` }}
                />
            </div>
        </div>
    );
}

function Sparkline({ server }: { server: ServerOverview }) {
    const tone = usageTone(server.latest?.cpu);

    if (server.sparkline.length < 2) {
        return <div className="h-6 w-24" />;
    }

    return (
        <AreaChart width={96} height={24} data={server.sparkline}>
            <YAxis hide domain={[0, 100]} />
            <Area
                type="monotone"
                dataKey="cpu"
                stroke={tone.hex}
                strokeWidth={1.25}
                fill={tone.hex}
                fillOpacity={0.12}
                isAnimationActive={false}
            />
        </AreaChart>
    );
}

/**
 * Every server on one row: current load with its 7-day average, the disk
 * forecast, the apps and what the server costs.
 */
export function ServerList({
    servers,
    costs,
    split,
    teamSlug,
}: {
    servers: ServerOverview[];
    costs: Record<string, ServerCost> | null;
    split: CostSplit;
    teamSlug: string;
}) {
    return (
        <Card className="gap-0 overflow-hidden border-border bg-card p-0">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-[12px]">
                    <thead>
                        <tr className="border-b border-border/60 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                            <th className="py-3 pr-3 pl-5 text-left font-semibold">
                                Server
                            </th>
                            <th className="px-3 py-3 text-left font-semibold">
                                CPU · 1h
                            </th>
                            <th className="px-3 py-3 text-right font-semibold">
                                CPU
                            </th>
                            <th className="px-3 py-3 text-right font-semibold">
                                Memory
                            </th>
                            <th className="px-3 py-3 text-right font-semibold">
                                Swap
                            </th>
                            <th className="px-3 py-3 text-right font-semibold">
                                Disk
                            </th>
                            <th className="px-3 py-3 text-left font-semibold">
                                Apps
                            </th>
                            <th className="py-3 pr-5 pl-3 text-right font-semibold">
                                Price
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {servers.map((server) => {
                            const latest = server.latest;
                            const cost = costs?.[server.id] ?? null;
                            const forecast = server.insights?.disk_full_in_days;

                            return (
                                <tr
                                    key={server.id}
                                    data-test="server-row"
                                    onClick={() =>
                                        router.visit(
                                            `/${teamSlug}/servers/${server.id}`,
                                        )
                                    }
                                    className="cursor-pointer align-top transition-colors hover:bg-muted/30"
                                >
                                    <td className="py-3 pr-3 pl-5">
                                        <div className="flex items-center gap-2">
                                            <StatusDot server={server} />
                                            <span className="font-semibold text-foreground">
                                                {server.name}
                                            </span>
                                        </div>
                                        <div className="mt-0.5 pl-[18px] text-[11px] text-muted-foreground">
                                            {server.cpu_count
                                                ? `${server.cpu_count} vCPU · `
                                                : ''}
                                            {latest
                                                ? `${formatBytes(latest.memory_total)} RAM · `
                                                : ''}
                                            {formatAgo(server.last_seen_at)}
                                        </div>
                                        <ServerFlags
                                            insights={server.insights}
                                            className="mt-1.5 pl-[18px]"
                                        />
                                    </td>
                                    <td className="px-3 py-3">
                                        <Sparkline server={server} />
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        <Percent
                                            value={latest?.cpu}
                                            detail={
                                                server.insights
                                                    ? `7d ${Math.round(server.insights.cpu_avg)}%`
                                                    : undefined
                                            }
                                        />
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        <Percent
                                            value={latest?.memory}
                                            detail={
                                                latest
                                                    ? formatBytes(
                                                          latest.memory_used,
                                                      )
                                                    : undefined
                                            }
                                        />
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        <Percent
                                            value={
                                                latest && latest.swap_total > 0
                                                    ? latest.swap
                                                    : null
                                            }
                                        />
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        <Percent
                                            value={latest?.disk}
                                            detail={
                                                forecast !== null &&
                                                forecast !== undefined
                                                    ? `full ~${forecast}d`
                                                    : undefined
                                            }
                                        />
                                    </td>
                                    <td className="max-w-64 px-3 py-3 text-[11px] text-foreground/80">
                                        {server.projects.length === 0 ? (
                                            <span className="text-muted-foreground">
                                                —
                                            </span>
                                        ) : (
                                            server.projects
                                                .map((project) => {
                                                    const share =
                                                        cost?.apps.find(
                                                            (app) =>
                                                                app.slug ===
                                                                project.slug,
                                                        );

                                                    return share
                                                        ? `${project.name} ${formatMoney(shareCents(share, split))}`
                                                        : project.name;
                                                })
                                                .join(' · ')
                                        )}
                                    </td>
                                    <td className="py-3 pr-5 pl-3 text-right font-medium text-foreground tabular-nums">
                                        {cost
                                            ? `${formatMoney(cost.monthly_cents)}/mo`
                                            : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
