import { useState } from 'react';

/**
 * A choice remembered in the browser under the given key. Only the allowed
 * values are read back, so a stale or edited entry falls back to the default.
 */
export function usePersistedState<T extends string>(
    key: string,
    allowed: readonly T[],
    fallback: T,
): [T, (value: T) => void] {
    const [value, setValue] = useState<T>(() => {
        if (typeof window === 'undefined') {
            return fallback;
        }

        const stored = window.localStorage.getItem(key) as T | null;

        return stored !== null && allowed.includes(stored) ? stored : fallback;
    });

    const update = (next: T) => {
        window.localStorage.setItem(key, next);
        setValue(next);
    };

    return [value, update];
}
