import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { formatMoney } from '@/lib/costs';
import type { RadarMonth } from '@/lib/domains';
import { formatDay } from '@/lib/domains';
import { cn } from '@/lib/utils';

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const MONTH_LONG = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
});

const monthDate = (key: string) => new Date(`${key}-01T00:00:00`);

/**
 * The next twelve months at a glance: what each month costs in renewals,
 * which domains renew (filled marks) and which certificates expire
 * (hollow marks). Hover or tap a month for the details.
 */
export function RenewalRadar({
    months,
    currency,
}: {
    months: RadarMonth[];
    currency: string;
}) {
    const firstBusy = Math.max(
        0,
        months.findIndex((m) => m.events.some((e) => e.type === 'renewal')),
    );
    const [selected, setSelected] = useState(firstBusy);
    const max = Math.max(1, ...months.map((m) => m.cents));
    const total = months.reduce((sum, m) => sum + m.cents, 0);
    const renewals = months.reduce(
        (sum, m) => sum + m.events.filter((e) => e.type === 'renewal').length,
        0,
    );
    const today = new Date();
    const todayOffset =
        (today.getDate() - 1) /
        new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const current = months[selected];

    return (
        <Card className="gap-0 overflow-hidden border-border bg-card p-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 px-5 py-3">
                <div>
                    <h2 className="text-sm font-semibold tracking-tight">
                        Renewal radar
                    </h2>
                    <p className="text-[11px] text-foreground/45">
                        Next 12 months · {renewals}{' '}
                        {renewals === 1 ? 'renewal' : 'renewals'} ·{' '}
                        {formatMoney(total, currency)}
                    </p>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-foreground/50">
                    <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-[1px] bg-foreground/80" />
                        Domain renews
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-[1px] border border-foreground/60" />
                        Certificate expires
                    </span>
                </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_280px]">
                <div className="overflow-x-auto px-5 pt-4 pb-3">
                    <div
                        className="grid min-w-[560px] grid-cols-12 gap-1.5"
                        role="list"
                        aria-label="Months"
                    >
                        {months.map((month, index) => {
                            const date = monthDate(month.month);
                            const renewalsHere = month.events.filter(
                                (e) => e.type === 'renewal',
                            );
                            const certsHere = month.events.filter(
                                (e) => e.type === 'certificate',
                            );
                            const height =
                                month.cents > 0
                                    ? Math.max(6, (month.cents / max) * 72)
                                    : 0;

                            return (
                                <button
                                    key={month.month}
                                    type="button"
                                    role="listitem"
                                    aria-label={`${MONTH_LONG.format(date)}: ${month.events.length} events`}
                                    aria-pressed={selected === index}
                                    onMouseEnter={() => setSelected(index)}
                                    onFocus={() => setSelected(index)}
                                    onClick={() => setSelected(index)}
                                    className={cn(
                                        'group relative flex flex-col items-stretch rounded-[4px] px-1 pt-1 pb-1.5 text-left transition-colors',
                                        selected === index
                                            ? 'bg-foreground/[0.06]'
                                            : 'hover:bg-foreground/[0.03]',
                                    )}
                                >
                                    {index === 0 && (
                                        <span
                                            className="absolute top-0 bottom-6 w-px bg-sky-500/70"
                                            style={{
                                                left: `calc(${(todayOffset * 100).toFixed(1)}% )`,
                                            }}
                                            title="Today"
                                        />
                                    )}
                                    <div className="flex min-h-10 flex-wrap content-end gap-0.5">
                                        {renewalsHere.map((event) => (
                                            <span
                                                key={`r-${event.name}`}
                                                title={`${event.name} renews ${formatDay(event.date)}`}
                                                className="size-2 rounded-[1px] bg-foreground/80"
                                            />
                                        ))}
                                        {certsHere.map((event) => (
                                            <span
                                                key={`c-${event.name}`}
                                                title={`Certificate of ${event.name} expires ${formatDay(event.date)}`}
                                                className="size-2 rounded-[1px] border border-foreground/60"
                                            />
                                        ))}
                                    </div>
                                    <div className="mt-1.5 flex h-[76px] items-end border-b border-border">
                                        <div
                                            className={cn(
                                                'w-full rounded-t-[2px] transition-colors',
                                                selected === index
                                                    ? 'bg-foreground/70'
                                                    : 'bg-foreground/25',
                                            )}
                                            style={{ height }}
                                        />
                                    </div>
                                    <div className="mt-1.5 flex items-baseline justify-between text-[10px] tabular-nums">
                                        <span
                                            className={cn(
                                                'font-medium',
                                                date.getMonth() === 0
                                                    ? 'text-foreground'
                                                    : 'text-foreground/55',
                                            )}
                                        >
                                            {MONTH.format(date)}
                                            {date.getMonth() === 0 &&
                                                ` ${String(date.getFullYear()).slice(2)}`}
                                        </span>
                                        {month.cents > 0 && (
                                            <span className="text-foreground/40">
                                                {formatMoney(
                                                    month.cents,
                                                    currency,
                                                    true,
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <aside
                    className="border-t border-border/60 px-5 py-4 lg:border-t-0 lg:border-l"
                    aria-live="polite"
                >
                    {current && (
                        <>
                            <div className="flex items-baseline justify-between">
                                <h3 className="text-[13px] font-semibold">
                                    {MONTH_LONG.format(
                                        monthDate(current.month),
                                    )}
                                </h3>
                                <span className="text-[13px] font-semibold tabular-nums">
                                    {formatMoney(current.cents, currency)}
                                </span>
                            </div>
                            {current.events.length === 0 ? (
                                <p className="mt-3 text-[12px] text-foreground/45">
                                    Nothing renews or expires.
                                </p>
                            ) : (
                                <ul className="mt-3 space-y-2">
                                    {current.events.map((event) => (
                                        <li
                                            key={`${event.type}-${event.name}`}
                                            className="flex items-center gap-2 text-[12px]"
                                        >
                                            <span
                                                className={cn(
                                                    'size-2 shrink-0 rounded-[1px]',
                                                    event.type === 'renewal'
                                                        ? 'bg-foreground/80'
                                                        : 'border border-foreground/60',
                                                )}
                                            />
                                            <span className="min-w-0 flex-1 truncate">
                                                {event.name}
                                            </span>
                                            <span className="shrink-0 text-foreground/45 tabular-nums">
                                                {formatDay(event.date)}
                                            </span>
                                            <span className="w-16 shrink-0 text-right text-foreground/70 tabular-nums">
                                                {event.type === 'renewal'
                                                    ? event.cents > 0
                                                        ? formatMoney(
                                                              event.cents,
                                                              currency,
                                                          )
                                                        : '—'
                                                    : 'auto'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    )}
                </aside>
            </div>
        </Card>
    );
}
