import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarClock,
    Plus,
    Trash2,
    Users,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import ReservationController from '@/actions/App/Http/Controllers/Reception/ReservationController';
import { CountInput } from '@/components/count-input';
import { DateTimeInput } from '@/components/date-time-input';
import { FormField } from '@/components/form-field';
import { IconButton } from '@/components/icon-button';
import InputError from '@/components/input-error';
import { Page, PageHeader } from '@/components/page';
import { RoomStatusBadge } from '@/components/room-status-badge';
import { RoomThumb } from '@/components/room-thumb';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
    formatClock,
    formatLocal,
    formatPeso,
    plural,
    todayIso,
} from '@/lib/format';
import { suggestPrice } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { checkIn, walkIn as walkInPage } from '@/routes/reception';
import {
    create as reservationsCreate,
    edit as reservationsEdit,
    index as reservationsIndex,
    show as reservationsShow,
} from '@/routes/reception/reservations';
import type { LocationOption, RoomSummary } from '@/types';

type Rate = { id: number; name: string; price: string; unit: string };

type RoomOption = RoomSummary & {
    blocked_reason: string | null;
    inclusions: string[];
    rates: Rate[];
};

type Window = {
    starts_at: string;
    ends_at: string;
    pax: number;
    location: number | null;
};

type Props = {
    window: Window;
    rooms: RoomOption[];
    freeCapacity: number;
    earliest: {
        starts_at: string;
        ends_at: string;
        rooms: number;
        capacity: number;
    } | null;
    locations: LocationOption[];
    guestTypes: { value: string; label: string }[];
    paymentMethods: string[];
    standardTimes: { check_in: string; check_out: string };
    walkIn: boolean;
    /** The reservation being changed; null for a new booking. */
    editing: {
        id: number;
        contact_name: string;
        contact_number: string;
        email: string | null;
        company: string | null;
        purpose: string | null;
        guest_type: string;
        paid: string;
        rooms: Line[];
    } | null;
};

type Line = {
    room_id: number;
    room_rate_id: number;
    pax: number;
    price: string;
};

type BookingForm = {
    contact_name: string;
    contact_number: string;
    email: string;
    company: string;
    purpose: string;
    guest_type: string;
    starts_at: string;
    ends_at: string;
    rooms: Line[];
    payment_amount: string;
    payment_method: string;
    paid_by: 'guest' | 'company';
    receipt_number: string;
};

const ALL = 'all';

/** "Overnight · ₱800", or "Standard · ₱150 / per hour" when the name does not say the unit. */
function rateLabel(rate: Rate): string {
    const unit =
        rate.name.toLowerCase() === rate.unit.toLowerCase()
            ? ''
            : ` / ${rate.unit.toLowerCase()}`;

    return `${rate.name} · ${formatPeso(rate.price)}${unit}`;
}

/** "2026-10-01T14:00" → ["2026-10-01", "14:00"]. */
function splitValue(value: string): [string, string] {
    const [date, time = '00:00'] = value.split('T');

    return [date, time];
}

/**
 * Free rooms that give `need` more guests a place: the smallest room that
 * takes them all, otherwise the biggest rooms first. Null = not enough rooms.
 */
function suggestRooms(
    need: number,
    candidates: RoomOption[],
): RoomOption[] | null {
    const picked: RoomOption[] = [];
    let pool = [...candidates];
    let left = need;

    while (left > 0) {
        const fits = pool
            .filter((room) => room.pax_capacity >= left)
            .sort((a, b) => a.pax_capacity - b.pax_capacity)[0];
        const next =
            fits ??
            [...pool].sort((a, b) => b.pax_capacity - a.pax_capacity)[0];

        if (!next) {
            return null;
        }

        picked.push(next);
        pool = pool.filter((room) => room.id !== next.id);
        left -= next.pax_capacity;
    }

    return picked;
}

function addDays(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + days));

    return next.toISOString().slice(0, 10);
}

export default function NewReservation({
    window,
    rooms,
    freeCapacity,
    earliest,
    locations,
    guestTypes,
    paymentMethods,
    standardTimes,
    walkIn,
    editing,
}: Props) {
    const form = useForm<BookingForm>({
        contact_name: editing?.contact_name ?? '',
        contact_number: editing?.contact_number ?? '',
        email: editing?.email ?? '',
        company: editing?.company ?? '',
        purpose: editing?.purpose ?? '',
        guest_type: editing?.guest_type ?? guestTypes[0]?.value ?? 'visitor',
        starts_at: window.starts_at,
        ends_at: window.ends_at,
        rooms: editing?.rooms ?? [],
        payment_amount: '',
        payment_method: '',
        paid_by: 'guest',
        receipt_number: '',
    });
    const errors = form.errors as Record<string, string | undefined>;

    const [pax, setPax] = useState(window.pax);
    const paxTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [location, setLocation] = useState(
        window.location ? String(window.location) : ALL,
    );
    // Prices reception typed in are kept when the dates change.
    const [typedPrice, setTypedPrice] = useState<Record<number, boolean>>({});

    const startDate = splitValue(form.data.starts_at)[0];

    const roomById = (id: number) => rooms.find((room) => room.id === id);

    const priceFor = (line: Line, startsAt: string, endsAt: string) => {
        const rate = roomById(line.room_id)?.rates.find(
            (item) => item.id === line.room_rate_id,
        );

        return rate
            ? suggestPrice(rate.price, rate.unit, startsAt, endsAt)
            : null;
    };

    const reload = (next: Partial<Window>) => {
        const startsAt = next.starts_at ?? form.data.starts_at;
        const endsAt = next.ends_at ?? form.data.ends_at;
        const nextPax = next.pax ?? pax;
        const nextLocation =
            next.location !== undefined
                ? next.location
                : location === ALL
                  ? null
                  : Number(location);

        form.setData((data) => ({
            ...data,
            starts_at: startsAt,
            ends_at: endsAt,
            rooms: data.rooms.map((line) => {
                const suggestion = priceFor(line, startsAt, endsAt);

                return typedPrice[line.room_id] || !suggestion
                    ? line
                    : { ...line, price: String(suggestion.total) };
            }),
        }));

        router.get(
            editing
                ? reservationsEdit(editing.id).url
                : walkIn
                  ? walkInPage().url
                  : reservationsCreate().url,
            {
                starts_at: startsAt,
                ends_at: endsAt,
                pax: nextPax,
                location: nextLocation ?? undefined,
            },
            {
                only: ['window', 'rooms', 'freeCapacity', 'earliest'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const changeStart = (date: string, time: string) => {
        const startsAt = `${date}T${time}`;
        // Keep the departure after the arrival.
        const endsAt =
            form.data.ends_at > startsAt
                ? form.data.ends_at
                : `${addDays(date, 1)}T${standardTimes.check_out}`;

        reload({ starts_at: startsAt, ends_at: endsAt });
    };

    const lines = form.data.rooms;
    const placed = lines.reduce((sum, line) => sum + line.pax, 0);
    const total = lines.reduce(
        (sum, line) => sum + (Number(line.price) || 0),
        0,
    );
    const blockedLines = lines.filter(
        (line) => roomById(line.room_id)?.blocked_reason,
    );

    const addRoom = (room: RoomOption) => {
        const rate = room.rates[0];
        const line: Line = {
            room_id: room.id,
            room_rate_id: rate.id,
            pax: Math.max(1, Math.min(room.pax_capacity, pax - placed)),
            price: String(
                suggestPrice(
                    rate.price,
                    rate.unit,
                    form.data.starts_at,
                    form.data.ends_at,
                ).total,
            ),
        };

        form.setData('rooms', [...lines, line]);
    };

    const updateLine = (index: number, patch: Partial<Line>) =>
        form.setData(
            'rooms',
            lines.map((line, i) =>
                i === index ? { ...line, ...patch } : line,
            ),
        );

    const removeLine = (index: number) =>
        form.setData(
            'rooms',
            lines.filter((_, i) => i !== index),
        );

    const shown = rooms.filter(
        (room) => location === ALL || String(room.location_id) === location,
    );
    const free = shown.filter((room) => room.blocked_reason === null);
    const blocked = shown.filter((room) => room.blocked_reason !== null);
    const selected = new Set(lines.map((line) => line.room_id));
    const paying = Number(form.data.payment_amount) > 0;

    // Every guest needs a place. When the rooms added cannot take the whole
    // group, the booking is refused and free rooms that would fit are suggested.
    const unplaced = lines.length > 0 ? Math.max(0, pax - placed) : 0;
    const spare = lines.reduce(
        (sum, line) =>
            sum +
            Math.max(
                0,
                (roomById(line.room_id)?.pax_capacity ?? line.pax) - line.pax,
            ),
        0,
    );
    // Still without a place even when the added rooms are filled up.
    const needRooms = Math.max(0, unplaced - spare);
    const suggestion =
        needRooms > 0
            ? suggestRooms(
                  needRooms,
                  rooms.filter(
                      (room) =>
                          room.blocked_reason === null &&
                          !selected.has(room.id) &&
                          room.rates.length > 0,
                  ),
              )
            : [];

    /** Fill the added rooms, then add the suggested ones, so everyone has a place. */
    const applySuggestion = () => {
        let left = unplaced;

        const filled = lines.map((line) => {
            const capacity = roomById(line.room_id)?.pax_capacity ?? line.pax;
            const more = Math.min(left, Math.max(0, capacity - line.pax));
            left -= more;

            return { ...line, pax: line.pax + more };
        });

        const added = (suggestion ?? []).map((room) => {
            const take = Math.max(1, Math.min(room.pax_capacity, left));
            left -= take;

            return {
                room_id: room.id,
                room_rate_id: room.rates[0].id,
                pax: take,
                price: String(
                    suggestPrice(
                        room.rates[0].price,
                        room.rates[0].unit,
                        form.data.starts_at,
                        form.data.ends_at,
                    ).total,
                ),
            };
        });

        form.setData('rooms', [...filled, ...added]);
    };

    // Guests arriving today can go straight on to the check-in form.
    const arrivesToday = startDate === todayIso();

    const save = (checkInNow: boolean) => {
        form.transform((data) => ({
            ...data,
            payment_amount: paying ? data.payment_amount : '',
            payment_method: paying ? data.payment_method : '',
            receipt_number: paying ? data.receipt_number : '',
            check_in_now: checkInNow,
            // The size of the group, so the server can refuse a booking that leaves guests without a room.
            guests: pax,
        }));

        if (editing) {
            form.put(ReservationController.update.url(editing.id), {
                preserveScroll: true,
            });
        } else {
            form.post(ReservationController.store.url(), {
                preserveScroll: true,
            });
        }
    };

    // A walk-in's main button saves and opens the check-in form.
    const submit = (event: FormEvent) => {
        event.preventDefault();
        save(walkIn);
    };

    return (
        <>
            <Head
                title={
                    editing
                        ? `Edit reservation #${editing.id}`
                        : walkIn
                          ? 'Walk-in check-in'
                          : 'New reservation'
                }
            />
            <Page className="max-w-5xl">
                <PageHeader
                    title={
                        editing
                            ? `Edit reservation #${editing.id}`
                            : walkIn
                              ? 'Walk-in check-in'
                              : 'New reservation'
                    }
                    description={
                        editing
                            ? 'Change the dates, rooms, guests per room, prices or contact details. The rooms this booking already has count as free. Payments are recorded on the reservation page.'
                            : walkIn
                              ? 'For guests who are here now without a booking. Choose their rooms first; the guest list and ID come right after.'
                              : `Book one or more rooms for a guest or a company. The guest list and ID are taken at check-in. Standard times: check-in ${formatClock(standardTimes.check_in)}, check-out ${formatClock(standardTimes.check_out)}.`
                    }
                />

                {walkIn && !editing && (
                    <ol className="grid gap-2 text-sm sm:grid-cols-2">
                        <li className="flex items-center gap-3 rounded-lg border border-primary bg-primary/5 px-4 py-3">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                1
                            </span>
                            <span>
                                <b className="block">Rooms and contact</b>
                                <span className="text-muted-foreground">
                                    You are here
                                </span>
                            </span>
                        </li>
                        <li className="flex items-center gap-3 rounded-lg border px-4 py-3 text-muted-foreground">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                                2
                            </span>
                            <span>
                                <b className="block">Guest list and ID</b>
                                Opens when you save
                            </span>
                        </li>
                    </ol>
                )}

                <form onSubmit={submit} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>When and how many</CardTitle>
                            <CardDescription>
                                The rooms below update to show which are free
                                for these dates.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 sm:grid-cols-2">
                            <FormField
                                label="Arrival"
                                htmlFor="start_date"
                                error={errors.starts_at}
                            >
                                <DateTimeInput
                                    id="start_date"
                                    label="Arrival"
                                    value={form.data.starts_at}
                                    min={todayIso()}
                                    onChange={(value) =>
                                        changeStart(...splitValue(value))
                                    }
                                    required
                                />
                            </FormField>
                            <FormField
                                label="Departure"
                                htmlFor="end_date"
                                error={errors.ends_at}
                            >
                                <DateTimeInput
                                    id="end_date"
                                    label="Departure"
                                    value={form.data.ends_at}
                                    min={startDate}
                                    onChange={(value) =>
                                        reload({ ends_at: value })
                                    }
                                    required
                                />
                            </FormField>
                            <FormField
                                label="Number of guests"
                                htmlFor="pax"
                                hint="Everyone in the booking, across all rooms."
                            >
                                <CountInput
                                    id="pax"
                                    max={1000}
                                    value={pax}
                                    onChange={(value) => {
                                        setPax(value);
                                        // Wait for the typing to finish before asking which rooms are free.
                                        clearTimeout(paxTimer.current);
                                        paxTimer.current = setTimeout(
                                            () => reload({ pax: value }),
                                            400,
                                        );
                                    }}
                                />
                            </FormField>
                            <FormField label="Location" htmlFor="location">
                                <Select
                                    value={location}
                                    onValueChange={(value) => {
                                        setLocation(value);
                                        reload({
                                            location:
                                                value === ALL
                                                    ? null
                                                    : Number(value),
                                        });
                                    }}
                                >
                                    <SelectTrigger
                                        id="location"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL}>
                                            All locations
                                        </SelectItem>
                                        {locations.map((item) => (
                                            <SelectItem
                                                key={item.id}
                                                value={String(item.id)}
                                            >
                                                {item.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormField>
                        </CardContent>
                    </Card>

                    {freeCapacity < pax && (
                        <div
                            role="status"
                            className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40"
                        >
                            <CalendarClock className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
                            <div className="min-w-0 flex-1 space-y-1">
                                <p className="font-medium">
                                    Not enough free rooms for{' '}
                                    {plural(pax, 'guest')} on these dates.
                                </p>
                                <p className="text-muted-foreground">
                                    {earliest
                                        ? `Earliest with enough room: ${formatLocal(earliest.starts_at)}, when ${plural(earliest.rooms, 'room')} for up to ${earliest.capacity} guests are free.`
                                        : `The free rooms hold ${freeCapacity}. No later date has enough rooms either; split the group or choose another location.`}
                                </p>
                            </div>
                            {earliest && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        reload({
                                            starts_at: earliest.starts_at,
                                            ends_at: earliest.ends_at,
                                        })
                                    }
                                >
                                    Use these dates
                                </Button>
                            )}
                        </div>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Rooms</CardTitle>
                            <CardDescription>
                                {free.length === 0
                                    ? 'No room is free for these dates.'
                                    : `${plural(free.length, 'room')} free for these dates. Add the rooms this booking needs.`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {free.length > 0 && (
                                <ul className="divide-y rounded-lg border">
                                    {free.map((room) => (
                                        <RoomRow
                                            key={room.id}
                                            room={room}
                                            action={
                                                selected.has(room.id) ? (
                                                    <span className="text-sm text-muted-foreground">
                                                        Added
                                                    </span>
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            addRoom(room)
                                                        }
                                                    >
                                                        <Plus />
                                                        Add
                                                    </Button>
                                                )
                                            }
                                        />
                                    ))}
                                </ul>
                            )}
                            {blocked.length > 0 && (
                                <details className="group rounded-lg border">
                                    <summary className="cursor-pointer px-3 py-2.5 text-sm text-muted-foreground select-none">
                                        {plural(blocked.length, 'room')} not
                                        available for these dates
                                    </summary>
                                    <ul className="divide-y border-t">
                                        {blocked.map((room) => (
                                            <RoomRow
                                                key={room.id}
                                                room={room}
                                                muted
                                            />
                                        ))}
                                    </ul>
                                </details>
                            )}
                            <InputError message={errors.rooms} />
                        </CardContent>
                    </Card>

                    {lines.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>In this booking</CardTitle>
                                <CardDescription>
                                    {placed === pax
                                        ? pax === 1
                                            ? 'The guest has a room.'
                                            : `All ${pax} guests have a room.`
                                        : placed < pax
                                          ? `${placed} of ${pax} guests have a room. Add another room or raise the guests per room.`
                                          : `${placed} places for ${plural(pax, 'guest')}.`}{' '}
                                    Prices are suggested from the rate; change
                                    them if needed.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {unplaced > 0 && (
                                    <div
                                        role="alert"
                                        className="flex flex-wrap items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm dark:border-red-900 dark:bg-red-950/40"
                                    >
                                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <p className="font-medium">
                                                This booking cannot be saved
                                                yet: {plural(unplaced, 'guest')}{' '}
                                                {unplaced === 1
                                                    ? 'has'
                                                    : 'have'}{' '}
                                                no room.
                                            </p>
                                            <p className="text-muted-foreground">
                                                The booking is for{' '}
                                                {plural(pax, 'guest')}, but the{' '}
                                                {lines.length === 1
                                                    ? 'room'
                                                    : 'rooms'}{' '}
                                                added{' '}
                                                {lines.length === 1
                                                    ? 'has'
                                                    : 'have'}{' '}
                                                places for {placed}.{' '}
                                                {needRooms === 0
                                                    ? 'The rooms added can take everyone: raise the guests per room.'
                                                    : suggestion === null
                                                      ? 'No other free rooms can take the rest on these dates. Lower the number of guests or choose other dates.'
                                                      : `Suggested: add ${suggestion
                                                            .map(
                                                                (room) =>
                                                                    `${room.name} (up to ${room.pax_capacity})`,
                                                            )
                                                            .join(
                                                                ' and ',
                                                            )}, ${plural(lines.length + suggestion.length, 'room')} in total.`}
                                            </p>
                                        </div>
                                        {suggestion !== null && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={applySuggestion}
                                            >
                                                <Plus />
                                                {needRooms === 0
                                                    ? 'Fill the rooms'
                                                    : suggestion.length === 1
                                                      ? 'Add suggested room'
                                                      : 'Add suggested rooms'}
                                            </Button>
                                        )}
                                    </div>
                                )}
                                <ul className="divide-y rounded-lg border">
                                    {lines.map((line, index) => {
                                        const room = roomById(line.room_id);
                                        const suggestion = priceFor(
                                            line,
                                            form.data.starts_at,
                                            form.data.ends_at,
                                        );

                                        if (!room) {
                                            return null;
                                        }

                                        return (
                                            <li
                                                key={line.room_id}
                                                className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,15rem)_9rem_auto] sm:items-start"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-medium">
                                                        {room.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {room.location} · up to{' '}
                                                        {room.pax_capacity}
                                                    </p>
                                                    {room.blocked_reason && (
                                                        <p className="mt-1 flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                                                            <AlertTriangle className="size-3.5 shrink-0" />
                                                            Not free for these
                                                            dates:{' '}
                                                            {
                                                                room.blocked_reason
                                                            }
                                                        </p>
                                                    )}
                                                    <InputError
                                                        message={
                                                            errors[
                                                                `rooms.${index}.room_id`
                                                            ]
                                                        }
                                                    />
                                                </div>
                                                <div className="grid gap-1">
                                                    <CountInput
                                                        max={room.pax_capacity}
                                                        value={line.pax}
                                                        aria-label={`Guests in ${room.name}`}
                                                        onChange={(value) =>
                                                            updateLine(index, {
                                                                pax: value,
                                                            })
                                                        }
                                                    />
                                                    <span className="text-xs text-muted-foreground">
                                                        guests
                                                    </span>
                                                    <InputError
                                                        message={
                                                            errors[
                                                                `rooms.${index}.pax`
                                                            ]
                                                        }
                                                    />
                                                </div>
                                                <div className="grid gap-1">
                                                    <Select
                                                        value={String(
                                                            line.room_rate_id,
                                                        )}
                                                        onValueChange={(
                                                            value,
                                                        ) => {
                                                            const rate =
                                                                room.rates.find(
                                                                    (item) =>
                                                                        item.id ===
                                                                        Number(
                                                                            value,
                                                                        ),
                                                                );

                                                            if (!rate) {
                                                                return;
                                                            }

                                                            setTypedPrice(
                                                                (typed) => ({
                                                                    ...typed,
                                                                    [room.id]: false,
                                                                }),
                                                            );
                                                            updateLine(index, {
                                                                room_rate_id:
                                                                    rate.id,
                                                                price: String(
                                                                    suggestPrice(
                                                                        rate.price,
                                                                        rate.unit,
                                                                        form
                                                                            .data
                                                                            .starts_at,
                                                                        form
                                                                            .data
                                                                            .ends_at,
                                                                    ).total,
                                                                ),
                                                            });
                                                        }}
                                                    >
                                                        <SelectTrigger
                                                            aria-label={`Rate for ${room.name}`}
                                                            className="w-full"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {room.rates.map(
                                                                (rate) => (
                                                                    <SelectItem
                                                                        key={
                                                                            rate.id
                                                                        }
                                                                        value={String(
                                                                            rate.id,
                                                                        )}
                                                                    >
                                                                        {rateLabel(
                                                                            rate,
                                                                        )}
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    {suggestion && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatPeso(
                                                                roomById(
                                                                    line.room_id,
                                                                )?.rates.find(
                                                                    (rate) =>
                                                                        rate.id ===
                                                                        line.room_rate_id,
                                                                )?.price ?? 0,
                                                            )}{' '}
                                                            ×{' '}
                                                            {plural(
                                                                suggestion.quantity,
                                                                suggestion.unitLabel,
                                                            )}{' '}
                                                            ={' '}
                                                            {formatPeso(
                                                                suggestion.total,
                                                            )}
                                                        </span>
                                                    )}
                                                    <InputError
                                                        message={
                                                            errors[
                                                                `rooms.${index}.room_rate_id`
                                                            ]
                                                        }
                                                    />
                                                </div>
                                                <div className="grid gap-1">
                                                    <div className="relative">
                                                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                                                            ₱
                                                        </span>
                                                        <Input
                                                            type="number"
                                                            inputMode="decimal"
                                                            min={0}
                                                            step="0.01"
                                                            value={line.price}
                                                            aria-label={`Price for ${room.name}`}
                                                            className="pl-7"
                                                            onChange={(
                                                                event,
                                                            ) => {
                                                                setTypedPrice(
                                                                    (
                                                                        typed,
                                                                    ) => ({
                                                                        ...typed,
                                                                        [room.id]: true,
                                                                    }),
                                                                );
                                                                updateLine(
                                                                    index,
                                                                    {
                                                                        price: event
                                                                            .target
                                                                            .value,
                                                                    },
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        price
                                                    </span>
                                                    <InputError
                                                        message={
                                                            errors[
                                                                `rooms.${index}.price`
                                                            ]
                                                        }
                                                    />
                                                </div>
                                                <IconButton
                                                    type="button"
                                                    label={`Remove ${room.name}`}
                                                    className="text-muted-foreground hover:text-destructive"
                                                    onClick={() =>
                                                        removeLine(index)
                                                    }
                                                >
                                                    <Trash2 />
                                                </IconButton>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Company and contact person</CardTitle>
                            <CardDescription>
                                The company the booking is for, then who to call
                                about the stay.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 sm:grid-cols-2">
                            <FormField
                                label="Company"
                                htmlFor="company"
                                error={errors.company}
                            >
                                <Input
                                    id="company"
                                    value={form.data.company}
                                    onChange={(event) =>
                                        form.setData(
                                            'company',
                                            event.target.value,
                                        )
                                    }
                                    required
                                />
                            </FormField>
                            <FormField
                                label="Purpose of stay"
                                htmlFor="purpose"
                                optional
                                error={errors.purpose}
                            >
                                <Input
                                    id="purpose"
                                    value={form.data.purpose}
                                    onChange={(event) =>
                                        form.setData(
                                            'purpose',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="e.g. Hull repair project, plant visit"
                                />
                            </FormField>

                            <h3 className="border-t pt-6 text-sm font-semibold sm:col-span-2">
                                Contact person
                            </h3>
                            <FormField
                                label="Name"
                                htmlFor="contact_name"
                                error={errors.contact_name}
                            >
                                <Input
                                    id="contact_name"
                                    value={form.data.contact_name}
                                    onChange={(event) =>
                                        form.setData(
                                            'contact_name',
                                            event.target.value,
                                        )
                                    }
                                    autoComplete="off"
                                    required
                                />
                            </FormField>
                            <FormField
                                label="Contact number"
                                htmlFor="contact_number"
                                error={errors.contact_number}
                            >
                                <Input
                                    id="contact_number"
                                    type="tel"
                                    value={form.data.contact_number}
                                    onChange={(event) =>
                                        form.setData(
                                            'contact_number',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="0917 123 4567"
                                    required
                                />
                            </FormField>
                            <FormField
                                label="Email"
                                htmlFor="email"
                                optional
                                error={errors.email}
                            >
                                <Input
                                    id="email"
                                    type="email"
                                    value={form.data.email}
                                    onChange={(event) =>
                                        form.setData(
                                            'email',
                                            event.target.value,
                                        )
                                    }
                                />
                            </FormField>
                            <FormField
                                label="Guest type"
                                htmlFor="guest_type"
                                error={errors.guest_type}
                            >
                                <Select
                                    value={form.data.guest_type}
                                    onValueChange={(value) =>
                                        form.setData('guest_type', value)
                                    }
                                >
                                    <SelectTrigger
                                        id="guest_type"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {guestTypes.map((type) => (
                                            <SelectItem
                                                key={type.value}
                                                value={type.value}
                                            >
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormField>
                        </CardContent>
                    </Card>

                    {!editing && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Payment now</CardTitle>
                                <CardDescription>
                                    Optional. A downpayment of any amount, the
                                    full amount, or nothing; the balance is
                                    shown at check-in and check-out.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6 sm:grid-cols-2">
                                <FormField
                                    label="Amount paid"
                                    htmlFor="payment_amount"
                                    optional
                                    hint={
                                        total > 0
                                            ? `Total ${formatPeso(total)}.`
                                            : undefined
                                    }
                                    error={errors.payment_amount}
                                >
                                    <div className="relative">
                                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                                            ₱
                                        </span>
                                        <Input
                                            id="payment_amount"
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            step="0.01"
                                            value={form.data.payment_amount}
                                            onChange={(event) =>
                                                form.setData(
                                                    'payment_amount',
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="0"
                                            className="pl-7"
                                        />
                                    </div>
                                </FormField>
                                {paying && (
                                    <>
                                        <FormField
                                            label="Paid with"
                                            htmlFor="payment_method"
                                            error={errors.payment_method}
                                        >
                                            <Select
                                                value={form.data.payment_method}
                                                onValueChange={(value) =>
                                                    form.setData(
                                                        'payment_method',
                                                        value,
                                                    )
                                                }
                                            >
                                                <SelectTrigger
                                                    id="payment_method"
                                                    className="w-full"
                                                >
                                                    <SelectValue placeholder="Choose" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {paymentMethods.map(
                                                        (method) => (
                                                            <SelectItem
                                                                key={method}
                                                                value={method}
                                                            >
                                                                {method}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </FormField>
                                        <FormField
                                            label="Paid by"
                                            htmlFor="paid_by"
                                        >
                                            <Select
                                                value={form.data.paid_by}
                                                onValueChange={(value) =>
                                                    form.setData(
                                                        'paid_by',
                                                        value as BookingForm['paid_by'],
                                                    )
                                                }
                                            >
                                                <SelectTrigger
                                                    id="paid_by"
                                                    className="w-full"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="guest">
                                                        Guest
                                                    </SelectItem>
                                                    <SelectItem value="company">
                                                        Company
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormField>
                                        <FormField
                                            label="Receipt number"
                                            htmlFor="receipt_number"
                                            optional
                                            error={errors.receipt_number}
                                        >
                                            <Input
                                                id="receipt_number"
                                                value={form.data.receipt_number}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'receipt_number',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </FormField>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
                        <p
                            role="status"
                            className={cn(
                                'flex items-center gap-2 text-sm',
                                form.hasErrors ||
                                    blockedLines.length > 0 ||
                                    unplaced > 0
                                    ? 'font-medium text-red-600 dark:text-red-400'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {form.hasErrors ? (
                                'Not saved. Check the highlighted fields above.'
                            ) : blockedLines.length > 0 ? (
                                'Remove the rooms that are not free for these dates.'
                            ) : unplaced > 0 ? (
                                `Not enough room: ${placed} of ${pax} guests have a place. See the suggestion above.`
                            ) : lines.length === 0 ? (
                                'Add at least one room.'
                            ) : (
                                <>
                                    <Users className="size-4" />
                                    {plural(lines.length, 'room')} ·{' '}
                                    {plural(placed, 'guest')} ·{' '}
                                    {formatPeso(total)}
                                </>
                            )}
                        </p>
                        <div className="flex gap-2">
                            <Button type="button" variant="ghost" asChild>
                                <Link
                                    href={
                                        editing
                                            ? reservationsShow(editing.id)
                                            : reservationsIndex()
                                    }
                                >
                                    Cancel
                                </Link>
                            </Button>
                            {!editing && (walkIn || arrivesToday) && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={
                                        form.processing ||
                                        lines.length === 0 ||
                                        blockedLines.length > 0 ||
                                        unplaced > 0
                                    }
                                    onClick={() => save(!walkIn)}
                                >
                                    {walkIn
                                        ? 'Save only'
                                        : 'Save and check in now'}
                                </Button>
                            )}
                            <Button
                                type="submit"
                                disabled={
                                    form.processing ||
                                    lines.length === 0 ||
                                    blockedLines.length > 0 ||
                                    unplaced > 0
                                }
                            >
                                {form.processing && <Spinner />}
                                {editing
                                    ? 'Save changes'
                                    : walkIn
                                      ? 'Save and check in'
                                      : 'Save reservation'}
                            </Button>
                        </div>
                    </div>
                </form>
            </Page>
        </>
    );
}

function RoomRow({
    room,
    action,
    muted = false,
}: {
    room: RoomOption;
    action?: ReactNode;
    muted?: boolean;
}) {
    const cheapest = room.rates[0];

    return (
        <li className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <RoomThumb url={room.cover_url} />
            <div className="min-w-0 flex-1">
                <p
                    className={cn(
                        'font-medium',
                        muted && 'text-muted-foreground',
                    )}
                >
                    {room.name}{' '}
                    <span className="font-normal text-muted-foreground">
                        · {room.location} · up to {room.pax_capacity}
                    </span>
                </p>
                <p className="text-xs text-muted-foreground">
                    {room.blocked_reason ??
                        (cheapest
                            ? `${room.rates.length > 1 ? 'from ' : ''}${formatPeso(cheapest.price)} / ${cheapest.unit.toLowerCase()}`
                            : '')}
                </p>
                {!muted && room.inclusions.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">
                        Includes: {room.inclusions.join(', ')}
                    </p>
                )}
            </div>
            <RoomStatusBadge group={room.group} label={room.status_label} />
            {action}
        </li>
    );
}

NewReservation.layout = (props: Props) => ({
    breadcrumbs: [
        props.walkIn && !props.editing
            ? { title: 'Check-in', href: checkIn() }
            : { title: 'Reservations', href: reservationsIndex() },
        ...(props.editing
            ? [
                  {
                      title: `#${props.editing.id} ${props.editing.contact_name}`,
                      href: reservationsShow(props.editing.id),
                  },
                  {
                      title: 'Edit',
                      href: reservationsEdit(props.editing.id),
                  },
              ]
            : [
                  props.walkIn
                      ? {
                            title: 'Walk-in',
                            href: walkInPage(),
                        }
                      : {
                            title: 'New reservation',
                            href: reservationsCreate(),
                        },
              ]),
    ],
});
