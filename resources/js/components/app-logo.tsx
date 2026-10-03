import { usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import type { SharedData } from '@/types';

export default function AppLogo() {
    const { name } = usePage<SharedData>().props;

    return (
        <div className="group flex cursor-pointer items-center gap-2.5">
            <div className="flex aspect-square size-9 items-center justify-center overflow-hidden rounded-lg bg-neutral-900 p-1 shadow-lg ring-1 ring-white/10 transition-all">
                <AppLogoIcon className="size-full object-contain" />
            </div>
            <div className="flex flex-col leading-tight">
                <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                    {name}
                </span>
                <span className="text-[9px] font-semibold tracking-widest text-neutral-500 uppercase">
                    Monitoring
                </span>
            </div>
        </div>
    );
}
