import { Head, Link, router } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    LogIn,
    LogOut,
    Plus,
    X,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { Page, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatDate, formatTime, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { calendar } from '@/routes/reception';
import { create as reservationsCreate } from '@/routes/reception/reservations';

type CalendarEvent = {
    type: 'arrival' | 'departure';
    label: string;
    guest: string;
    company: string | null;
    rooms: string;
    at: string;
    status: string;
    href: string;
};

type Props = {
    /** True when a "from … to" range was asked for; false for a whole month. */
    ranged: boolean;
    from: string;
    to: string;
    title: string;
    previous: string;
    next: string;
    today: string;
    events: Record<string, CalendarEvent[]>;
    arrivals: number;
    departures: number;
};

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Arrivals are blue, check-outs amber, the same in the boxes and the keys.
const tone = {
    arrival:
        'border-l-sky-600 bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100',
    departure:
        'border-l-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100',
};

/** How many events a day box shows before "+ more". */
const SHOWN = 3;

/** "2026-10-07" moved by a number of days (no time zones involved). */
function shift(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);

    return new Date(Date.UTC(year, month - 1, day + days))
        .toISOString()
        .slice(0, 10);
}

function weekday(date: string): number {
    const [year, month, day] = date.split('-').map(Number);

    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export default function Calendar({
    ranged,
    from,
    to,
    title,
    previous,
    next,
    today,
    events,
    arrivals,
    departures,
}: Props) {
    const [picked, setPicked] = useState<string | null>(null);
    const [range, setRange] = useState({ from, to });
    const [shownRange, setShownRange] = useState(`${from}|${to}`);

    // Follow the dates the server answered with (Previous, Next, Today).
    if (shownRange !== `${from}|${to}`) {
        setShownRange(`${from}|${to}`);
        setRange({ from, to });
    }

    const inRange = (date: string) => date >= from && date <= to;
    const selected = picked !== null && inRange(picked) ? picked : null;

    const go = (query: Record<string, string>) =>
        router.get(calendar().url, query, { preserveScroll: true });

    const showRange = (event: FormEvent) => {
        event.preventDefault();
        go(range);
    };

    // Whole weeks, Sunday to Saturday, that cover the dates shown.
    const start = shift(from, -weekday(from));
    const end = shift(to, 6 - weekday(to));
    const dates: string[] = [];

    for (let date = start; date <= end; date = shift(date, 1)) {
        dates.push(date);
    }

    const schedule = selected ? (events[selected] ?? []) : [];

    return (
        <>
            <Head title="Calendar" />
            <Page>
                <PageHeader
                    title="Calendar"
                    description="See who is arriving or checking out, their room, status and scheduled time."
                    actions={
                        <Button asChild>
                            <Link href={reservationsCreate()}>
                                <Plus />
                                New reservation
                            </Link>
                        </Button>
                    }
                />

                <Card className="gap-5 p-4 md:p-6">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="space-y-3">
                            <h2 className="text-xl font-semibold tracking-tight">
                                {title}
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => go({ month: previous })}
                                >
                                    <ChevronLeft />
                                    Previous month
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => go({})}
                                >
                                    Today
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => go({ month: next })}
                                >
                                    Next month
                                    <ChevronRight />
                                </Button>
                            </div>
                        </div>

                        <form
                            onSubmit={showRange}
                            className="flex flex-wrap items-end gap-2"
                        >
                            <FormField label="From" htmlFor="calendar_from">
                                <Input
                                    id="calendar_from"
                                    type="date"
                                    value={range.from}
                                    max={range.to}
                                    onChange={(event) =>
                                        setRange({
                                            ...range,
                                            from: event.target.value,
                                        })
                                    }
                                    required
                                />
                            </FormField>
                            <FormField label="To" htmlFor="calendar_to">
                                <Input
                                    id="calendar_to"
                                    type="date"
                                    value={range.to}
                                    min={range.from}
                                    onChange={(event) =>
                                        setRange({
                                            ...range,
                                            to: event.target.value,
                                        })
                                    }
                                    required
                                />
                            </FormField>
                            <Button type="submit">Show dates</Button>
                            {ranged && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => go({})}
                                >
                                    <X />
                                    Clear
                                </Button>
                            )}
                        </form>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span
                            className={cn(
                                'inline-flex items-center gap-2 rounded-md border-l-4 px-3 py-1.5',
                                tone.arrival,
                            )}
                        >
                            <LogIn className="size-4" />
                            Arrivals / reservations
                            <b className="text-base">{arrivals}</b>
                        </span>
                        <span
                            className={cn(
                                'inline-flex items-center gap-2 rounded-md border-l-4 px-3 py-1.5',
                                tone.departure,
                            )}
                        >
                            <LogOut className="size-4" />
                            Expected check-outs
                            <b className="text-base">{departures}</b>
                        </span>
                        <span className="text-muted-foreground">
                            Click a day to see everything on it.
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <div className="grid min-w-[46rem] grid-cols-7 overflow-hidden rounded-lg border-t border-l">
                            {weekdays.map((day) => (
                                <div
                                    key={day}
                                    className="border-r border-b bg-muted/60 px-2 py-2.5 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                                >
                                    {day}
                                </div>
                            ))}

                            {dates.map((date) => {
                                // Days outside the dates asked for are left blank.
                                if (!inRange(date)) {
                                    return (
                                        <div
                                            key={date}
                                            className="min-h-32 border-r border-b bg-muted/30"
                                        />
                                    );
                                }

                                const list = events[date] ?? [];
                                const day = Number(date.slice(8));

                                return (
                                    <div
                                        key={date}
                                        className={cn(
                                            'min-h-32 border-r border-b p-1.5',
                                            date === today &&
                                                'bg-sky-50/60 dark:bg-sky-950/20',
                                            date === selected &&
                                                'ring-2 ring-ring ring-inset',
                                        )}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setPicked(date)}
                                            aria-pressed={date === selected}
                                            aria-label={`${formatDate(date)}, ${plural(list.length, 'activity', 'activities')}`}
                                            className="flex w-full items-center justify-between rounded px-1 py-0.5 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                        >
                                            <span
                                                className={cn(
                                                    'text-sm font-semibold',
                                                    date === today &&
                                                        'rounded-full bg-primary px-2 text-primary-foreground',
                                                )}
                                            >
                                                {/* A range can cross months: say which one on its first day. */}
                                                {day === 1 || date === from
                                                    ? formatDate(date).replace(
                                                          /,? \d{4}$/,
                                                          '',
                                                      )
                                                    : day}
                                            </span>
                                            {list.length > 0 && (
                                                <span className="text-[11px] text-muted-foreground">
                                                    {plural(
                                                        list.length,
                                                        'activity',
                                                        'activities',
                                                    )}
                                                </span>
                                            )}
                                        </button>

                                        {list.slice(0, SHOWN).map((event) => (
                                            <EventCard
                                                key={`${event.type}-${event.href}`}
                                                event={event}
                                                compact
                                            />
                                        ))}
                                        {list.length > SHOWN && (
                                            <button
                                                type="button"
                                                onClick={() => setPicked(date)}
                                                className="mt-1 w-full rounded border border-dashed px-2 py-1 text-left text-xs font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                            >
                                                + {list.length - SHOWN} more,
                                                view all
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Card>
            </Page>

            {/* Every activity of the day that was clicked. */}
            <Dialog
                open={selected !== null}
                onOpenChange={(open) => !open && setPicked(null)}
            >
                <DialogContent className="sm:max-w-2xl">
                    {selected && (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {formatDate(selected)}
                                    {selected === today && ' (today)'}
                                </DialogTitle>
                                <DialogDescription>
                                    {schedule.length === 0
                                        ? 'Nobody arrives or checks out on this day.'
                                        : `${plural(schedule.length, 'activity', 'activities')}. Open one to see the booking.`}
                                </DialogDescription>
                            </DialogHeader>
                            {schedule.length > 0 && (
                                <div className="grid max-h-[60vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                                    {schedule.map((event) => (
                                        <EventCard
                                            key={`${event.type}-${event.href}`}
                                            event={event}
                                        />
                                    ))}
                                </div>
                            )}
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="outline">Close</Button>
                                </DialogClose>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

/** One arrival or check-out; it opens the reservation or the stay. */
function EventCard({
    event,
    compact = false,
}: {
    event: CalendarEvent;
    compact?: boolean;
}) {
    return (
        <Link
            href={event.href}
            title={`${event.label}: ${event.guest}, ${event.rooms}, ${formatTime(event.at)}`}
            className={cn(
                'block rounded-md border-l-4 px-2 py-1.5 hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                compact ? 'mt-1 text-xs' : 'text-sm',
                tone[event.type],
            )}
        >
            <b className="block truncate">{event.label}</b>
            <span className="block truncate font-medium">{event.guest}</span>
            {!compact && event.company && (
                <span className="block truncate text-xs">{event.company}</span>
            )}
            <span className="block truncate text-[11px]">
                {event.rooms} · {formatTime(event.at)}
            </span>
            <span className="block truncate text-[11px] opacity-70">
                {event.status}
            </span>
        </Link>
    );
}

Calendar.layout = {
    breadcrumbs: [{ title: 'Calendar', href: calendar() }],
};
