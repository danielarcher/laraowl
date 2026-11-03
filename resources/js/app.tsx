import { createInertiaApp, router } from '@inertiajs/react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import '@/lib/echo';
import { initPwa } from '@/lib/pwa';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name === 'projects/create/index' || name === 'teams/create':
                return null;

            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('settings/'):
            case name.startsWith('teams/') && name !== 'teams/create':
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    // A thin sky bar, only once a visit has taken a noticeable moment.
    progress: {
        color: 'oklch(0.746 0.16 232.661)',
        delay: 150,
        showSpinner: false,
    },
});

// This will set light / dark mode on load...
initializeTheme();

// Installable app + push: an alert that arrives while LaraOwl is open shows in place too.
initPwa((message) => {
    toast(message.title, {
        description: message.body,
        action: message.data?.url
            ? {
                  label: 'Open',
                  onClick: () => router.visit(message.data!.url!),
              }
            : undefined,
    });
});
