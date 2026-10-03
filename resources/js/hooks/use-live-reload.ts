import { router } from '@inertiajs/react';
import { useEffect, useRef } from 'react';

export function useLiveReload(
    projectId: number | string | undefined,
    intervalMs = 5000,
): void {
    const lastReloadAt = useRef(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!projectId || !window.Echo) {
            return;
        }

        const reload = () => {
            lastReloadAt.current = Date.now();
            router.reload({
                preserveScroll: true,
                preserveState: true,
                async: true,
            } as any);
        };

        const schedule = () => {
            const elapsed = Date.now() - lastReloadAt.current;

            if (elapsed >= intervalMs) {
                if (timer.current) {
                    clearTimeout(timer.current);
                    timer.current = null;
                }

                reload();

                return;
            }

            if (!timer.current) {
                timer.current = setTimeout(() => {
                    timer.current = null;
                    reload();
                }, intervalMs - elapsed);
            }
        };

        const channel = window.Echo.private(`project.${projectId}`).listen(
            '.ProjectDataIngested',
            schedule,
        );

        return () => {
            if (timer.current) {
                clearTimeout(timer.current);
                timer.current = null;
            }

            channel.stopListening('.ProjectDataIngested');
        };
    }, [projectId, intervalMs]);
}
