import type { Certificate } from '@/lib/domains';
import { formatDay } from '@/lib/domains';
import { cn } from '@/lib/utils';

/**
 * Where a certificate is in its life: the filled part has gone by.
 * Certificates normally renew around a third of their life before the end,
 * so a bar still filling past that point is the one to watch.
 */
export function CertLifeline({
    certificate,
}: {
    certificate: Certificate | null;
}) {
    if (!certificate) {
        return <span className="text-[11px] text-red-500">No certificate</span>;
    }

    const days = certificate.days_left;
    const tone =
        days <= 5
            ? 'bg-red-500'
            : days <= 14
              ? 'bg-amber-500'
              : 'bg-foreground/45';

    return (
        <div
            className="min-w-0 space-y-1"
            title={`${certificate.issuer ?? 'Unknown issuer'} · ${formatDay(certificate.valid_from)} → ${formatDay(certificate.expires_at)}`}
        >
            <div className="flex items-baseline justify-between gap-2 text-[11px] tabular-nums">
                <span
                    className={cn(
                        'font-medium',
                        days <= 5
                            ? 'text-red-500'
                            : days <= 14
                              ? 'text-amber-500'
                              : 'text-foreground/80',
                    )}
                >
                    {days < 0 ? 'Expired' : `${days}d left`}
                </span>
                <span className="truncate text-foreground/40">
                    {certificate.issuer ?? '—'}
                </span>
            </div>
            <div className="h-1 overflow-hidden rounded-[1px] bg-foreground/[0.08]">
                <div
                    className={cn('h-full', tone)}
                    style={{ width: `${Math.round(certificate.used * 100)}%` }}
                />
            </div>
        </div>
    );
}
