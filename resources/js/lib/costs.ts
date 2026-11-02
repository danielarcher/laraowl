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

export type Spending = {
    currency: string;
    monthly_cents: number;
    yearly_cents: number;
    approximate: boolean;
    count: number;
    categories: SpendingCategory[];
    apps: AppShare[];
    traffic_days: number;
};

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
