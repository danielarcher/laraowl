import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { UpdateBanner } from '@/components/update-banner';
import { useVisitPending } from '@/hooks/use-visit-pending';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    const pending = useVisitPending();

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent
                variant="sidebar"
                className="min-h-screen bg-background"
            >
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                <div
                    className={`mx-auto w-full max-w-[1600px] space-y-8 p-6 md:p-8 ${pending ? 'visit-pending' : 'visit-settled'}`}
                >
                    <UpdateBanner />
                    {children}
                </div>
            </AppContent>
        </AppShell>
    );
}
