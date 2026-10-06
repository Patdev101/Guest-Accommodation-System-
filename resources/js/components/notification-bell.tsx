import { router, usePage } from '@inertiajs/react';
import {
    ArrowRightLeft,
    Bell,
    BookmarkPlus,
    CalendarClock,
    CalendarPlus,
    CalendarX,
    CheckCircle2,
    Phone,
    UserX,
    Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
    index as alertsIndex,
    read as alertsRead,
    readAll as alertsReadAll,
} from '@/routes/reception/alerts';

type Alert = {
    id: string;
    kind: string;
    title: string;
    body: string;
    url: string | null;
    read: boolean;
    created_at: string | null;
};

type AlertState = { unread: number; items: Alert[] };

/** How often the bell asks for news (and runs the due-alert check). */
const POLL_MS = 60_000;

type Tone = 'act' | 'info' | 'done' | 'quiet' | 'repair';

/** Icon and colour per kind: red = act now, blue = coming up, green = done. */
const kinds: Record<string, { icon: LucideIcon; tone: Tone }> = {
    checkout_call: { icon: Phone, tone: 'act' },
    not_arrived: { icon: UserX, tone: 'act' },
    room_clash: { icon: UserX, tone: 'act' },
    extension_waiting: { icon: ArrowRightLeft, tone: 'act' },
    arriving: { icon: CalendarClock, tone: 'info' },
    booked: { icon: BookmarkPlus, tone: 'info' },
    changed: { icon: CalendarClock, tone: 'info' },
    room_ready: { icon: CheckCircle2, tone: 'done' },
    extension: { icon: CalendarPlus, tone: 'done' },
    cancelled: { icon: CalendarX, tone: 'quiet' },
    repair: { icon: Wrench, tone: 'repair' },
};

const toneClass: Record<Tone, string> = {
    act: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    info: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
    done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    quiet: 'bg-muted text-muted-foreground',
    repair: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
};

const ago = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function timeAgo(iso: string | null): string {
    if (!iso) {
        return '';
    }

    const minutes = Math.round((Date.parse(iso) - Date.now()) / 60000);

    if (Math.abs(minutes) < 60) {
        return ago.format(minutes, 'minute');
    }

    const hours = Math.round(minutes / 60);

    return Math.abs(hours) < 24
        ? ago.format(hours, 'hour')
        : ago.format(Math.round(hours / 24), 'day');
}

async function request(
    url: string,
    method: 'GET' | 'POST' = 'GET',
): Promise<AlertState> {
    const token = document.cookie
        .split('; ')
        .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
        ?.split('=')[1];

    const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': decodeURIComponent(token ?? ''),
        },
    });

    if (!response.ok) {
        throw new Error(`Alerts request failed: ${response.status}`);
    }

    return (await response.json()) as AlertState;
}

/**
 * In-app alerts (rule 27). Reception gets the front desk's (calls, arrivals,
 * late guests, bookings, rooms ready, extensions); the Admin gets rooms
 * needing repair. New unread ones also pop up as a message.
 */
export function NotificationBell() {
    const isAdmin = usePage().props.auth.user.role === 'admin';
    const [state, setState] = useState<AlertState>({ unread: 0, items: [] });
    const seen = useRef<Set<string> | null>(null);

    const open = useCallback((alert: Alert) => {
        request(alertsRead.url(alert.id), 'POST')
            .then(setState)
            .catch(() => undefined);

        if (alert.url) {
            router.visit(alert.url);
        }
    }, []);

    const apply = useCallback(
        (next: AlertState) => {
            // Pop up alerts that arrived since the last look (not on first load).
            if (seen.current) {
                next.items
                    .filter((item) => !item.read && !seen.current?.has(item.id))
                    .slice(0, 3)
                    .forEach((item) =>
                        toast(item.title, {
                            description: item.body,
                            duration: 12_000,
                            action: item.url
                                ? { label: 'Open', onClick: () => open(item) }
                                : undefined,
                        }),
                    );
            }

            seen.current = new Set(next.items.map((item) => item.id));
            setState(next);
        },
        [open],
    );

    useEffect(() => {
        let active = true;
        const load = () =>
            request(alertsIndex.url())
                .then((next) => active && apply(next))
                .catch(() => undefined);

        void load();
        const timer = setInterval(() => void load(), POLL_MS);

        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [apply]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label={
                        state.unread > 0
                            ? `Alerts, ${state.unread} unread`
                            : 'Alerts'
                    }
                >
                    <Bell />
                    {state.unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white tabular-nums">
                            {state.unread > 9 ? '9+' : state.unread}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[22rem] p-0">
                <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                    <p className="text-sm font-semibold">Alerts</p>
                    {state.unread > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                                request(alertsReadAll.url(), 'POST')
                                    .then(setState)
                                    .catch(() => undefined)
                            }
                        >
                            Mark all as read
                        </Button>
                    )}
                </div>
                {state.items.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {isAdmin
                            ? 'No alerts yet. Rooms sent for repair or taken out of service will appear here.'
                            : 'No alerts yet. Calls before check-out, arrivals, late guests, new bookings and rooms that are ready will appear here.'}
                    </p>
                ) : (
                    <div className="max-h-[26rem] overflow-y-auto py-1">
                        {state.items.map((item) => {
                            const kind = kinds[item.kind] ?? {
                                icon: Bell,
                                tone: 'quiet',
                            };
                            const Icon = kind.icon;

                            return (
                                <DropdownMenuItem
                                    key={item.id}
                                    onSelect={() => open(item)}
                                    className="items-start gap-3 rounded-none px-3 py-2.5"
                                >
                                    <span
                                        className={cn(
                                            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
                                            toneClass[kind.tone],
                                            item.read && 'opacity-60',
                                        )}
                                    >
                                        <Icon className="size-3.5" />
                                    </span>
                                    <span className="grid min-w-0 flex-1 gap-0.5">
                                        <span
                                            className={cn(
                                                'text-sm',
                                                item.read
                                                    ? 'text-muted-foreground'
                                                    : 'font-medium',
                                            )}
                                        >
                                            {item.title}
                                        </span>
                                        <span className="line-clamp-2 text-xs text-muted-foreground">
                                            {item.body}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">
                                            {timeAgo(item.created_at)}
                                        </span>
                                    </span>
                                    {!item.read && (
                                        <span
                                            aria-label="Unread"
                                            className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                                        />
                                    )}
                                </DropdownMenuItem>
                            );
                        })}
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
