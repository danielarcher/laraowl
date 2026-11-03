import { router } from '@inertiajs/react';
import { RotateCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isStandalone } from '@/lib/pwa';
import { cn } from '@/lib/utils';

export const PULL_THRESHOLD = 72;
const MAX_PULL = 110;

/**
 * Pull down at the top of a page to reload its data. Only in the installed
 * app on a touch screen: browsers already have their own.
 */
export function PullToRefresh({ enabled }: { enabled?: boolean }) {
    const [pull, setPull] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [dragging, setDragging] = useState(false);
    const start = useRef<number | null>(null);
    const active = enabled ?? (isStandalone() && 'ontouchstart' in window);

    useEffect(() => {
        if (!active) {
            return;
        }

        const onStart = (event: TouchEvent) => {
            start.current =
                window.scrollY <= 0 && event.touches.length === 1
                    ? event.touches[0].clientY
                    : null;
            setDragging(start.current !== null);
        };

        const onMove = (event: TouchEvent) => {
            if (start.current === null || refreshing) {
                return;
            }

            const distance = event.touches[0].clientY - start.current;

            if (distance <= 0 || window.scrollY > 0) {
                setPull(0);

                return;
            }

            // Resist as it goes, like the native gesture.
            setPull(Math.min(MAX_PULL, distance * 0.5));
        };

        const onEnd = () => {
            if (start.current === null) {
                return;
            }

            start.current = null;
            setDragging(false);

            setPull((current) => {
                if (current >= PULL_THRESHOLD && !refreshing) {
                    setRefreshing(true);
                    router.reload({
                        onFinish: () => {
                            setRefreshing(false);
                            setPull(0);
                        },
                    });

                    return PULL_THRESHOLD;
                }

                return 0;
            });
        };

        window.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onEnd);
        window.addEventListener('touchcancel', onEnd);

        return () => {
            window.removeEventListener('touchstart', onStart);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
            window.removeEventListener('touchcancel', onEnd);
        };
    }, [active, refreshing]);

    if (!active || (pull === 0 && !refreshing)) {
        return null;
    }

    const progress = Math.min(1, pull / PULL_THRESHOLD);

    return (
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4rem)] z-50 flex justify-center"
            style={{
                transform: `translateY(${pull - 36}px)`,
                transition: dragging ? 'none' : 'transform 180ms',
            }}
        >
            <span className="flex size-8 items-center justify-center rounded-md border border-border bg-background">
                <RotateCw
                    className={cn(
                        'size-4 text-foreground',
                        refreshing && 'animate-spin',
                    )}
                    style={{
                        opacity: 0.35 + progress * 0.65,
                        transform: refreshing
                            ? undefined
                            : `rotate(${progress * 270}deg)`,
                    }}
                />
                <span className="sr-only">
                    {refreshing
                        ? 'Refreshing'
                        : progress >= 1
                          ? 'Release to refresh'
                          : 'Pull to refresh'}
                </span>
            </span>
        </div>
    );
}
