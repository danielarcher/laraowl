import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { domainRow, uptime } from '@/test/domain-fixtures';
import { inertiaMock } from '@/test/inertia-mock';

vi.mock('@inertiajs/react', () => inertiaMock);

const { DomainRow } = await import('@/components/domains/domain-row');
const { RenewalRadar } = await import('@/components/domains/renewal-radar');
const { UptimeStrip } = await import('@/components/domains/uptime-strip');
const { MailPosture } = await import('@/components/domains/breakdowns');

const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(2026, 10 + i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    return { month: key, cents: 0, events: [] as never[] };
});

describe('domain row', () => {
    it('opens to show hosts, mail records and registration', () => {
        render(
            <ul>
                <DomainRow
                    row={domainRow({
                        findings: [
                            {
                                level: 'warning',
                                text: 'The registration runs out in 20 days.',
                            },
                        ],
                    })}
                    teamSlug="archer"
                />
            </ul>,
        );

        expect(screen.queryByText('Registrar')).toBe(null);

        fireEvent.click(
            screen.getByRole('button', { name: 'example.com details' }),
        );

        expect(
            screen.getByText('The registration runs out in 20 days.'),
        ).toBeTruthy();
        expect(screen.getByText('Namecheap')).toBeTruthy();
        expect(screen.getByText('v=spf1 -all')).toBeTruthy();
        expect(screen.getByText('p=reject')).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Shop' }).getAttribute('href'),
        ).toBe('/archer/shop/dashboard');
        expect(screen.getByText(/years old/)).toBeTruthy();
    });

    it('calls a domain with no app that redirects elsewhere parked', () => {
        render(
            <ul>
                <DomainRow
                    row={domainRow({
                        name: 'old-brand.com',
                        redirects_to: 'example.com',
                        hosts: [{ ...domainRow().hosts[0], apps: [] }],
                    })}
                    teamSlug="archer"
                />
            </ul>,
        );

        expect(screen.getByText(/Parked/).textContent).toContain('example.com');
    });

    it('shows Cloudflare when the host is proxied', () => {
        render(
            <ul>
                <DomainRow
                    row={domainRow({
                        hosts: [
                            {
                                ...domainRow().hosts[0],
                                proxied: true,
                                server: null,
                            },
                        ],
                    })}
                    teamSlug="archer"
                />
            </ul>,
        );

        expect(screen.getByText('Cloudflare')).toBeTruthy();
    });
});

describe('renewal radar', () => {
    it('lists a month’s renewals and certificates when you point at it', () => {
        const data = months.map((m) => ({
            ...m,
            events: [] as {
                type: 'renewal' | 'certificate';
                name: string;
                date: string;
                cents: number;
            }[],
        }));
        data[4] = {
            ...data[4],
            cents: 5160,
            events: [
                {
                    type: 'renewal',
                    name: 'fastidious.gg',
                    date: `${data[4].month}-09`,
                    cents: 5160,
                },
                {
                    type: 'certificate',
                    name: 'shop.example.com',
                    date: `${data[4].month}-20`,
                    cents: 0,
                },
            ],
        };

        render(<RenewalRadar months={data} currency="USD" />);

        expect(screen.getByText(/1 renewal ·/)).toBeTruthy();

        const items = within(
            screen.getByRole('list', { name: 'Months' }),
        ).getAllByRole('listitem');
        fireEvent.mouseEnter(items[0]);
        expect(screen.getByText('Nothing renews or expires.')).toBeTruthy();

        fireEvent.mouseEnter(items[4]);
        expect(screen.getByText('fastidious.gg')).toBeTruthy();
        expect(screen.getByText('shop.example.com')).toBeTruthy();
        expect(screen.getByText('auto')).toBeTruthy();
    });
});

describe('uptime strip', () => {
    it('draws one cell a day, coloured by how much it was up', () => {
        const days = uptime(1);
        days[3] = { ...days[3], ratio: 0.99 };
        days[4] = { ...days[4], ratio: 0.5 };
        days[5] = { ...days[5], ratio: null, ms: null, checks: 0 };

        const { container } = render(<UptimeStrip days={days} />);
        const cells = container.querySelectorAll('[data-ratio]');

        expect(cells).toHaveLength(30);
        expect(cells[0].className).toContain('bg-emerald-500');
        expect(cells[3].className).toContain('bg-amber-500');
        expect(cells[4].className).toContain('bg-red-500');
        expect(cells[5].getAttribute('title')).toContain('no checks');
    });
});

describe('mail posture', () => {
    it('counts domains per spoofing grade', () => {
        render(<MailPosture grades={{ A: 1, C: 4, F: 5 }} />);

        expect(screen.getByTitle(/forged mail gets rejected/).textContent).toBe(
            'A1',
        );
        expect(screen.getByTitle(/anyone can send mail/).textContent).toBe(
            'F5',
        );
        expect(screen.getByTitle(/only reports/).textContent).toBe('B0');
    });
});
