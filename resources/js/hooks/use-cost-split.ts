import { usePersistedState } from '@/hooks/use-persisted-state';
import type { CostSplit } from '@/lib/costs';

const SPLITS: readonly CostSplit[] = ['equal', 'traffic'];

/**
 * How a server's price is shared across its apps: evenly or by traffic.
 * The choice is remembered in the browser, so the overview and the servers
 * pages always split the same way.
 */
export function useCostSplit(): [CostSplit, (split: CostSplit) => void] {
    return usePersistedState('laraowl.cost-split', SPLITS, 'equal');
}
