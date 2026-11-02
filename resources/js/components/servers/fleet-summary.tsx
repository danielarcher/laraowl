import { Card } from '@/components/ui/card';
import type { ServerCost } from '@/lib/costs';
import { formatMoney } from '@/lib/costs';
import type { ServerOverview } from '@/lib/server-metrics';
import { formatBytes, usageTone } from '@/lib/server-metrics';
import { cn } from '@/lib/utils';

function Figure({
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

/**
 * The whole fleet at a glance: what it has, how busy it is, what it costs
 * and how many servers need a look.
 */
export function FleetSummary({
    servers,
    costs,
}: {
    servers: ServerOverview[];
    costs: Record<string, ServerCost> | null;
}) {
    // Live figures only count servers that are reporting right now.
    const sampled = servers.filter(
        (server) => server.is_online && server.latest !== null,
    );
    const sum = (pick: (server: ServerOverview) => number) =>
        sampled.reduce((total, server) => total + pick(server), 0);

    const memoryUsed = sum((server) => server.latest?.memory_used ?? 0);
    const memoryTotal = sum((server) => server.latest?.memory_total ?? 0);
    const memoryPercent =
        memoryTotal > 0 ? (memoryUsed / memoryTotal) * 100 : null;
    const ramTotal = servers.reduce(
        (total, server) => total + (server.latest?.memory_total ?? 0),
        0,
    );
    // Older agents don't report cores, so the count is only given when every server does.
    const vcpus = servers.every((server) => server.cpu_count !== null)
        ? servers.reduce((total, server) => total + (server.cpu_count ?? 0), 0)
        : null;
    // CPU weighted by cores, so a busy 1-vCPU box counts for less than a busy 4-vCPU one.
    const cores = sum((server) => server.cpu_count ?? 1);
    const cpu =
        cores > 0
            ? sum(
                  (server) =>
                      (server.latest?.cpu ?? 0) * (server.cpu_count ?? 1),
              ) / cores
            : null;
    const weekCpu = servers.filter((server) => server.insights);
    const flagged = servers.filter((server) =>
        server.insights?.flags.some((flag) => flag.tone !== 'info'),
    );
    const monthly = costs
        ? Object.values(costs).reduce(
              (total, cost) => total + cost.monthly_cents,
              0,
          )
        : null;

    return (
        <Card
            className={cn(
                'grid grid-cols-2 gap-0 divide-border/60 overflow-hidden border-border bg-card p-0 sm:divide-x',
                monthly !== null ? 'md:grid-cols-5' : 'md:grid-cols-4',
            )}
            data-test="fleet-summary"
        >
            <Figure
                label="Capacity"
                value={`${formatBytes(ramTotal)} RAM`}
                detail={`${servers.length} servers${vcpus === null ? '' : ` · ${vcpus} vCPU`} · ${sampled.length} online`}
            />
            <Figure
                label="CPU now"
                value={cpu === null ? '—' : `${Math.round(cpu)}%`}
                detail={
                    weekCpu.length
                        ? `7d average ${Math.round(weekCpu.reduce((total, server) => total + (server.insights?.cpu_avg ?? 0), 0) / weekCpu.length)}%`
                        : undefined
                }
                tone={usageTone(cpu).text}
            />
            <Figure
                label="Memory"
                value={
                    memoryPercent === null
                        ? '—'
                        : `${Math.round(memoryPercent)}%`
                }
                detail={
                    memoryTotal > 0
                        ? `${formatBytes(memoryUsed)} of ${formatBytes(memoryTotal)}`
                        : undefined
                }
                tone={usageTone(memoryPercent).text}
            />
            {monthly !== null && (
                <Figure
                    label="Servers cost"
                    value={formatMoney(monthly)}
                    detail="per month"
                />
            )}
            <Figure
                label="Needs attention"
                value={String(flagged.length)}
                detail={
                    flagged.length
                        ? flagged.map((server) => server.name).join(', ')
                        : 'nothing flagged this week'
                }
                tone={flagged.length ? 'text-amber-400' : undefined}
            />
        </Card>
    );
}
