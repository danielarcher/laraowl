import { router } from '@inertiajs/react';
import type { MouseEvent } from 'react';
import { useState } from 'react';
import { categoryColors, formatCount } from '@/components/charts/format';
import { cn } from '@/lib/utils';

export const trafficSources = [
    { key: 'human', label: 'Humans', color: categoryColors[2] },
    { key: 'search', label: 'Search engines', color: categoryColors[0] },
    { key: 'ai', label: 'AI crawlers', color: categoryColors[1] },
    { key: 'monitor', label: 'Monitors', color: categoryColors[3] },
    { key: 'bot', label: 'Other bots', color: categoryColors[4] },
] as const;

export type TrafficSourceKey = (typeof trafficSources)[number]['key'];

/** The current URL with its sources swapped; every source means no filter. */
function sourcesUrl(selected: string[]): string {
    const params = new URLSearchParams(window.location.search);

    if (selected.length === trafficSources.length) {
        params.delete('sources');
    } else {
        params.set('sources', selected.join(','));
    }

    const query = params.toString();

    return `${window.location.pathname}${query ? `?${query}` : ''}`;
}

/**
 * Which traffic the request figures count, by who sent it (read from the
 * user agent). Each source shows its size for the period whether it is
 * counted or not, and a bar beneath gives the mix at a glance. Click
 * switches a source; Alt-click keeps only that one.
 */
export function SourceFilter({
    selected,
    totals,
}: {
    selected: string[];
    totals: Partial<Record<TrafficSourceKey, number>>;
}) {
    // Moves at once, before the page answers.
    const [chosen, setChosen] = useState<string[] | null>(null);
    const shown = chosen ?? selected;
    const all = trafficSources.reduce(
        (sum, source) => sum + (totals[source.key] ?? 0),
        0,
    );
    const filtered = shown.length < trafficSources.length;

    const visit = (next: string[]) => {
        setChosen(next);
        router.get(
            sourcesUrl(next),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onFinish: () => setChosen(null),
            },
        );
    };

    const toggle = (key: string, event: MouseEvent) => {
        if (event.altKey) {
            visit([key]);

            return;
        }

        const next = shown.includes(key)
            ? shown.filter((source) => source !== key)
            : trafficSources
                  .map((source) => source.key as string)
                  .filter((source) => source === key || shown.includes(source));

        // At least one source stays counted.
        if (next.length > 0) {
            visit(next);
        }
    };

    return (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center gap-x-1 gap-y-1 px-3 py-2">
                <span className="mr-2 text-[11px] text-muted-foreground">
                    Traffic
                </span>
                {trafficSources.map((source) => {
                    const on = shown.includes(source.key);
                    const total = totals[source.key] ?? 0;

                    return (
                        <button
                            key={source.key}
                            type="button"
                            onClick={(event) => toggle(source.key, event)}
                            aria-pressed={on}
                            title={`${on ? 'Leave out' : 'Count'} ${source.label} · Alt-click to count only ${source.label}`}
                            className={cn(
                                'flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition-[opacity,background-color,border-color] duration-150 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                                on
                                    ? 'border-border bg-muted/60 hover:bg-muted'
                                    : 'border-transparent opacity-45 hover:opacity-80',
                            )}
                        >
                            <span
                                aria-hidden
                                className={cn(
                                    'size-2 rounded-[2px] border',
                                    !on && 'bg-transparent!',
                                )}
                                style={{
                                    backgroundColor: source.color,
                                    borderColor: source.color,
                                }}
                            />
                            <span
                                className={cn(
                                    on
                                        ? 'text-foreground'
                                        : 'text-muted-foreground line-through decoration-muted-foreground/60',
                                )}
                            >
                                {source.label}
                            </span>
                            <span className="font-mono text-muted-foreground tabular-nums">
                                {formatCount(total)}
                            </span>
                        </button>
                    );
                })}
                <div className="ml-auto flex items-center gap-3 pl-2 text-[11px]">
                    {!(shown.length === 1 && shown[0] === 'human') && (
                        <button
                            type="button"
                            onClick={() => visit(['human'])}
                            className="text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                        >
                            Humans only
                        </button>
                    )}
                    {filtered && (
                        <button
                            type="button"
                            onClick={() =>
                                visit(trafficSources.map((s) => s.key))
                            }
                            className="text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                        >
                            Show all
                        </button>
                    )}
                </div>
            </div>
            {/* The mix of the period, left out sources dimmed. */}
            <div className="flex h-0.5 bg-series-muted" aria-hidden>
                {all > 0 &&
                    trafficSources.map((source) => (
                        <div
                            key={source.key}
                            className={cn(
                                'transition-opacity duration-150',
                                !shown.includes(source.key) && 'opacity-25',
                            )}
                            style={{
                                width: `${((totals[source.key] ?? 0) / all) * 100}%`,
                                backgroundColor: source.color,
                            }}
                        />
                    ))}
            </div>
        </div>
    );
}
