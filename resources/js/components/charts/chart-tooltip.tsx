import { rangeLabel } from '@/components/charts/format';

export type TooltipRow = {
    name: string;
    color: string;
    value: string;
    dashed?: boolean;
};

/**
 * The one tooltip every chart uses: the slot's time range, then a row per
 * series with its swatch and value, figures right-aligned.
 */
export function ChartTooltipCard({
    t,
    slot,
    rows,
    footer,
}: {
    t: number;
    slot: number;
    rows: TooltipRow[];
    footer?: { name: string; value: string };
}) {
    return (
        <div className="min-w-44 rounded-md border border-border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
            <div className="mb-1.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                {rangeLabel(t, slot)}
            </div>
            <div className="space-y-1">
                {rows.map((row) => (
                    <div key={row.name} className="flex items-center gap-2">
                        <Swatch color={row.color} dashed={row.dashed} />
                        <span className="text-muted-foreground">
                            {row.name}
                        </span>
                        <span className="ml-auto pl-4 font-mono font-medium text-foreground tabular-nums">
                            {row.value}
                        </span>
                    </div>
                ))}
            </div>
            {footer && (
                <div className="mt-1.5 flex items-center border-t border-border pt-1.5">
                    <span className="text-muted-foreground">{footer.name}</span>
                    <span className="ml-auto pl-4 font-mono font-medium text-foreground tabular-nums">
                        {footer.value}
                    </span>
                </div>
            )}
        </div>
    );
}

export function Swatch({
    color,
    dashed = false,
}: {
    color: string;
    dashed?: boolean;
}) {
    if (dashed) {
        return (
            <span
                className="inline-block h-0 w-2.5 shrink-0 border-t-2 border-dashed"
                style={{ borderColor: color }}
            />
        );
    }

    return (
        <span
            className="inline-block size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: color }}
        />
    );
}
