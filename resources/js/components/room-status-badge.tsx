import { groupColor } from '@/lib/room-status';
import { cn } from '@/lib/utils';
import type { RoomStatusGroup } from '@/types';

/** A small filled mark in the status group's colour. */
export function StatusDot({
    group,
    className,
}: {
    group: RoomStatusGroup;
    className?: string;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                'inline-block size-2 shrink-0 rounded-full',
                className,
            )}
            style={{ backgroundColor: groupColor[group] }}
        />
    );
}

/** Status label in text ink, with the group's colour as a dot beside it. */
export function RoomStatusBadge({
    group,
    label,
    className,
}: {
    group: RoomStatusGroup;
    label: string;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
                className,
            )}
        >
            <StatusDot group={group} />
            {label}
        </span>
    );
}
