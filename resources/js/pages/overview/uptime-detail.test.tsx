import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { inertiaMock } from '@/test/inertia-mock';

vi.mock('@inertiajs/react', () => inertiaMock);

const { UptimeDetail } = await import('@/pages/overview/index');

describe('uptime detail', () => {
    it('says nothing is down, in plain text', () => {
        const { container } = render(
            <UptimeDetail totals={{ apps_down: 0, apps_host_not_found: 0 }} />,
        );

        expect(container.textContent).toBe('nothing down');
        expect(container.querySelector('.text-red-500')).toBe(null);
    });

    it('puts real outages in red and a vanished host in amber', () => {
        render(
            <UptimeDetail totals={{ apps_down: 2, apps_host_not_found: 1 }} />,
        );

        expect(screen.getByText('2 down').className).toContain('text-red-500');
        expect(screen.getByText('1 host not found').className).toContain(
            'text-amber-500',
        );
    });

    it('does not call a stale URL an outage', () => {
        const { container } = render(
            <UptimeDetail totals={{ apps_down: 0, apps_host_not_found: 1 }} />,
        );

        expect(container.textContent).toBe('1 host not found');
        expect(container.querySelector('.text-red-500')).toBe(null);
    });
});
