import { Form, Head, Link } from '@inertiajs/react';
import {
    AlarmClock,
    ArrowRight,
    BedDouble,
    CalendarCheck,
    CalendarClock,
    CalendarPlus,
    Clock,
    Hourglass,
    Info,
    Mail,
    MapPin,
    Phone,
    Search,
    Settings2,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ConfirmAction } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { PaymentStatusBadge } from '@/components/reception/badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatDayTime, formatPeso, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { cancel as cancelRequest } from '@/routes/guest/requests';
import { show as showReservation } from '@/routes/guest/reservations';
import { extension as askExtension } from '@/routes/guest/stay';
import { edit as profileEdit } from '@/routes/profile';
import { index as roomsIndex } from '@/routes/rooms';
import type { PaymentStatus } from '@/types';

type Booking = {
    id: number;
    rooms: string;
    location: string;
    guests: number;
    starts_at: string;
    ends_at: string;
    total: string;
    paid: string;
    payment_status: PaymentStatus;
    status: string;
    status_label: string;
    note: string | null;
};

type BookingRequest = {
    id: number;
    rooms: string;
    guests: number;
    starts_at: string;
    ends_at: string;
    total: string;
    status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'expired';
    status_label: string;
    decline_reason: string | null;
    note: string | null;
    sent_at: string;
    held_until: string | null;
};

type Props = {
    profile: {
        name: string;
        email: string;
        contact_number: string | null;
        member_since: string | null;
    };
    stay: {
        rooms: string;
        checked_in_at: string;
        due_out_at: string;
        overdue: boolean;
        balance: number;
    } | null;
    requests: BookingRequest[];
    upcoming: Booking[];
    past: Booking[];
    counts: { upcoming: number; waiting: number; stays: number };
};

const requestTone: Record<BookingRequest['status'], string> = {
    pending:
        'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    approved:
        'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    declined:
        'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
    cancelled: 'border-border bg-muted text-muted-foreground',
    expired: 'border-border bg-muted text-muted-foreground',
};

export default function GuestHome({
    profile,
    stay,
    requests,
    upcoming,
    past,
    counts,
}: Props) {
    const [cancelling, setCancelling] = useState<BookingRequest | null>(null);
    const [extending, setExtending] = useState(false);
    const firstName = profile.name.split(' ')[0];
    const nothing =
        !stay &&
        requests.length === 0 &&
        upcoming.length === 0 &&
        past.length === 0;

    return (
        <>
            <Head title="My bookings" />

            <section className="relative bg-gradient-to-br from-[#16294f] via-[#1f3c73] to-[#0e7c8c] text-white">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_85%_-10%,rgba(255,255,255,0.18),transparent)]"
                />
                <div className="relative mx-auto flex w-full max-w-6xl flex-wrap items-end justify-between gap-4 px-4 pt-10 pb-24">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">
                            My bookings
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                            Welcome, {firstName}
                        </h1>
                        <p className="mt-2 max-w-xl text-white/80">
                            Your stay, your booking requests and your
                            reservations, all in one place.
                        </p>
                    </div>
                    <Button
                        asChild
                        size="lg"
                        className="bg-white text-[#16294f] hover:bg-white/90"
                    >
                        <Link href={roomsIndex()}>
                            <Search />
                            Browse rooms
                        </Link>
                    </Button>
                </div>
            </section>

            <div className="relative z-10 mx-auto -mt-14 grid w-full max-w-6xl gap-4 px-4 sm:grid-cols-3">
                <Stat
                    icon={CalendarCheck}
                    label="Upcoming bookings"
                    value={counts.upcoming}
                    detail="Confirmed by our front desk"
                />
                <Stat
                    icon={Hourglass}
                    label="Waiting for approval"
                    value={counts.waiting}
                    detail="Requests we have not answered yet"
                />
                <Stat
                    icon={BedDouble}
                    label="Past stays"
                    value={counts.stays}
                    detail="Stays you have completed with us"
                />
            </div>

            <div className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="min-w-0 space-y-8">
                    {stay && (
                        <section
                            className={cn(
                                'rounded-2xl border p-6 shadow-sm',
                                stay.overdue
                                    ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
                                    : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40',
                            )}
                        >
                            <p className="text-xs font-semibold tracking-widest uppercase opacity-70">
                                You are checked in
                            </p>
                            <h2 className="mt-1 text-xl font-semibold">
                                {stay.rooms}
                            </h2>
                            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                                <Fact label="Checked in">
                                    {formatDayTime(stay.checked_in_at)}
                                </Fact>
                                <Fact label="Check-out">
                                    <span className="inline-flex items-center gap-1.5">
                                        {stay.overdue ? (
                                            <AlarmClock className="size-4" />
                                        ) : (
                                            <Clock className="size-4" />
                                        )}
                                        {formatDayTime(stay.due_out_at)}
                                    </span>
                                </Fact>
                                <Fact label="Still to pay">
                                    {stay.balance > 0
                                        ? formatPeso(stay.balance)
                                        : 'Nothing, all paid'}
                                </Fact>
                            </dl>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm opacity-80">
                                    {stay.overdue
                                        ? 'Your check-out time has passed. Please see the front desk, or ask here to stay longer.'
                                        : 'Want to stay longer? Ask before your check-out time.'}
                                </p>
                                <Button
                                    variant="outline"
                                    className="bg-background"
                                    onClick={() => setExtending(true)}
                                >
                                    <CalendarPlus />
                                    Ask to stay longer
                                </Button>
                            </div>
                        </section>
                    )}

                    {nothing ? (
                        <section className="rounded-2xl border border-dashed px-6 py-16 text-center">
                            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <CalendarClock className="size-7" />
                            </span>
                            <h2 className="mt-4 text-xl font-semibold">
                                You have no bookings yet
                            </h2>
                            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                                Browse the rooms and check your dates. Bookings
                                you make and stays you complete will be listed
                                here.
                            </p>
                            <Button asChild className="mt-5">
                                <Link href={roomsIndex()}>
                                    <Search />
                                    Browse rooms
                                </Link>
                            </Button>
                        </section>
                    ) : (
                        <>
                            {requests.length > 0 && (
                                <Section
                                    title="Booking requests"
                                    description="Our front desk answers every request. Approved ones become reservations."
                                >
                                    {requests.map((request) => (
                                        <li
                                            key={request.id}
                                            className="rounded-xl border bg-card p-5 shadow-xs"
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <h3 className="font-semibold">
                                                    {request.rooms}
                                                </h3>
                                                <span
                                                    className={cn(
                                                        'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                                                        requestTone[
                                                            request.status
                                                        ],
                                                    )}
                                                >
                                                    {request.status_label}
                                                </span>
                                            </div>
                                            <BookingFacts
                                                from={request.starts_at}
                                                to={request.ends_at}
                                                guests={request.guests}
                                            />
                                            <p className="mt-3 text-sm text-muted-foreground">
                                                Total{' '}
                                                <span className="font-semibold text-foreground">
                                                    {formatPeso(request.total)}
                                                </span>{' '}
                                                · sent{' '}
                                                {formatDate(request.sent_at)}
                                            </p>
                                            {request.decline_reason && (
                                                <p className="mt-2 text-sm">
                                                    Reason:{' '}
                                                    {request.decline_reason}
                                                </p>
                                            )}
                                            {request.note && (
                                                <Note>{request.note}</Note>
                                            )}
                                            {request.status === 'pending' && (
                                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                                                    <p className="text-sm text-muted-foreground">
                                                        {request.held_until
                                                            ? `The room is held for you until ${formatDayTime(request.held_until)}.`
                                                            : 'The room is held for you while we answer.'}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setCancelling(
                                                                request,
                                                            )
                                                        }
                                                    >
                                                        Cancel request
                                                    </Button>
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </Section>
                            )}

                            <Section
                                title="Upcoming reservations"
                                description="Confirmed bookings. Bring a valid ID when you arrive."
                                empty="You have no upcoming reservations."
                            >
                                {upcoming.map((booking) => (
                                    <BookingCard
                                        key={booking.id}
                                        booking={booking}
                                    />
                                ))}
                            </Section>

                            {past.length > 0 && (
                                <Section
                                    title="Past bookings"
                                    description="Stays you completed, and bookings that were cancelled."
                                >
                                    {past.map((booking) => (
                                        <BookingCard
                                            key={booking.id}
                                            booking={booking}
                                            muted
                                        />
                                    ))}
                                </Section>
                            )}
                        </>
                    )}
                </div>

                <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                    <div className="rounded-2xl border bg-card p-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                                {profile.name.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate font-semibold">
                                    {profile.name}
                                </p>
                                {profile.member_since && (
                                    <p className="text-xs text-muted-foreground">
                                        Guest since{' '}
                                        {formatDate(profile.member_since)}
                                    </p>
                                )}
                            </div>
                        </div>
                        <ul className="mt-5 space-y-2.5 text-sm">
                            <li className="flex items-center gap-2.5">
                                <Mail className="size-4 shrink-0 text-muted-foreground" />
                                <span className="truncate">
                                    {profile.email}
                                </span>
                            </li>
                            <li className="flex items-center gap-2.5">
                                <Phone className="size-4 shrink-0 text-muted-foreground" />
                                {profile.contact_number ?? 'No number yet'}
                            </li>
                        </ul>
                        <Button
                            variant="outline"
                            asChild
                            className="mt-5 w-full"
                        >
                            <Link href={profileEdit()}>
                                <Settings2 />
                                Account settings
                            </Link>
                        </Button>
                    </div>

                    <div className="rounded-2xl border bg-muted/40 p-6 text-sm">
                        <p className="font-semibold">Good to know</p>
                        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
                            <li>
                                Every booking is confirmed by our front desk.
                            </li>
                            <li>
                                We keep one valid ID at the desk during your
                                stay and return it when the bill is paid.
                            </li>
                            <li>
                                We call your contact number about an hour before
                                your check-out.
                            </li>
                        </ul>
                    </div>
                </aside>
            </div>

            {stay && (
                <Dialog open={extending} onOpenChange={setExtending}>
                    <DialogContent>
                        <Form
                            action={askExtension().url}
                            method="post"
                            onSuccess={() => setExtending(false)}
                            className="space-y-4"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <DialogHeader>
                                        <DialogTitle>
                                            Ask to stay longer
                                        </DialogTitle>
                                        <DialogDescription>
                                            Your check-out is{' '}
                                            {formatDayTime(stay.due_out_at)}.
                                            The front desk checks that the room
                                            is free, tells you the price and
                                            confirms it. Nothing changes until
                                            they do.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <FormField
                                        label="New check-out"
                                        htmlFor="extend_until"
                                        error={errors.until}
                                    >
                                        <Input
                                            id="extend_until"
                                            name="until"
                                            type="datetime-local"
                                            required
                                        />
                                    </FormField>
                                    <FormField
                                        label="Message"
                                        htmlFor="extend_message"
                                        error={errors.message}
                                        optional
                                    >
                                        <Input
                                            id="extend_message"
                                            name="message"
                                            maxLength={300}
                                            placeholder="For example: our work finishes a day later"
                                        />
                                    </FormField>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                            >
                                                Not now
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                        >
                                            {processing && <Spinner />}
                                            Send to the front desk
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    </DialogContent>
                </Dialog>
            )}

            {cancelling && (
                <ConfirmAction
                    open
                    onOpenChange={(open) => !open && setCancelling(null)}
                    title={`Cancel your request for ${cancelling.rooms}?`}
                    description="The room will no longer be held for you. You can send a new request any time."
                    url={cancelRequest(cancelling.id).url}
                    method="patch"
                    confirmLabel="Cancel request"
                    destructive
                />
            )}
        </>
    );
}

function Stat({
    icon: Icon,
    label,
    value,
    detail,
}: {
    icon: typeof BedDouble;
    label: string;
    value: number;
    detail: string;
}) {
    return (
        <div className="rounded-2xl border bg-card p-5 shadow-lg">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{label}</p>
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-4" />
                </span>
            </div>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
                {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
    );
}

function Section({
    title,
    description,
    empty,
    children,
}: {
    title: string;
    description: string;
    empty?: string;
    children: ReactNode[];
}) {
    return (
        <section>
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            {children.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    {empty}
                </p>
            ) : (
                <ul className="mt-4 space-y-3">{children}</ul>
            )}
        </section>
    );
}

/** How a booking ended, e.g. "Cancelled by the front desk on 9 Oct 2026. Reason: ...". */
function Note({ children }: { children: ReactNode }) {
    return (
        <p className="mt-3 flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>{children}</span>
        </p>
    );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <dt className="text-xs opacity-70">{label}</dt>
            <dd className="mt-0.5 font-medium">{children}</dd>
        </div>
    );
}

function BookingFacts({
    from,
    to,
    guests,
    location,
}: {
    from: string;
    to: string;
    guests: number;
    location?: string;
}) {
    return (
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4" />
                {formatDayTime(from)} to {formatDayTime(to)}
            </span>
            <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" />
                {plural(guests, 'guest')}
            </span>
            {location && (
                <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" />
                    {location}
                </span>
            )}
        </p>
    );
}

function BookingCard({
    booking,
    muted = false,
}: {
    booking: Booking;
    muted?: boolean;
}) {
    return (
        <li
            className={cn(
                'rounded-xl border bg-card p-5 shadow-xs',
                muted && 'opacity-80',
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold">
                    <Link
                        href={showReservation(booking.id)}
                        className="underline-offset-4 hover:underline"
                    >
                        {booking.rooms}
                    </Link>
                </h3>
                <Badge variant={muted ? 'outline' : 'secondary'}>
                    {booking.status_label}
                </Badge>
            </div>
            <BookingFacts
                from={booking.starts_at}
                to={booking.ends_at}
                guests={booking.guests}
                location={booking.location}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">
                    {formatPeso(booking.total)}
                </span>
                {!muted && (
                    <PaymentStatusBadge status={booking.payment_status} />
                )}
            </div>
            {booking.note && <Note>{booking.note}</Note>}
            <Link
                href={showReservation(booking.id)}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
                {muted ? 'See details' : 'See details or cancel'}
                <ArrowRight className="size-4" />
            </Link>
        </li>
    );
}
