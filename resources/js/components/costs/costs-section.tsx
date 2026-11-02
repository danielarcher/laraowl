import { Link } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';
import { CostSplitToggle } from '@/components/cost-split-toggle';
import { useCostSplit } from '@/hooks/use-cost-split';
import type { Spending } from '@/lib/costs';
import { formatMoney, formatUnitCost } from '@/lib/costs';
import { index as costsIndex } from '@/routes/teams/costs';
import { AppCosts } from './app-costs';
import { BillForecast, UpcomingRenewals } from './bill-forecast';
import { CostStatement } from './cost-statement';

function Figure({
    label,
    value,
    detail,
}: {
    label: string;
    value: string;
    detail: string;
}) {
    return (
        <div className="min-w-0 bg-card px-4 py-3.5">
            <div className="text-[11px] font-medium text-foreground/45">
                {label}
            </div>
            <div className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                {value}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-foreground/40">
                {detail}
            </div>
        </div>
    );
}

function compactCount(value: number): string {
    return new Intl.NumberFormat('en-GB', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

/**
 * The team's costs on the overview: the headline figures, the statement
 * by category, each app's share, and the bills coming in the next year.
 */
export function CostsSection({
    spending,
    teamSlug,
}: {
    spending: Spending;
    teamSlug: string;
}) {
    const [split, setSplit] = useCostSplit();
    const prefix = spending.approximate ? '≈ ' : '';
    const nextYear = spending.forecast.reduce(
        (sum, month) => sum + month.total_cents,
        0,
    );
    const perThousand = formatUnitCost(
        spending.monthly_cents,
        spending.requests,
        spending.currency,
    );

    return (
        <section
            className="overflow-hidden rounded-lg border border-border bg-card"
            data-test="costs-section"
        >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    Costs
                </h2>
                <div className="flex items-center gap-3">
                    {spending.apps.length > 0 && (
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="hidden sm:inline">
                                Split servers
                            </span>
                            <CostSplitToggle
                                split={split}
                                onChange={setSplit}
                            />
                        </div>
                    )}
                    <Link
                        href={costsIndex(teamSlug).url}
                        className="group/link inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                        Edit costs
                        <ArrowRight className="size-3 transition-transform duration-200 group-hover/link:translate-x-0.5" />
                    </Link>
                </div>
            </header>

            {spending.count === 0 ? (
                <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                    No costs yet. Add what you pay to see it here.
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-px border-b border-border/60 bg-border/60 lg:grid-cols-4">
                        <Figure
                            label="Monthly run-rate"
                            value={`${prefix}${formatMoney(spending.monthly_cents, spending.currency)}`}
                            detail={`${spending.count} cost${spending.count === 1 ? '' : 's'}, yearly ones as a twelfth`}
                        />
                        <Figure
                            label="Per year"
                            value={`${prefix}${formatMoney(spending.yearly_cents, spending.currency, true)}`}
                            detail="at today's prices"
                        />
                        <Figure
                            label="Billed next 12 months"
                            value={formatMoney(
                                nextYear,
                                spending.currency,
                                true,
                            )}
                            detail="renewals on the month they fall due"
                        />
                        <Figure
                            label="All-in per 1k requests"
                            value={perThousand ?? '—'}
                            detail={
                                perThousand
                                    ? `${compactCount(spending.requests)} requests in ${spending.traffic_days} days`
                                    : 'no requests yet'
                            }
                        />
                    </div>

                    <div className="grid grid-cols-1 divide-y divide-border/60 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                        <CostStatement spending={spending} />
                        <AppCosts
                            spending={spending}
                            split={split}
                            teamSlug={teamSlug}
                        />
                    </div>

                    <div className="grid grid-cols-1 divide-y divide-border/60 border-t border-border/60 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:divide-x lg:divide-y-0">
                        <BillForecast spending={spending} />
                        <UpcomingRenewals spending={spending} />
                    </div>
                </>
            )}
        </section>
    );
}
