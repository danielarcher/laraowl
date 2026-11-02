import { Link } from '@inertiajs/react';
import { useState } from 'react';
import type { CostSplit, Spending } from '@/lib/costs';
import { formatMoney, formatUnitCost, shareCents } from '@/lib/costs';
import { cn } from '@/lib/utils';
import { PanelTitle } from './cost-parts';

/** Apps listed before "Show all". */
const SHOWN = 8;

type AppOrder = 'cost' | 'unit';

/**
 * What each app costs once its server's price is shared out, and what that
 * comes to per 1,000 requests.
 */
export function AppCosts({
    spending,
    split,
    teamSlug,
}: {
    spending: Spending;
    split: CostSplit;
    teamSlug: string;
}) {
    const [order, setOrder] = useState<AppOrder>('cost');
    const [expanded, setExpanded] = useState(false);
    const unit = (cents: number, requests: number) =>
        requests > 0 ? cents / requests : -1;
    const apps = [...spending.apps].sort((a, b) =>
        order === 'cost'
            ? shareCents(b, split) - shareCents(a, split)
            : unit(shareCents(b, split), b.requests) -
              unit(shareCents(a, split), a.requests),
    );
    const top = Math.max(1, ...apps.map((app) => shareCents(app, split)));
    const shown = expanded ? apps : apps.slice(0, SHOWN);
    const orderButton = (key: AppOrder, label: string) => (
        <button
            type="button"
            aria-pressed={order === key}
            onClick={() => setOrder(key)}
            className={cn(
                'rounded-sm px-2 py-0.5 transition-colors',
                order === key
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
            )}
        >
            {label}
        </button>
    );

    return (
        <div className="px-4 py-4" data-test="app-costs">
            <PanelTitle
                aside={
                    apps.length > 1 && (
                        <div
                            className="flex rounded-md border border-border p-0.5 text-[11px]"
                            role="group"
                            aria-label="Order apps by"
                        >
                            {orderButton('cost', 'Cost')}
                            {orderButton('unit', 'Per 1k requests')}
                        </div>
                    )
                }
            >
                Server cost by app
            </PanelTitle>

            {apps.length === 0 ? (
                <div className="text-[12px] text-foreground/40">
                    No server prices yet
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-x-3 border-b border-border/60 pb-1.5 text-[10px] font-medium text-foreground/40">
                        <span>App</span>
                        <span className="text-right">/month</span>
                        <span className="text-right">per 1k req</span>
                    </div>
                    <ul>
                        {shown.map((app) => {
                            const cents = shareCents(app, split);
                            const perThousand = formatUnitCost(
                                cents,
                                app.requests,
                                spending.currency,
                            );

                            return (
                                <li
                                    key={app.id}
                                    className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center gap-x-3 py-1.5 text-[12px]"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-baseline gap-2">
                                            <Link
                                                href={`/${teamSlug}/${app.slug}/dashboard`}
                                                className="truncate text-foreground/80 hover:text-foreground"
                                            >
                                                {app.name}
                                            </Link>
                                            <span className="truncate text-[11px] text-foreground/35">
                                                {app.server_name}
                                            </span>
                                        </div>
                                        <div className="mt-1 h-1 w-full bg-foreground/[0.06]">
                                            <div
                                                className="h-full rounded-r-[2px]"
                                                style={{
                                                    width: `${(cents / top) * 100}%`,
                                                    backgroundColor:
                                                        'var(--cost-server)',
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-right text-foreground tabular-nums">
                                        {formatMoney(cents, spending.currency)}
                                    </span>
                                    <span
                                        className="text-right text-foreground/60 tabular-nums"
                                        title={
                                            perThousand
                                                ? `${app.requests.toLocaleString('en-GB')} requests in ${spending.traffic_days} days`
                                                : 'No requests reported'
                                        }
                                    >
                                        {perThousand ?? '—'}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                    {apps.length > SHOWN && (
                        <button
                            type="button"
                            onClick={() => setExpanded(!expanded)}
                            className="mt-1 text-[11px] text-foreground/50 transition-colors hover:text-foreground"
                        >
                            {expanded
                                ? 'Show fewer'
                                : `Show all ${apps.length} apps`}
                        </button>
                    )}
                    <p className="mt-3 text-[11px] text-foreground/40">
                        {split === 'traffic'
                            ? `Each server's price shared by requests over the last ${spending.traffic_days} days.`
                            : "Each server's price shared evenly by its apps."}{' '}
                        Per 1k requests uses the same {spending.traffic_days}{' '}
                        days.
                    </p>
                </>
            )}
        </div>
    );
}
