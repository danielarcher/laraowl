import { describe, expect, it } from 'vitest';
import {
    countdownTone,
    formatDay,
    formatDays,
    sortDomains,
} from '@/lib/domains';
import { domainRow } from '@/test/domain-fixtures';

describe('domain helpers', () => {
    it('writes dates as dd/mm/yyyy', () => {
        expect(formatDay('2027-03-09')).toBe('09/03/2027');
        expect(formatDay(null)).toBe('—');
    });

    it('writes countdowns short', () => {
        expect(formatDays(0)).toBe('today');
        expect(formatDays(12)).toBe('12d');
        expect(formatDays(-3)).toBe('3d ago');
        expect(formatDays(1020)).toBe('2.8y');
    });

    it('turns a countdown amber, then red', () => {
        expect(countdownTone(100, 30, 7)).toBe('text-foreground');
        expect(countdownTone(20, 30, 7)).toBe('text-amber-500');
        expect(countdownTone(3, 30, 7)).toBe('text-red-500');
    });

    it('puts what needs a look first, then by renewal or certificate', () => {
        const calm = domainRow({
            id: 1,
            name: 'calm.com',
            days_to_expiry: 300,
            cert_days: 80,
        });
        const warn = domainRow({
            id: 2,
            name: 'warn.com',
            days_to_expiry: 20,
            cert_days: 60,
            findings: [{ level: 'warning', text: 'soon' }],
        });
        const bad = domainRow({
            id: 3,
            name: 'bad.com',
            days_to_expiry: null,
            cert_days: 2,
            findings: [{ level: 'critical', text: 'expired' }],
        });

        const names = (sort: Parameters<typeof sortDomains>[1]) =>
            sortDomains([calm, warn, bad], sort).map((row) => row.name);

        expect(names('attention')).toEqual(['bad.com', 'warn.com', 'calm.com']);
        expect(names('renewal')).toEqual(['warn.com', 'calm.com', 'bad.com']);
        expect(names('certificate')).toEqual([
            'bad.com',
            'warn.com',
            'calm.com',
        ]);
        expect(names('name')).toEqual(['bad.com', 'calm.com', 'warn.com']);
    });
});
