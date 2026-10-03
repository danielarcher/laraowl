export type ServerDisk = {
    mount: string;
    total: number;
    used: number;
    percent: number | null;
};

export type ServerSample = {
    recorded_at: string;
    cpu: number;
    load: [number, number, number];
    memory_total: number;
    memory_used: number;
    memory: number | null;
    swap_total: number;
    swap_used: number;
    swap: number | null;
    disk_total: number;
    disk_used: number;
    disk: number | null;
    disks: ServerDisk[];
    uptime_seconds: number | null;
};

export type ServerPoint = {
    timestamp: number;
    cpu: number;
    cpu_max: number;
    memory: number | null;
    memory_used: number;
    swap: number | null;
    swap_used: number;
    load_1: number;
    load_5: number;
    load_15: number;
    disk: number | null;
    disk_used: number;
};

export type ServerProjectLink = {
    name: string;
    slug: string;
};

export type ServerSummary = {
    id: number;
    name: string;
    hostname: string | null;
    ip_address: string | null;
    os: string | null;
    cpu_count: number | null;
    last_seen_at: string | null;
    is_online: boolean;
    projects: ServerProjectLink[];
};

export type ServerOverview = ServerSummary & {
    latest: ServerSample | null;
    sparkline: ServerPoint[];
};

export function formatBytes(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined || isNaN(bytes)) {
        return '—';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }

    return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

export function formatPercent(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : `${value.toFixed(1)}%`;
}

export function formatUptime(seconds: number | null | undefined): string {
    if (!seconds) {
        return '—';
    }

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
        return `${days}d ${hours}h`;
    }

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}

export function formatAgo(iso: string | null): string {
    if (!iso) {
        return 'never';
    }

    const seconds = Math.max(
        0,
        Math.round((Date.now() - new Date(iso).getTime()) / 1000),
    );

    if (seconds < 60) {
        return `${seconds}s ago`;
    }

    if (seconds < 3600) {
        return `${Math.floor(seconds / 60)}m ago`;
    }

    if (seconds < 86400) {
        return `${Math.floor(seconds / 3600)}h ago`;
    }

    return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Chart axis/tooltip time: 24h clock, dd/mm when the window spans days.
 */
export function formatChartTime(timestamp: number, withDate: boolean): string {
    const date = new Date(timestamp * 1000);
    const time = date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    if (!withDate) {
        return time;
    }

    const day = date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
    });

    return `${day} ${time}`;
}

/**
 * Traffic-light colour for a usage percentage.
 */
export function usageTone(percent: number | null | undefined): {
    bar: string;
    text: string;
    hex: string;
} {
    if (percent === null || percent === undefined) {
        return {
            bar: 'bg-muted',
            text: 'text-muted-foreground',
            hex: '#6b7280',
        };
    }

    if (percent >= 90) {
        return { bar: 'bg-red-500', text: 'text-red-500', hex: '#ef4444' };
    }

    if (percent >= 70) {
        return { bar: 'bg-amber-500', text: 'text-amber-500', hex: '#f59e0b' };
    }

    return { bar: 'bg-emerald-500', text: 'text-emerald-500', hex: '#10b981' };
}
