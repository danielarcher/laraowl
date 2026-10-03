import type { MouseEvent } from 'react';
import { useState } from 'react';

/**
 * Series switched off per chart, kept in memory: a live refresh or a new
 * period keeps the choice, a fresh page load shows everything again, so a
 * hidden 5xx band never outlives the visit that hid it.
 */
const hiddenByChart = new Map<string, ReadonlySet<string>>();

const NONE: ReadonlySet<string> = new Set();

/**
 * Lets the legend switch a chart's series on and off. A click hides or
 * shows one series; alt-click shows only that one. Clicking the only one
 * left (or alt-clicking it) brings them all back, so the chart is never
 * empty.
 */
export function useHiddenSeries(chart: string, keys: string[]) {
    const [stored, setStored] = useState<ReadonlySet<string>>(
        () => hiddenByChart.get(chart) ?? NONE,
    );

    // Series that are no longer in the chart don't count, and a chart whose
    // every series is hidden (the 5xx view of an app that was switched off)
    // shows them all.
    const shown = keys.filter((key) => !stored.has(key));
    const hidden = shown.length === 0 ? NONE : stored;

    const update = (next: ReadonlySet<string>) => {
        hiddenByChart.set(chart, next);
        setStored(next);
    };

    const toggle = (key: string, only: boolean) => {
        const visible = keys.filter((other) => !hidden.has(other));
        const isOnlyOne = visible.length === 1 && visible[0] === key;

        if (isOnlyOne) {
            update(NONE);
        } else if (only) {
            update(new Set(keys.filter((other) => other !== key)));
        } else if (hidden.has(key)) {
            update(new Set([...hidden].filter((other) => other !== key)));
        } else {
            update(new Set([...hidden, key]));
        }
    };

    return {
        anyHidden: keys.some((key) => hidden.has(key)),
        visible: <T extends { key: string }>(series: T[]): T[] =>
            series.filter((item) => !hidden.has(item.key)),
        showAll: () => update(NONE),
        /** What a LegendItem needs to switch its series. */
        itemProps: (key: string) => ({
            hidden: hidden.has(key),
            onToggle: (event: MouseEvent) => toggle(key, event.altKey),
        }),
    };
}
