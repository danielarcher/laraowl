import { Link } from '@inertiajs/react';
import { ArrowRight, ChevronDown, Cloud, Server } from 'lucide-react';
import { useState } from 'react';
import { GRADE_COPY, gradeTone } from '@/components/domains/breakdowns';
import { CertLifeline } from '@/components/domains/cert-lifeline';
import { LatencySpark, UptimeStrip } from '@/components/domains/uptime-strip';
import { formatMoney } from '@/lib/costs';
import type { DomainHost, DomainRow as Row, Finding } from '@/lib/domains';
import {
    countdownTone,
    dnsLabel,
    domainAge,
    formatDay,
    formatDays,
    worstLevel,
} from '@/lib/domains';
import { cn } from '@/lib/utils';

const LEVEL_TONE: Record<Finding['level'], string> = {
    critical: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-foreground/30',
};

export const ROW_GRID =
    'lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_44px_minmax(0,0.8fr)_20px] lg:items-center lg:gap-5';

function PointsAt({ host }: { host: DomainHost | undefined }) {
    if (!host) {
        return <span className="text-foreground/40">—</span>;
    }

    if (host.addresses.length === 0) {
        return <span className="text-red-500">Doesn't resolve</span>;
    }

    if (host.proxied) {
        return (
            <span className="flex items-center gap-1.5">
                <Cloud className="size-3.5 text-orange-500" />
                Cloudflare
            </span>
        );
    }

    if (host.server) {
        return (
            <span className="flex min-w-0 items-center gap-1.5">
                <Server className="size-3.5 shrink-0 text-foreground/45" />
                <span className="truncate">{host.server.name}</span>
            </span>
        );
    }

    return (
        <span className="truncate font-mono text-[11px] text-amber-600 dark:text-amber-400">
            {host.addresses[0]}
        </span>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-[110px_1fr] gap-3 py-1 text-[12px]">
            <dt className="text-foreground/45">{label}</dt>
            <dd className="min-w-0 break-words">{children}</dd>
        </div>
    );
}

function Details({ row, teamSlug }: { row: Row; teamSlug: string }) {
    const age = domainAge(row.registered_at);

    return (
        <div className="space-y-5 border-t border-border/60 bg-foreground/[0.015] px-5 py-5">
            {row.findings.length > 0 && (
                <ul className="space-y-1.5" aria-label="Findings">
                    {row.findings.map((finding) => (
                        <li
                            key={finding.text}
                            className="flex items-start gap-2 text-[12px]"
                        >
                            <span
                                className={cn(
                                    'mt-1 size-2 shrink-0 rounded-[1px]',
                                    LEVEL_TONE[finding.level],
                                )}
                            />
                            {finding.text}
                        </li>
                    ))}
                </ul>
            )}

            <div className="grid gap-6 xl:grid-cols-3">
                <section>
                    <h4 className="mb-2 text-[11px] font-medium tracking-wide text-foreground/45 uppercase">
                        Hosts
                    </h4>
                    <div className="space-y-3">
                        {row.hosts.map((host) => (
                            <div
                                key={host.host}
                                className="rounded-[6px] border border-border/70 bg-card px-3 py-2.5"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <a
                                        href={`https://${host.host}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="truncate text-[12px] font-medium hover:underline"
                                    >
                                        {host.host}
                                    </a>
                                    <span className="shrink-0 text-[11px] text-foreground/60">
                                        <PointsAt host={host} />
                                    </span>
                                </div>
                                {host.apps.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-foreground/50">
                                        {host.apps.map((app) => (
                                            <Link
                                                key={app.id}
                                                href={`/${teamSlug}/${app.slug}/dashboard`}
                                                className="hover:text-foreground"
                                            >
                                                {app.name}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                                <div className="mt-2">
                                    <CertLifeline
                                        certificate={host.certificate}
                                    />
                                </div>
                                {host.certificate && (
                                    <p className="mt-1.5 text-[11px] text-foreground/45 tabular-nums">
                                        {formatDay(host.certificate.valid_from)}{' '}
                                        →{' '}
                                        {formatDay(host.certificate.expires_at)}{' '}
                                        · {host.certificate.names.length}{' '}
                                        {host.certificate.names.length === 1
                                            ? 'name'
                                            : 'names'}
                                    </p>
                                )}
                                {host.addresses.length > 0 && (
                                    <p className="mt-1 truncate font-mono text-[10px] text-foreground/40">
                                        {host.addresses.join(' · ')}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <h4 className="mb-2 text-[11px] font-medium tracking-wide text-foreground/45 uppercase">
                        DNS & mail
                    </h4>
                    {row.kind === 'platform' ? (
                        <p className="text-[12px] text-foreground/50">
                            A host on its platform's domain: the platform runs
                            DNS and mail.
                        </p>
                    ) : (
                        <dl>
                            <Field label="DNS">{row.dns_provider ?? '—'}</Field>
                            <Field label="Nameservers">
                                <span className="font-mono text-[11px]">
                                    {row.nameservers.join(', ') || '—'}
                                </span>
                            </Field>
                            <Field label="Mail servers">
                                {row.email?.mx ? 'Yes (MX)' : 'None'}
                            </Field>
                            <Field label="SPF">
                                <span className="font-mono text-[11px]">
                                    {row.email?.spf ?? 'missing'}
                                </span>
                            </Field>
                            <Field label="DMARC">
                                {row.email?.dmarc
                                    ? `p=${row.email.dmarc}`
                                    : 'missing'}
                            </Field>
                            {row.email && (
                                <Field label="Spoofing">
                                    <span className="flex items-start gap-2">
                                        <span
                                            className={cn(
                                                'shrink-0 rounded-[3px] border px-1 text-[11px] font-semibold',
                                                gradeTone(row.email.grade),
                                            )}
                                        >
                                            {row.email.grade}
                                        </span>
                                        <span className="text-foreground/60">
                                            {GRADE_COPY[row.email.grade]}
                                        </span>
                                    </span>
                                </Field>
                            )}
                        </dl>
                    )}
                </section>

                <section>
                    <h4 className="mb-2 text-[11px] font-medium tracking-wide text-foreground/45 uppercase">
                        Registration
                    </h4>
                    <dl>
                        {row.kind === 'registered' && (
                            <>
                                <Field label="Registrar">
                                    {row.registrar ?? '—'}
                                </Field>
                                <Field label="Registered">
                                    {row.registered_at ? (
                                        <>
                                            {formatDay(row.registered_at)}
                                            {age && (
                                                <span className="text-foreground/45">
                                                    {' '}
                                                    · {age}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        '—'
                                    )}
                                </Field>
                                <Field label="Renews">
                                    {formatDay(row.expires_at)}
                                    {row.expiry_source && (
                                        <span className="text-foreground/45">
                                            {' '}
                                            ·{' '}
                                            {row.expiry_source === 'registry'
                                                ? 'from the registry'
                                                : 'from Costs'}
                                        </span>
                                    )}
                                </Field>
                                <Field label="Cost">
                                    {row.cost
                                        ? `${formatMoney(row.cost.amount_cents, row.cost.currency)} / ${row.cost.interval === 'yearly' ? 'year' : 'month'}`
                                        : '—'}
                                </Field>
                            </>
                        )}
                        <Field label="Home page">
                            {row.http_status ? (
                                <span className="tabular-nums">
                                    HTTP {row.http_status}
                                    {row.redirects_to && (
                                        <> → {row.redirects_to}</>
                                    )}
                                </span>
                            ) : (
                                'No answer'
                            )}
                        </Field>
                        <Field label="Uptime 30d">
                            {row.availability === null
                                ? 'No app checks it'
                                : `${(row.availability * 100).toFixed(3)}%`}
                        </Field>
                    </dl>
                </section>
            </div>
        </div>
    );
}

/**
 * One domain: the line you scan, and everything else when opened.
 */
export function DomainRow({ row, teamSlug }: { row: Row; teamSlug: string }) {
    const [open, setOpen] = useState(false);
    const primary = row.hosts.find((h) => h.apps.length > 0) ?? row.hosts[0];
    const certificate =
        row.hosts
            .map((h) => h.certificate)
            .filter((c) => c !== null)
            .sort((a, b) => a.days_left - b.days_left)[0] ?? null;
    const apps = row.hosts.flatMap((h) => h.apps);
    const worst = worstLevel(row.findings);
    const parked = row.redirects_to !== null && apps.length === 0;

    return (
        <li className="border-b border-border/60 last:border-b-0">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-label={`${row.name} details`}
                className={cn(
                    'w-full space-y-3 px-5 py-3.5 text-left transition-colors hover:bg-foreground/[0.02] lg:space-y-0',
                    ROW_GRID,
                )}
            >
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        {worst && (
                            <span
                                title={`${row.findings.length} ${row.findings.length === 1 ? 'finding' : 'findings'}`}
                                className={cn(
                                    'size-2 shrink-0 rounded-[1px]',
                                    LEVEL_TONE[worst],
                                )}
                            />
                        )}
                        <span className="truncate text-[13px] font-semibold tracking-tight">
                            {row.name}
                        </span>
                        {row.kind === 'platform' && (
                            <span className="shrink-0 rounded-[3px] border border-border px-1 text-[10px] text-foreground/50">
                                platform
                            </span>
                        )}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-foreground/45">
                        {parked ? (
                            <span className="inline-flex items-center gap-1">
                                Parked <ArrowRight className="size-3" />{' '}
                                {row.redirects_to}
                            </span>
                        ) : apps.length > 0 ? (
                            apps.map((a) => a.name).join(' · ')
                        ) : (
                            'No app on it'
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-[12px] lg:block">
                    <span className="text-[11px] text-foreground/40 lg:hidden">
                        Points at
                    </span>
                    <PointsAt host={primary} />
                </div>

                <div className="flex items-center justify-between gap-3 text-[12px] lg:block lg:min-w-0">
                    <span className="text-[11px] text-foreground/40 lg:hidden">
                        DNS
                    </span>
                    <span
                        className={cn(
                            'truncate',
                            row.dns_provider === null && 'text-foreground/40',
                        )}
                    >
                        {dnsLabel(row)}
                    </span>
                </div>

                <div className="lg:min-w-0">
                    <CertLifeline certificate={certificate} />
                </div>

                <div className="space-y-1">
                    <UptimeStrip days={row.uptime} />
                    <div className="flex items-center justify-between gap-2">
                        <LatencySpark
                            days={row.uptime}
                            width={90}
                            height={14}
                        />
                        <span className="text-[11px] text-foreground/55 tabular-nums">
                            {row.availability === null
                                ? '—'
                                : `${(row.availability * 100).toFixed(2)}%`}
                        </span>
                    </div>
                </div>

                <div className="flex items-baseline justify-between gap-2 text-[12px] lg:block">
                    <span className="text-[11px] text-foreground/40 lg:hidden">
                        Renews
                    </span>
                    {row.kind === 'platform' ? (
                        <span className="text-foreground/40">—</span>
                    ) : (
                        <span className="tabular-nums">
                            <span
                                className={cn(
                                    'font-medium',
                                    countdownTone(row.days_to_expiry, 30, 7),
                                )}
                            >
                                {formatDays(row.days_to_expiry)}
                            </span>
                            <span className="block text-[11px] text-foreground/40">
                                {formatDay(row.expires_at)}
                            </span>
                        </span>
                    )}
                </div>

                <div className="hidden lg:block">
                    {row.email ? (
                        <span
                            title={GRADE_COPY[row.email.grade]}
                            className={cn(
                                'inline-flex size-6 items-center justify-center rounded-[4px] border text-[11px] font-semibold',
                                gradeTone(row.email.grade),
                            )}
                        >
                            {row.email.grade}
                        </span>
                    ) : (
                        <span className="text-foreground/30">—</span>
                    )}
                </div>

                <div className="hidden text-right text-[12px] tabular-nums lg:block">
                    {row.cost ? (
                        <>
                            {formatMoney(
                                row.cost.amount_cents,
                                row.cost.currency,
                            )}
                            <span className="block text-[11px] text-foreground/40">
                                /{' '}
                                {row.cost.interval === 'yearly'
                                    ? 'year'
                                    : 'month'}
                            </span>
                        </>
                    ) : (
                        <span className="text-foreground/30">—</span>
                    )}
                </div>

                <ChevronDown
                    className={cn(
                        'hidden size-4 text-foreground/40 transition-transform lg:block',
                        open && 'rotate-180',
                    )}
                />
            </button>
            {open && <Details row={row} teamSlug={teamSlug} />}
        </li>
    );
}
