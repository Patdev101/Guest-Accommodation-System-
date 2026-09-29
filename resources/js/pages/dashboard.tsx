import { Head, usePage } from '@inertiajs/react';
import { StatTile } from '@/components/admin/stat-tile';
import { RoomStatusBadge } from '@/components/room-status-badge';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { dashboard } from '@/routes';
import type { RoomStatusGroup } from '@/types';

// Reception and guest dashboards are placeholders until their phases.
type RoomStatusCount = {
    status: string;
    label: string;
    group: RoomStatusGroup;
    count: number;
};

type GuestReservation = {
    id: number;
    room: string;
    location: string;
    starts_at: string;
    ends_at: string;
    pax: number;
    payment_status: 'unpaid' | 'partial' | 'paid';
};

type Props = {
    stats?: Record<string, number>;
    roomStatuses?: RoomStatusCount[];
    reservations?: GuestReservation[];
};

const statLabels: Record<string, string> = {
    arrivalsToday: 'Arrivals today',
    inHouse: 'Guests in house',
    checkoutsToday: 'Check-outs today',
    idsPendingPayment: 'IDs held – pending payment',
};

const paymentLabels: Record<GuestReservation['payment_status'], string> = {
    unpaid: 'Unpaid',
    partial: 'Partially paid',
    paid: 'Paid',
};

const dateTime = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
});

export default function Dashboard({
    stats,
    roomStatuses,
    reservations,
}: Props) {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto p-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">
                        Welcome, {auth.user.name}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {auth.user.role === 'guest'
                            ? 'Your reservations, bills and reminders.'
                            : 'Today at a glance.'}
                    </p>
                </div>

                {stats && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {Object.entries(stats).map(([key, value]) => (
                            <StatTile
                                key={key}
                                label={statLabels[key] ?? key}
                                value={value}
                            />
                        ))}
                    </div>
                )}

                {roomStatuses && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Rooms by status</CardTitle>
                            <CardDescription>
                                Reservations are shown separately on the room
                                board; a room can be occupied and reserved for
                                later.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                            {roomStatuses.map((item) => (
                                <RoomStatusBadge
                                    key={item.status}
                                    group={item.group}
                                    label={`${item.label} ${item.count}`}
                                    className="px-3 py-1 text-sm"
                                />
                            ))}
                        </CardContent>
                    </Card>
                )}

                {reservations && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Upcoming reservations</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {reservations.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    You have no upcoming reservations.
                                </p>
                            ) : (
                                <ul className="divide-y">
                                    {reservations.map((reservation) => (
                                        <li
                                            key={reservation.id}
                                            className="flex flex-wrap items-center justify-between gap-2 py-3"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    {reservation.location} ·{' '}
                                                    {reservation.room}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {dateTime.format(
                                                        new Date(
                                                            reservation.starts_at,
                                                        ),
                                                    )}{' '}
                                                    –{' '}
                                                    {dateTime.format(
                                                        new Date(
                                                            reservation.ends_at,
                                                        ),
                                                    )}{' '}
                                                    · {reservation.pax} pax
                                                </p>
                                            </div>
                                            <Badge variant="secondary">
                                                {
                                                    paymentLabels[
                                                        reservation
                                                            .payment_status
                                                    ]
                                                }
                                            </Badge>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
