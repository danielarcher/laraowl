import { Head, Link, usePage } from '@inertiajs/react';
import {
    Bell,
    ArrowUpRight,
    Mail,
    MessageSquare,
    Smartphone,
    Globe,
    XCircle,
    Send,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Pagination } from '@/components/pagination';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useLiveReload } from '@/hooks/use-live-reload';
import AppLayout from '@/layouts/app-layout';
import { monitoringQuery } from '@/lib/monitoring-query';
import { formatCompactNumber } from '@/lib/utils';
import { show as showNotification } from '@/routes/notifications';

export default function NotificationsIndex({
    notifications,
    period,
    from,
    to,
}: {
    notifications: any;
    period?: string | null;
    from?: string | null;
    to?: string | null;
}) {
    const { props }: any = usePage();
    const teamSlug = props.current_team?.slug || props.currentTeam?.slug;
    const currentProject = props.current_project || props.currentProject;
    const projectSlug =
        props.current_project?.slug || props.currentProject?.slug;

    useLiveReload(currentProject?.id);

    const data = notifications.data || [];
    const notificationDetailsHref = (hash: string | number) =>
        showNotification.url(
            {
                current_team: teamSlug,
                project: projectSlug,
                hash,
            },
            monitoringQuery({ period, from, to }),
        );

    const getChannelIcon = (channel: string) => {
        switch (channel.toLowerCase()) {
            case 'mail':
                return <Mail className="h-3 w-3" />;
            case 'database':
                return <Globe className="h-3 w-3" />;
            case 'sms':
                return <Smartphone className="h-3 w-3" />;
            default:
                return <MessageSquare className="h-3 w-3" />;
        }
    };

    return (
        <>
            <Head title="Notifications" />

            {/* Table Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-foreground">
                        <Send className="h-4 w-4 text-muted-foreground" />
                        <span>
                            {formatCompactNumber(notifications.total || 0)}{' '}
                            Notification Types
                        </span>
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border bg-card">
                    {data.length > 0 ? (
                        <>
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="pl-6 text-[10px] font-bold text-muted-foreground uppercase">
                                            Notification
                                        </TableHead>
                                        <TableHead className="text-[10px] font-bold text-muted-foreground uppercase">
                                            Channel
                                        </TableHead>
                                        <TableHead className="text-center text-[10px] font-bold text-muted-foreground uppercase">
                                            Sent
                                        </TableHead>
                                        <TableHead className="text-center text-[10px] font-bold text-muted-foreground uppercase">
                                            Failed
                                        </TableHead>
                                        <TableHead className="text-center text-[10px] font-bold text-muted-foreground uppercase">
                                            Total
                                        </TableHead>
                                        <TableHead className="w-[50px] pr-6"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((notif: any, index: number) => (
                                        <TableRow
                                            key={index}
                                            className="group border-border transition-colors hover:bg-muted/30"
                                        >
                                            <TableCell className="pl-6">
                                                <Link
                                                    href={notificationDetailsHref(
                                                        notif.hash,
                                                    )}
                                                >
                                                    <div className="flex cursor-pointer flex-col gap-0.5">
                                                        <span className="max-w-md truncate font-mono text-xs text-foreground/90 transition-colors group-hover:text-foreground">
                                                            {
                                                                notif.notification_class
                                                            }
                                                        </span>
                                                        <span className="text-[10px] tracking-tight text-muted-foreground uppercase">
                                                            APP\NOTIFICATIONS
                                                        </span>
                                                    </div>
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="rounded bg-muted p-1 text-muted-foreground">
                                                        {getChannelIcon(
                                                            notif.channel,
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-foreground/70 uppercase">
                                                        {notif.channel}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-xs font-bold text-emerald-500">
                                                {formatCompactNumber(
                                                    notif.sent_count,
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-xs font-bold text-red-500">
                                                {notif.failed_count > 0 ? (
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <XCircle className="h-3 w-3" />
                                                        {formatCompactNumber(
                                                            notif.failed_count,
                                                        )}
                                                    </div>
                                                ) : (
                                                    '0'
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-xs font-bold text-foreground">
                                                {formatCompactNumber(
                                                    notif.total,
                                                )}
                                            </TableCell>
                                            <TableCell className="pr-6">
                                                <Link
                                                    href={notificationDetailsHref(
                                                        notif.hash,
                                                    )}
                                                >
                                                    <div className="cursor-pointer rounded border border-border bg-muted p-1 transition-all group-hover:border-border">
                                                        <ArrowUpRight className="h-3 w-3" />
                                                    </div>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <Pagination
                                links={notifications.links}
                                meta={notifications}
                            />
                        </>
                    ) : (
                        <div className="p-12">
                            <EmptyState
                                title="No Notifications Sent"
                                description="We haven't detected any notifications being sent through your application channels."
                                icon={Bell}
                            />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

NotificationsIndex.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[{ title: 'Notifications', href: '#' }]}
    />
);
