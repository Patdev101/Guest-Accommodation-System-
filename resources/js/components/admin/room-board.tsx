import { Link } from '@inertiajs/react';
import {
    AlarmClock,
    CalendarClock,
    ChevronLeft,
    ChevronRight,
    Clock,
    Users,
    X,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { RoomStatusBadge } from '@/components/room-status-badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatShortWhen, plural } from '@/lib/format';
import { groupColor } from '@/lib/room-status';
import { cn } from '@/lib/utils';
import { index as roomsIndex, show as roomsShow } from '@/routes/admin/rooms';
import type { BoardRoomSummary } from '@/types';

export type BoardLocation = {
    id: number;
    name: string;
    rooms: BoardRoomSummary[];
};

const tileClass =
    'relative flex h-full flex-col gap-2 overflow-hidden rounded-lg border bg-card py-3 pr-3 pl-4';

const interactive =
    'transition hover:border-primary/40 hover:shadow-sm focus-within:ring-[3px] focus-within:ring-ring/50';

// The whole card is the click target; a button on the card sits above it.
const stretched =
    'flex flex-1 flex-col gap-2 text-left outline-none after:absolute after:inset-0';

const ALL = 'all';

/** Rooms shown at once; a bigger location continues on the next page. */
const PER_PAGE = 12;

/**
 * Rooms as cards, one location at a time, with filters (location, status,
 * number of guests) and Previous / Next, so the board stays short however many
 * rooms there are. For the Admin a card opens the room's setup page; reception
 * clicks a card to act on the room.
 */
export function RoomBoard<Room extends BoardRoomSummary = BoardRoomSummary>({
    locations,
    linkRooms = true,
    onRoomClick,
    roomLabel,
    roomAction,
    status: controlledStatus,
    onStatusChange,
}: {
    locations: (Omit<BoardLocation, 'rooms'> & { rooms: Room[] })[];
    linkRooms?: boolean;
    /** Without links, a card becomes a button calling this. */
    onRoomClick?: (room: Room) => void;
    /** The button's accessible name, e.g. "A-101, Occupied. Open". */
    roomLabel?: (room: Room) => string;
    /** A shortcut button at the bottom of a card, e.g. "Get room". */
    roomAction?: (room: Room) => ReactNode;
    /** The status filter (a status name), when the page also sets it. */
    status?: string | null;
    onStatusChange?: (status: string | null) => void;
}) {
    const [location, setLocation] = useState(ALL);
    const [ownStatus, setOwnStatus] = useState<string | null>(null);
    const [pax, setPax] = useState(ALL);
    const [page, setPage] = useState(1);

    const status =
        controlledStatus === undefined ? ownStatus : controlledStatus;
    const setStatus = (value: string | null) => {
        setOwnStatus(value);
        onStatusChange?.(value);
        setPage(1);
    };

    const everyRoom = locations.flatMap((item) => item.rooms);
    const statuses = [...new Set(everyRoom.map((room) => room.status_label))];
    const sizes = [...new Set(everyRoom.map((room) => room.pax_capacity))].sort(
        (a, b) => a - b,
    );
    const filtered = location !== ALL || status !== null || pax !== ALL;

    const matching = locations
        .filter((item) => location === ALL || String(item.id) === location)
        .map((item) => ({
            ...item,
            total: item.rooms.length,
            rooms: item.rooms.filter(
                (room) =>
                    (status === null || room.status_label === status) &&
                    (pax === ALL || room.pax_capacity >= Number(pax)),
            ),
        }))
        // A location without rooms is only worth showing when nothing is filtered.
        .filter((item) => item.rooms.length > 0 || !filtered);

    // One location per page; a big location is split into several pages.
    const pages = matching.flatMap((item) => {
        const parts = Math.max(1, Math.ceil(item.rooms.length / PER_PAGE));

        return Array.from({ length: parts }, (_, part) => ({
            ...item,
            part: part + 1,
            parts,
            shown: item.rooms.slice(part * PER_PAGE, (part + 1) * PER_PAGE),
        }));
    });
    const current = pages[Math.min(page, pages.length) - 1];
    const number = current ? pages.indexOf(current) + 1 : 1;
    const found = matching.reduce((sum, item) => sum + item.rooms.length, 0);

    const pageName = (item: (typeof pages)[number]) =>
        item.parts > 1
            ? `${item.name} (${item.part}/${item.parts})`
            : item.name;

    const clear = () => {
        setLocation(ALL);
        setPax(ALL);
        setStatus(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                {locations.length > 1 && (
                    <Select
                        value={location}
                        onValueChange={(value) => {
                            setLocation(value);
                            setPage(1);
                        }}
                    >
                        <SelectTrigger
                            className="w-full sm:w-52"
                            aria-label="Filter rooms by location"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>
                                All locations ({everyRoom.length})
                            </SelectItem>
                            {locations.map((item) => (
                                <SelectItem
                                    key={item.id}
                                    value={String(item.id)}
                                >
                                    {item.name} ({item.rooms.length})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                <Select
                    value={status ?? ALL}
                    onValueChange={(value) =>
                        setStatus(value === ALL ? null : value)
                    }
                >
                    <SelectTrigger
                        className="w-full sm:w-52"
                        aria-label="Filter rooms by status"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>All statuses</SelectItem>
                        {statuses.map((name) => (
                            <SelectItem key={name} value={name}>
                                {name} (
                                {
                                    everyRoom.filter(
                                        (room) => room.status_label === name,
                                    ).length
                                }
                                )
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={pax}
                    onValueChange={(value) => {
                        setPax(value);
                        setPage(1);
                    }}
                >
                    <SelectTrigger
                        className="w-full sm:w-56"
                        aria-label="Filter rooms by number of guests"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>
                            Any number of guests
                        </SelectItem>
                        {sizes.map((size) => (
                            <SelectItem key={size} value={String(size)}>
                                Good for {size} or more (
                                {
                                    everyRoom.filter(
                                        (room) => room.pax_capacity >= size,
                                    ).length
                                }
                                )
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {filtered && (
                    <Button type="button" variant="ghost" onClick={clear}>
                        <X />
                        Clear
                    </Button>
                )}
            </div>

            {!current ? (
                <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
                    No rooms match this filter.{' '}
                    <button
                        type="button"
                        onClick={clear}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                        Show all rooms
                    </button>
                </p>
            ) : (
                <section className="space-y-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-sm font-semibold">
                            {pageName(current)}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                            {filtered
                                ? `${plural(current.rooms.length, 'matching room')} here · ${found} of ${everyRoom.length} in all`
                                : `${plural(current.total, 'room')} · ${current.rooms.filter((room) => room.group === 'available').length} available`}
                        </span>
                    </div>

                    {current.shown.length === 0 ? (
                        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                            No rooms here yet.{' '}
                            {linkRooms && (
                                <Link
                                    href={roomsIndex({
                                        query: {
                                            create: 1,
                                            location: current.id,
                                        },
                                    })}
                                    className="font-medium text-foreground underline-offset-4 hover:underline"
                                >
                                    Add a room
                                </Link>
                            )}
                        </p>
                    ) : (
                        <ul className="grid grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] gap-3">
                            {current.shown.map((room) => {
                                const action = roomAction?.(room);

                                return (
                                    <li key={room.id}>
                                        <div
                                            className={cn(
                                                tileClass,
                                                (linkRooms || onRoomClick) &&
                                                    interactive,
                                            )}
                                        >
                                            {linkRooms ? (
                                                <Link
                                                    href={roomsShow(room.id)}
                                                    className={stretched}
                                                >
                                                    <Tile room={room} />
                                                </Link>
                                            ) : onRoomClick ? (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onRoomClick(room)
                                                    }
                                                    aria-label={roomLabel?.(
                                                        room,
                                                    )}
                                                    className={stretched}
                                                >
                                                    <Tile room={room} />
                                                </button>
                                            ) : (
                                                <Tile room={room} />
                                            )}
                                            {action && (
                                                <div className="relative z-10 flex justify-end">
                                                    {action}
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            )}

            {pages.length > 1 && current && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <span className="text-sm text-muted-foreground">
                        {pageName(current)} · page {number} of {pages.length}
                    </span>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={number === 1}
                            onClick={() => setPage(number - 1)}
                        >
                            <ChevronLeft />
                            {number === 1
                                ? 'Previous'
                                : pageName(pages[number - 2])}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={number === pages.length}
                            onClick={() => setPage(number + 1)}
                        >
                            {number === pages.length
                                ? 'Next'
                                : pageName(pages[number])}
                            <ChevronRight />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function Tile({ room }: { room: BoardRoomSummary }): ReactNode {
    const { stay, arrival } = room;

    return (
        <>
            <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1"
                style={{ backgroundColor: groupColor[room.group] }}
            />
            <span className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                <span className="truncate font-semibold">{room.name}</span>
                <RoomStatusBadge group={room.group} label={room.status_label} />
            </span>

            <span className="grid min-h-9 content-start text-sm">
                {stay ? (
                    <>
                        <span className="text-xs text-muted-foreground">
                            In the room
                        </span>
                        <span className="truncate font-medium">
                            {stay.guest}
                        </span>
                    </>
                ) : arrival ? (
                    <>
                        <span className="text-xs text-muted-foreground">
                            {arrival.late ? 'Not arrived yet' : 'Arriving'}
                        </span>
                        <span className="truncate font-medium">
                            {arrival.guest}
                        </span>
                    </>
                ) : (
                    <span className="text-muted-foreground">
                        {room.group === 'unavailable' ? 'Not in use' : 'Vacant'}
                    </span>
                )}
            </span>

            <span className="mt-auto flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
                <span className="flex shrink-0 items-center gap-1 tabular-nums">
                    <Users className="size-3.5" />
                    {stay
                        ? `${stay.pax}/${room.pax_capacity}`
                        : room.pax_capacity}{' '}
                    pax
                </span>
                {stay ? (
                    <Time
                        icon={stay.overdue ? AlarmClock : Clock}
                        urgent={stay.overdue}
                        label={
                            stay.overdue
                                ? `Late · was due ${formatShortWhen(stay.due_out_at)}`
                                : `Leaves ${formatShortWhen(stay.due_out_at)}`
                        }
                    />
                ) : (
                    arrival && (
                        <Time
                            icon={arrival.late ? AlarmClock : CalendarClock}
                            urgent={arrival.late}
                            label={
                                arrival.late
                                    ? `Late · was due ${formatShortWhen(arrival.starts_at)}`
                                    : `Arrives ${formatShortWhen(arrival.starts_at)}`
                            }
                        />
                    )
                )}
            </span>
        </>
    );
}

function Time({
    icon: Icon,
    label,
    urgent,
}: {
    icon: typeof Clock;
    label: string;
    urgent: boolean;
}) {
    return (
        <span
            className={cn(
                'flex min-w-0 items-center gap-1 font-medium whitespace-nowrap tabular-nums',
                urgent ? 'text-red-600 dark:text-red-400' : 'text-foreground',
            )}
        >
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
        </span>
    );
}
