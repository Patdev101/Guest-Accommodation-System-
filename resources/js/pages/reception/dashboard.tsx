import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowRight,
    CheckCircle2,
    ClipboardCheck,
    DoorOpen,
    ExternalLink,
    LogIn,
    LogOut,
    Phone,
    Plus,
    Search,
    Settings2,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import CheckInController from '@/actions/App/Http/Controllers/Reception/CheckInController';
import RoomStatusController from '@/actions/App/Http/Controllers/Reception/RoomStatusController';
import { RoomBoard } from '@/components/admin/room-board';
import type { BoardLocation } from '@/components/admin/room-board';
import {
    StatusDialog,
    actionLabel,
} from '@/components/admin/room-status-panel';
import type { Transition } from '@/components/admin/room-status-panel';
import { StatTile } from '@/components/admin/stat-tile';
import { EmptyState } from '@/components/empty-state';
import { Page, PageHeader } from '@/components/page';
import { PaymentStatusBadge } from '@/components/reception/badges';
import { CallDialog } from '@/components/reception/call-dialog';
import { RoomStatusBadge, StatusDot } from '@/components/room-status-badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    formatClock,
    formatDayTime,
    formatMinutes,
    formatPeso,
    formatTime,
    formatToday,
    formatWhen,
    greeting,
    plural,
} from '@/lib/format';
import { groupColor } from '@/lib/room-status';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { walkIn } from '@/routes/reception';
import { index as refundsIndex } from '@/routes/reception/refunds';
import {
    create as reservationsCreate,
    index as reservationsIndex,
    show as reservationsShow,
} from '@/routes/reception/reservations';
import {
    index as staysIndex,
    show as staysShow,
} from '@/routes/reception/stays';
import type {
    BoardRoomSummary,
    ReservationRow,
    RoomOccupancy,
    RoomStatusGroup,
    StatusGroupOption,
    StayRow,
} from '@/types';

type BoardRoom = BoardRoomSummary &
    RoomOccupancy & {
        transitions: Transition[];
        upcoming_reservations: number;
        description: string | null;
        rates: {
            id: number;
            name: string;
            unit: string;
            price: string;
            is_extension: boolean;
        }[];
        inclusions: { id: number; item: string; quantity: number }[];
        company: string | null;
        guest_names: string[];
    };

type Props = {
    stats: {
        rooms: number;
        capacity: number;
        occupied: number;
        available: number;
        arrivalsToday: number;
        checkedInToday: number;
        inHouse: number;
        checkoutsToday: number;
        openRefunds: number;
    };
    arrivals: ReservationRow[];
    overdue: ReservationRow[];
    dueSoon: (StayRow & {
        not_extending: boolean;
        last_call: { result: string | null; sent_at: string } | null;
    })[];
    toInspect: {
        stay_id: number;
        room: string;
        guest: string;
        checked_out_at: string | null;
    }[];
    groups: (StatusGroupOption & { value: RoomStatusGroup; count: number })[];
    board: (Omit<BoardLocation, 'rooms'> & { rooms: BoardRoom[] })[];
    rules: {
        checkIn: string;
        checkOut: string;
        cleaningBuffer: number;
        grace: number;
        reminder: number;
    };
};

export default function FrontDesk({
    stats,
    arrivals,
    overdue,
    dueSoon,
    toInspect,
    board,
    rules,
}: Props) {
    const [calling, setCalling] = useState<StayRow | null>(null);
    const [picking, setPicking] = useState<BoardRoom | null>(null);
    const [changing, setChanging] = useState<{
        room: BoardRoom;
        target: Transition;
    } | null>(null);
    const [search, setSearch] = useState('');
    // The board's status filter, so the "Available now" tile can set it.
    const [status, setStatus] = useState<string | null>(null);

    // Rooms where the next guest is due today but the last guest is still in.
    const clashes = board
        .flatMap((item) => item.rooms)
        .filter((room) => room.stay && room.arrival);
    const lateIds = new Set(overdue.map((row) => row.id));
    const expected = arrivals.filter((row) => !lateIds.has(row.id));

    const showAvailable = () => {
        setStatus(
            board
                .flatMap((item) => item.rooms)
                .find((room) => room.group === 'available')?.status_label ??
                'Available',
        );
        document
            .getElementById('rooms')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <>
            <Head title="Front desk" />
            <Page>
                <PageHeader
                    title={greeting()}
                    description={`${formatToday()} · updates by itself`}
                    actions={
                        <>
                            <form
                                role="search"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    router.get(reservationsIndex().url, {
                                        show: 'all',
                                        search: search.trim() || undefined,
                                    });
                                }}
                                className="relative w-full sm:w-60"
                            >
                                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="search"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Find a booking"
                                    aria-label="Find a booking by name, number, company or room"
                                    className="pl-9"
                                />
                            </form>
                            <Button variant="outline" asChild>
                                <Link href={walkIn()}>
                                    <DoorOpen />
                                    Walk-in
                                </Link>
                            </Button>
                            <Button asChild>
                                <Link href={reservationsCreate()}>
                                    <Plus />
                                    New reservation
                                </Link>
                            </Button>
                        </>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <TileLink href={staysIndex()}>
                        <StatTile
                            marker={<StatusDot group="in_use" />}
                            label="Occupied rooms"
                            value={stats.occupied}
                            detail={`Out of ${plural(stats.rooms, 'room')} · ${plural(stats.inHouse, 'guest')} staying`}
                        />
                    </TileLink>
                    <button
                        type="button"
                        onClick={showAvailable}
                        className={cn(tileLinkClass, 'text-left')}
                    >
                        <StatTile
                            marker={<StatusDot group="available" />}
                            label="Available now"
                            value={stats.available}
                            detail="Ready for new guests. Click to see them."
                        />
                    </button>
                    <TileLink
                        href={reservationsIndex({ query: { show: 'today' } })}
                    >
                        <StatTile
                            marker={<Marker className="bg-primary" />}
                            label="Still to arrive today"
                            value={stats.arrivalsToday}
                            detail={
                                overdue.length > 0
                                    ? `${stats.checkedInToday} already checked in · ${overdue.length} late`
                                    : `${stats.checkedInToday} already checked in`
                            }
                        />
                    </TileLink>
                    <TileLink href={staysIndex()}>
                        <StatTile
                            marker={<Marker className="bg-destructive" />}
                            label="Checking out today"
                            value={stats.checkoutsToday}
                            detail={
                                dueSoon.length > 0
                                    ? `${plural(dueSoon.length, 'guest')} to call now`
                                    : 'No calls needed yet'
                            }
                        />
                    </TileLink>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem] xl:items-start">
                    {/* First in the page order: on small screens the day's to-dos come before the board. */}
                    <Card className="gap-4 xl:col-start-2 xl:row-start-1">
                        <CardHeader className="flex flex-row items-start justify-between gap-3">
                            <div className="space-y-1.5">
                                <CardTitle>Today</CardTitle>
                                <CardDescription>
                                    What needs the desk, most urgent first.
                                </CardDescription>
                            </div>
                            <LiveBadge />
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {clashes.length === 0 &&
                            dueSoon.length === 0 &&
                            overdue.length === 0 &&
                            expected.length === 0 &&
                            toInspect.length === 0 ? (
                                <EmptyState
                                    icon={CheckCircle2}
                                    title="All clear"
                                    description="No calls, arrivals or inspections waiting. New ones appear here by themselves."
                                    className="py-8"
                                />
                            ) : (
                                <>
                                    <FeedSection
                                        title="Room still occupied, next guest due"
                                        hint="Check the current guest out, or give the new guest another room."
                                        rows={clashes}
                                    >
                                        {(room) => (
                                            <FeedItem
                                                key={room.id}
                                                accent="bg-destructive"
                                                action={
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            setPicking(room)
                                                        }
                                                    >
                                                        Open room
                                                    </Button>
                                                }
                                            >
                                                <p className="font-medium">
                                                    {room.name}
                                                </p>
                                                <FeedLine>
                                                    In: {room.stay?.guest}
                                                    {room.stay?.overdue &&
                                                        ' (past check-out)'}
                                                </FeedLine>
                                                <FeedLine>
                                                    Next: {room.arrival?.guest},{' '}
                                                    {room.arrival &&
                                                        formatWhen(
                                                            room.arrival
                                                                .starts_at,
                                                        )}
                                                </FeedLine>
                                            </FeedItem>
                                        )}
                                    </FeedSection>

                                    <FeedSection
                                        title="Call before check-out"
                                        rows={dueSoon}
                                    >
                                        {(stay) => (
                                            <FeedItem
                                                key={stay.id}
                                                accent="bg-destructive"
                                                action={
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            setCalling(stay)
                                                        }
                                                    >
                                                        <Phone />
                                                        Log call
                                                    </Button>
                                                }
                                            >
                                                <FeedTitle
                                                    href={staysShow(stay.id)}
                                                >
                                                    {stay.contact_name}
                                                </FeedTitle>
                                                <FeedLine>
                                                    {stay.rooms.join(', ')} ·
                                                    due{' '}
                                                    {formatWhen(
                                                        stay.expected_check_out_at,
                                                    )}
                                                    {stay.overdue && (
                                                        <span className="font-medium text-red-600 dark:text-red-400">
                                                            {' '}
                                                            (passed)
                                                        </span>
                                                    )}
                                                </FeedLine>
                                                <FeedLine>
                                                    {stay.not_extending
                                                        ? 'Not extending'
                                                        : stay.last_call
                                                          ? `Called ${formatTime(stay.last_call.sent_at)}: ${stay.last_call.result ?? 'no result'}`
                                                          : `Not called yet · ${stay.contact_number}`}
                                                </FeedLine>
                                            </FeedItem>
                                        )}
                                    </FeedSection>

                                    <FeedSection
                                        title="Late: not arrived yet"
                                        hint="The grace period is over. Open one to mark it as a no-show, or check them in if they come."
                                        rows={overdue}
                                    >
                                        {(row) => (
                                            <FeedItem
                                                key={row.id}
                                                accent="bg-destructive"
                                                action={
                                                    <CheckInButton
                                                        id={row.id}
                                                        variant="outline"
                                                    />
                                                }
                                            >
                                                <FeedTitle
                                                    href={reservationsShow(
                                                        row.id,
                                                    )}
                                                >
                                                    {row.contact_name}
                                                </FeedTitle>
                                                <FeedLine>
                                                    {row.rooms.join(', ')} ·
                                                    reserved{' '}
                                                    {formatWhen(row.starts_at)}
                                                </FeedLine>
                                            </FeedItem>
                                        )}
                                    </FeedSection>

                                    <FeedSection
                                        title="Arriving today"
                                        rows={expected}
                                    >
                                        {(row) => (
                                            <FeedItem
                                                key={row.id}
                                                accent="bg-primary"
                                                action={
                                                    <CheckInButton
                                                        id={row.id}
                                                    />
                                                }
                                            >
                                                <FeedTitle
                                                    href={reservationsShow(
                                                        row.id,
                                                    )}
                                                >
                                                    <span className="tabular-nums">
                                                        {formatTime(
                                                            row.starts_at,
                                                        )}
                                                    </span>{' '}
                                                    · {row.contact_name}
                                                </FeedTitle>
                                                <FeedLine>
                                                    {row.rooms.join(', ')} ·{' '}
                                                    {plural(row.pax, 'guest')}
                                                </FeedLine>
                                                <div className="mt-1">
                                                    <PaymentStatusBadge
                                                        status={
                                                            row.payment_status
                                                        }
                                                    />
                                                </div>
                                            </FeedItem>
                                        )}
                                    </FeedSection>

                                    <FeedSection
                                        title="Rooms to inspect"
                                        rows={toInspect}
                                    >
                                        {(item) => (
                                            <FeedItem
                                                key={`${item.stay_id}-${item.room}`}
                                                accentColor={
                                                    groupColor.turnover
                                                }
                                                action={
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={staysShow(
                                                                item.stay_id,
                                                            )}
                                                        >
                                                            <ClipboardCheck />
                                                            Inspect
                                                        </Link>
                                                    </Button>
                                                }
                                            >
                                                <p className="font-medium">
                                                    {item.room}
                                                </p>
                                                <FeedLine>
                                                    {item.guest}
                                                    {item.checked_out_at &&
                                                        ` · out ${formatTime(item.checked_out_at)}`}
                                                </FeedLine>
                                            </FeedItem>
                                        )}
                                    </FeedSection>
                                </>
                            )}

                            {stats.openRefunds > 0 && (
                                <Link
                                    href={refundsIndex()}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-2.5 text-sm transition-colors hover:bg-muted/50"
                                >
                                    <span>
                                        {plural(stats.openRefunds, 'refund')} to
                                        process
                                    </span>
                                    <ArrowRight className="size-4 text-muted-foreground" />
                                </Link>
                            )}
                        </CardContent>
                    </Card>

                    <Card
                        id="rooms"
                        className="scroll-mt-4 gap-5 xl:col-start-1 xl:row-start-1"
                    >
                        <CardHeader>
                            <CardTitle>Rooms</CardTitle>
                            <CardDescription>
                                One location at a time. Click a room to see its
                                prices, inclusions and who is in it; "Get room"
                                starts a check-in in that room.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <RoomBoard
                                locations={board}
                                linkRooms={false}
                                status={status}
                                onStatusChange={setStatus}
                                onRoomClick={(room) => setPicking(room)}
                                roomLabel={(room) =>
                                    `${room.name}, ${room.status_label}${room.stay ? `, ${room.stay.guest}` : ''}. Open`
                                }
                                roomAction={(room) =>
                                    room.stay ? (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            asChild
                                        >
                                            <Link
                                                href={staysShow(room.stay.id)}
                                            >
                                                <LogOut />
                                                Check out
                                            </Link>
                                        </Button>
                                    ) : room.arrival ? (
                                        <CheckInButton
                                            id={room.arrival.reservation_id}
                                        />
                                    ) : room.group === 'available' &&
                                      // A room without a price cannot be booked yet.
                                      room.rates.some(
                                          (rate) => !rate.is_extension,
                                      ) ? (
                                        <Button size="sm" asChild>
                                            <Link
                                                href={walkIn({
                                                    query: { room: room.id },
                                                })}
                                            >
                                                <LogIn />
                                                Get room
                                            </Link>
                                        </Button>
                                    ) : null
                                }
                            />
                        </CardContent>
                    </Card>
                </div>

                <HouseRules rules={rules} />
            </Page>

            <RoomDialog
                room={picking}
                onClose={() => setPicking(null)}
                onChange={(room, target) => {
                    setChanging({ room, target });
                    setPicking(null);
                }}
            />

            <CallDialog stay={calling} onClose={() => setCalling(null)} />

            {changing && (
                <StatusDialog
                    room={changing.room}
                    target={changing.target}
                    form={RoomStatusController.form(changing.room.id)}
                    upcomingReservations={changing.room.upcoming_reservations}
                    onOpenChange={(open) => !open && setChanging(null)}
                />
            )}
        </>
    );
}

const tileLinkClass =
    'rounded-xl transition outline-none hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>*]:h-full';

/** A stat tile that opens the list behind it. */
function TileLink({
    href,
    children,
}: {
    href: Parameters<typeof Link>[0]['href'];
    children: ReactNode;
}) {
    return (
        <Link href={href} className={tileLinkClass}>
            {children}
        </Link>
    );
}

function Marker({ className }: { className: string }) {
    return (
        <span
            aria-hidden
            className={cn('inline-block size-2 rounded-full', className)}
        />
    );
}

function LiveBadge() {
    return (
        <span
            title="Updates by itself every few seconds"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
        >
            <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Live
        </span>
    );
}

/** One kind of to-do in the Today panel; hidden when there is nothing. */
function FeedSection<Row>({
    title,
    hint,
    rows,
    children,
}: {
    title: string;
    hint?: string;
    rows: Row[];
    children: (row: Row) => ReactNode;
}) {
    if (rows.length === 0) {
        return null;
    }

    return (
        <section className="space-y-2">
            <h3 className="flex items-baseline justify-between gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {title}
                <span className="tabular-nums">{rows.length}</span>
            </h3>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            <ul className="space-y-2">{rows.map(children)}</ul>
        </section>
    );
}

function FeedItem({
    accent,
    accentColor,
    action,
    children,
}: {
    accent?: string;
    accentColor?: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <li className="relative flex items-center gap-3 overflow-hidden rounded-lg border bg-muted/30 py-2.5 pr-2.5 pl-4">
            <span
                aria-hidden
                className={cn('absolute inset-y-0 left-0 w-1', accent)}
                style={
                    accentColor ? { backgroundColor: accentColor } : undefined
                }
            />
            <div className="min-w-0 flex-1 text-sm">{children}</div>
            {action}
        </li>
    );
}

function FeedTitle({
    href,
    children,
}: {
    href: Parameters<typeof Link>[0]['href'];
    children: ReactNode;
}) {
    return (
        <Link
            href={href}
            className="block truncate font-medium underline-offset-4 hover:underline"
        >
            {children}
        </Link>
    );
}

function FeedLine({ children }: { children: ReactNode }) {
    return <p className="truncate text-xs text-muted-foreground">{children}</p>;
}

function CheckInButton({
    id,
    variant = 'default',
}: {
    id: number;
    variant?: 'default' | 'outline';
}) {
    return (
        <Button size="sm" variant={variant} asChild>
            <Link href={CheckInController.create(id)}>
                <LogIn />
                Check in
            </Link>
        </Button>
    );
}

/** The settings reception works by, as a reminder under the board. */
function HouseRules({ rules }: { rules: Props['rules'] }) {
    const items: [string, string][] = [
        ['Check-in time', formatClock(rules.checkIn)],
        ['Check-out time', formatClock(rules.checkOut)],
        [
            'Cleaning time between guests',
            rules.cleaningBuffer > 0
                ? formatMinutes(rules.cleaningBuffer)
                : 'None',
        ],
        ['No-show after', `${formatMinutes(rules.grace)} late`],
        ['Reminder call', `${formatMinutes(rules.reminder)} before check-out`],
    ];

    return (
        <Card className="flex-row flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
            <p className="flex items-center gap-2 text-sm font-medium">
                <Settings2 className="size-4 text-muted-foreground" />
                House rules
            </p>
            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {items.map(([label, value]) => (
                    <div key={label} className="flex items-center gap-2">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="rounded-md border bg-muted/50 px-2 py-0.5 font-medium">
                            {value}
                        </dd>
                    </div>
                ))}
            </dl>
        </Card>
    );
}

/** Everything about one room: who is in it, who comes next, its prices and inclusions (read-only), its status. */
function RoomDialog({
    room,
    onClose,
    onChange,
}: {
    room: BoardRoom | null;
    onClose: () => void;
    onChange: (room: BoardRoom, target: Transition) => void;
}) {
    return (
        <Dialog
            open={room !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                {room && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex flex-wrap items-center gap-2">
                                {room.name}
                                <RoomStatusBadge
                                    group={room.group}
                                    label={room.status_label}
                                />
                            </DialogTitle>
                            <DialogDescription>
                                {room.location} · sleeps {room.pax_capacity}
                            </DialogDescription>
                        </DialogHeader>

                        {room.cover_url && (
                            <img
                                src={room.cover_url}
                                alt={`Photo of ${room.name}`}
                                className="h-40 w-full rounded-lg object-cover"
                            />
                        )}

                        {room.stay && (
                            <RoomFact
                                label="In the room"
                                action={
                                    <Button size="sm" variant="outline" asChild>
                                        <Link href={staysShow(room.stay.id)}>
                                            <ExternalLink />
                                            Open
                                        </Link>
                                    </Button>
                                }
                            >
                                <p className="font-medium">{room.stay.guest}</p>
                                <p className="text-xs text-muted-foreground">
                                    {plural(room.stay.pax, 'guest')} · due out{' '}
                                    {formatDayTime(room.stay.due_out_at)}
                                    {room.stay.overdue && (
                                        <span className="font-medium text-red-600 dark:text-red-400">
                                            {' '}
                                            (passed)
                                        </span>
                                    )}
                                    {room.stay.not_extending &&
                                        ' · not extending'}
                                </p>
                                {room.company && (
                                    <p className="text-xs text-muted-foreground">
                                        {room.company}
                                    </p>
                                )}
                                {room.guest_names.length > 0 && (
                                    <ul className="mt-2 list-inside list-disc text-xs">
                                        {room.guest_names.map((name, index) => (
                                            <li key={index}>{name}</li>
                                        ))}
                                    </ul>
                                )}
                            </RoomFact>
                        )}

                        {room.arrival && (
                            <RoomFact
                                label={
                                    room.arrival.late
                                        ? 'Not arrived yet'
                                        : room.stay
                                          ? 'Next guest'
                                          : 'Arriving'
                                }
                                action={
                                    <CheckInButton
                                        id={room.arrival.reservation_id}
                                        variant={
                                            room.stay ? 'outline' : 'default'
                                        }
                                    />
                                }
                            >
                                <Link
                                    href={reservationsShow(
                                        room.arrival.reservation_id,
                                    )}
                                    className="font-medium underline-offset-4 hover:underline"
                                >
                                    {room.arrival.guest}
                                </Link>
                                <p className="text-xs text-muted-foreground">
                                    {plural(room.arrival.pax, 'guest')} ·{' '}
                                    {formatWhen(room.arrival.starts_at)}
                                </p>
                            </RoomFact>
                        )}

                        {!room.stay && !room.arrival && (
                            <p className="text-sm text-muted-foreground">
                                Nobody is in this room or arriving today.
                            </p>
                        )}

                        <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium">Prices</h3>
                                {room.rates.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No price set yet. Ask the Admin to add
                                        one.
                                    </p>
                                ) : (
                                    <ul className="space-y-1.5 text-sm">
                                        {room.rates.map((rate) => (
                                            <li
                                                key={rate.id}
                                                className="flex items-baseline justify-between gap-3"
                                            >
                                                <span className="min-w-0">
                                                    {rate.name}
                                                    <span className="block text-xs text-muted-foreground">
                                                        {rate.unit}
                                                        {rate.is_extension &&
                                                            ' · for extending a stay'}
                                                    </span>
                                                </span>
                                                <span className="font-medium tabular-nums">
                                                    {formatPeso(rate.price)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium">
                                    Inclusions
                                </h3>
                                {room.inclusions.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        None listed.
                                    </p>
                                ) : (
                                    <ul className="space-y-1.5 text-sm">
                                        {room.inclusions.map((inclusion) => (
                                            <li
                                                key={inclusion.id}
                                                className="flex justify-between gap-3"
                                            >
                                                <span>{inclusion.item}</span>
                                                <span className="text-muted-foreground tabular-nums">
                                                    × {inclusion.quantity}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            {room.description && (
                                <p className="text-sm text-muted-foreground sm:col-span-2">
                                    {room.description}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2 border-t pt-4">
                            <h3 className="text-sm font-medium">
                                Change status
                            </h3>
                            {room.transitions.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    This status changes through check-in and
                                    check-out.
                                </p>
                            ) : (
                                <div className="grid gap-2">
                                    {room.transitions.map((transition) => (
                                        <Button
                                            key={transition.value}
                                            variant="outline"
                                            className="justify-between"
                                            onClick={() =>
                                                onChange(room, transition)
                                            }
                                        >
                                            <span className="flex items-center gap-2">
                                                <StatusDot
                                                    group={transition.group}
                                                />
                                                {actionLabel[
                                                    transition.value
                                                ] ?? transition.label}
                                            </span>
                                            <ArrowRight className="text-muted-foreground" />
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function RoomFact({
    label,
    action,
    children,
}: {
    label: string;
    action: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <div className="min-w-0 flex-1 text-sm">
                <p className="text-xs text-muted-foreground">{label}</p>
                {children}
            </div>
            {action}
        </div>
    );
}

FrontDesk.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
