import { Link, router } from '@inertiajs/react';
import { ArrowUpRight, ChevronDown, Search, UserRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatCount } from '@/components/charts/format';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type RequestUser = {
    key: string;
    hash: string;
    name: string;
    email: string;
    requests?: number;
    last_seen?: string | null;
    /** More requests than the page reads back: the figures are the latest. */
    truncated?: boolean;
    /** Raw requests are kept this many days, fewer than the period covers. */
    kept_days?: number | null;
};

/** Users shown as chips before the rest fold into the picker. */
const CHIPS = 5;

/** The current URL with the user swapped, back on the first page. */
function userUrl(key: string | null): string {
    const params = new URLSearchParams(window.location.search);

    if (key === null) {
        params.delete('user');
    } else {
        params.set('user', key);
    }

    params.delete('page');

    const query = params.toString();

    return `${window.location.pathname}${query ? `?${query}` : ''}`;
}

/**
 * Whose requests the page shows: everyone, or one signed-in user. The most
 * active users of the period sit inline; the rest are a search away.
 */
export function UserFilter({
    users,
    selected,
    profileHref,
}: {
    users: RequestUser[];
    selected: RequestUser | null;
    profileHref?: string;
}) {
    // Moves at once, before the page answers.
    const [chosen, setChosen] = useState<RequestUser | null | undefined>(
        undefined,
    );
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const shown = chosen === undefined ? selected : chosen;

    const visit = (user: RequestUser | null) => {
        setChosen(user);
        setOpen(false);
        router.get(
            userUrl(user?.key ?? null),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onFinish: () => setChosen(undefined),
            },
        );
    };

    const matches = useMemo(() => {
        const needle = search.trim().toLowerCase();

        return needle === ''
            ? users
            : users.filter((user) =>
                  [user.name, user.email, user.key].some((field) =>
                      field?.toLowerCase().includes(needle),
                  ),
              );
    }, [users, search]);

    const label = (user: RequestUser) => user.name || user.key;

    return (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 rounded-lg border border-border bg-card px-3 py-2">
            <span className="mr-2 text-[11px] text-muted-foreground">User</span>

            {shown ? (
                <>
                    <button
                        type="button"
                        onClick={() => visit(null)}
                        title="Show every user"
                        className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 text-[11px] text-foreground transition-colors hover:bg-muted"
                    >
                        <UserRound className="size-3 text-muted-foreground" />
                        <span className="font-medium">{label(shown)}</span>
                        {shown.email && shown.email !== shown.name && (
                            <span className="text-muted-foreground">
                                {shown.email}
                            </span>
                        )}
                        {shown.name !== shown.key && (
                            <span className="font-mono text-muted-foreground">
                                #{shown.key}
                            </span>
                        )}
                        <X className="size-3 text-muted-foreground" />
                    </button>
                    {profileHref && (
                        <Link
                            href={profileHref}
                            className="ml-1 flex items-center gap-0.5 text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                        >
                            Profile
                            <ArrowUpRight className="size-3" />
                        </Link>
                    )}
                    {shown.kept_days && (
                        <span className="ml-2 text-[11px] text-muted-foreground">
                            Per-user requests cover the last {shown.kept_days}{' '}
                            days
                        </span>
                    )}
                    {shown.truncated && (
                        <span className="ml-2 text-[11px] text-muted-foreground">
                            Latest 5,000 requests
                        </span>
                    )}
                </>
            ) : users.length === 0 ? (
                <span className="text-[11px] text-muted-foreground">
                    No signed-in users this period
                </span>
            ) : (
                users.slice(0, CHIPS).map((user) => (
                    <button
                        key={user.key}
                        type="button"
                        onClick={() => visit(user)}
                        title={`Only ${label(user)}'s requests${user.email ? ` · ${user.email}` : ''}`}
                        className="flex h-7 items-center gap-1.5 rounded-md border border-transparent px-2 text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground"
                    >
                        <span className="max-w-40 truncate">{label(user)}</span>
                        <span className="font-mono tabular-nums">
                            {formatCount(user.requests ?? 0)}
                        </span>
                    </button>
                ))
            )}

            {users.length > 0 && (
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                'ml-auto flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground',
                                open && 'text-foreground',
                            )}
                        >
                            {shown
                                ? 'Switch user'
                                : `${formatCount(users.length)} users`}
                            <ChevronDown className="size-3" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 p-0">
                        <div className="flex items-center gap-2 border-b border-border px-3">
                            <Search className="size-3.5 text-muted-foreground" />
                            <input
                                autoFocus
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && matches[0]) {
                                        visit(matches[0]);
                                    }
                                }}
                                placeholder="Name, email or id"
                                className="h-9 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                            />
                        </div>
                        <div className="max-h-72 overflow-y-auto py-1">
                            {matches.map((user) => (
                                <button
                                    key={user.key}
                                    type="button"
                                    onClick={() => visit(user)}
                                    className={cn(
                                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted',
                                        shown?.key === user.key &&
                                            'bg-muted/60',
                                    )}
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-foreground">
                                            {label(user)}
                                        </span>
                                        {(user.email ||
                                            user.name !== user.key) && (
                                            <span className="block truncate text-[11px] text-muted-foreground">
                                                {user.email || `#${user.key}`}
                                            </span>
                                        )}
                                    </span>
                                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                                        {formatCount(user.requests ?? 0)}
                                    </span>
                                </button>
                            ))}
                            {matches.length === 0 && (
                                <p className="px-3 py-2 text-xs text-muted-foreground">
                                    No user matches.
                                </p>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
}
