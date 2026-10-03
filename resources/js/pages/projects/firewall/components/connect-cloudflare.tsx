import { Link, usePage } from '@inertiajs/react';
import {
    Shield,
    ExternalLink,
    Settings,
    Lock,
    ArrowUpRight,
    Activity,
} from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui/button';

export function ConnectCloudflare() {
    const { props }: any = usePage();
    const teamSlug = props.currentTeam?.slug || props.current_team?.slug;
    const projectSlug =
        props.currentProject?.slug || props.current_project?.slug;

    return (
        <div className="flex min-h-[50vh] animate-in flex-col items-center justify-center px-4 py-12 duration-700 fade-in slide-in-from-bottom-4">
            <div className="mb-8">
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 shadow-sm">
                    <Shield className="h-10 w-10 text-primary" />
                </div>
            </div>

            <div className="mb-10 max-w-lg space-y-4 text-center">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground uppercase">
                    Activate Edge Security
                </h2>
                <p className="text-sm leading-relaxed font-medium text-muted-foreground">
                    Unlock advanced firewall protections, real-time traffic
                    analysis, and global threat mitigation by connecting your
                    Cloudflare account.
                </p>
            </div>

            <div className="mb-12 grid w-full max-w-2xl grid-cols-1 gap-3 md:grid-cols-3">
                {[
                    {
                        icon: Lock,
                        title: 'WAF Protection',
                        desc: 'Block malicious requests.',
                    },
                    {
                        icon: Activity,
                        title: 'Edge Analytics',
                        desc: 'Real-time traffic metrics.',
                    },
                    {
                        icon: Settings,
                        title: 'Firewall Rules',
                        desc: 'Full control over IP rules.',
                    },
                ].map((feature, i) => (
                    <div
                        key={i}
                        className="flex flex-col items-center rounded-lg border border-border bg-card/30 p-4 text-center"
                    >
                        <feature.icon className="mb-3 h-4 w-4 text-primary" />
                        <h3 className="mb-1 text-[10px] font-semibold tracking-widest uppercase">
                            {feature.title}
                        </h3>
                        <p className="text-[9px] text-muted-foreground">
                            {feature.desc}
                        </p>
                    </div>
                ))}
            </div>

            <div className="flex flex-col items-center gap-3 sm:flex-row">
                <Link href={`/${teamSlug}/${projectSlug}/settings#cloudflare`}>
                    <Button
                        size="lg"
                        className="h-12 gap-2 rounded-lg bg-primary px-10 text-xs font-semibold tracking-widest uppercase shadow-lg shadow-primary/20 hover:bg-primary/90"
                    >
                        Configure Cloudflare
                        <ArrowUpRight className="size-4" />
                    </Button>
                </Link>
                <Button
                    variant="outline"
                    size="lg"
                    className="h-12 gap-2 rounded-lg border-border px-8 text-xs font-semibold tracking-widest uppercase"
                    asChild
                >
                    <a
                        href="https://dash.cloudflare.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        External Dashboard
                        <ExternalLink className="size-4" />
                    </a>
                </Button>
            </div>
        </div>
    );
}
