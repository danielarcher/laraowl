import { Head, Link, router } from '@inertiajs/react';
import {
    BellOff,
    BellRing,
    Download,
    Monitor,
    Share,
    Smartphone,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import NotificationController from '@/actions/App/Http/Controllers/Settings/NotificationController';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import {
    currentSubscription,
    isIos,
    pushSupport,
    sha256Hex,
    subscribe,
    unsubscribe,
} from '@/lib/pwa';
import { formatAgo } from '@/lib/server-metrics';
import { cn } from '@/lib/utils';
import { edit as notificationsRoute } from '@/routes/notifications';

export type Device = {
    id: number;
    device: string;
    endpoint_hash: string;
    last_used_at: string | null;
    created_at: string;
};

export type AppRow = {
    id: number;
    name: string;
    team: string;
    settings_url: string;
    rules_count: number;
    push_enabled: boolean;
};

type Props = {
    vapidPublicKey: string | null;
    devices: Device[];
    apps: AppRow[];
};

type DeviceState =
    | 'checking'
    | 'unsupported'
    | 'needs-install'
    | 'not-configured'
    | 'blocked'
    | 'off'
    | 'on';

const STATE_COPY: Record<DeviceState, { label: string; detail: string }> = {
    checking: { label: 'Checking', detail: 'Looking at this browser…' },
    unsupported: {
        label: 'Not available',
        detail: 'This browser cannot receive push notifications.',
    },
    'needs-install': {
        label: 'Install first',
        detail: 'On iPhone and iPad, alerts reach LaraOwl only once it is on the Home Screen.',
    },
    'not-configured': {
        label: 'Not set up',
        detail: 'The server has no VAPID keys yet. Run php artisan laraowl:push:vapid and add them to .env.',
    },
    blocked: {
        label: 'Blocked',
        detail: 'Notifications are blocked for this site. Allow them in the browser settings, then come back.',
    },
    off: {
        label: 'Off',
        detail: 'This device gets no alerts.',
    },
    on: {
        label: 'On',
        detail: 'Alerts from the apps below land on this device.',
    },
};

const formatDate = (iso: string) => {
    const date = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');

    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

function StateMark({ state }: { state: DeviceState }) {
    return (
        <span
            aria-hidden
            className={cn(
                'inline-block size-2 rounded-[2px]',
                state === 'on' && 'bg-emerald-500',
                state === 'off' && 'bg-muted-foreground/40',
                (state === 'blocked' || state === 'not-configured') &&
                    'bg-amber-500',
                (state === 'unsupported' || state === 'checking') &&
                    'bg-muted-foreground/25',
                state === 'needs-install' && 'bg-sky-500',
            )}
        />
    );
}

export function deviceStateFor({
    support,
    configured,
    permission,
    subscribed,
}: {
    support: ReturnType<typeof pushSupport>;
    configured: boolean;
    permission: NotificationPermission | null;
    subscribed: boolean;
}): DeviceState {
    if (support === 'needs-install') {
        return 'needs-install';
    }

    if (support === 'unsupported') {
        return 'unsupported';
    }

    if (!configured) {
        return 'not-configured';
    }

    if (permission === 'denied') {
        return 'blocked';
    }

    return subscribed ? 'on' : 'off';
}

export default function Notifications({
    vapidPublicKey,
    devices,
    apps,
}: Props) {
    const [state, setState] = useState<DeviceState>('checking');
    const [thisHash, setThisHash] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const { canInstall, installed, install } = useInstallPrompt();

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const support = pushSupport();
            const subscription =
                support === 'supported' ? await currentSubscription() : null;
            const hash = subscription
                ? await sha256Hex(subscription.endpoint)
                : null;

            if (cancelled) {
                return;
            }

            setThisHash(hash);
            setState(
                deviceStateFor({
                    support,
                    configured: Boolean(vapidPublicKey),
                    permission:
                        support === 'supported'
                            ? Notification.permission
                            : null,
                    subscribed: Boolean(
                        hash && devices.some((d) => d.endpoint_hash === hash),
                    ),
                }),
            );
        })();

        return () => {
            cancelled = true;
        };
    }, [vapidPublicKey, devices]);

    const turnOn = async () => {
        if (!vapidPublicKey) {
            return;
        }

        setBusy(true);

        try {
            const payload = await subscribe(vapidPublicKey);

            router.post(NotificationController.store.url(), payload, {
                preserveScroll: true,
                onSuccess: () => toast.success('Push is on for this device.'),
                onError: () =>
                    toast.error('The server did not accept this device.'),
                onFinish: () => setBusy(false),
            });
        } catch (error) {
            setBusy(false);

            if (Notification.permission === 'denied') {
                setState('blocked');
            }

            toast.error((error as Error).message);
        }
    };

    const turnOff = async () => {
        const mine = devices.find((d) => d.endpoint_hash === thisHash);
        setBusy(true);
        await unsubscribe().catch(() => {});

        if (!mine) {
            setBusy(false);
            setState('off');

            return;
        }

        router.delete(NotificationController.destroy.url(mine.id), {
            preserveScroll: true,
            onSuccess: () => toast.success('Push is off for this device.'),
            onFinish: () => setBusy(false),
        });
    };

    const sendTest = () => {
        router.post(
            NotificationController.test.url(),
            {},
            {
                preserveScroll: true,
                onSuccess: () =>
                    toast.success(
                        devices.length === 1
                            ? 'Test sent to 1 device.'
                            : `Test sent to ${devices.length} devices.`,
                    ),
                onError: (errors) =>
                    toast.error(errors.push ?? 'The test could not be sent.'),
            },
        );
    };

    const toggleApp = (app: AppRow, enabled: boolean) => {
        router.put(
            NotificationController.updateApp.url(app.id),
            { enabled },
            {
                preserveScroll: true,
                onSuccess: () =>
                    toast.success(
                        enabled
                            ? `${app.name} now pushes its alerts.`
                            : `${app.name} no longer pushes alerts.`,
                    ),
            },
        );
    };

    const removeDevice = (device: Device) => {
        if (device.endpoint_hash === thisHash) {
            void turnOff();

            return;
        }

        router.delete(NotificationController.destroy.url(device.id), {
            preserveScroll: true,
            onSuccess: () => toast.success(`${device.device} removed.`),
        });
    };

    const copy = STATE_COPY[state];
    const pushing = apps.filter((a) => a.push_enabled).length;

    return (
        <>
            <Head title="Notifications" />

            <h1 className="sr-only">Notifications</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Notifications"
                    description="Alerts pushed to your phone and desktop, from the installed LaraOwl app or this browser."
                />

                <section
                    aria-labelledby="this-device"
                    className="overflow-hidden rounded-lg border border-border"
                >
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                            <h3
                                id="this-device"
                                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                            >
                                This device
                            </h3>
                            <p
                                className="flex items-center gap-2 text-sm font-medium"
                                data-test="device-state"
                            >
                                <StateMark state={state} />
                                Push {copy.label.toLowerCase()}
                            </p>
                            <p className="text-[13px] leading-relaxed text-muted-foreground">
                                {copy.detail}
                            </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            {state === 'on' && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={sendTest}
                                    >
                                        <BellRing />
                                        Send test
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={turnOff}
                                        disabled={busy}
                                    >
                                        <BellOff />
                                        Turn off
                                    </Button>
                                </>
                            )}
                            {state === 'off' && (
                                <Button
                                    size="sm"
                                    onClick={turnOn}
                                    disabled={busy}
                                >
                                    <BellRing />
                                    Turn on push
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t border-border bg-muted/30 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <img
                                src="/icons/icon-192.png"
                                alt=""
                                className="size-8 shrink-0 rounded-md border border-border"
                            />
                            <div className="min-w-0">
                                <p className="text-sm font-medium">
                                    LaraOwl app
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {installed
                                        ? 'Installed and running as an app.'
                                        : isIos()
                                          ? 'Safari: Share, then Add to Home Screen.'
                                          : canInstall
                                            ? 'Full screen, its own icon, alerts even when closed.'
                                            : 'Use the install icon in the address bar, or the browser menu.'}
                                </p>
                            </div>
                        </div>

                        {installed ? (
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                Installed
                            </span>
                        ) : isIos() ? (
                            <Share className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                            canInstall && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void install()}
                                >
                                    <Download />
                                    Install
                                </Button>
                            )
                        )}
                    </div>
                </section>

                <section aria-labelledby="alerts-from" className="space-y-3">
                    <div className="flex items-baseline justify-between">
                        <h3
                            id="alerts-from"
                            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                        >
                            Push alerts from
                        </h3>
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {pushing} of {apps.length} apps
                        </span>
                    </div>

                    <ul className="divide-y divide-border rounded-lg border border-border">
                        {apps.map((app) => (
                            <li
                                key={app.id}
                                className="flex items-center justify-between gap-4 px-4 py-3"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">
                                        {app.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground tabular-nums">
                                        {app.rules_count > 0 ? (
                                            `${app.rules_count} alert ${app.rules_count === 1 ? 'rule' : 'rules'}`
                                        ) : (
                                            <>
                                                No alert rules ·{' '}
                                                <Link
                                                    href={app.settings_url}
                                                    className="underline underline-offset-2 hover:text-foreground"
                                                >
                                                    add one
                                                </Link>
                                            </>
                                        )}
                                    </p>
                                </div>
                                <Switch
                                    checked={app.push_enabled}
                                    onCheckedChange={(on) => toggleApp(app, on)}
                                    aria-label={`Push alerts from ${app.name}`}
                                />
                            </li>
                        ))}
                        {apps.length === 0 && (
                            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                                No apps yet.
                            </li>
                        )}
                    </ul>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        A switch applies to everyone on the app's team: each
                        member gets the alert on every device they turned push
                        on for.
                    </p>
                </section>

                <section aria-labelledby="your-devices" className="space-y-3">
                    <h3
                        id="your-devices"
                        className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    >
                        Your devices
                    </h3>

                    {devices.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                            No device has push on yet.
                        </p>
                    ) : (
                        <ul className="divide-y divide-border rounded-lg border border-border">
                            {devices.map((device) => {
                                const mobile = /iphone|ipad|android/i.test(
                                    device.device,
                                );
                                const Icon = mobile ? Smartphone : Monitor;
                                const isThis =
                                    device.endpoint_hash === thisHash;

                                return (
                                    <li
                                        key={device.id}
                                        className="flex items-center justify-between gap-4 px-4 py-3"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Icon className="size-4 shrink-0 text-muted-foreground" />
                                            <div className="min-w-0">
                                                <p className="flex items-center gap-2 truncate text-sm font-medium">
                                                    {device.device}
                                                    {isThis && (
                                                        <span className="rounded-[4px] border border-border px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                                                            This device
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-muted-foreground tabular-nums">
                                                    Added{' '}
                                                    {formatDate(
                                                        device.created_at,
                                                    )}{' '}
                                                    · last alert{' '}
                                                    {formatAgo(
                                                        device.last_used_at,
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeDevice(device)}
                                        >
                                            Remove
                                        </Button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>
        </>
    );
}

Notifications.layout = {
    breadcrumbs: [
        {
            title: 'Notifications',
            href: notificationsRoute(),
        },
    ],
};
