import { BedDouble } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A room's photo, or a soft placeholder when the Admin has not added one yet,
 * so a room without photos still looks finished.
 */
export function RoomPhoto({
    url,
    alt,
    className,
    imageClassName,
    lazy = true,
}: {
    url: string | null | undefined;
    alt: string;
    className?: string;
    imageClassName?: string;
    lazy?: boolean;
}) {
    return (
        <div className={cn('relative overflow-hidden bg-muted', className)}>
            {url ? (
                <img
                    src={url}
                    alt={alt}
                    loading={lazy ? 'lazy' : undefined}
                    className={cn('size-full object-cover', imageClassName)}
                />
            ) : (
                <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-sky-100 via-slate-100 to-teal-100 text-slate-500 dark:from-slate-800 dark:via-slate-900 dark:to-teal-950 dark:text-slate-400">
                    <span className="flex size-14 items-center justify-center rounded-full bg-white/70 shadow-sm dark:bg-white/10">
                        <BedDouble className="size-7" />
                    </span>
                    <span className="text-xs font-medium tracking-wide">
                        Photo coming soon
                    </span>
                </div>
            )}
        </div>
    );
}
