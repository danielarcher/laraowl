import { Head, usePage, usePoll } from '@inertiajs/react';
import { Server as ServerIcon } from 'lucide-react';
import { FleetSummary } from '@/components/servers/fleet-summary';
import { ServerCard } from '@/components/servers/server-card';
import { ServerList } from '@/components/servers/server-list';
import type { ServersView } from '@/components/servers/servers-toolbar';
import { ServersToolbar } from '@/components/servers/servers-toolbar';
import { Card } from '@/components/ui/card';
import { useCostSplit } from '@/hooks/use-cost-split';
import { usePersistedState } from '@/hooks/use-persisted-state';
import AppLayout from '@/layouts/app-layout';
import type { ServerCost } from '@/lib/costs';
import { formatMoney } from '@/lib/costs';
import type { ServerOverview } from '@/lib/server-metrics';
import type { ServerSortKey, SortDirection } from '@/lib/server-sort';
import { SORT_KEYS, sortServers } from '@/lib/server-sort';

type ServersIndexProps = {
    servers: ServerOverview[];
    costs: Record<string, ServerCost> | null;
    agentUrl: string;
};

const VIEWS: readonly ServersView[] = ['grid', 'list'];
const DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];

export default function ServersIndex({
    servers,
    costs,
    agentUrl,
}: ServersIndexProps) {
    const { props }: any = usePage();
    const teamSlug: string = props.currentTeam?.slug ?? '';
    const online = servers.filter((server) => server.is_online).length;
    const [split, setSplit] = useCostSplit();
    const [view, setView] = usePersistedState(
        'laraowl.servers-view',
        VIEWS,
        'grid',
    );
    const [sort, setSort] = usePersistedState<ServerSortKey>(
        'laraowl.servers-sort',
        SORT_KEYS,
        'name',
    );
    const [direction, setDirection] = usePersistedState(
        'laraowl.servers-sort-dir',
        DIRECTIONS,
        'asc',
    );
    const monthly = costs
        ? Object.values(costs).reduce(
              (sum, cost) => sum + cost.monthly_cents,
              0,
          )
        : 0;
    const priced = costs !== null && monthly > 0;
    const sorted = sortServers(servers, costs, sort, direction);

    usePoll(60_000);

    return (
        <>
            <Head title="Servers" />

            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                        Servers
                    </h1>
                    <p className="mt-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                        {servers.length} server{servers.length === 1 ? '' : 's'}{' '}
                        · {online} online
                        {priced ? ` · ${formatMoney(monthly)}/mo` : ''} ·
                        refreshes every minute
                    </p>
                </div>
                {servers.length > 0 && (
                    <ServersToolbar
                        view={view}
                        onViewChange={setView}
                        sort={sort}
                        onSortChange={setSort}
                        direction={direction}
                        onDirectionChange={setDirection}
                        split={priced ? split : null}
                        onSplitChange={setSplit}
                    />
                )}
            </div>

            {servers.length === 0 ? (
                <Card className="border-border bg-card p-10">
                    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
                        <ServerIcon className="size-12 text-muted-foreground/30" />
                        <div className="text-2xl font-semibold tracking-tight text-foreground">
                            No servers yet
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Register a server, then run the agent on it every
                            minute. It posts CPU, memory, swap, disk and load.
                        </p>
                        <pre className="w-full overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-left text-xs text-foreground">
                            {`php artisan laraowl:servers:create ${teamSlug || '<team>'} "web-1"\n# then follow the printed steps; the agent lives at\n${agentUrl}`}
                        </pre>
                    </div>
                </Card>
            ) : (
                <>
                    <FleetSummary
                        servers={servers}
                        costs={priced ? costs : null}
                    />

                    {view === 'list' ? (
                        <ServerList
                            servers={sorted}
                            costs={costs}
                            split={split}
                            teamSlug={teamSlug}
                        />
                    ) : (
                        <div className="enter-stagger grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {sorted.map((server) => (
                                <ServerCard
                                    key={server.id}
                                    server={server}
                                    cost={costs?.[server.id] ?? null}
                                    split={split}
                                    teamSlug={teamSlug}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </>
    );
}

ServersIndex.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[{ title: 'Servers', href: '#' }]}
    />
);
