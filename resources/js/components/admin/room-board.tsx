import { Link } from '@inertiajs/react';
import { AlarmClock, CalendarClock, Clock, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { RoomStatusBadge } from '@/components/room-status-badge';
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
    'w-full text-left transition outline-none hover:border-primary/40 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50';

/**
 * Every room as a card, grouped by location: status, who is in it and when
 * they leave (or who arrives next today). For the Admin a card opens the
 * room's setup page; reception clicks a card to act on the room.
 */
export function RoomBoard<Room extends BoardRoomSummary = BoardRoomSummary>({
    locations,
    linkRooms = true,
    onRoomClick,
    roomLabel,
}: {
    locations: (Omit<BoardLocation, 'rooms'> & { rooms: Room[] })[];
    linkRooms?: boolean;
    /** Without links, a card becomes a button calling this. */
    onRoomClick?: (room: Room) => void;
    /** The button's accessible name, e.g. "A-101, Occupied. Open". */
    roomLabel?: (room: Room) => string;
}) {
    return (
        <div className="space-y-6">
            {locations.map((location) => {
                const available = location.rooms.filter(
                    (room) => room.group === 'available',
                ).length;

                return (
                    <section key={location.id} className="space-y-2.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="text-sm font-semibold">
                                {location.name}
                            </h3>
                            <span className="text-xs text-muted-foreground">
                                {plural(location.rooms.length, 'room')} ·{' '}
                                {available} available
                            </span>
                        </div>

                        {location.rooms.length === 0 ? (
                            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                                No rooms here yet.{' '}
                                {linkRooms && (
                                    <Link
                                        href={roomsIndex({
                                            query: {
                                                create: 1,
                                                location: location.id,
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
                                {location.rooms.map((room) => (
                                    <li key={room.id}>
                                        {linkRooms ? (
                                            <Link
                                                href={roomsShow(room.id)}
                                                className={cn(
                                                    tileClass,
                                                    interactive,
                                                )}
                                            >
                                                <Tile room={room} />
                                            </Link>
                                        ) : onRoomClick ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onRoomClick(room)
                                                }
                                                aria-label={roomLabel?.(room)}
                                                className={cn(
                                                    tileClass,
                                                    interactive,
                                                )}
                                            >
                                                <Tile room={room} />
                                            </button>
                                        ) : (
                                            <div className={tileClass}>
                                                <Tile room={room} />
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                );
            })}
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
