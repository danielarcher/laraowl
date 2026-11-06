import { router } from '@inertiajs/react';
import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** How long typing pauses before the list is asked again. */
const DEBOUNCE_MS = 250;

export const routeFilterHelp =
    '* matches anything and ties the filter to the whole path (/api/*, *ideas). Text without * matches anywhere in the path. Start with a method to narrow by it (POST /api/*).';

/** The current URL with the filter swapped and back on page one. */
export function routeFilterUrl(text: string): string {
    const params = new URLSearchParams(window.location.search);
    const filter = text.trim();

    if (filter) {
        params.set('filter', filter);
    } else {
        params.delete('filter');
    }

    params.delete('page');

    const query = params.toString();

    return `${window.location.pathname}${query ? `?${query}` : ''}`;
}

/**
 * Filters the route list by method and path as you type. The list is
 * filtered on the server, so the count and the pages cover every route.
 * Escape clears it.
 */
export function RouteFilter({
    value,
    className,
}: {
    /** The filter the page was answered with. */
    value: string | null;
    className?: string;
}) {
    const [text, setText] = useState(value ?? '');
    const asked = useRef(value ?? '');

    useEffect(() => {
        if (text.trim() === asked.current.trim()) {
            return;
        }

        const timer = setTimeout(() => {
            asked.current = text;
            router.get(
                routeFilterUrl(text),
                {},
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [text]);

    return (
        <div className={cn('relative w-full sm:w-72', className)}>
            <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
                type="search"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Escape' && text !== '') {
                        event.preventDefault();
                        setText('');
                    }
                }}
                placeholder="Filter routes · /api/* or POST *"
                aria-label="Filter routes"
                title={routeFilterHelp}
                spellCheck={false}
                autoComplete="off"
                className="h-8 w-full rounded-md border border-border bg-card pr-8 pl-8 font-mono text-xs text-foreground transition-colors outline-none placeholder:font-sans placeholder:text-muted-foreground hover:border-muted-foreground/40 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
            />
            {text !== '' && (
                <button
                    type="button"
                    onClick={() => setText('')}
                    aria-label="Clear the route filter"
                    className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <X className="size-3" />
                </button>
            )}
        </div>
    );
}
