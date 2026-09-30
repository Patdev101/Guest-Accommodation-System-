import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Page, PageHeader } from '@/components/page';
import { StatusDot } from '@/components/room-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDateTime, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { calendar } from '@/routes/reception';
import { create as reservationsCreate } from '@/routes/reception/reservations';
import type { RoomSummary } from '@/types';

type Booking = {
    kind: 'reserved' | 'not_arrived' | 'in_house' | 'checked_out';
    label: string;
    company: string | null;
    pax: number;
    starts_at: string;
    ends_at: string;
    open_ended: boolean;
    href: string;
};

type Props = {
    now: string;
    start: string;
    from: string;
    until: string;
    days: string[];
    today: string;
    standardTimes: { check_in: string; check_out: string };
    locations: {
        id: number;
        name: string;
        rooms: (RoomSummary & { bookings: Booking[] })[];
    }[];
};

const dayLabel = new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
});

function utcDate(date: string): Date {
    const [year, month, day] = date.split('-').map(Number);

    return new Date(Date.UTC(year, month - 1, day));
}

function shiftDays(date: string, days: number): string {
    const next = utcDate(date);
    next.setUTCDate(next.getUTCDate() + days);

    return next.toISOString().slice(0, 10);
}

/**
 * One colour per kind, each with a strong left edge and dark text on a light
 * fill so the name stays readable. In house uses the room board's "In use"
 * orange, so the same colour means the same thing on both screens.
 */
const barStyle: Record<Booking['kind'], string> = {
    reserved:
        'border border-l-4 border-violet-300 border-l-violet-600 bg-violet-100 text-violet-950 dark:border-violet-800 dark:border-l-violet-400 dark:bg-violet-950 dark:text-violet-100',
    not_arrived:
        'border border-l-4 border-dashed border-red-400 border-l-red-600 bg-red-50 text-red-950 dark:border-red-800 dark:border-l-red-400 dark:bg-red-950 dark:text-red-100',
    in_house:
        'border border-l-4 border-room-in-use/50 border-l-room-in-use bg-room-in-use/20 text-foreground',
    checked_out:
        'border border-l-4 border-slate-300 border-l-slate-400 bg-slate-100 text-slate-600 dark:border-slate-700 dark:border-l-slate-500 dark:bg-slate-900 dark:text-slate-400',
};

const kindLabel: Record<Booking['kind'], string> = {
    reserved: 'Reserved',
    not_arrived: 'Not arrived',
    in_house: 'In house',
    checked_out: 'Checked out',
};

const kindHint: Record<Booking['kind'], string> = {
    reserved: 'booked, guests not here yet',
    not_arrived: 'late, past the grace period',
    in_house: 'guests are in the room now',
    checked_out: 'guests have left',
};

/** "May extend": the stay may go on, so the time after is kept free for now. */
const extendStyle = {
    backgroundImage:
        'repeating-linear-gradient(135deg, color-mix(in oklab, var(--room-in-use) 30%, transparent) 0 4px, transparent 4px 9px)',
};

/** Bars narrower than this (share of the week, about 12 hours) show no text. */
const LABEL_MIN_WIDTH = 7;

export default function Calendar({
    now,
    start,
    from,
    until,
    days,
    today,
    standardTimes,
    locations,
}: Props) {
    const windowStart = Date.parse(from);
    const windowLength = Date.parse(until) - windowStart;

    /** Where a time sits across the week, 0–100%. */
    const position = (iso: string) =>
        Math.min(
            100,
            Math.max(0, ((Date.parse(iso) - windowStart) / windowLength) * 100),
        );

    const nowAt = Date.parse(now);
    const nowShown =
        nowAt >= windowStart && nowAt <= windowStart + windowLength;
    const nowLeft = position(now);

    const go = (date: string | null) =>
        router.get(calendar().url, date ? { start: date } : {}, {
            preserveScroll: true,
        });

    // A literal class, so Tailwind generates it: room name + 7 days.
    const columns = 'grid-cols-[9rem_repeat(7,minmax(0,1fr))]';

    return (
        <>
            <Head title="Calendar" />
            <Page>
                <PageHeader
                    title="Calendar"
                    description="A week of every room. Click a free day to book it; click a bar to open the booking."
                    actions={
                        <>
                            <Button
                                variant="outline"
                                size="icon"
                                aria-label="Previous week"
                                onClick={() => go(shiftDays(start, -7))}
                            >
                                <ChevronLeft />
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => go(null)}
                                disabled={start === today}
                            >
                                Today
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                aria-label="Next week"
                                onClick={() => go(shiftDays(start, 7))}
                            >
                                <ChevronRight />
                            </Button>
                            <Button asChild>
                                <Link href={reservationsCreate()}>
                                    <Plus />
                                    New reservation
                                </Link>
                            </Button>
                        </>
                    }
                />

                <Card className="gap-0 px-5 py-4">
                    <h2 className="sr-only">What the colours mean</h2>
                    <ul className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        {(Object.keys(kindLabel) as Booking['kind'][]).map(
                            (kind) => (
                                <li
                                    key={kind}
                                    className="flex items-center gap-3"
                                >
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'inline-block h-5 w-10 shrink-0 rounded-md',
                                            barStyle[kind],
                                        )}
                                    />
                                    <span>
                                        <span className="font-medium">
                                            {kindLabel[kind]}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {' '}
                                            – {kindHint[kind]}
                                        </span>
                                    </span>
                                </li>
                            ),
                        )}
                        <li className="flex items-center gap-3">
                            <span
                                aria-hidden
                                className="inline-block h-5 w-10 shrink-0 rounded-md border border-dashed border-room-in-use"
                                style={extendStyle}
                            />
                            <span>
                                <span className="font-medium">May extend</span>
                                <span className="text-muted-foreground">
                                    {' '}
                                    – kept free until the guest confirms
                                </span>
                            </span>
                        </li>
                        <li className="flex items-center gap-3">
                            <span
                                aria-hidden
                                className="flex h-5 w-10 shrink-0 justify-center"
                            >
                                <span className="h-full w-0.5 rounded-full bg-red-500" />
                            </span>
                            <span>
                                <span className="font-medium">Now</span>
                                <span className="text-muted-foreground">
                                    {' '}
                                    – the current time
                                </span>
                            </span>
                        </li>
                    </ul>
                </Card>

                {locations.map((location) => (
                    <Card key={location.id} className="gap-0 py-0">
                        <CardHeader className="border-b py-4">
                            <CardTitle className="text-base">
                                {location.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-x-auto p-0">
                            <div className="min-w-[52rem]">
                                <div
                                    className={cn(
                                        'grid border-b bg-muted/40 text-xs',
                                        columns,
                                    )}
                                >
                                    <div className="px-3 py-2 font-medium text-muted-foreground">
                                        Room
                                    </div>
                                    {days.map((day) => (
                                        <div
                                            key={day}
                                            className={cn(
                                                'border-l px-2 py-2 font-medium',
                                                day === today
                                                    ? 'text-foreground'
                                                    : 'text-muted-foreground',
                                            )}
                                        >
                                            {dayLabel.format(utcDate(day))}
                                            {day === today && (
                                                <span className="ml-1.5 rounded bg-primary px-1 py-px text-[10px] text-primary-foreground">
                                                    Today
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {location.rooms.length === 0 && (
                                    <p className="px-3 py-4 text-sm text-muted-foreground">
                                        No rooms here yet.
                                    </p>
                                )}

                                {location.rooms.map((room) => (
                                    <div
                                        key={room.id}
                                        className={cn(
                                            'grid border-b last:border-b-0',
                                            columns,
                                        )}
                                    >
                                        <div className="px-3 py-2">
                                            <p className="truncate text-sm font-medium">
                                                {room.name}
                                            </p>
                                            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                                                <StatusDot group={room.group} />
                                                <span className="truncate">
                                                    {room.status_label} ·{' '}
                                                    {room.pax_capacity} pax
                                                </span>
                                            </p>
                                        </div>
                                        <div className="relative col-span-7 min-h-14">
                                            <div className="absolute inset-0 grid grid-cols-7">
                                                {days.map((day) => (
                                                    <Link
                                                        key={day}
                                                        href={reservationsCreate(
                                                            {
                                                                query: {
                                                                    starts_at: `${day}T${standardTimes.check_in}`,
                                                                    ends_at: `${shiftDays(day, 1)}T${standardTimes.check_out}`,
                                                                    location:
                                                                        location.id,
                                                                },
                                                            },
                                                        )}
                                                        aria-label={`Book ${room.name} from ${dayLabel.format(utcDate(day))}`}
                                                        className={cn(
                                                            'border-l transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none',
                                                            day === today &&
                                                                'bg-primary/5',
                                                        )}
                                                    />
                                                ))}
                                            </div>

                                            {room.bookings.map(
                                                (booking, index) => {
                                                    const left = position(
                                                        booking.starts_at,
                                                    );
                                                    const right = position(
                                                        booking.ends_at,
                                                    );
                                                    const name =
                                                        booking.company &&
                                                        booking.company !==
                                                            booking.label
                                                            ? `${booking.label} · ${booking.company}`
                                                            : booking.label;

                                                    return (
                                                        <div key={index}>
                                                            {booking.open_ended &&
                                                                right < 100 && (
                                                                    <div
                                                                        aria-hidden
                                                                        className="pointer-events-none absolute top-2 bottom-2 rounded-r-md border border-l-0 border-dashed border-room-in-use"
                                                                        style={{
                                                                            ...extendStyle,
                                                                            left: `${right}%`,
                                                                            width: `${100 - right}%`,
                                                                        }}
                                                                    />
                                                                )}
                                                            {right > left && (
                                                                <Tooltip>
                                                                    <TooltipTrigger
                                                                        asChild
                                                                    >
                                                                        <Link
                                                                            href={
                                                                                booking.href
                                                                            }
                                                                            aria-label={`${kindLabel[booking.kind]}: ${name}`}
                                                                            className={cn(
                                                                                'absolute top-2 bottom-2 flex min-w-2 items-center overflow-hidden rounded-md px-2 text-xs font-medium shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                                                                                barStyle[
                                                                                    booking
                                                                                        .kind
                                                                                ],
                                                                            )}
                                                                            style={{
                                                                                left: `${left}%`,
                                                                                width: `${right - left}%`,
                                                                            }}
                                                                        >
                                                                            {right -
                                                                                left >=
                                                                                LABEL_MIN_WIDTH && (
                                                                                <span className="truncate">
                                                                                    {booking.kind ===
                                                                                        'not_arrived' &&
                                                                                        'Late · '}
                                                                                    {
                                                                                        name
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                        </Link>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        {
                                                                            kindLabel[
                                                                                booking
                                                                                    .kind
                                                                            ]
                                                                        }
                                                                        : {name}
                                                                        ,{' '}
                                                                        {plural(
                                                                            booking.pax,
                                                                            'guest',
                                                                        )}
                                                                        <br />
                                                                        {formatDateTime(
                                                                            booking.starts_at,
                                                                        )}{' '}
                                                                        to{' '}
                                                                        {formatDateTime(
                                                                            booking.ends_at,
                                                                        )}
                                                                        {booking.open_ended &&
                                                                            ' · may extend'}
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                    );
                                                },
                                            )}

                                            {nowShown && (
                                                <span
                                                    aria-hidden
                                                    className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-red-500"
                                                    style={{
                                                        left: `${nowLeft}%`,
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </Page>
        </>
    );
}

Calendar.layout = {
    breadcrumbs: [{ title: 'Calendar', href: calendar() }],
};
