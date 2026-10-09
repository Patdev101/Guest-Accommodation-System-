import { Link, router, usePage } from '@inertiajs/react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDayTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { read as readNotices } from '@/routes/guest/notices';

/**
 * The guest's notices: a request answered, a booking cancelled, a check-out
 * coming up. Opening the list marks them as read.
 */
export function GuestBell() {
    const { notices } = usePage().props;

    if (!notices) {
        return null;
    }

    const markRead = (open: boolean) => {
        // When the list closes, what was in it counts as seen.
        if (!open && notices.unread > 0) {
            router.post(
                readNotices().url,
                {},
                {
                    preserveScroll: true,
                    preserveState: true,
                    only: ['notices'],
                },
            );
        }
    };

    return (
        <DropdownMenu onOpenChange={markRead}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label={
                        notices.unread > 0
                            ? `Notices, ${notices.unread} new`
                            : 'Notices'
                    }
                >
                    <Bell />
                    {notices.unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] leading-5 font-semibold text-white">
                            {notices.unread > 9 ? '9+' : notices.unread}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
                <p className="border-b px-4 py-3 text-sm font-semibold">
                    Notices
                </p>
                {notices.items.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Nothing yet. We will tell you here when a request is
                        answered.
                    </p>
                ) : (
                    <ul className="max-h-96 divide-y overflow-y-auto">
                        {notices.items.map((notice) => (
                            <li key={notice.id}>
                                <Link
                                    href={notice.url}
                                    className={cn(
                                        'block px-4 py-3 text-sm outline-none hover:bg-muted focus-visible:bg-muted',
                                        !notice.read && 'bg-primary/5',
                                    )}
                                >
                                    <span className="flex items-start justify-between gap-2">
                                        <span className="font-medium">
                                            {notice.title}
                                        </span>
                                        {!notice.read && (
                                            <span
                                                aria-label="New"
                                                className="mt-1.5 size-2 shrink-0 rounded-full bg-red-600"
                                            />
                                        )}
                                    </span>
                                    <span className="mt-0.5 block text-muted-foreground">
                                        {notice.body}
                                    </span>
                                    {notice.at && (
                                        <span className="mt-1 block text-xs text-muted-foreground">
                                            {formatDayTime(notice.at)}
                                        </span>
                                    )}
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
