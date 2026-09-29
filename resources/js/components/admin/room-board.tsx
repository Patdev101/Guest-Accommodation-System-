import { Link } from '@inertiajs/react';
import { Users } from 'lucide-react';
import { StatusDot } from '@/components/room-status-badge';
import { plural } from '@/lib/format';
import { groupColor } from '@/lib/room-status';
import { index as roomsIndex, show as roomsShow } from '@/routes/admin/rooms';
import type { RoomSummary } from '@/types';

export type BoardLocation = {
    id: number;
    name: string;
    rooms: RoomSummary[];
};

/** Every room as a tile, grouped by location. Opens the room on click. */
export function RoomBoard({ locations }: { locations: BoardLocation[] }) {
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
                            </p>
                        ) : (
                            <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
                                {location.rooms.map((room) => (
                                    <li key={room.id}>
                                        <Link
                                            href={roomsShow(room.id)}
                                            className="relative flex h-full flex-col gap-1 overflow-hidden rounded-lg border bg-card py-2.5 pr-3 pl-4 transition outline-none hover:border-primary/40 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                        >
                                            <span
                                                aria-hidden
                                                className="absolute inset-y-0 left-0 w-1"
                                                style={{
                                                    backgroundColor:
                                                        groupColor[room.group],
                                                }}
                                            />
                                            <span className="truncate text-sm font-medium">
                                                {room.name}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-xs">
                                                <StatusDot group={room.group} />
                                                {room.status_label}
                                            </span>
                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Users className="size-3" />
                                                {room.pax_capacity} pax
                                            </span>
                                        </Link>
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
