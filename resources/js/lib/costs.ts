export type CostSplit = 'equal' | 'traffic';

export type AppShare = {
    id: number;
    name: string;
    slug: string;
    server_id: number;
    server_name: string;
    requests: number;
    traffic_share: number | null;
    equal_cents: number;
    traffic_cents: number;
};

export type ServerCost = {
    monthly_cents: number;
    apps: AppShare[];
};

export type SpendingCategory = {
    category: 'server' | 'plan' | 'service' | 'domain';
    label: string;
    monthly_cents: number;
};

export type CostCategoryKey = SpendingCategory['category'];

export type CostItem = {
    id: number;
    name: string;
    category: CostCategoryKey;
    server_name: string | null;
    interval: 'monthly' | 'yearly';
    amount_cents: number;
    currency: string;
    monthly_cents: number;
    renews_on: string | null;
};

export type ForecastMonth = {
    month: string;
    total_cents: number;
    categories: Record<CostCategoryKey, number>;
    renewals: { name: string; date: string; cents: number }[];
};

export type Renewal = {
    id: number;
    name: string;
    category: CostCategoryKey;
    date: string;
    days: number;
    cents: number;
};

export type Spending = {
    currency: string;
    monthly_cents: number;
    yearly_cents: number;
    approximate: boolean;
    count: number;
    categories: SpendingCategory[];
    items: CostItem[];
    apps: AppShare[];
    requests: number;
    traffic_days: number;
    forecast: ForecastMonth[];
    renewals: Renewal[];
    unscheduled_cents: number;
};

/** One colour per category, in a fixed order (see --cost-* in app.css). */
export const COST_CATEGORY_COLORS: Record<CostCategoryKey, string> = {
    server: 'var(--cost-server)',
    plan: 'var(--cost-plan)',
    service: 'var(--cost-service)',
    domain: 'var(--cost-domain)',
};

export const COST_CATEGORY_ORDER: CostCategoryKey[] = [
    'server',
    'plan',
    'service',
    'domain',
];

export const SPLIT_OPTIONS: { key: CostSplit; label: string }[] = [
    { key: 'equal', label: 'Even' },
    { key: 'traffic', label: 'Traffic' },
];

/**
 * An amount in cents as money: cents shown below 1,000, whole units above.
 */
export function formatMoney(
    cents: number,
    currency = 'USD',
    wholeUnits = false,
): string {
    const whole = wholeUnits || Math.abs(cents) >= 100_000;

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: whole ? 0 : 2,
        maximumFractionDigits: whole ? 0 : 2,
    }).format(cents / 100);
}

export function shareCents(app: AppShare, split: CostSplit): number {
    return split === 'equal' ? app.equal_cents : app.traffic_cents;
}

/**
 * Cost per 1,000 requests, with enough decimals to tell small amounts
 * apart; null when there were no requests.
 */
export function formatUnitCost(
    cents: number,
    requests: number,
    currency = 'USD',
): string | null {
    if (requests <= 0) {
        return null;
    }

    const perThousand = cents / 100 / (requests / 1000);
    const digits = perThousand >= 1 ? 2 : perThousand >= 0.01 ? 3 : 4;

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(perThousand);
}
