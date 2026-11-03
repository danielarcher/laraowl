import type { DomainRow, UptimeDay } from '@/lib/domains';

export function uptime(ratio: number | null = 1, ms = 200): UptimeDay[] {
    return Array.from({ length: 30 }, (_, i) => ({
        date: `2026-10-${String(i + 1).padStart(2, '0')}`,
        ratio,
        ms: ratio === null ? null : ms + i,
        checks: ratio === null ? 0 : 1440,
    }));
}

export function domainRow(overrides: Partial<DomainRow> = {}): DomainRow {
    return {
        id: 1,
        name: 'example.com',
        kind: 'registered',
        hosts: [
            {
                host: 'example.com',
                addresses: ['10.0.0.5'],
                proxied: false,
                server: { id: 1, name: 'web-1' },
                certificate: {
                    issuer: "Let's Encrypt",
                    valid_from: '2026-10-01T00:00:00Z',
                    expires_at: '2026-12-30T00:00:00Z',
                    names: ['example.com'],
                    days_left: 57,
                    lifetime_days: 90,
                    used: 0.36,
                },
                apps: [{ id: 3, name: 'Shop', slug: 'shop' }],
            },
        ],
        dns_provider: 'Cloudflare',
        nameservers: ['ns1.cloudflare.com'],
        email: {
            mx: true,
            spf: 'v=spf1 -all',
            spf_all: '-',
            dmarc: 'reject',
            grade: 'A',
        },
        http_status: 200,
        redirects_to: null,
        registrar: 'Namecheap',
        registered_at: '2015-04-01T00:00:00Z',
        expires_at: '2027-04-01T00:00:00Z',
        expiry_source: 'registry',
        days_to_expiry: 149,
        rdap_status: 'ok',
        cert_days: 57,
        cost: {
            amount_cents: 1200,
            currency: 'USD',
            interval: 'yearly',
            yearly_cents: 1200,
        },
        uptime: uptime(),
        availability: 0.99985,
        findings: [],
        scanned_at: '2026-11-03T10:00:00Z',
        ...overrides,
    };
}
