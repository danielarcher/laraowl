import { useState } from 'react';
import type { CostSplit } from '@/lib/costs';

const STORAGE_KEY = 'laraowl.cost-split';

function storedSplit(): CostSplit {
    if (typeof window === 'undefined') {
        return 'equal';
    }

    return window.localStorage.getItem(STORAGE_KEY) === 'traffic'
        ? 'traffic'
        : 'equal';
}

/**
 * How a server's price is shared across its apps: evenly or by traffic.
 * The choice is remembered in the browser, so the overview and the servers
 * pages always split the same way.
 */
export function useCostSplit(): [CostSplit, (split: CostSplit) => void] {
    const [split, setSplit] = useState<CostSplit>(storedSplit);

    const update = (next: CostSplit) => {
        window.localStorage.setItem(STORAGE_KEY, next);
        setSplit(next);
    };

    return [split, update];
}
