import type { CostSplit } from '@/lib/costs';
import { SPLIT_OPTIONS } from '@/lib/costs';
import { cn } from '@/lib/utils';

/**
 * Switches how a server's price is shared across its apps.
 */
export function CostSplitToggle({
    split,
    onChange,
}: {
    split: CostSplit;
    onChange: (split: CostSplit) => void;
}) {
    return (
        <div
            className="flex rounded-md border border-border p-0.5 text-[11px]"
            role="group"
            aria-label="Split server prices"
        >
            {SPLIT_OPTIONS.map((option) => (
                <button
                    key={option.key}
                    type="button"
                    aria-pressed={split === option.key}
                    onClick={() => onChange(option.key)}
                    className={cn(
                        'rounded-sm px-2 py-0.5 transition-colors',
                        split === option.key
                            ? 'bg-muted text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
