export type Certificate = {
    issuer: string | null;
    valid_from: string;
    expires_at: string;
    names: string[];
    days_left: number;
    lifetime_days: number;
    used: number;
};

export type DomainHost = {
    host: string;
    addresses: string[];
    proxied: boolean;
    server: { id: number; name: string } | null;
    certificate: Certificate | null;
    apps: { id: number; name: string; slug: string }[];
};

export type EmailPosture = {
    mx: boolean;
    spf: string | null;
    spf_all: string | null;
    dmarc: 'none' | 'quarantine' | 'reject' | null;
    grade: 'A' | 'B' | 'C' | 'F';
};

export type Finding = {
    level: 'critical' | 'warning' | 'info';
    text: string;
};

export type UptimeDay = {
    date: string;
    ratio: number | null;
    ms: number | null;
    checks: number;
};

export type DomainRow = {
    id: number;
    name: string;
    kind: 'registered' | 'platform';
    hosts: DomainHost[];
    dns_provider: string | null;
    nameservers: string[];
    email: EmailPosture | null;
    http_status: number | null;
    redirects_to: string | null;
    registrar: string | null;
    registered_at: string | null;
    expires_at: string | null;
    expiry_source: 'registry' | 'costs' | null;
    days_to_expiry: number | null;
    rdap_status: 'ok' | 'unsupported' | 'failed' | null;
    cert_days: number | null;
    cost: {
        amount_cents: number;
        currency: string;
        interval: 'monthly' | 'yearly';
        yearly_cents: number;
    } | null;
    uptime: UptimeDay[];
    availability: number | null;
    findings: Finding[];
    scanned_at: string | null;
};

export type DomainSummary = {
    domains: number;
    registered: number;
    platform: number;
    hosts: number;
    yearly_cents: number;
    next_renewal: { name: string; days: number; date: string } | null;
    soonest_certificate: {
        host: string;
        days: number;
        issuer: string | null;
    } | null;
    critical: number;
    warnings: number;
    providers: Record<string, number>;
    issuers: Record<string, number>;
    proxied: number;
    email_grades: Record<string, number>;
};

export type RadarEvent = {
    type: 'renewal' | 'certificate';
    name: string;
    date: string;
    cents: number;
};

export type RadarMonth = {
    month: string;
    cents: number;
    events: RadarEvent[];
};

export function formatDay(iso: string | null): string {
    if (!iso) {
        return '—';
    }

    const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
    const pad = (n: number) => String(n).padStart(2, '0');

    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatDays(days: number | null): string {
    if (days === null) {
        return '—';
    }

    if (days < 0) {
        return `${Math.abs(days)}d ago`;
    }

    if (days === 0) {
        return 'today';
    }

    return days >= 365 ? `${(days / 365).toFixed(1)}y` : `${days}d`;
}

/** Text colour for a countdown: red when it's close, amber when it's coming. */
export function countdownTone(
    days: number | null,
    warn: number,
    critical: number,
): string {
    if (days === null) {
        return 'text-foreground/40';
    }

    if (days <= critical) {
        return 'text-red-500';
    }

    return days <= warn ? 'text-amber-500' : 'text-foreground';
}

export function domainAge(registeredAt: string | null): string | null {
    if (!registeredAt) {
        return null;
    }

    const years =
        (Date.now() - new Date(registeredAt).getTime()) /
        (365.25 * 24 * 3600 * 1000);

    if (years < 1) {
        const months = Math.max(1, Math.floor(years * 12));

        return `${months} ${months === 1 ? 'month' : 'months'} old`;
    }

    const whole = Math.floor(years);

    return `${whole} ${whole === 1 ? 'year' : 'years'} old`;
}

export function worstLevel(findings: Finding[]): Finding['level'] | null {
    if (findings.some((f) => f.level === 'critical')) {
        return 'critical';
    }

    if (findings.some((f) => f.level === 'warning')) {
        return 'warning';
    }

    return findings.length > 0 ? 'info' : null;
}

export type DomainSort = 'attention' | 'renewal' | 'certificate' | 'name';

const LEVEL_WEIGHT = { critical: 0, warning: 1, info: 2 } as const;

export function sortDomains(rows: DomainRow[], sort: DomainSort): DomainRow[] {
    const byName = (a: DomainRow, b: DomainRow) => a.name.localeCompare(b.name);
    const nullsLast = (a: number | null, b: number | null) =>
        (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER);

    return [...rows].sort((a, b) => {
        switch (sort) {
            case 'renewal':
                return (
                    nullsLast(a.days_to_expiry, b.days_to_expiry) ||
                    byName(a, b)
                );
            case 'certificate':
                return nullsLast(a.cert_days, b.cert_days) || byName(a, b);
            case 'name':
                return byName(a, b);
            default: {
                const wa = worstLevel(a.findings);
                const wb = worstLevel(b.findings);

                return (
                    (wa ? LEVEL_WEIGHT[wa] : 3) - (wb ? LEVEL_WEIGHT[wb] : 3) ||
                    b.findings.length - a.findings.length ||
                    byName(a, b)
                );
            }
        }
    });
}

/**
 * Who runs a domain's DNS, as the list and its filter name it. A platform
 * host has no DNS of its own: the platform answers for it.
 */
export function dnsLabel(row: DomainRow): string {
    if (row.dns_provider) {
        return row.dns_provider;
    }

    return row.kind === 'platform' ? 'Platform' : 'Unknown';
}

/**
 * Where a provider's DNS for a domain is edited: the domain's own records
 * page when the provider links to it by name, its domain list otherwise.
 * Null for a provider we have no page for.
 */
export function dnsManageUrl(
    provider: string | null,
    domain: string,
): string | null {
    const name = encodeURIComponent(domain);
    const pages: Record<string, string> = {
        Cloudflare: `https://dash.cloudflare.com/?to=/:account/${name}/dns/records`,
        Namecheap: `https://ap.www.namecheap.com/Domains/DomainControlPanel/${name}/advancedns`,
        Gandi: 'https://admin.gandi.net/domain/',
        'AWS Route 53':
            'https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones',
        DigitalOcean: `https://cloud.digitalocean.com/networking/domains/${name}`,
        GoDaddy: `https://dcc.godaddy.com/control/dnsmanagement?domainName=${name}`,
        'Registro.br': 'https://registro.br/painel/',
        Hostinger: `https://hpanel.hostinger.com/domain/${name}/dns`,
        Vercel: 'https://vercel.com/dashboard/domains',
        Maxer: 'https://my.maxer.com/',
        'Akamai Linode': 'https://cloud.linode.com/domains',
        Hetzner: 'https://dns.hetzner.com/',
        Spaceship:
            'https://www.spaceship.com/application/domain-list-application/',
        Wix: 'https://manage.wix.com/account/domains',
        Blacknight: 'https://cp.blacknight.com/',
        NS1: 'https://my.nsone.net/',
    };

    return provider ? (pages[provider] ?? null) : null;
}
