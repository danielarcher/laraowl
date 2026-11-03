import { Head, router, usePage } from '@inertiajs/react';
import { Globe, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import DomainController from '@/actions/App/Http/Controllers/Domains/DomainController';
import { MailPosture, ShareBar } from '@/components/domains/breakdowns';
import { DomainRow, ROW_GRID } from '@/components/domains/domain-row';
import { RenewalRadar } from '@/components/domains/renewal-radar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { formatMoney } from '@/lib/costs';
import type {
    DomainRow as Row,
    DomainSort,
    DomainSummary,
    RadarMonth,
} from '@/lib/domains';
import {
    countdownTone,
    dnsLabel,
    formatDay,
    sortDomains,
    worstLevel,
} from '@/lib/domains';
import { formatAgo } from '@/lib/server-metrics';
import { cn } from '@/lib/utils';

type Props = {
    domains: Row[];
    summary: DomainSummary;
    radar: RadarMonth[];
    currency: string;
    scanned_at: string | null;
};

type Filter = 'all' | 'attention' | 'parked' | 'platform';

const SORTS: readonly DomainSort[] = [
    'attention',
    'renewal',
    'certificate',
    'name',
];
const SORT_LABELS: Record<DomainSort, string> = {
    attention: 'Attention',
    renewal: 'Renewal',
    certificate: 'Certificate',
    name: 'Name',
};

function Figure({
    label,
    value,
    detail,
    tone,
}: {
    label: string;
    value: string;
    detail?: React.ReactNode;
    tone?: string;
}) {
    return (
        <div className="min-w-0 px-5 py-4">
            <div className="text-[11px] font-medium text-foreground/45">
                {label}
            </div>
            <div
                className={cn(
                    'mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums',
                    tone ?? 'text-foreground',
                )}
            >
                {value}
            </div>
            {detail && (
                <div className="mt-0.5 truncate text-[11px] text-foreground/40">
                    {detail}
                </div>
            )}
        </div>
    );
}

export function filterDomains(rows: Row[], filter: Filter): Row[] {
    switch (filter) {
        case 'attention':
            return rows.filter((row) => {
                const worst = worstLevel(row.findings);

                return worst === 'critical' || worst === 'warning';
            });
        case 'parked':
            return rows.filter(
                (row) =>
                    row.redirects_to !== null &&
                    row.hosts.every((host) => host.apps.length === 0),
            );
        case 'platform':
            return rows.filter((row) => row.kind === 'platform');
        default:
            return rows;
    }
}

export default function DomainsIndex({
    domains,
    summary,
    radar,
    currency,
    scanned_at,
}: Props) {
    const { props }: any = usePage();
    const teamSlug: string = props.currentTeam?.slug ?? '';
    const [scanning, setScanning] = useState(false);
    const [filter, setFilter] = useState<Filter>('all');
    const [sort, setSort] = usePersistedState<DomainSort>(
        'laraowl.domains-sort',
        SORTS,
        'attention',
    );

    const scan = () => {
        setScanning(true);
        router.post(
            DomainController.scan.url(teamSlug),
            {},
            {
                preserveScroll: true,
                onSuccess: () => toast.success('Domains scanned.'),
                onError: () => toast.error('The scan did not finish.'),
                onFinish: () => setScanning(false),
            },
        );
    };

    const attention = summary.critical + summary.warnings;
    const parkedCount = filterDomains(domains, 'parked').length;
    const filters: { key: Filter; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: domains.length },
        {
            key: 'attention',
            label: 'Needs a look',
            count: filterDomains(domains, 'attention').length,
        },
        { key: 'parked', label: 'Parked', count: parkedCount },
        { key: 'platform', label: 'Platform', count: summary.platform },
    ];
    const [dns, setDns] = useState<string>('all');
    const dnsCounts = domains.reduce<Record<string, number>>((counts, row) => {
        const label = dnsLabel(row);
        counts[label] = (counts[label] ?? 0) + 1;

        return counts;
    }, {});
    // Busiest provider first; Platform and Unknown always last.
    const dnsOptions = Object.entries(dnsCounts).sort(([a, ca], [b, cb]) => {
        const tail = (label: string) =>
            label === 'Platform' || label === 'Unknown' ? 1 : 0;

        return tail(a) - tail(b) || cb - ca || a.localeCompare(b);
    });
    const dnsFilter = dns === 'all' || dnsCounts[dns] ? dns : 'all';
    const visible = sortDomains(
        filterDomains(domains, filter).filter(
            (row) => dnsFilter === 'all' || dnsLabel(row) === dnsFilter,
        ),
        sort,
    );

    return (
        <>
            <Head title="Domains" />

            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Domains
                    </h1>
                    <p className="mt-1 text-sm text-foreground/50">
                        {summary.domains} domains · {summary.hosts} hosts ·{' '}
                        {scanned_at
                            ? `scanned ${formatAgo(scanned_at)}`
                            : 'not scanned yet'}{' '}
                        · rescans every 6 hours
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={scan}
                    disabled={scanning}
                >
                    <RefreshCw className={cn(scanning && 'animate-spin')} />
                    {scanning ? 'Scanning…' : 'Scan now'}
                </Button>
            </div>

            {domains.length === 0 ? (
                <Card className="items-center gap-3 border-border bg-card p-10 text-center">
                    <Globe className="size-10 text-foreground/20" />
                    <div className="text-lg font-semibold">No domains yet</div>
                    <p className="max-w-md text-sm text-foreground/50">
                        Domains come from your apps' URLs and from the domain
                        costs in Settings. Scan to find them.
                    </p>
                    <Button size="sm" onClick={scan} disabled={scanning}>
                        Scan now
                    </Button>
                </Card>
            ) : (
                <>
                    <Card className="grid grid-cols-2 gap-0 divide-border/60 overflow-hidden border-border bg-card p-0 sm:grid-cols-3 sm:divide-x xl:grid-cols-5">
                        <Figure
                            label="Domains"
                            value={String(summary.domains)}
                            detail={`${summary.registered} registered · ${summary.platform} on platforms`}
                        />
                        <Figure
                            label="Next renewal"
                            value={
                                summary.next_renewal
                                    ? `${summary.next_renewal.days} days`
                                    : '—'
                            }
                            tone={
                                summary.next_renewal
                                    ? countdownTone(
                                          summary.next_renewal.days,
                                          30,
                                          7,
                                      )
                                    : undefined
                            }
                            detail={
                                summary.next_renewal
                                    ? `${summary.next_renewal.name} · ${formatDay(summary.next_renewal.date)}`
                                    : 'no renewal dates'
                            }
                        />
                        <Figure
                            label="First certificate to expire"
                            value={
                                summary.soonest_certificate
                                    ? `${summary.soonest_certificate.days} days`
                                    : '—'
                            }
                            tone={
                                summary.soonest_certificate
                                    ? countdownTone(
                                          summary.soonest_certificate.days,
                                          14,
                                          5,
                                      )
                                    : undefined
                            }
                            detail={
                                summary.soonest_certificate
                                    ? summary.soonest_certificate.host
                                    : 'none found'
                            }
                        />
                        <Figure
                            label="Renewals per year"
                            value={formatMoney(summary.yearly_cents, currency)}
                            detail={`≈ ${formatMoney(Math.round(summary.yearly_cents / 12), currency)} a month`}
                        />
                        <Figure
                            label="Needs a look"
                            value={String(attention)}
                            detail={
                                attention === 0 ? (
                                    'all clear'
                                ) : (
                                    <>
                                        {summary.critical > 0 && (
                                            <span className="font-medium text-red-500">
                                                {summary.critical} critical
                                            </span>
                                        )}
                                        {summary.critical > 0 &&
                                            summary.warnings > 0 &&
                                            ' · '}
                                        {summary.warnings > 0 && (
                                            <span className="text-amber-500">
                                                {summary.warnings}{' '}
                                                {summary.warnings === 1
                                                    ? 'warning'
                                                    : 'warnings'}
                                            </span>
                                        )}
                                    </>
                                )
                            }
                        />
                    </Card>

                    <RenewalRadar months={radar} currency={currency} />

                    <div className="grid gap-4 md:grid-cols-3">
                        <ShareBar
                            title="DNS"
                            caption="Who answers for each domain"
                            shares={summary.providers}
                        />
                        <ShareBar
                            title="Certificates"
                            caption={`Issuers · ${summary.proxied} ${summary.proxied === 1 ? 'host' : 'hosts'} behind Cloudflare`}
                            shares={summary.issuers}
                        />
                        <MailPosture grades={summary.email_grades} />
                    </div>

                    <Card className="gap-0 overflow-hidden border-border bg-card p-0">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
                            <div
                                className="flex flex-wrap gap-1"
                                role="group"
                                aria-label="Filter domains"
                            >
                                {filters.map((option) => (
                                    <button
                                        key={option.key}
                                        type="button"
                                        aria-pressed={filter === option.key}
                                        onClick={() => setFilter(option.key)}
                                        className={cn(
                                            'rounded-[4px] px-2 py-1 text-[12px] transition-colors',
                                            filter === option.key
                                                ? 'bg-muted text-foreground'
                                                : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {option.label}
                                        <span className="ml-1.5 text-foreground/40 tabular-nums">
                                            {option.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-foreground/45">
                                DNS
                                <div
                                    className="flex flex-wrap rounded-md border border-border p-0.5"
                                    role="group"
                                    aria-label="Filter by DNS provider"
                                >
                                    {[
                                        ['all', domains.length] as const,
                                        ...dnsOptions,
                                    ].map(([key, count]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            aria-pressed={dnsFilter === key}
                                            onClick={() => setDns(key)}
                                            className={cn(
                                                'rounded-sm px-2 py-0.5 transition-colors',
                                                dnsFilter === key
                                                    ? 'bg-muted text-foreground'
                                                    : 'text-muted-foreground hover:text-foreground',
                                            )}
                                        >
                                            {key === 'all' ? 'All' : key}
                                            <span className="ml-1.5 text-foreground/40 tabular-nums">
                                                {count}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-foreground/45">
                                Sort
                                <div
                                    className="flex rounded-md border border-border p-0.5"
                                    role="group"
                                    aria-label="Sort domains"
                                >
                                    {SORTS.map((key) => (
                                        <button
                                            key={key}
                                            type="button"
                                            aria-pressed={sort === key}
                                            onClick={() => setSort(key)}
                                            className={cn(
                                                'rounded-sm px-2 py-0.5 transition-colors',
                                                sort === key
                                                    ? 'bg-muted text-foreground'
                                                    : 'text-muted-foreground hover:text-foreground',
                                            )}
                                        >
                                            {SORT_LABELS[key]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div
                            className={cn(
                                'hidden border-b border-border/60 px-5 py-2 text-[11px] font-medium text-foreground/40',
                                ROW_GRID,
                            )}
                            aria-hidden
                        >
                            <span>Domain</span>
                            <span>Points at</span>
                            <span>DNS</span>
                            <span>Certificate</span>
                            <span>Uptime · 30 days</span>
                            <span>Renews</span>
                            <span>Mail</span>
                            <span className="text-right">Cost</span>
                            <span />
                        </div>

                        <ul aria-label="Domains">
                            {visible.map((row) => (
                                <DomainRow
                                    key={row.id}
                                    row={row}
                                    teamSlug={teamSlug}
                                />
                            ))}
                            {visible.length === 0 && (
                                <li className="px-5 py-8 text-center text-sm text-foreground/45">
                                    Nothing here.
                                </li>
                            )}
                        </ul>
                    </Card>
                </>
            )}
        </>
    );
}

DomainsIndex.layout = {
    breadcrumbs: [{ title: 'Domains', href: '#' }],
};
