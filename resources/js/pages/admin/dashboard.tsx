import { Head, Link, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    BedDouble,
    CheckCircle2,
    MapPin,
    Plus,
    Wrench,
} from 'lucide-react';
import { AvailabilityChart } from '@/components/admin/availability-chart';
import type {
    GroupCount,
    StatusCount,
} from '@/components/admin/availability-chart';
import { RoomBoard } from '@/components/admin/room-board';
import type { BoardLocation } from '@/components/admin/room-board';
import { SetupChecklist } from '@/components/admin/setup-checklist';
import type { Checklist } from '@/components/admin/setup-checklist';
import { StatTile } from '@/components/admin/stat-tile';
import { EmptyState } from '@/components/empty-state';
import { Page, PageHeader } from '@/components/page';
import { StatusDot } from '@/components/room-status-badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    formatDate,
    formatToday,
    greeting,
    percent,
    plural,
} from '@/lib/format';
import { dashboard } from '@/routes';
import { index as locationsIndex } from '@/routes/admin/locations';
import { index as roomsIndex, show as roomsShow } from '@/routes/admin/rooms';

type MaintenanceItem = {
    id: number;
    room_id: number;
    room: string;
    location: string;
    performed_on: string;
    issue: string;
    resolved: boolean;
};

type Props = {
    stats: { rooms: number; capacity: number; locations: number };
    groups: GroupCount[];
    breakdown: StatusCount[];
    board: BoardLocation[];
    checklist: Checklist;
    recentMaintenance: MaintenanceItem[];
};

export default function AdminDashboard({
    stats,
    groups,
    breakdown,
    board,
    checklist,
    recentMaintenance,
}: Props) {
    const { auth } = usePage().props;
    const firstName = auth.user.name.split(' ')[0];
    const count = (value: string) =>
        groups.find((group) => group.value === value)?.count ?? 0;

    return (
        <>
            <Head title="Dashboard" />
            <Page>
                <PageHeader
                    title={`${greeting()}, ${firstName}`}
                    description={`${formatToday()}. Here is how the rooms look right now.`}
                    actions={
                        <>
                            <Button variant="outline" asChild>
                                <Link
                                    href={locationsIndex({
                                        query: { create: 1 },
                                    })}
                                >
                                    <MapPin />
                                    Add location
                                </Link>
                            </Button>
                            {stats.locations > 0 && (
                                <Button asChild>
                                    <Link
                                        href={roomsIndex({
                                            query: { create: 1 },
                                        })}
                                    >
                                        <Plus />
                                        Add room
                                    </Link>
                                </Button>
                            )}
                        </>
                    }
                />

                <SetupChecklist checklist={checklist} />

                {stats.rooms === 0 ? (
                    <EmptyState
                        icon={BedDouble}
                        title="No rooms to show yet"
                        description={
                            stats.locations === 0
                                ? 'Start by adding a location such as Guest Villa or Barracks, then add its rooms.'
                                : 'Add the rooms at your locations. The room board and availability appear here once you do.'
                        }
                        action={
                            <Button asChild>
                                <Link
                                    href={
                                        stats.locations === 0
                                            ? locationsIndex({
                                                  query: { create: 1 },
                                              })
                                            : roomsIndex({
                                                  query: { create: 1 },
                                              })
                                    }
                                >
                                    <Plus />
                                    {stats.locations === 0
                                        ? 'Add location'
                                        : 'Add room'}
                                </Link>
                            </Button>
                        }
                    />
                ) : (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <StatTile
                                label="Rooms"
                                value={stats.rooms}
                                detail={`Across ${plural(stats.locations, 'location')}`}
                            />
                            <StatTile
                                label="Guest capacity"
                                value={`${stats.capacity} pax`}
                                detail="Total pax across all rooms"
                            />
                            <StatTile
                                label="Available now"
                                marker={<StatusDot group="available" />}
                                value={count('available')}
                                detail={`${percent(count('available'), stats.rooms)} of rooms are ready for a guest`}
                            />
                            <StatTile
                                label="Not bookable"
                                marker={<StatusDot group="unavailable" />}
                                value={count('unavailable')}
                                detail="Under maintenance or out of service"
                            />
                        </div>

                        <div className="grid gap-6 xl:grid-cols-3">
                            <div className="flex flex-col gap-6 xl:col-span-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Room availability</CardTitle>
                                        <CardDescription>
                                            All {plural(stats.rooms, 'room')} by
                                            status. Reservations are tracked
                                            separately, so an occupied room can
                                            still be booked for later.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <AvailabilityChart
                                            groups={groups}
                                            breakdown={breakdown}
                                        />
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Room board</CardTitle>
                                        <CardDescription>
                                            Every room at a glance. Open one to
                                            change its rates, inclusions or
                                            status.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <RoomBoard locations={board} />
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="flex flex-col gap-6">
                                {checklist.roomsWithoutRatesCount > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                                                Rooms without a price
                                            </CardTitle>
                                            <CardDescription>
                                                Guests cannot book these until
                                                they have a rate.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ul className="divide-y">
                                                {checklist.roomsWithoutRates.map(
                                                    (room) => (
                                                        <li
                                                            key={room.id}
                                                            className="flex items-center justify-between gap-3 py-2 first:pt-0"
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-medium">
                                                                    {room.name}
                                                                </p>
                                                                <p className="truncate text-xs text-muted-foreground">
                                                                    {
                                                                        room.location
                                                                    }
                                                                </p>
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={roomsShow(
                                                                        room.id,
                                                                    )}
                                                                >
                                                                    Set rates
                                                                </Link>
                                                            </Button>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                            {checklist.roomsWithoutRatesCount >
                                                checklist.roomsWithoutRates
                                                    .length && (
                                                <Link
                                                    href={roomsIndex({
                                                        query: {
                                                            missing: 'rates',
                                                        },
                                                    })}
                                                    className="mt-3 inline-block text-sm font-medium underline-offset-4 hover:underline"
                                                >
                                                    See all{' '}
                                                    {
                                                        checklist.roomsWithoutRatesCount
                                                    }
                                                </Link>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            Recent maintenance
                                        </CardTitle>
                                        <CardDescription>
                                            The latest issues logged on rooms.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {recentMaintenance.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                No maintenance recorded yet.
                                            </p>
                                        ) : (
                                            <ul className="space-y-4">
                                                {recentMaintenance.map(
                                                    (item) => (
                                                        <li
                                                            key={item.id}
                                                            className="flex gap-3"
                                                        >
                                                            {item.resolved ? (
                                                                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                                            ) : (
                                                                <Wrench className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                                            )}
                                                            <div className="min-w-0 space-y-0.5">
                                                                <Link
                                                                    href={roomsShow(
                                                                        item.room_id,
                                                                    )}
                                                                    className="text-sm font-medium underline-offset-4 hover:underline"
                                                                >
                                                                    {item.room}
                                                                </Link>
                                                                <p className="line-clamp-2 text-sm text-muted-foreground">
                                                                    {item.issue}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {
                                                                        item.location
                                                                    }{' '}
                                                                    ·{' '}
                                                                    {formatDate(
                                                                        item.performed_on,
                                                                    )}{' '}
                                                                    ·{' '}
                                                                    {item.resolved
                                                                        ? 'Resolved'
                                                                        : 'Open'}
                                                                </p>
                                                            </div>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </>
                )}
            </Page>
        </>
    );
}

AdminDashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
