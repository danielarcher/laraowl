import { Head, usePage } from '@inertiajs/react';
import {
    Shield,
    AlertTriangle,
    Globe,
    Activity,
    Lock,
    ShieldAlert,
} from 'lucide-react';
import { IssueTable } from '@/components/issue-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLiveReload } from '@/hooks/use-live-reload';
import AppLayout from '@/layouts/app-layout';

interface SecurityProps {
    threats: any;
    overview: {
        unique_ips: number;
        total_scanned: number;
        failed_logins?: number;
        recent_auth_events?: any[];
    };
    period: string;
}

export default function SecurityIndex({
    threats,
    overview,
    period,
}: SecurityProps) {
    const { props }: any = usePage();
    const currentProject = props.current_project || props.currentProject;

    useLiveReload(currentProject?.id);

    return (
        <div className="animate-in space-y-12 duration-700 fade-in slide-in-from-bottom-4">
            <Head title={`Security - ${currentProject?.name}`} />

            {/* Section: Overview Cards */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                    <Shield className="size-3 text-primary" />
                    Threat Intelligence
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {[
                        {
                            title: 'Active Threats',
                            value: threats.total,
                            icon: AlertTriangle,
                            color: 'text-primary',
                        },
                        {
                            title: 'Attacking IPs',
                            value: overview.unique_ips,
                            icon: Globe,
                            color: 'text-primary',
                        },
                        {
                            title: 'Requests Scanned',
                            value: overview.total_scanned,
                            icon: Activity,
                            color: 'text-primary',
                        },
                    ].map((card, i) => (
                        <Card
                            key={i}
                            className="border-border bg-card/50 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-primary/20"
                        >
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                            {card.title}
                                        </p>
                                        <p className="text-3xl font-semibold tracking-tight text-foreground">
                                            {card.value}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-primary/10 bg-primary/5 p-2.5">
                                        <card.icon
                                            className={`size-5 ${card.color}`}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Section: Authentication Monitoring */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                    <Lock className="size-3 text-primary" />
                    Authentication Guard
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Brute Force Indicator */}
                    <Card className="group overflow-hidden border-border bg-card/50 shadow-sm">
                        <CardContent className="relative flex items-center justify-between p-8">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] transition-opacity group-hover:opacity-[0.05]">
                                <ShieldAlert className="size-32 text-primary" />
                            </div>
                            <div className="relative space-y-1">
                                <h3 className="text-sm font-bold text-foreground">
                                    Failed Login Attempts
                                </h3>
                                <p className="max-w-[240px] text-[11px] text-muted-foreground">
                                    Monitoring for brute force patterns across
                                    all accounts.
                                </p>
                                <div className="flex items-baseline gap-2 pt-6">
                                    <span className="text-5xl font-semibold tracking-tight text-primary">
                                        {overview.failed_logins ?? 0}
                                    </span>
                                    <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                        In {period || '24h'}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Auth Incidents */}
                    <Card className="overflow-hidden border-border bg-card/30 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                                <Activity className="size-3 text-primary" />
                                Suspicious Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/30">
                                {(overview.recent_auth_events || []).length >
                                0 ? (
                                    overview.recent_auth_events?.map(
                                        (event: any, i: number) => (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between p-4 transition-colors hover:bg-muted/30"
                                            >
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[11px] font-bold text-foreground">
                                                        {event.user ||
                                                            'Unknown User'}
                                                    </span>
                                                    <span className="text-[9px] tracking-tight text-muted-foreground uppercase">
                                                        {event.ip} •{' '}
                                                        {event.location ||
                                                            'Unknown Location'}
                                                    </span>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className="border-primary/20 bg-primary/5 py-0 text-[8px] font-semibold text-primary uppercase"
                                                >
                                                    {event.type}
                                                </Badge>
                                            </div>
                                        ),
                                    )
                                ) : (
                                    <div className="p-12 text-center text-[10px] font-bold tracking-[0.2em] text-muted-foreground/50 uppercase">
                                        No suspicious activity detected
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Section: Threats List */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                        <Shield className="size-3 text-primary" />
                        Security Incident Log
                    </div>
                </div>

                <Card className="overflow-hidden border-border bg-card/50 shadow-sm">
                    <IssueTable issues={threats} baseUrl="security/threats" />
                </Card>
            </section>
        </div>
    );
}

SecurityIndex.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[{ title: 'Security', href: '#' }]}
    />
);
