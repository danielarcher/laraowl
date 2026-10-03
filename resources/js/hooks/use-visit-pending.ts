import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

/**
 * Whether a foreground visit is in flight. Background reloads (polling) are
 * async and never count, so a refreshing page doesn't flicker.
 */
export function useVisitPending(): boolean {
    const [pending, setPending] = useState(false);

    useEffect(() => {
        const stopStart = router.on('start', (event) => {
            if (!event.detail.visit.async) {
                setPending(true);
            }
        });
        const stopFinish = router.on('finish', () => setPending(false));

        return () => {
            stopStart();
            stopFinish();
        };
    }, []);

    return pending;
}
