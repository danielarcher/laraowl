import { ArrowDown, ArrowUp, LayoutGrid, List } from 'lucide-react';
import { CostSplitToggle } from '@/components/cost-split-toggle';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { CostSplit } from '@/lib/costs';
import type { ServerSortKey, SortDirection } from '@/lib/server-sort';
import { SERVER_SORTS } from '@/lib/server-sort';
import { cn } from '@/lib/utils';

export type ServersView = 'grid' | 'list';

/**
 * Grid or list, the order, and (with prices) how they are split.
 */
export function ServersToolbar({
    view,
    onViewChange,
    sort,
    onSortChange,
    direction,
    onDirectionChange,
    split,
    onSplitChange,
}: {
    view: ServersView;
    onViewChange: (view: ServersView) => void;
    sort: ServerSortKey;
    onSortChange: (sort: ServerSortKey) => void;
    direction: SortDirection;
    onDirectionChange: (direction: SortDirection) => void;
    split: CostSplit | null;
    onSplitChange: (split: CostSplit) => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            {split && (
                <div className="flex items-center gap-2">
                    Split prices
                    <CostSplitToggle split={split} onChange={onSplitChange} />
                </div>
            )}

            <div className="flex items-center gap-1.5">
                <span>Sort</span>
                <Select
                    value={sort}
                    onValueChange={(value) => {
                        const option = SERVER_SORTS.find(
                            (item) => item.key === value,
                        );

                        if (option) {
                            onSortChange(option.key);
                            onDirectionChange(option.direction);
                        }
                    }}
                >
                    <SelectTrigger
                        size="sm"
                        className="h-7 min-w-36 text-[11px]"
                        aria-label="Sort servers by"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {SERVER_SORTS.map((option) => (
                            <SelectItem key={option.key} value={option.key}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <button
                    type="button"
                    onClick={() =>
                        onDirectionChange(direction === 'asc' ? 'desc' : 'asc')
                    }
                    className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={
                        direction === 'asc'
                            ? 'Ascending, switch to descending'
                            : 'Descending, switch to ascending'
                    }
                >
                    {direction === 'asc' ? (
                        <ArrowUp className="size-3.5" />
                    ) : (
                        <ArrowDown className="size-3.5" />
                    )}
                </button>
            </div>

            <div
                className="flex rounded-md border border-border p-0.5"
                role="group"
                aria-label="Layout"
            >
                {(
                    [
                        { key: 'grid', label: 'Grid', icon: LayoutGrid },
                        { key: 'list', label: 'List', icon: List },
                    ] as const
                ).map((option) => (
                    <button
                        key={option.key}
                        type="button"
                        aria-pressed={view === option.key}
                        aria-label={`${option.label} view`}
                        onClick={() => onViewChange(option.key)}
                        className={cn(
                            'flex items-center gap-1 rounded-sm px-2 py-0.5 transition-colors',
                            view === option.key
                                ? 'bg-muted text-foreground'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <option.icon className="size-3.5" />
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
