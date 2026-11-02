import type { ServerFlag, ServerInsights } from '@/lib/server-metrics';
import { cn } from '@/lib/utils';

const FLAG_TONES: Record<ServerFlag['tone'], string> = {
    error: 'border-red-500/30 bg-red-500/10 text-red-400',
    warn: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
};

const FLAG_HINTS: Record<ServerFlag['key'], string> = {
    disk: 'The daily disk peaks of the last 14 days, extended in a straight line',
    memory: 'Memory averaged 85% or more over the last 7 days',
    swap: 'Swap averaged half full or more over the last 7 days',
    cpu: 'CPU averaged 70% or more over the last 7 days',
    idle: 'CPU under 5% and memory under half over the last 7 days',
};

/**
 * What deserves a look on a server, judged on its last week.
 */
export function ServerFlags({
    insights,
    className,
}: {
    insights: ServerInsights | null;
    className?: string;
}) {
    if (!insights || insights.flags.length === 0) {
        return null;
    }

    return (
        <div className={cn('flex flex-wrap gap-1.5', className)}>
            {insights.flags.map((flag) => (
                <span
                    key={flag.key}
                    title={FLAG_HINTS[flag.key]}
                    data-test={`server-flag-${flag.key}`}
                    className={cn(
                        'rounded-sm border px-1.5 py-0.5 text-[10px] font-medium',
                        FLAG_TONES[flag.tone],
                    )}
                >
                    {flag.label}
                </span>
            ))}
        </div>
    );
}

/**
 * The weight of a server's flags, for sorting by what needs attention.
 */
export function attentionScore(insights: ServerInsights | null): number {
    const weights = { error: 100, warn: 10, info: 1 };

    return (insights?.flags ?? []).reduce(
        (score, flag) => score + weights[flag.tone],
        0,
    );
}
