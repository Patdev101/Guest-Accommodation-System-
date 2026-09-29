import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import RoomController from '@/actions/App/Http/Controllers/Admin/RoomController';
import { RoomFormDialog } from '@/components/admin/room-form-dialog';
import { RoomInclusions } from '@/components/admin/room-inclusions';
import { RoomMaintenance } from '@/components/admin/room-maintenance';
import { RoomRates } from '@/components/admin/room-rates';
import { RoomStatusPanel } from '@/components/admin/room-status-panel';
import type { Transition } from '@/components/admin/room-status-panel';
import { ConfirmDelete } from '@/components/confirm-dialog';
import { IconButton } from '@/components/icon-button';
import { Page, PageHeader } from '@/components/page';
import { RoomStatusBadge } from '@/components/room-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, plural } from '@/lib/format';
import { index as roomsIndex, show as roomsShow } from '@/routes/admin/rooms';
import type {
    LocationOption,
    MaintenanceRecord,
    RateUnitOption,
    RoomInclusion,
    RoomRate,
    RoomSummary,
} from '@/types';

type Props = {
    room: RoomSummary & {
        description: string | null;
        status_description: string;
        created_at: string | null;
    };
    transitions: Transition[];
    inclusions: RoomInclusion[];
    rates: RoomRate[];
    maintenance: MaintenanceRecord[];
    upcomingReservations: number;
    locations: LocationOption[];
    rateUnits: RateUnitOption[];
};

export default function RoomShow({
    room,
    transitions,
    inclusions,
    rates,
    maintenance,
    upcomingReservations,
    locations,
    rateUnits,
}: Props) {
    const [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false);

    return (
        <>
            <Head title={room.name} />
            <Page>
                <div className="space-y-3">
                    <Link
                        href={roomsIndex()}
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="size-4" />
                        All rooms
                    </Link>
                    <PageHeader
                        title={
                            <span className="flex flex-wrap items-center gap-3">
                                {room.name}
                                <RoomStatusBadge
                                    group={room.group}
                                    label={room.status_label}
                                />
                            </span>
                        }
                        description={`${room.location} · ${room.pax_capacity} pax capacity`}
                        actions={
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setEditing(true)}
                                >
                                    <Pencil />
                                    Edit details
                                </Button>
                                <IconButton
                                    label="Delete room"
                                    variant="outline"
                                    className="size-9 text-muted-foreground hover:text-destructive"
                                    onClick={() => setDeleting(true)}
                                >
                                    <Trash2 />
                                </IconButton>
                            </>
                        }
                    />
                </div>

                <div className="grid items-start gap-6 lg:grid-cols-3">
                    <div className="flex flex-col gap-6 lg:col-span-2">
                        <RoomRates
                            roomId={room.id}
                            rates={rates}
                            rateUnits={rateUnits}
                        />
                        <RoomMaintenance
                            roomId={room.id}
                            records={maintenance}
                        />
                    </div>

                    <div className="flex flex-col gap-6">
                        <RoomStatusPanel
                            room={room}
                            statusDescription={room.status_description}
                            transitions={transitions}
                            upcomingReservations={upcomingReservations}
                        />
                        <RoomInclusions
                            roomId={room.id}
                            inclusions={inclusions}
                        />
                        <Card>
                            <CardHeader>
                                <CardTitle>Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="grid gap-3 text-sm">
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-muted-foreground">
                                            Location
                                        </dt>
                                        <dd className="text-right font-medium">
                                            {room.location}
                                        </dd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-muted-foreground">
                                            Pax capacity
                                        </dt>
                                        <dd className="text-right font-medium">
                                            {plural(
                                                room.pax_capacity,
                                                'person',
                                                'people',
                                            )}
                                        </dd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-muted-foreground">
                                            Upcoming reservations
                                        </dt>
                                        <dd className="text-right font-medium">
                                            {upcomingReservations}
                                        </dd>
                                    </div>
                                    {room.created_at && (
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-muted-foreground">
                                                Added
                                            </dt>
                                            <dd className="text-right font-medium">
                                                {formatDate(room.created_at)}
                                            </dd>
                                        </div>
                                    )}
                                    <div className="grid gap-1 border-t pt-3">
                                        <dt className="text-muted-foreground">
                                            Description
                                        </dt>
                                        <dd className="whitespace-pre-line">
                                            {room.description ?? (
                                                <span className="text-muted-foreground">
                                                    None yet.{' '}
                                                    <button
                                                        type="button"
                                                        className="font-medium text-foreground underline-offset-4 hover:underline"
                                                        onClick={() =>
                                                            setEditing(true)
                                                        }
                                                    >
                                                        Add one
                                                    </button>
                                                </span>
                                            )}
                                        </dd>
                                    </div>
                                </dl>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </Page>

            <RoomFormDialog
                open={editing}
                onOpenChange={setEditing}
                locations={locations}
                room={{
                    id: room.id,
                    name: room.name,
                    location_id: room.location_id,
                    pax_capacity: room.pax_capacity,
                    description: room.description,
                }}
            />

            <ConfirmDelete
                open={deleting}
                onOpenChange={setDeleting}
                title={`Delete ${room.name}?`}
                description="Its rates, inclusions and maintenance log are deleted too. Rooms with reservations or stays cannot be deleted; set them to Out of service instead."
                url={RoomController.destroy.url(room.id)}
            />
        </>
    );
}

RoomShow.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Rooms', href: roomsIndex() },
        { title: props.room.name, href: roomsShow(props.room.id) },
    ],
});
