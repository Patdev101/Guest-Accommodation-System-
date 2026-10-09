import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Hourglass,
    MapPin,
    Plus,
    Send,
    Trash2,
    Users,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { IconButton } from '@/components/icon-button';
import { HouseRules } from '@/components/public/house-rules';
import { RoomPhoto } from '@/components/public/room-photo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatClock, formatPeso, plural } from '@/lib/format';
import { suggestPrice } from '@/lib/pricing';
import { create, store } from '@/routes/guest/requests';
import { show as roomsShow } from '@/routes/rooms';

type Rate = { id: number; name: string; unit: string; price: string };

type RoomOption = {
    id: number;
    name: string;
    location: string;
    pax_capacity: number;
    cover_url: string | null;
    rates: Rate[];
    /** Free for the chosen dates; null until dates are chosen. */
    free: boolean | null;
};

type Line = { room_id: number; room_rate_id: number; pax: number };

type Props = {
    /** The room the guest started from. */
    roomId: number;
    rooms: RoomOption[];
    defaults: {
        from: string | null;
        to: string | null;
        guests: number;
        contact_name: string;
        contact_number: string | null;
        company: string | null;
    };
    guestTypes: { value: string; label: string }[];
    today: string;
    standardTimes: { check_in: string; check_out: string };
    pending: number;
    maxPending: number;
    holdHours: number;
};

export default function Book({
    roomId,
    rooms,
    defaults,
    guestTypes,
    today,
    standardTimes,
    pending,
    maxPending,
    holdHours,
}: Props) {
    const first = rooms.find((room) => room.id === roomId) ?? rooms[0];

    const form = useForm({
        from: defaults.from ?? '',
        to: defaults.to ?? '',
        rooms: [
            {
                room_id: first.id,
                room_rate_id: first.rates[0].id,
                pax: Math.min(first.pax_capacity, defaults.guests),
            },
        ] as Line[],
        contact_name: defaults.contact_name,
        contact_number: defaults.contact_number ?? '',
        company: defaults.company ?? '',
        purpose: '',
        guest_type: guestTypes[0]?.value ?? 'visitor',
        message: '',
    });
    const { data } = form;
    const errors = form.errors as Record<string, string | undefined>;

    const dated = data.from !== '' && data.to !== '' && data.to > data.from;
    const roomById = (id: number) => rooms.find((room) => room.id === id);
    const chosen = new Set(data.rooms.map((line) => line.room_id));
    const guests = data.rooms.reduce((sum, line) => sum + line.pax, 0);
    // Rooms the group can still add: not chosen yet, and free when dates are known.
    const others = rooms.filter(
        (room) => !chosen.has(room.id) && room.free !== false,
    );
    const taken = data.rooms.filter(
        (line) => roomById(line.room_id)?.free === false,
    );

    // The same sum the server uses; the server's figure is the one that counts.
    const priceOf = (line: Line) => {
        const rate = roomById(line.room_id)?.rates.find(
            (item) => item.id === line.room_rate_id,
        );

        return rate && dated
            ? suggestPrice(
                  rate.price,
                  rate.unit,
                  `${data.from}T${standardTimes.check_in}`,
                  `${data.to}T${standardTimes.check_out}`,
              )
            : null;
    };
    const total = data.rooms.reduce(
        (sum, line) => sum + (priceOf(line)?.total ?? 0),
        0,
    );
    const full = pending >= maxPending;

    // New dates: ask again which rooms are free, keeping what was typed.
    const changeDates = (from: string, to: string) => {
        form.setData({ ...data, from, to });

        if (from !== '' && to !== '' && to > from) {
            router.get(
                create(roomId).url,
                { from, to },
                {
                    only: ['rooms'],
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                },
            );
        }
    };

    const setLine = (index: number, patch: Partial<Line>) =>
        form.setData(
            'rooms',
            data.rooms.map((line, i) =>
                i === index ? { ...line, ...patch } : line,
            ),
        );

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(store(roomId).url, { preserveScroll: true });
    };

    return (
        <>
            <Head title="Request to book" />
            <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">
                <Link
                    href={roomsShow(roomId, {
                        query: {
                            from: data.from || undefined,
                            to: data.to || undefined,
                        },
                    })}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                    <ArrowLeft className="size-4" />
                    Back to {first.name}
                </Link>

                <h1 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
                    Request to book
                </h1>
                <p className="mt-1 max-w-2xl text-muted-foreground">
                    Tell us when you are coming and who for. Our front desk
                    checks every request and confirms it; nothing is charged
                    online.
                </p>

                {full && (
                    <p
                        role="alert"
                        className="mt-5 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40"
                    >
                        <Hourglass className="mt-0.5 size-4 shrink-0" />
                        You already have {plural(pending, 'request')} waiting
                        for our answer, which is the most allowed at one time.
                        Please wait for a reply, or cancel one under My
                        bookings.
                    </p>
                )}

                <form
                    onSubmit={submit}
                    className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]"
                >
                    <div className="min-w-0 space-y-6">
                        <fieldset className="space-y-4 rounded-2xl border bg-card p-6 shadow-xs">
                            <legend className="px-1 text-lg font-semibold">
                                Your stay
                            </legend>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                    label="Arrival"
                                    htmlFor="book_from"
                                    error={errors.from}
                                    hint={`Check-in from ${formatClock(standardTimes.check_in)}.`}
                                >
                                    <Input
                                        id="book_from"
                                        type="date"
                                        min={today}
                                        value={data.from}
                                        onChange={(event) =>
                                            changeDates(
                                                event.target.value,
                                                data.to,
                                            )
                                        }
                                        required
                                    />
                                </FormField>
                                <FormField
                                    label="Departure"
                                    htmlFor="book_to"
                                    error={errors.to}
                                    hint={`Check-out by ${formatClock(standardTimes.check_out)}.`}
                                >
                                    <Input
                                        id="book_to"
                                        type="date"
                                        min={data.from || today}
                                        value={data.to}
                                        onChange={(event) =>
                                            changeDates(
                                                data.from,
                                                event.target.value,
                                            )
                                        }
                                        required
                                    />
                                </FormField>
                            </div>
                        </fieldset>

                        <fieldset className="space-y-4 rounded-2xl border bg-card p-6 shadow-xs">
                            <legend className="px-1 text-lg font-semibold">
                                {data.rooms.length === 1 ? 'Room' : 'Rooms'}
                            </legend>
                            <p className="text-sm text-muted-foreground">
                                Say how many guests go in each room. A bigger
                                group can add more rooms to the same request.
                            </p>

                            {defaults.guests > guests && (
                                <p
                                    role="status"
                                    className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/40"
                                >
                                    You searched for {defaults.guests} guests;
                                    the {plural(data.rooms.length, 'room')}{' '}
                                    below{' '}
                                    {data.rooms.length === 1 ? 'takes' : 'take'}{' '}
                                    {guests}. Add another room for the other{' '}
                                    {defaults.guests - guests}.
                                </p>
                            )}

                            {errors.rooms && (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {errors.rooms}
                                </p>
                            )}

                            <ul className="space-y-3">
                                {data.rooms.map((line, index) => {
                                    const room = roomById(line.room_id);

                                    if (!room) {
                                        return null;
                                    }

                                    const price = priceOf(line);

                                    return (
                                        <li
                                            key={line.room_id}
                                            className="rounded-xl border p-4"
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold">
                                                        {room.name}
                                                    </p>
                                                    <p className="mt-0.5 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <MapPin className="size-3.5" />
                                                            {room.location}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <Users className="size-3.5" />
                                                            Up to{' '}
                                                            {room.pax_capacity}
                                                        </span>
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold tabular-nums">
                                                        {price
                                                            ? formatPeso(
                                                                  price.total,
                                                              )
                                                            : ''}
                                                    </span>
                                                    {data.rooms.length > 1 && (
                                                        <IconButton
                                                            label={`Remove ${room.name}`}
                                                            className="text-muted-foreground hover:text-destructive"
                                                            onClick={() =>
                                                                form.setData(
                                                                    'rooms',
                                                                    data.rooms.filter(
                                                                        (
                                                                            _,
                                                                            i,
                                                                        ) =>
                                                                            i !==
                                                                            index,
                                                                    ),
                                                                )
                                                            }
                                                        >
                                                            <Trash2 />
                                                        </IconButton>
                                                    )}
                                                </div>
                                            </div>

                                            {room.free === false && (
                                                <p
                                                    role="alert"
                                                    className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/40"
                                                >
                                                    {room.name} is not free for
                                                    these dates. Choose other
                                                    dates
                                                    {data.rooms.length > 1
                                                        ? ', or remove this room.'
                                                        : ' or another room.'}
                                                </p>
                                            )}

                                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                                <FormField
                                                    label="Guests in this room"
                                                    htmlFor={`book_pax_${room.id}`}
                                                    error={
                                                        errors[
                                                            `rooms.${index}.pax`
                                                        ]
                                                    }
                                                >
                                                    <Input
                                                        id={`book_pax_${room.id}`}
                                                        type="number"
                                                        min={1}
                                                        max={room.pax_capacity}
                                                        value={
                                                            line.pax === 0
                                                                ? ''
                                                                : line.pax
                                                        }
                                                        onChange={(event) =>
                                                            setLine(index, {
                                                                pax: Number(
                                                                    event.target
                                                                        .value,
                                                                ),
                                                            })
                                                        }
                                                        required
                                                    />
                                                </FormField>
                                                <FormField
                                                    label="Price"
                                                    htmlFor={`book_rate_${room.id}`}
                                                    error={
                                                        errors[
                                                            `rooms.${index}.room_rate_id`
                                                        ]
                                                    }
                                                >
                                                    <Select
                                                        value={String(
                                                            line.room_rate_id,
                                                        )}
                                                        onValueChange={(
                                                            value,
                                                        ) =>
                                                            setLine(index, {
                                                                room_rate_id:
                                                                    Number(
                                                                        value,
                                                                    ),
                                                            })
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id={`book_rate_${room.id}`}
                                                            className="w-full"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {room.rates.map(
                                                                (item) => (
                                                                    <SelectItem
                                                                        key={
                                                                            item.id
                                                                        }
                                                                        value={String(
                                                                            item.id,
                                                                        )}
                                                                    >
                                                                        {
                                                                            item.name
                                                                        }{' '}
                                                                        ·{' '}
                                                                        {formatPeso(
                                                                            item.price,
                                                                        )}{' '}
                                                                        /{' '}
                                                                        {item.unit.toLowerCase()}
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </FormField>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>

                            {others.length > 0 && data.rooms.length < 10 && (
                                <div className="space-y-2 border-t pt-4">
                                    <p className="text-sm font-medium">
                                        Need more space? Add another room
                                        {dated
                                            ? ' that is free for your dates'
                                            : ''}
                                        .
                                    </p>
                                    <ul className="grid gap-2 sm:grid-cols-2">
                                        {others.map((room) => (
                                            <li key={room.id}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        form.setData('rooms', [
                                                            ...data.rooms,
                                                            {
                                                                room_id:
                                                                    room.id,
                                                                room_rate_id:
                                                                    room
                                                                        .rates[0]
                                                                        .id,
                                                                pax: 1,
                                                            },
                                                        ])
                                                    }
                                                    className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                                >
                                                    <span className="min-w-0">
                                                        <span className="block truncate font-medium">
                                                            {room.name}
                                                        </span>
                                                        <span className="block truncate text-xs text-muted-foreground">
                                                            {room.location} · up
                                                            to{' '}
                                                            {room.pax_capacity}{' '}
                                                            · from{' '}
                                                            {formatPeso(
                                                                room.rates[0]
                                                                    .price,
                                                            )}
                                                        </span>
                                                    </span>
                                                    <Plus className="size-4 shrink-0" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </fieldset>

                        <fieldset className="space-y-4 rounded-2xl border bg-card p-6 shadow-xs">
                            <legend className="px-1 text-lg font-semibold">
                                Who is coming
                            </legend>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                    label="Contact person"
                                    htmlFor="book_name"
                                    error={errors.contact_name}
                                >
                                    <Input
                                        id="book_name"
                                        value={data.contact_name}
                                        onChange={(event) =>
                                            form.setData(
                                                'contact_name',
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="name"
                                        required
                                    />
                                </FormField>
                                <FormField
                                    label="Contact number"
                                    htmlFor="book_number"
                                    error={errors.contact_number}
                                    hint="We call this number before your check-out."
                                >
                                    <Input
                                        id="book_number"
                                        type="tel"
                                        value={data.contact_number}
                                        onChange={(event) =>
                                            form.setData(
                                                'contact_number',
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="tel"
                                        placeholder="09XX XXX XXXX"
                                        required
                                    />
                                </FormField>
                                <FormField
                                    label="Company"
                                    htmlFor="book_company"
                                    error={errors.company}
                                    hint="Filled in from your last request. Change it here if you now book for another company."
                                >
                                    <Input
                                        id="book_company"
                                        value={data.company}
                                        onChange={(event) =>
                                            form.setData(
                                                'company',
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="organization"
                                        required
                                    />
                                </FormField>
                                <FormField
                                    label="You are a"
                                    htmlFor="book_type"
                                    error={errors.guest_type}
                                >
                                    <Select
                                        value={data.guest_type}
                                        onValueChange={(value) =>
                                            form.setData('guest_type', value)
                                        }
                                    >
                                        <SelectTrigger
                                            id="book_type"
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
                            </div>
                            <FormField
                                label="Purpose of the stay"
                                htmlFor="book_purpose"
                                error={errors.purpose}
                                optional
                            >
                                <Input
                                    id="book_purpose"
                                    value={data.purpose}
                                    onChange={(event) =>
                                        form.setData(
                                            'purpose',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="For example: vessel repair, site visit"
                                />
                            </FormField>
                            <FormField
                                label="Message to the front desk"
                                htmlFor="book_message"
                                error={errors.message}
                                optional
                            >
                                <Textarea
                                    id="book_message"
                                    rows={3}
                                    maxLength={1000}
                                    value={data.message}
                                    onChange={(event) =>
                                        form.setData(
                                            'message',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="Anything we should know, such as a late arrival"
                                />
                            </FormField>
                        </fieldset>

                        <section className="rounded-2xl border bg-muted/40 p-6">
                            <h2 className="mb-4 text-lg font-semibold">
                                Before you send it
                            </h2>
                            <HouseRules compact />
                        </section>
                    </div>

                    <aside className="lg:sticky lg:top-24 lg:self-start">
                        <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
                            <RoomPhoto
                                url={first.cover_url}
                                alt={`Photo of ${first.name}`}
                                className="aspect-[16/9]"
                            />
                            <div className="space-y-4 p-6">
                                <h2 className="text-lg font-semibold">
                                    Your request
                                </h2>
                                <dl className="space-y-2 text-sm">
                                    {data.rooms.map((line) => {
                                        const price = priceOf(line);

                                        return (
                                            <div
                                                key={line.room_id}
                                                className="flex justify-between gap-3"
                                            >
                                                <dt className="min-w-0">
                                                    <span className="block truncate font-medium">
                                                        {
                                                            roomById(
                                                                line.room_id,
                                                            )?.name
                                                        }
                                                    </span>
                                                    <span className="block text-xs text-muted-foreground">
                                                        {plural(
                                                            line.pax,
                                                            'guest',
                                                        )}
                                                        {price &&
                                                            ` · ${plural(price.quantity, price.unitLabel)}`}
                                                    </span>
                                                </dt>
                                                <dd className="tabular-nums">
                                                    {price
                                                        ? formatPeso(
                                                              price.total,
                                                          )
                                                        : ''}
                                                </dd>
                                            </div>
                                        );
                                    })}
                                    <div className="flex justify-between gap-3 border-t pt-3">
                                        <dt className="text-muted-foreground">
                                            Guests
                                        </dt>
                                        <dd className="tabular-nums">
                                            {guests}
                                        </dd>
                                    </div>
                                    <div className="flex items-baseline justify-between gap-3">
                                        <dt className="font-semibold">Total</dt>
                                        <dd className="text-2xl font-semibold tabular-nums">
                                            {dated
                                                ? formatPeso(total)
                                                : 'Choose dates'}
                                        </dd>
                                    </div>
                                </dl>

                                <Button
                                    type="submit"
                                    size="lg"
                                    className="w-full"
                                    disabled={
                                        form.processing ||
                                        full ||
                                        taken.length > 0
                                    }
                                >
                                    {form.processing ? <Spinner /> : <Send />}
                                    Send request
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    {plural(data.rooms.length, 'room')}{' '}
                                    {data.rooms.length === 1 ? 'is' : 'are'}{' '}
                                    held for you for up to{' '}
                                    {plural(holdHours, 'hour')} while we answer.
                                    You pay at the front desk, not online.
                                </p>
                            </div>
                        </div>
                    </aside>
                </form>
            </div>
        </>
    );
}
