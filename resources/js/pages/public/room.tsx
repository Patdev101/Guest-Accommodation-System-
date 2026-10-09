import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarX,
    CheckCircle2,
    MapPin,
    Users,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { ContactLine, HouseRules } from '@/components/public/house-rules';
import { RoomPhoto } from '@/components/public/room-photo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    formatClock,
    formatDate,
    formatDayTime,
    formatPeso,
    plural,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { openAccountDialog } from '@/lib/account-dialog';
import { create as bookRoom } from '@/routes/guest/requests';
import { index as roomsIndex, show as roomsShow } from '@/routes/rooms';
import type { User } from '@/types';

type Props = {
    room: {
        id: number;
        name: string;
        location: string;
        pax_capacity: number;
        description: string | null;
        photos: { id: number; url: string; caption: string | null }[];
        inclusions: { id: number; item: string; quantity: number }[];
        rates: { id: number; name: string; unit: string; price: string }[];
    };
    /** Times the room is already taken; `to` is null while a guest may still extend. */
    busy: { from: string; to: string | null }[];
    /** Free for the chosen dates; null until dates are chosen. */
    free: boolean | null;
    /** What stands in the way of the dates, when they are not free. */
    blockedBy: 'occupied' | 'booked' | null;
    filters: {
        from: string | null;
        to: string | null;
        guests: number | null;
    };
    today: string;
    standardTimes: { check_in: string; check_out: string };
};

export default function RoomPage({
    room,
    busy,
    free,
    blockedBy,
    filters,
    today,
    standardTimes,
}: Props) {
    const user = usePage().props.auth.user as User | null;
    const [photo, setPhoto] = useState(0);
    const [dates, setDates] = useState({
        from: filters.from ?? '',
        to: filters.to ?? '',
    });
    const current = room.photos[Math.min(photo, room.photos.length - 1)];
    const tooMany =
        filters.guests !== null && filters.guests > room.pax_capacity;

    // The request form opens with the dates and guests already chosen here.
    const bookUrl = bookRoom(room.id, {
        query: {
            from: filters.from ?? undefined,
            to: filters.to ?? undefined,
            guests: filters.guests ?? undefined,
        },
    }).url;

    const check = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            roomsShow(room.id).url,
            { ...dates, guests: filters.guests ?? undefined },
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title={room.name} />
            <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">
                <Link
                    href={roomsIndex({
                        query: {
                            from: filters.from ?? undefined,
                            to: filters.to ?? undefined,
                            guests: filters.guests ?? undefined,
                        },
                    })}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                    <ArrowLeft className="size-4" />
                    All rooms
                </Link>

                <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="min-w-0 space-y-6">
                        <div className="space-y-2">
                            <RoomPhoto
                                url={current?.url}
                                alt={
                                    current?.caption ?? `Photo of ${room.name}`
                                }
                                lazy={false}
                                className="aspect-[16/10] rounded-2xl border shadow-sm"
                            />
                            {current?.caption && (
                                <p className="text-sm text-muted-foreground">
                                    {current.caption}
                                </p>
                            )}
                            {room.photos.length > 1 && (
                                <ul className="flex gap-2 overflow-x-auto pb-1">
                                    {room.photos.map((item, index) => (
                                        <li key={item.id} className="shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setPhoto(index)}
                                                aria-label={`Show photo ${index + 1} of ${room.photos.length}`}
                                                aria-pressed={index === photo}
                                                className={cn(
                                                    'block h-16 w-24 overflow-hidden rounded-md border-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                                                    index === photo
                                                        ? 'border-primary'
                                                        : 'border-transparent opacity-70 hover:opacity-100',
                                                )}
                                            >
                                                <img
                                                    src={item.url}
                                                    alt=""
                                                    loading="lazy"
                                                    className="size-full object-cover"
                                                />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                                {room.name}
                            </h1>
                            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                                    <MapPin className="size-4" />
                                    {room.location}
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                                    <Users className="size-4" />
                                    Up to {plural(room.pax_capacity, 'guest')}
                                </span>
                            </p>
                            {room.description && (
                                <p className="mt-4 max-w-prose whitespace-pre-line">
                                    {room.description}
                                </p>
                            )}
                        </div>

                        <section className="space-y-3 border-t pt-6">
                            <h2 className="text-lg font-semibold">
                                What is included
                            </h2>
                            {room.inclusions.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Nothing is listed for this room yet.
                                </p>
                            ) : (
                                <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                                    {room.inclusions.map((inclusion) => (
                                        <li
                                            key={inclusion.id}
                                            className="flex items-center gap-2"
                                        >
                                            <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                            {inclusion.quantity > 1 &&
                                                `${inclusion.quantity} `}
                                            {inclusion.item}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="space-y-3 border-t pt-6">
                            <h2 className="text-lg font-semibold">
                                When it is taken
                            </h2>
                            {busy.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    This room has no bookings ahead. Any dates
                                    are open.
                                </p>
                            ) : (
                                <ul className="space-y-2 text-sm">
                                    {busy.map((period) => (
                                        <li
                                            key={period.from}
                                            className="flex items-start gap-2"
                                        >
                                            <CalendarX className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                            <span>
                                                {formatDayTime(period.from)}{' '}
                                                {period.to ? (
                                                    <>
                                                        to{' '}
                                                        {formatDayTime(
                                                            period.to,
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        onwards (the current
                                                        guest has not confirmed
                                                        their check-out yet)
                                                    </span>
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>

                    <section className="space-y-4 border-t pt-6 lg:col-start-1">
                        <h2 className="text-lg font-semibold">Good to know</h2>
                        <HouseRules compact />
                        <ContactLine />
                    </section>

                    <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
                        <div className="space-y-5 rounded-2xl border bg-card p-6 shadow-lg">
                            {room.rates[0] && (
                                <p className="text-sm text-muted-foreground">
                                    From
                                    <span className="block text-3xl leading-tight font-semibold tracking-tight text-foreground">
                                        {formatPeso(room.rates[0].price)}
                                        <span className="text-base font-normal text-muted-foreground">
                                            {' '}
                                            / {room.rates[0].unit.toLowerCase()}
                                        </span>
                                    </span>
                                </p>
                            )}
                            <div className="space-y-2 border-t pt-5">
                                <h2 className="font-semibold">Prices</h2>
                                <ul className="space-y-2 text-sm">
                                    {room.rates.map((rate) => (
                                        <li
                                            key={rate.id}
                                            className="flex items-baseline justify-between gap-3"
                                        >
                                            <span className="min-w-0">
                                                {rate.name}
                                                {rate.name.toLowerCase() !==
                                                    rate.unit.toLowerCase() && (
                                                    <span className="block text-xs text-muted-foreground">
                                                        {rate.unit}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-base font-semibold tabular-nums">
                                                {formatPeso(rate.price)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <form
                                onSubmit={check}
                                className="space-y-3 border-t pt-5"
                            >
                                <h2 className="font-semibold">
                                    Check your dates
                                </h2>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField
                                        label="Arrival"
                                        htmlFor="room_from"
                                    >
                                        <Input
                                            id="room_from"
                                            type="date"
                                            min={today}
                                            value={dates.from}
                                            onChange={(event) =>
                                                setDates({
                                                    ...dates,
                                                    from: event.target.value,
                                                })
                                            }
                                            required
                                        />
                                    </FormField>
                                    <FormField
                                        label="Departure"
                                        htmlFor="room_to"
                                    >
                                        <Input
                                            id="room_to"
                                            type="date"
                                            min={dates.from || today}
                                            value={dates.to}
                                            onChange={(event) =>
                                                setDates({
                                                    ...dates,
                                                    to: event.target.value,
                                                })
                                            }
                                            required
                                        />
                                    </FormField>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Check-in from{' '}
                                    {formatClock(standardTimes.check_in)},
                                    check-out by{' '}
                                    {formatClock(standardTimes.check_out)}.
                                </p>
                                <Button
                                    type="submit"
                                    variant="outline"
                                    className="w-full"
                                >
                                    Check availability
                                </Button>
                            </form>

                            {free !== null && filters.from && filters.to && (
                                <p
                                    role="status"
                                    className={cn(
                                        'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm',
                                        free
                                            ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                                            : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40',
                                    )}
                                >
                                    {free ? (
                                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                        <XCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                    )}
                                    <span>
                                        {free
                                            ? `Free from ${formatDate(filters.from)} to ${formatDate(filters.to)}.`
                                            : blockedBy === 'occupied'
                                              ? `We cannot promise ${formatDate(filters.from)} to ${formatDate(filters.to)} yet. A guest is staying in this room now and has not confirmed when they leave. Please check again soon, or choose another room.`
                                              : `Already booked from ${formatDate(filters.from)} to ${formatDate(filters.to)}. Try other dates or another room.`}
                                    </span>
                                </p>
                            )}

                            {tooMany && (
                                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-800 dark:bg-amber-950/40">
                                    This room takes up to {room.pax_capacity}.
                                    For {filters.guests} guests you will need
                                    more than one room.
                                </p>
                            )}

                            <div className="space-y-2 border-t pt-5">
                                {user?.role === 'guest' ? (
                                    <Button
                                        asChild
                                        size="lg"
                                        className="w-full"
                                    >
                                        <Link href={bookUrl}>
                                            Request to book
                                        </Link>
                                    </Button>
                                ) : user ? (
                                    <Button
                                        size="lg"
                                        className="w-full"
                                        disabled
                                    >
                                        Request to book
                                    </Button>
                                ) : (
                                    // No account yet: log in or sign up first, then carry on to the request.
                                    <Button
                                        size="lg"
                                        className="w-full"
                                        onClick={() =>
                                            openAccountDialog({
                                                mode: 'login',
                                                intended: bookUrl,
                                            })
                                        }
                                    >
                                        Request to book
                                    </Button>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    {user?.role === 'guest' ? (
                                        'You send a request; our front desk confirms it. Nothing is charged online.'
                                    ) : user ? (
                                        'Staff accounts book from the front desk screens. Only guest accounts send requests here.'
                                    ) : (
                                        <>
                                            You need an account to send a
                                            request.{' '}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openAccountDialog({
                                                        mode: 'login',
                                                        intended: bookUrl,
                                                    })
                                                }
                                                className="font-medium text-foreground underline-offset-4 hover:underline"
                                            >
                                                Log in
                                            </button>{' '}
                                            or{' '}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openAccountDialog({
                                                        mode: 'register',
                                                        intended: bookUrl,
                                                    })
                                                }
                                                className="font-medium text-foreground underline-offset-4 hover:underline"
                                            >
                                                create an account
                                            </button>
                                            ; it takes a minute.
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </>
    );
}
