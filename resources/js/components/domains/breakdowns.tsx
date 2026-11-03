import { Card } from '@/components/ui/card';
import type { DomainSummary } from '@/lib/domains';
import { cn } from '@/lib/utils';

const SHADES = [
    'bg-foreground/80',
    'bg-foreground/55',
    'bg-foreground/35',
    'bg-foreground/20',
    'bg-foreground/10',
];

/**
 * A share bar: one segment per entry, widest first, in steps of one ink.
 */
export function ShareBar({
    title,
    caption,
    shares,
}: {
    title: string;
    caption: string;
    shares: Record<string, number>;
}) {
    const entries = Object.entries(shares).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, n]) => sum + n, 0);

    return (
        <Card className="gap-3 border-border bg-card px-5 py-4">
            <div>
                <h3 className="text-[13px] font-semibold tracking-tight">
                    {title}
                </h3>
                <p className="text-[11px] text-foreground/45">{caption}</p>
            </div>
            {total === 0 ? (
                <p className="text-[12px] text-foreground/40">
                    Not scanned yet.
                </p>
            ) : (
                <>
                    <div className="flex h-2 gap-px overflow-hidden rounded-[2px]">
                        {entries.map(([name, n], index) => (
                            <span
                                key={name}
                                title={`${name}: ${n}`}
                                className={
                                    SHADES[Math.min(index, SHADES.length - 1)]
                                }
                                style={{ width: `${(n / total) * 100}%` }}
                            />
                        ))}
                    </div>
                    <ul className="space-y-1">
                        {entries.map(([name, n], index) => (
                            <li
                                key={name}
                                className="flex items-center gap-2 text-[12px]"
                            >
                                <span
                                    className={cn(
                                        'size-2 rounded-[1px]',
                                        SHADES[
                                            Math.min(index, SHADES.length - 1)
                                        ],
                                    )}
                                />
                                <span className="flex-1 truncate">{name}</span>
                                <span className="text-foreground/50 tabular-nums">
                                    {n}
                                </span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </Card>
    );
}

export const GRADE_COPY: Record<string, string> = {
    A: 'SPF and an enforced DMARC: forged mail gets rejected.',
    B: 'SPF and a DMARC that only reports, or a soft SPF.',
    C: 'SPF only: receivers may still deliver forgeries.',
    F: 'No SPF: anyone can send mail as this domain.',
};

export function gradeTone(grade: string): string {
    return (
        {
            A: 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400',
            B: 'border-foreground/30 text-foreground/80',
            C: 'border-amber-500/50 text-amber-600 dark:text-amber-400',
            F: 'border-red-500/50 text-red-600 dark:text-red-400',
        }[grade] ?? 'border-border text-foreground/50'
    );
}

/**
 * How well each domain is protected against forged email.
 */
export function MailPosture({
    grades,
}: {
    grades: DomainSummary['email_grades'];
}) {
    return (
        <Card className="gap-3 border-border bg-card px-5 py-4">
            <div>
                <h3 className="text-[13px] font-semibold tracking-tight">
                    Spoofing protection
                </h3>
                <p className="text-[11px] text-foreground/45">
                    Can someone send mail pretending to be you?
                </p>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
                {(['A', 'B', 'C', 'F'] as const).map((grade) => (
                    <div
                        key={grade}
                        title={GRADE_COPY[grade]}
                        className={cn(
                            'rounded-[4px] border px-2 py-1.5',
                            (grades[grade] ?? 0) > 0
                                ? gradeTone(grade)
                                : 'border-border text-foreground/25',
                        )}
                    >
                        <div className="text-[11px] font-semibold">{grade}</div>
                        <div className="text-lg leading-tight font-semibold tabular-nums">
                            {grades[grade] ?? 0}
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-[11px] leading-relaxed text-foreground/45">
                A: forged mail is rejected · F: nothing stops it. Open a domain
                to see its records.
            </p>
        </Card>
    );
}
