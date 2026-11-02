import type { ReactNode } from 'react';
import type { CostCategoryKey } from '@/lib/costs';
import { COST_CATEGORY_COLORS } from '@/lib/costs';
import { cn } from '@/lib/utils';

export function CategorySwatch({
    category,
    className,
}: {
    category: CostCategoryKey;
    className?: string;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                'inline-block size-2 shrink-0 rounded-[2px]',
                className,
            )}
            style={{ backgroundColor: COST_CATEGORY_COLORS[category] }}
        />
    );
}

export function PanelTitle({
    children,
    aside,
}: {
    children: ReactNode;
    aside?: ReactNode;
}) {
    return (
        <div className="mb-3 flex min-h-6 items-center justify-between gap-3">
            <h3 className="text-[11px] font-medium text-foreground/45">
                {children}
            </h3>
            {aside}
        </div>
    );
}

/** A share of a whole as a whole percent, "<1%" for slivers. */
export function percentOf(part: number, whole: number): string {
    if (whole <= 0) {
        return '—';
    }

    const percent = (part / whole) * 100;

    return percent > 0 && percent < 1 ? '<1%' : `${Math.round(percent)}%`;
}
