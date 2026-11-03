import { usePage } from '@inertiajs/react';
import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { MobileTabBar } from '@/components/mobile-tab-bar';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { UpdateBanner } from '@/components/update-banner';
import { useVisitPending } from '@/hooks/use-visit-pending';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    const pending = useVisitPending();
    const { component, url } = usePage();
    // Keyed by page, not by query, so switching the period or sorting a
    // table updates in place while moving to another page replays the entrance.
    const pageKey = `${component}:${url.split('?')[0]}`;

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent
                variant="sidebar"
                className="min-h-screen bg-background"
            >
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                <div
                    key={pageKey}
                    className={`enter-stagger mx-auto w-full max-w-[1600px] space-y-8 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-8 ${pending ? 'visit-pending' : 'visit-settled'}`}
                >
                    <UpdateBanner />
                    {children}
                </div>
                <PullToRefresh />
            </AppContent>
            <MobileTabBar />
        </AppShell>
    );
}
