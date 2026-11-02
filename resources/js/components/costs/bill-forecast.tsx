import { useState } from 'react';
import { formatDay } from '@/components/date-range-calendar';
import type { ForecastMonth, Spending, SpendingCategory } from '@/lib/costs';
import {
    COST_CATEGORY_COLORS,
    COST_CATEGORY_ORDER,
    formatMoney,
} from '@/lib/costs';
import { cn } from '@/lib/utils';
import { CategorySwatch, PanelTitle } from './cost-parts';

const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

function monthName(key: string): { short: string; year: string } {
    const [year, month] = key.split('-');

    return { short: MONTHS[Number(month) - 1], year };
}

function ForecastTooltip({
    month,
    index,
    count,
    labels,
    currency,
}: {
    month: ForecastMonth;
    index: number;
    count: number;
    labels: Record<string, string>;
    currency: string;
}) {
    const { short, year } = monthName(month.month);
    // Keep the card inside the chart at both ends.
    const left = ((index + 0.5) / count) * 100;
    const shift = left < 20 ? '0%' : left > 80 ? '-100%' : '-50%';

    return (
        <div
            className="pointer-events-none absolute bottom-full z-20 mb-2 min-w-48 rounded-md border border-border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md"
            style={{ left: `${left}%`, transform: `translateX(${shift})` }}
        >
            <div className="mb-1.5 font-mono text-[10px] text-muted-foreground">
                {short} {year}
            </div>
            <div className="space-y-1">
                {COST_CATEGORY_ORDER.filter(
                    (key) => month.categories[key] > 0,
                ).map((key) => (
                    <div key={key} className="flex items-center gap-2">
                        <CategorySwatch category={key} />
                        <span className="text-muted-foreground">
                            {labels[key]}
                        </span>
                        <span className="ml-auto pl-4 font-mono text-foreground tabular-nums">
                            {formatMoney(month.categories[key], currency)}
                        </span>
                    </div>
                ))}
            </div>
            {month.renewals.length > 0 && (
                <div className="mt-1.5 space-y-0.5 border-t border-border/60 pt-1.5">
                    {month.renewals.map((renewal) => (
                        <div
                            key={`${renewal.name}-${renewal.date}`}
                            className="flex gap-2 text-[11px] text-muted-foreground"
                        >
                            <span className="truncate">{renewal.name}</span>
                            <span className="ml-auto shrink-0 font-mono">
                                {formatDay(renewal.date).slice(0, 5)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            <div className="mt-1.5 flex items-center gap-2 border-t border-border/60 pt-1.5">
                <span className="text-muted-foreground">Billed</span>
                <span className="ml-auto font-mono font-medium text-foreground tabular-nums">
                    {formatMoney(month.total_cents, currency)}
                </span>
            </div>
        </div>
    );
}

/**
 * What lands on the bills in each of the next twelve months, stacked by
 * category: the recurring base every month, renewals on the month they
 * fall due. The dashed line is the monthly run-rate they average out to.
 */
export function BillForecast({ spending }: { spending: Spending }) {
    const [active, setActive] = useState<number | null>(null);
    const months = spending.forecast;
    const max = Math.max(1, ...months.map((month) => month.total_cents));
    const average = spending.monthly_cents;
    const total = months.reduce((sum, month) => sum + month.total_cents, 0);
    const labels = Object.fromEntries(
        spending.categories.map((category: SpendingCategory) => [
            category.category,
            category.label,
        ]),
    );
    const present = COST_CATEGORY_ORDER.filter((key) =>
        months.some((month) => month.categories[key] > 0),
    );
    const money = (cents: number) =>
        formatMoney(cents, spending.currency, true);

    return (
        <div className="px-4 py-4" data-test="bill-forecast">
            <PanelTitle
                aside={
                    <ul className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] text-foreground/55">
                        {present.map((key) => (
                            <li key={key} className="flex items-center gap-1.5">
                                <CategorySwatch category={key} />
                                {labels[key] ?? key}
                            </li>
                        ))}
                    </ul>
                }
            >
                Bills, next 12 months ·{' '}
                <span className="text-foreground tabular-nums">
                    {money(total)}
                </span>
            </PanelTitle>

            <div className="relative" onMouseLeave={() => setActive(null)}>
                {active !== null && (
                    <ForecastTooltip
                        month={months[active]}
                        index={active}
                        count={months.length}
                        labels={labels}
                        currency={spending.currency}
                    />
                )}

                <div className="relative h-40 border-b border-border">
                    <div
                        className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-foreground/30"
                        style={{ bottom: `${(average / max) * 100}%` }}
                    >
                        <span className="absolute right-0 -translate-y-full bg-card pb-0.5 pl-1 text-[10px] text-foreground/50 tabular-nums">
                            run-rate {money(average)}
                        </span>
                    </div>

                    <div className="flex h-full items-end gap-1 sm:gap-1.5">
                        {months.map((month, index) => {
                            const stack = [...COST_CATEGORY_ORDER]
                                .reverse()
                                .filter((key) => month.categories[key] > 0);
                            const spike = month.renewals.length > 0;

                            return (
                                <button
                                    key={month.month}
                                    type="button"
                                    aria-label={`${monthName(month.month).short} ${monthName(month.month).year}: ${formatMoney(month.total_cents, spending.currency)}`}
                                    onMouseEnter={() => setActive(index)}
                                    onFocus={() => setActive(index)}
                                    onBlur={() => setActive(null)}
                                    onClick={() =>
                                        setActive(
                                            active === index ? null : index,
                                        )
                                    }
                                    className="group relative flex h-full flex-1 flex-col justify-end outline-none"
                                >
                                    {spike && (
                                        <span className="mb-1 text-center text-[10px] text-foreground/70 tabular-nums">
                                            {money(month.total_cents)}
                                        </span>
                                    )}
                                    <div
                                        className={cn(
                                            'flex w-full flex-col gap-[2px] transition-opacity',
                                            active !== null &&
                                                active !== index &&
                                                'opacity-45',
                                        )}
                                        style={{
                                            height: `${(month.total_cents / max) * 100}%`,
                                        }}
                                    >
                                        {stack.map((key, position) => (
                                            <div
                                                key={key}
                                                className={cn(
                                                    'w-full',
                                                    position === 0 &&
                                                        'rounded-t-[4px]',
                                                )}
                                                style={{
                                                    flexGrow:
                                                        month.categories[key],
                                                    flexBasis: 0,
                                                    minHeight: 2,
                                                    backgroundColor:
                                                        COST_CATEGORY_COLORS[
                                                            key
                                                        ],
                                                }}
                                            />
                                        ))}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-1.5 flex gap-1 sm:gap-1.5">
                    {months.map((month, index) => {
                        const { short, year } = monthName(month.month);
                        const showYear = index === 0 || short === 'Jan';

                        return (
                            <div
                                key={month.month}
                                className="flex-1 text-center text-[10px] leading-tight text-foreground/45"
                            >
                                <span className="sm:hidden">{short[0]}</span>
                                <span className="hidden sm:inline">
                                    {short}
                                </span>
                                {showYear && (
                                    <div className="text-foreground/30">
                                        ’{year.slice(2)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/**
 * The next yearly bills, soonest first.
 */
export function UpcomingRenewals({ spending }: { spending: Spending }) {
    return (
        <div className="px-4 py-4" data-test="upcoming-renewals">
            <PanelTitle>Next renewals</PanelTitle>
            {spending.renewals.length === 0 ? (
                <p className="text-[12px] text-foreground/40">
                    Add a renewal date to yearly costs to see them here.
                </p>
            ) : (
                <ul className="divide-y divide-border/60">
                    {spending.renewals.map((renewal) => (
                        <li
                            key={renewal.id}
                            className="flex items-center gap-3 py-2 text-[12px]"
                        >
                            <CategorySwatch category={renewal.category} />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-foreground/80">
                                    {renewal.name}
                                </div>
                                <div className="text-[11px] text-foreground/40 tabular-nums">
                                    {formatDay(renewal.date)} · in{' '}
                                    {renewal.days} day
                                    {renewal.days === 1 ? '' : 's'}
                                </div>
                            </div>
                            <span className="shrink-0 text-foreground tabular-nums">
                                {formatMoney(renewal.cents, spending.currency)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {spending.unscheduled_cents > 0 && (
                <p className="mt-3 text-[11px] text-foreground/40">
                    Yearly costs without a renewal date are spread evenly (
                    {formatMoney(spending.unscheduled_cents, spending.currency)}
                    /mo).
                </p>
            )}
        </div>
    );
}
