import { Form, Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Building2,
    CalendarClock,
    Info,
    MapPin,
    Users,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { FormField } from '@/components/form-field';
import { ContactLine } from '@/components/public/house-rules';
import { PaymentStatusBadge } from '@/components/reception/badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { formatDayTime, formatPeso, plural } from '@/lib/format';
import { home as guestHome } from '@/routes/guest';
import { cancel } from '@/routes/guest/reservations';
import type { PaymentStatus } from '@/types';

type Props = {
    reservation: {
        id: number;
        company: string | null;
        purpose: string | null;
        starts_at: string;
        ends_at: string;
        guests: number;
        total: string;
        paid: string;
        balance: string;
        payment_status: PaymentStatus;
        status: string;
        status_label: string;
        note: string | null;
        can_cancel: boolean;
        refunds: number;
    };
    rooms: {
        id: number;
        name: string;
        location: string;
        rate: string | null;
        guests: number;
        price: string;
    }[];
    payments: { id: number; amount: string; method: string; paid_at: string }[];
};

export default function GuestReservation({
    reservation,
    rooms,
    payments,
}: Props) {
    const [cancelling, setCancelling] = useState(false);
    const paid = Number(reservation.paid);

    return (
        <>
            <Head title={`Booking #${reservation.id}`} />
            <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">
                <Link
                    href={guestHome()}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                    <ArrowLeft className="size-4" />
                    My bookings
                </Link>

                <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                            Booking #{reservation.id}
                        </h1>
                        <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarClock className="size-4" />
                                {formatDayTime(reservation.starts_at)} to{' '}
                                {formatDayTime(reservation.ends_at)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <Users className="size-4" />
                                {plural(reservation.guests, 'guest')}
                            </span>
                            {reservation.company && (
                                <span className="inline-flex items-center gap-1.5">
                                    <Building2 className="size-4" />
                                    {reservation.company}
                                </span>
                            )}
                        </p>
                    </div>
                    <Badge
                        variant={
                            reservation.can_cancel ? 'secondary' : 'outline'
                        }
                        className="text-sm"
                    >
                        {reservation.status_label}
                    </Badge>
                </div>

                {reservation.note && (
                    <p className="mt-5 flex items-start gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-sm">
                        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span>
                            {reservation.note}
                            {reservation.refunds > 0 &&
                                ` ${formatPeso(reservation.refunds)} is being refunded by the front desk.`}
                        </span>
                    </p>
                )}

                <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="min-w-0 space-y-6">
                        <section className="rounded-2xl border bg-card p-6 shadow-xs">
                            <h2 className="text-lg font-semibold">
                                {rooms.length === 1
                                    ? 'Your room'
                                    : 'Your rooms'}
                            </h2>
                            <ul className="mt-4 divide-y">
                                {rooms.map((room) => (
                                    <li
                                        key={room.id}
                                        className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                                    >
                                        <div>
                                            <p className="font-medium">
                                                {room.name}
                                            </p>
                                            <p className="mt-0.5 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <MapPin className="size-3.5" />
                                                    {room.location}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Users className="size-3.5" />
                                                    {plural(
                                                        room.guests,
                                                        'guest',
                                                    )}
                                                </span>
                                                {room.rate && (
                                                    <span>{room.rate}</span>
                                                )}
                                            </p>
                                        </div>
                                        <span className="font-semibold tabular-nums">
                                            {formatPeso(room.price)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {reservation.purpose && (
                                <p className="mt-4 border-t pt-4 text-sm">
                                    <span className="text-muted-foreground">
                                        Purpose:{' '}
                                    </span>
                                    {reservation.purpose}
                                </p>
                            )}
                        </section>

                        <section className="rounded-2xl border bg-card p-6 shadow-xs">
                            <h2 className="text-lg font-semibold">Payments</h2>
                            {payments.length === 0 ? (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Nothing has been paid yet. You pay at the
                                    front desk, when you book or when you
                                    arrive.
                                </p>
                            ) : (
                                <ul className="mt-4 divide-y text-sm">
                                    {payments.map((payment) => (
                                        <li
                                            key={payment.id}
                                            className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                                        >
                                            <span>
                                                {formatDayTime(payment.paid_at)}
                                                <span className="text-muted-foreground">
                                                    {' '}
                                                    · {payment.method}
                                                </span>
                                            </span>
                                            <span className="font-medium tabular-nums">
                                                {formatPeso(payment.amount)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>

                    <aside className="lg:sticky lg:top-24 lg:self-start">
                        <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-lg">
                            <dl className="space-y-2 text-sm">
                                <div className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">
                                        Total
                                    </dt>
                                    <dd className="tabular-nums">
                                        {formatPeso(reservation.total)}
                                    </dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">
                                        Paid
                                    </dt>
                                    <dd className="tabular-nums">
                                        {formatPeso(reservation.paid)}
                                    </dd>
                                </div>
                                {/* A cancelled booking owes nothing more. */}
                                {reservation.status !== 'cancelled' &&
                                    reservation.status !== 'no_show' && (
                                        <div className="flex items-baseline justify-between gap-3 border-t pt-3">
                                            <dt className="font-semibold">
                                                Still to pay
                                            </dt>
                                            <dd className="text-2xl font-semibold tabular-nums">
                                                {formatPeso(
                                                    reservation.balance,
                                                )}
                                            </dd>
                                        </div>
                                    )}
                            </dl>
                            {reservation.can_cancel && (
                                <PaymentStatusBadge
                                    status={reservation.payment_status}
                                />
                            )}

                            {reservation.can_cancel ? (
                                <div className="space-y-2 border-t pt-4">
                                    <Button
                                        variant="outline"
                                        className="w-full text-destructive hover:text-destructive"
                                        onClick={() => setCancelling(true)}
                                    >
                                        <XCircle />
                                        Cancel this booking
                                    </Button>
                                    <p className="text-xs text-muted-foreground">
                                        You can cancel any time before you check
                                        in.
                                        {paid > 0 &&
                                            ' What you paid is refunded by the front desk.'}
                                    </p>
                                </div>
                            ) : (
                                <p className="border-t pt-4 text-xs text-muted-foreground">
                                    This booking can no longer be changed here.
                                </p>
                            )}
                            <ContactLine className="border-t pt-4 text-xs" />
                        </div>
                    </aside>
                </div>
            </div>

            <Dialog open={cancelling} onOpenChange={setCancelling}>
                <DialogContent>
                    <Form
                        action={cancel(reservation.id).url}
                        method="patch"
                        onSuccess={() => setCancelling(false)}
                        className="space-y-4"
                    >
                        {({ errors, processing }) => (
                            <>
                                <DialogHeader>
                                    <DialogTitle>
                                        Cancel booking #{reservation.id}?
                                    </DialogTitle>
                                    <DialogDescription>
                                        Your {plural(rooms.length, 'room')} will
                                        be released for other guests. This
                                        cannot be undone; you would need to send
                                        a new request.
                                        {paid > 0 &&
                                            ` The ${formatPeso(reservation.paid)} you paid will be refunded by the front desk.`}
                                    </DialogDescription>
                                </DialogHeader>
                                <FormField
                                    label="Reason"
                                    htmlFor="cancel_reason"
                                    error={errors.reason}
                                    optional
                                >
                                    <Input
                                        id="cancel_reason"
                                        name="reason"
                                        maxLength={200}
                                        placeholder="For example: the trip was moved"
                                    />
                                </FormField>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline">
                                            Keep my booking
                                        </Button>
                                    </DialogClose>
                                    <Button
                                        type="submit"
                                        variant="destructive"
                                        disabled={processing}
                                    >
                                        {processing && <Spinner />}
                                        Cancel booking
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>
        </>
    );
}
