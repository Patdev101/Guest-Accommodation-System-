import { BedDouble } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A room's cover photo, or a neutral placeholder when it has none. */
export function RoomThumb({
    url,
    alt = '',
    className,
}: {
    url: string | null;
    alt?: string;
    className?: string;
}) {
    return url ? (
        <img
            src={url}
            alt={alt}
            loading="lazy"
            className={cn(
                'size-10 shrink-0 rounded-md object-cover',
                className,
            )}
        />
    ) : (
        <div
            aria-hidden
            className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground',
                className,
            )}
        >
            <BedDouble className="size-1/2 max-h-10 max-w-10" />
        </div>
    );
}
