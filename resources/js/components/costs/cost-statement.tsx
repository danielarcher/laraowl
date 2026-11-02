import { ChevronRight } from 'lucide-react';
import { formatDay } from '@/components/date-range-calendar';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { CostItem, Spending } from '@/lib/costs';
import { COST_CATEGORY_COLORS, formatMoney } from '@/lib/costs';
import { CategorySwatch, PanelTitle, percentOf } from './cost-parts';

/** Categories with more lines than this start folded. */
const OPEN_UP_TO = 6;

function ItemDetail({ item, base }: { item: CostItem; base: string }) {
    const parts: string[] = [];

    if (item.server_name && item.server_name !== item.name) {
        parts.push(item.server_name);
    }

    if (item.interval === 'yearly' || item.currency !== base) {
        parts.push(
            `${formatMoney(item.amount_cents, item.currency)}/${item.interval === 'yearly' ? 'yr' : 'mo'}`,
        );
    }

    if (item.renews_on) {
        parts.push(`renews ${formatDay(item.renews_on)}`);
    }

    return parts.length ? (
        <div className="truncate text-[11px] text-foreground/40">
            {parts.join(' · ')}
        </div>
    ) : null;
}

/**
 * Every cost on one statement: a bar of the categories, then each category
 * with its subtotal and share, its lines underneath, and the total.
 */
export function CostStatement({ spending }: { spending: Spending }) {
    const money = (cents: number) => formatMoney(cents, spending.currency);
    const total = spending.monthly_cents;

    return (
        <div className="px-4 py-4" data-test="cost-statement">
            <PanelTitle>Breakdown per month</PanelTitle>

            <div
                className="mb-4 flex h-2 w-full gap-[2px]"
                role="img"
                aria-label={spending.categories
                    .map(
                        (category) =>
                            `${category.label} ${percentOf(category.monthly_cents, total)}`,
                    )
                    .join(', ')}
            >
                {spending.categories.map((category) => (
                    <div
                        key={category.category}
                        className="h-full min-w-[2px] rounded-[2px]"
                        style={{
                            flexGrow: category.monthly_cents,
                            flexBasis: 0,
                            backgroundColor:
                                COST_CATEGORY_COLORS[category.category],
                        }}
                    />
                ))}
            </div>

            <div className="divide-y divide-border/60 border-y border-border/60">
                {spending.categories.map((category) => {
                    const items = spending.items.filter(
                        (item) => item.category === category.category,
                    );

                    return (
                        <Collapsible
                            key={category.category}
                            defaultOpen={items.length <= OPEN_UP_TO}
                        >
                            <CollapsibleTrigger className="group flex w-full items-center gap-2 py-2.5 text-left text-[12px]">
                                <ChevronRight className="size-3 shrink-0 text-foreground/35 transition-transform duration-150 group-data-[state=open]:rotate-90" />
                                <CategorySwatch category={category.category} />
                                <span className="font-medium text-foreground">
                                    {category.label}
                                </span>
                                <span className="text-foreground/35 tabular-nums">
                                    {items.length}
                                </span>
                                <span className="ml-auto w-10 text-right text-foreground/45 tabular-nums">
                                    {percentOf(category.monthly_cents, total)}
                                </span>
                                <span className="w-20 text-right font-medium text-foreground tabular-nums">
                                    {money(category.monthly_cents)}
                                </span>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <ul className="pb-2">
                                    {items.map((item) => (
                                        <li
                                            key={item.id}
                                            className="flex items-center gap-3 py-1 pl-[34px] text-[12px]"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-foreground/75">
                                                    {item.name}
                                                </div>
                                                <ItemDetail
                                                    item={item}
                                                    base={spending.currency}
                                                />
                                            </div>
                                            <span className="w-20 shrink-0 text-right text-foreground/75 tabular-nums">
                                                {money(item.monthly_cents)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </CollapsibleContent>
                        </Collapsible>
                    );
                })}
            </div>

            <div className="flex items-baseline justify-between gap-3 pt-2.5 text-[12px]">
                <span className="text-foreground/45">
                    Total per month
                    {spending.approximate &&
                        ' · other currencies at a fixed rate'}
                </span>
                <span className="font-semibold text-foreground tabular-nums">
                    {spending.approximate ? '≈ ' : ''}
                    {money(total)}
                </span>
            </div>
        </div>
    );
}
