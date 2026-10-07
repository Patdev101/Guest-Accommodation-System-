import { Head, Link, router } from '@inertiajs/react';
import { ChevronRight, DoorOpen, LogIn, UserPlus } from 'lucide-react';
import CheckInController from '@/actions/App/Http/Controllers/Reception/CheckInController';
import { StatTile } from '@/components/admin/stat-tile';
import { EmptyState } from '@/components/empty-state';
import { Page, PageHeader } from '@/components/page';
import { PaymentStatusBadge } from '@/components/reception/badges';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatDayTime, formatPeso, plural } from '@/lib/format';
import { checkIn, walkIn as walkInPage } from '@/routes/reception';
import { show as reservationsShow } from '@/routes/reception/reservations';
import type { ReservationRow } from '@/types';

type Props = {
    late: ReservationRow[];
    today: ReservationRow[];
    later: ReservationRow[];
    laterTotal: number;
};

export default function Arrivals({ late, today, later, laterTotal }: Props) {
    const nothing = late.length + today.length + later.length === 0;
    const walkIn = (
        <Button asChild>
            <Link href={walkInPage()}>
                <UserPlus />
                Walk-in guest
            </Link>
        </Button>
    );

    return (
        <>
            <Head title="Check-in" />
            <Page>
                <PageHeader
                    title="Check-in"
                    description="Bookings waiting for their guests. Start the check-in when they arrive, or take a walk-in guest who has no booking."
                    actions={walkIn}
                />

                <div className="grid gap-4 sm:grid-cols-3">
                    <StatTile
                        label="Not arrived"
                        value={late.length}
                        detail="Past the grace period"
                    />
                    <StatTile
                        label="Arriving today"
                        value={today.length}
                        detail="Ready to check in"
                    />
                    <StatTile
                        label="Coming later"
                        value={laterTotal}
                        detail="Booked for another day"
                    />
                </div>

                {nothing ? (
                    <EmptyState
                        icon={DoorOpen}
                        title="Nobody is waiting to check in"
                        description="Bookings appear here until their guests check in. A guest without a booking is a walk-in."
                        action={walkIn}
                    />
                ) : (
                    <>
                        {late.length > 0 && (
                            <Section
                                title="Not arrived"
                                description="The reserved time and the grace period have passed. Check them in if they come, or open the booking to mark a no-show."
                                rows={late}
                                ready
                            />
                        )}
                        <Section
                            title="Arriving today"
                            description="Check each one in when the guests are at the desk."
                            rows={today}
                            empty="No more arrivals are expected today."
                            ready
                        />
                        {later.length > 0 && (
                            <Section
                                title="Coming later"
                                description={
                                    laterTotal > later.length
                                        ? `The next ${later.length} of ${plural(laterTotal, 'booking')}. See all of them under Reservations.`
                                        : 'Not due yet. Open one to change or cancel it.'
                                }
                                rows={later}
                            />
                        )}
                    </>
                )}
            </Page>
        </>
    );
}

/** One group of bookings; `ready` ones get the Check in button. */
function Section({
    title,
    description,
    rows,
    empty,
    ready = false,
}: {
    title: string;
    description: string;
    rows: ReservationRow[];
    empty?: string;
    ready?: boolean;
}) {
    return (
        <Card className="gap-0 overflow-hidden pb-0">
            <CardHeader className="pb-4">
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            {rows.length === 0 ? (
                <CardContent className="pb-6 text-sm text-muted-foreground">
                    {empty}
                </CardContent>
            ) : (
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="pl-6">Arrival</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead className="hidden md:table-cell">
                                Rooms
                            </TableHead>
                            <TableHead className="hidden text-right sm:table-cell">
                                Guests
                            </TableHead>
                            <TableHead className="hidden lg:table-cell">
                                Payment
                            </TableHead>
                            <TableHead className="pr-6">
                                <span className="sr-only">Action</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow
                                key={row.id}
                                className="cursor-pointer"
                                onClick={() =>
                                    router.visit(reservationsShow(row.id))
                                }
                            >
                                <TableCell className="pl-6">
                                    <div className="font-medium tabular-nums">
                                        {formatDayTime(row.starts_at)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        until {formatDayTime(row.ends_at)}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Link
                                        href={reservationsShow(row.id)}
                                        className="font-medium underline-offset-4 hover:underline"
                                        onClick={(event) =>
                                            event.stopPropagation()
                                        }
                                    >
                                        {row.contact_name}
                                    </Link>
                                    <div className="text-xs text-muted-foreground">
                                        {row.company ?? row.contact_number}
                                    </div>
                                    <div className="text-xs text-muted-foreground md:hidden">
                                        {row.rooms.join(', ')}
                                    </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                    <div>{row.rooms.join(', ')}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {row.location}
                                    </div>
                                </TableCell>
                                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                                    {row.pax}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="tabular-nums">
                                            {formatPeso(row.total)}
                                        </span>
                                        <PaymentStatusBadge
                                            status={row.payment_status}
                                        />
                                    </div>
                                </TableCell>
                                <TableCell className="pr-6 text-right text-muted-foreground">
                                    {ready ? (
                                        <Button
                                            size="sm"
                                            asChild
                                            onClick={(event) =>
                                                event.stopPropagation()
                                            }
                                        >
                                            <Link
                                                href={CheckInController.create(
                                                    row.id,
                                                )}
                                            >
                                                <LogIn />
                                                Check in
                                            </Link>
                                        </Button>
                                    ) : (
                                        <ChevronRight className="ml-auto size-4" />
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </Card>
    );
}

Arrivals.layout = {
    breadcrumbs: [{ title: 'Check-in', href: checkIn() }],
};
