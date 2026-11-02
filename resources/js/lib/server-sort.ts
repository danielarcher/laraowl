import { attentionScore } from '@/components/servers/server-flags';
import type { ServerCost } from '@/lib/costs';
import type { ServerOverview } from '@/lib/server-metrics';

export type ServerSortKey =
    | 'name'
    | 'attention'
    | 'cpu'
    | 'memory'
    | 'disk'
    | 'swap'
    | 'price'
    | 'apps';

export type SortDirection = 'asc' | 'desc';

export const SERVER_SORTS: {
    key: ServerSortKey;
    label: string;
    direction: SortDirection;
}[] = [
    { key: 'name', label: 'Name', direction: 'asc' },
    { key: 'attention', label: 'Needs attention', direction: 'desc' },
    { key: 'cpu', label: 'CPU', direction: 'desc' },
    { key: 'memory', label: 'Memory', direction: 'desc' },
    { key: 'disk', label: 'Disk', direction: 'desc' },
    { key: 'swap', label: 'Swap', direction: 'desc' },
    { key: 'price', label: 'Price', direction: 'desc' },
    { key: 'apps', label: 'Apps', direction: 'desc' },
];

export const SORT_KEYS = SERVER_SORTS.map((sort) => sort.key);

/**
 * The value a server is ordered by; missing values sort last whatever the
 * direction.
 */
function sortValue(
    server: ServerOverview,
    cost: ServerCost | null,
    key: Exclude<ServerSortKey, 'name'>,
): number | null {
    switch (key) {
        case 'attention':
            return attentionScore(server.insights);
        case 'cpu':
            return server.latest?.cpu ?? null;
        case 'memory':
            return server.latest?.memory ?? null;
        case 'disk':
            return server.latest?.disk ?? null;
        case 'swap':
            return server.latest?.swap ?? null;
        case 'price':
            return cost?.monthly_cents ?? null;
        case 'apps':
            return server.projects.length;
    }
}

export function sortServers(
    servers: ServerOverview[],
    costs: Record<string, ServerCost> | null,
    key: ServerSortKey,
    direction: SortDirection,
): ServerOverview[] {
    const sign = direction === 'asc' ? 1 : -1;
    const byName = (a: ServerOverview, b: ServerOverview) =>
        a.name.localeCompare(b.name);

    if (key === 'name') {
        return [...servers].sort((a, b) => sign * byName(a, b));
    }

    return [...servers].sort((a, b) => {
        const left = sortValue(a, costs?.[a.id] ?? null, key);
        const right = sortValue(b, costs?.[b.id] ?? null, key);

        if (left === right) {
            return byName(a, b);
        }

        if (left === null) {
            return 1;
        }

        if (right === null) {
            return -1;
        }

        return sign * (left - right);
    });
}
