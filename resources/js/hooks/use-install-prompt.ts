import { useSyncExternalStore } from 'react';
import {
    canPromptInstall,
    isStandalone,
    onInstallAvailabilityChange,
    promptInstall,
} from '@/lib/pwa';

/**
 * Whether the browser offers "Install LaraOwl" right now, and a way to ask.
 */
export function useInstallPrompt(): {
    canInstall: boolean;
    installed: boolean;
    install: () => Promise<boolean>;
} {
    const canInstall = useSyncExternalStore(
        onInstallAvailabilityChange,
        canPromptInstall,
        () => false,
    );

    return { canInstall, installed: isStandalone(), install: promptInstall };
}
