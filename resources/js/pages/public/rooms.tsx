import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    BedDouble,
    CheckCircle2,
    ClipboardList,
    Clock,
    MapPin,
    Search,
    Users,
    X,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { FormField } from '@/components/form-field';
import { ContactLine, HouseRules } from '@/components/public/house-rules';
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
import { formatClock, formatDate, formatPeso, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { index as roomsIndex, show as roomsShow } from '@/routes/rooms';
import type { User } from '@/types';

type RoomCard = {
    id: number;
    name: string;
    location_id: number;
    location: string;
    pax_capacity: number;
    cover_url: string | null;
    description: string | null;
    inclusions: string[];
    from_price: string;
    from_unit: string;
    /** Free for the chosen dates; null until dates are chosen. */
    free: boolean | null;
};

type Filters = {
    location: number | null;
    from: string | null;
    to: string | null;
    guests: number | null;
};

type Props = {
    rooms: RoomCard[];
    filters: Filters;
    locations: { id: number; name: string }[];
    today: string;
    standardTimes: { check_in: string; check_out: string };
};

const ALL = 'all';

type Sort = 'location' | 'price_low' | 'price_high' | 'guests';

const steps = [
    {
        icon: Search,
        title: 'Browse the rooms',
        text: 'See the photos, what is included and the price. No account needed.',
    },
    {
        icon: ClipboardList,
        title: 'Send a booking request',
        text: 'Choose your dates and tell us who is coming.',
    },
    {
        icon: CheckCircle2,
        title: 'We confirm it',
        text: 'Our front desk checks every request and confirms your room.',
    },
];

export default function Rooms({
    rooms,
    filters,
    locations,
    today,
    standardTimes,
}: Props) {
    // A signed-in guest gets the rooms only; visitors (and staff looking in) get the welcome page.
    const guest = (usePage().props.auth.user as User | null)?.role === 'guest';
    const [sort, setSort] = useState<Sort>('location');
    const [place, setPlace] = useState<string | null>(null);
    const [form, setForm] = useState({
        location: filters.location ? String(filters.location) : ALL,
        from: filters.from ?? '',
        to: filters.to ?? '',
        guests: filters.guests ? String(filters.guests) : '',
    });

    const searched =
        filters.location !== null ||
        filters.from !== null ||
        filters.guests !== null;
    const dated = filters.from !== null && filters.to !== null;

    const search = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            `${roomsIndex().url}#rooms`,
            {
                location: form.location === ALL ? undefined : form.location,
                from: form.from && form.to ? form.from : undefined,
                to: form.from && form.to ? form.to : undefined,
                guests: form.guests || undefined,
            },
            { preserveScroll: true },
        );
    };

    const inLocation = rooms.filter(
        (room) =>
            filters.location === null || room.location_id === filters.location,
    );
    const bigEnough = inLocation.filter(
        (room) =>
            filters.guests === null || room.pax_capacity >= filters.guests,
    );
    // A big group can take several rooms, so no single room fitting is not a dead end.
    const groupTooBig = filters.guests !== null && bigEnough.length === 0;
    const order: Record<Sort, (a: RoomCard, b: RoomCard) => number> = {
        location: () => 0,
        price_low: (a, b) => Number(a.from_price) - Number(b.from_price),
        price_high: (a, b) => Number(b.from_price) - Number(a.from_price),
        guests: (a, b) => b.pax_capacity - a.pax_capacity,
    };
    // Free rooms always come first; within that, the order the guest chose.
    const shown = [...(groupTooBig ? inLocation : bigEnough)].sort(
        (a, b) =>
            Number(b.free ?? true) - Number(a.free ?? true) ||
            order[sort](a, b),
    );
    const freeCount = shown.filter((room) => room.free).length;

    // With dates or a chosen order, one list; otherwise rooms sit under their location.
    const sections =
        dated || sort !== 'location'
            ? [{ name: null as string | null, rooms: shown }]
            : locations
                  .map((location) => ({
                      name: location.name as string | null,
                      rooms: shown.filter(
                          (room) => room.location_id === location.id,
                      ),
                  }))
                  .filter((section) => section.rooms.length > 0);

    // A guest can narrow the page to one location with the buttons above the rooms.
    const visible = sections.filter(
        (section) =>
            place === null || section.name === null || section.name === place,
    );

    // The search travels with the visitor to the room page.
    const roomQuery = {
        from: filters.from ?? undefined,
        to: filters.to ?? undefined,
        guests: filters.guests ?? undefined,
    };

    return (
        <>
            <Head title="Rooms" />

            {guest ? (
                // A signed-in guest came to pick a room: no welcome banner, just the rooms.
                <section className="border-b bg-muted/50">
                    <div className="mx-auto flex w-full max-w-6xl flex-wrap items-end justify-between gap-4 px-4 pt-8 pb-24">
                        <div>
                            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                                Find a room
                            </p>
                            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                                Where would you like to stay?
                            </h1>
                            <p className="mt-2 max-w-2xl text-muted-foreground">
                                Choose your dates to see which rooms are free,
                                then send a request. Our front desk confirms it.
                            </p>
                        </div>
                        <ul className="flex flex-wrap gap-2 text-sm">
                            <li className="inline-flex items-center gap-2 rounded-full border bg-background px-3.5 py-1.5">
                                <BedDouble className="size-4 text-primary" />
                                {plural(rooms.length, 'room')}
                            </li>
                            <li className="inline-flex items-center gap-2 rounded-full border bg-background px-3.5 py-1.5">
                                <Clock className="size-4 text-primary" />
                                In {formatClock(standardTimes.check_in)}, out{' '}
                                {formatClock(standardTimes.check_out)}
                            </li>
                        </ul>
                    </div>
                </section>
            ) : (
                <section className="relative bg-gradient-to-br from-[#16294f] via-[#1f3c73] to-[#0e7c8c] text-white">
                    {/* Soft light in the corner, so the band is not a flat colour. */}
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_85%_-10%,rgba(255,255,255,0.18),transparent)]"
                    />
                    <div className="relative mx-auto w-full max-w-6xl px-4 pt-12 pb-28 md:pt-16 md:pb-32">
                        <p className="text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">
                            Mindoro Marine · Guest accommodation
                        </p>
                        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
                            A comfortable room, ready when you arrive
                        </h1>
                        <p className="mt-4 max-w-xl text-base text-white/80 md:text-lg">
                            Browse our rooms, check your dates and see the
                            prices before you book.
                        </p>
                        <ul className="mt-6 flex flex-wrap gap-2 text-sm">
                            <Fact icon={BedDouble}>
                                {plural(rooms.length, 'room')}
                            </Fact>
                            <Fact icon={MapPin}>
                                {plural(locations.length, 'location')}
                            </Fact>
                            <Fact icon={Clock}>
                                Check-in {formatClock(standardTimes.check_in)} ·
                                check-out {formatClock(standardTimes.check_out)}
                            </Fact>
                        </ul>
                    </div>
                </section>
            )}

            <div className="relative z-10 mx-auto -mt-16 w-full max-w-6xl px-4">
                <form
                    onSubmit={search}
                    className="grid gap-4 rounded-2xl border bg-card p-5 shadow-lg sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_0.8fr_auto] lg:items-end"
                >
                    <FormField label="Location" htmlFor="search_location">
                        <Select
                            value={form.location}
                            onValueChange={(location) =>
                                setForm({ ...form, location })
                            }
                        >
                            <SelectTrigger
                                id="search_location"
                                className="w-full"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>
                                    All locations
                                </SelectItem>
                                {locations.map((location) => (
                                    <SelectItem
                                        key={location.id}
                                        value={String(location.id)}
                                    >
                                        {location.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>
                    <FormField label="Arrival" htmlFor="search_from">
                        <Input
                            id="search_from"
                            type="date"
                            min={today}
                            value={form.from}
                            required={form.to !== ''}
                            onChange={(event) =>
                                setForm({ ...form, from: event.target.value })
                            }
                        />
                    </FormField>
                    <FormField label="Departure" htmlFor="search_to">
                        <Input
                            id="search_to"
                            type="date"
                            min={form.from || today}
                            value={form.to}
                            required={form.from !== ''}
                            onChange={(event) =>
                                setForm({ ...form, to: event.target.value })
                            }
                        />
                    </FormField>
                    <FormField label="Guests" htmlFor="search_guests">
                        <Input
                            id="search_guests"
                            type="number"
                            min={1}
                            max={1000}
                            placeholder="Any"
                            value={form.guests}
                            onChange={(event) =>
                                setForm({ ...form, guests: event.target.value })
                            }
                        />
                    </FormField>
                    <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
                        <Button type="submit" size="lg" className="flex-1">
                            <Search />
                            Search
                        </Button>
                        {searched && (
                            <Button variant="ghost" size="lg" asChild>
                                <Link href={roomsIndex()}>
                                    <X />
                                    Clear
                                </Link>
                            </Button>
                        )}
                    </div>
                </form>
            </div>

            <section
                id="rooms"
                className="mx-auto w-full max-w-6xl flex-1 scroll-mt-20 px-4 pt-10 pb-12"
            >
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            {searched ? 'Rooms that match' : 'Our rooms'}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {dated
                                ? `${freeCount} of ${plural(shown.length, 'room')} free from ${formatDate(filters.from ?? '')} to ${formatDate(filters.to ?? '')}. Free rooms are shown first.`
                                : 'Choose your dates above to see which rooms are free.'}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {!dated && (
                            <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                                {plural(shown.length, 'room')}
                            </span>
                        )}
                        {guest && shown.length > 1 && (
                            <Select
                                value={sort}
                                onValueChange={(value) =>
                                    setSort(value as Sort)
                                }
                            >
                                <SelectTrigger
                                    className="w-52"
                                    aria-label="Sort rooms"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="location">
                                        By location
                                    </SelectItem>
                                    <SelectItem value="price_low">
                                        Price: lowest first
                                    </SelectItem>
                                    <SelectItem value="price_high">
                                        Price: highest first
                                    </SelectItem>
                                    <SelectItem value="guests">
                                        Most guests first
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>

                {guest &&
                    !dated &&
                    sort === 'location' &&
                    sections.length > 1 && (
                        <div
                            role="group"
                            aria-label="Jump to a location"
                            className="mt-5 flex flex-wrap gap-2"
                        >
                            <Button
                                size="sm"
                                variant={place === null ? 'default' : 'outline'}
                                className="rounded-full"
                                aria-pressed={place === null}
                                onClick={() => setPlace(null)}
                            >
                                All locations
                            </Button>
                            {sections.map((section) => (
                                <Button
                                    key={section.name}
                                    size="sm"
                                    variant={
                                        place === section.name
                                            ? 'default'
                                            : 'outline'
                                    }
                                    className="rounded-full"
                                    aria-pressed={place === section.name}
                                    onClick={() => setPlace(section.name)}
                                >
                                    {section.name} ({section.rooms.length})
                                </Button>
                            ))}
                        </div>
                    )}

                {groupTooBig && inLocation.length > 0 && (
                    <p
                        role="status"
                        className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40"
                    >
                        No single room takes {filters.guests} guests. A group
                        can book several rooms together, so all rooms are shown.
                    </p>
                )}

                {shown.length === 0 ? (
                    <div className="mt-8 rounded-2xl border border-dashed px-4 py-16 text-center">
                        <BedDouble className="mx-auto size-8 text-muted-foreground" />
                        <p className="mt-3 font-medium">
                            {searched
                                ? 'No rooms match your search'
                                : 'No rooms are offered yet'}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {searched
                                ? 'Try another location or fewer guests.'
                                : 'Please check again soon.'}
                        </p>
                        {searched && (
                            <Button variant="outline" asChild className="mt-4">
                                <Link href={roomsIndex()}>Show all rooms</Link>
                            </Button>
                        )}
                    </div>
                ) : (
                    visible.map((section) => (
                        <div key={section.name ?? 'all'} className="mt-8">
                            {section.name && (
                                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                                    <MapPin className="size-4" />
                                    {section.name}
                                    <span className="h-px flex-1 bg-border" />
                                    <span className="font-normal normal-case">
                                        {plural(section.rooms.length, 'room')}
                                    </span>
                                </h3>
                            )}
                            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {section.rooms.map((room) => (
                                    <li key={room.id}>
                                        <Link
                                            href={roomsShow(room.id, {
                                                query: roomQuery,
                                            })}
                                            className={cn(
                                                'group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition duration-200 outline-none hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-[3px] focus-visible:ring-ring/50',
                                                room.free === false &&
                                                    'opacity-70 hover:opacity-100',
                                            )}
                                        >
                                            <div className="relative">
                                                <RoomPhoto
                                                    url={room.cover_url}
                                                    alt={`Photo of ${room.name}`}
                                                    className="aspect-[4/3]"
                                                    imageClassName="transition duration-300 group-hover:scale-105"
                                                />
                                                <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                                                    <MapPin className="size-3" />
                                                    {room.location}
                                                </span>
                                                {room.free !== null && (
                                                    <span
                                                        className={cn(
                                                            'absolute top-3 left-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm',
                                                            room.free
                                                                ? 'bg-emerald-600 text-white'
                                                                : 'bg-white text-slate-700',
                                                        )}
                                                    >
                                                        {room.free && (
                                                            <CheckCircle2 className="size-3.5" />
                                                        )}
                                                        {room.free
                                                            ? 'Free for your dates'
                                                            : 'Taken on your dates'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-1 flex-col gap-3 p-5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <h4 className="text-lg leading-tight font-semibold">
                                                        {room.name}
                                                    </h4>
                                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                                        <Users className="size-3.5" />
                                                        Up to{' '}
                                                        {room.pax_capacity}
                                                    </span>
                                                </div>
                                                {room.inclusions.length > 0 && (
                                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                                        {room.inclusions.join(
                                                            ' · ',
                                                        )}
                                                    </p>
                                                )}
                                                <div className="mt-auto flex items-end justify-between gap-3 border-t pt-4">
                                                    <p className="text-sm text-muted-foreground">
                                                        From
                                                        <span className="block text-xl leading-tight font-semibold text-foreground">
                                                            {formatPeso(
                                                                room.from_price,
                                                            )}
                                                            <span className="text-sm font-normal text-muted-foreground">
                                                                {' '}
                                                                /{' '}
                                                                {room.from_unit.toLowerCase()}
                                                            </span>
                                                        </span>
                                                    </p>
                                                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                                                        {guest
                                                            ? 'View and request'
                                                            : 'View room'}
                                                        <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))
                )}
            </section>

            {!guest && (
                <section className="border-t bg-muted/40">
                    <div className="mx-auto w-full max-w-6xl px-4 py-12">
                        <h2 className="text-center text-2xl font-semibold tracking-tight">
                            How booking works
                        </h2>
                        <p className="mt-1 text-center text-sm text-muted-foreground">
                            Three steps, and our front desk takes care of the
                            rest.
                        </p>
                        <ol className="mt-8 grid gap-5 md:grid-cols-3">
                            {steps.map((step, index) => (
                                <li
                                    key={step.title}
                                    className="relative rounded-2xl border bg-card p-6 text-center shadow-xs"
                                >
                                    <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                        <step.icon className="size-5" />
                                    </span>
                                    <p className="mt-4 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                        Step {index + 1}
                                    </p>
                                    <p className="mt-1 text-lg font-semibold">
                                        {step.title}
                                    </p>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        {step.text}
                                    </p>
                                </li>
                            ))}
                        </ol>

                        <h2 className="mt-12 text-center text-2xl font-semibold tracking-tight">
                            Good to know before you book
                        </h2>
                        <HouseRules className="mt-6" />
                        <ContactLine className="mt-6 text-center" />
                    </div>
                </section>
            )}
        </>
    );
}

/** One short fact in the banner. */
function Fact({
    icon: Icon,
    children,
}: {
    icon: typeof BedDouble;
    children: ReactNode;
}) {
    return (
        <li className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 ring-1 ring-white/20 backdrop-blur-sm">
            <Icon className="size-4" />
            {children}
        </li>
    );
}
