import { Form, Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    Ban,
    IdCard,
    LogIn,
    Pencil,
    Plus,
    UserX,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import CheckInController from '@/actions/App/Http/Controllers/Reception/CheckInController';
import ReservationController from '@/actions/App/Http/Controllers/Reception/ReservationController';
import ReservationPaymentController from '@/actions/App/Http/Controllers/Reception/ReservationPaymentController';
import { ConfirmAction } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { Page, PageHeader } from '@/components/page';
import { IdPhotoButton } from '@/components/reception/viewers';
import {
    PaymentStatusBadge,
    RefundStatusBadge,
    ReservationStatusBadge,
} from '@/components/reception/badges';
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
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    formatDateTime,
    formatDayTime,
    formatPeso,
    plural,
} from '@/lib/format';
import {
    index as reservationsIndex,
    show as reservationsShow,
} from '@/routes/reception/reservations';
import { show as staysShow } from '@/routes/reception/stays';
import type { RefundStatus, ReservationRow } from '@/types';

type Reservation = ReservationRow & {
    email: string | null;
    guest_type: string;
    purpose: string | null;
    booked_via: string;
    booked_by: string;
    booked_at: string;
    cancelled_at: string | null;
    cancelled_by: string | null;
    cancellation_reason: string | null;
    balance: string;
    no_show_from: string;
};

type Props = {
    reservation: Reservation;
    rooms: {
        id: number;
        room: string;
        location: string;
        pax: number;
        pax_capacity: number;
        rate: string | null;
        price: string;
    }[];
    payments: {
        id: number;
        amount: string;
        type: string;
        paid_by: string;
        method: string;
        receipt_number: string | null;
        received_by: string;
        paid_at: string;
    }[];
    refunds: {
        id: number;
        amount: string;
        reason: string;
        status: RefundStatus;
        status_label: string;
    }[];
    stay: Stay | null;
    can: {
        check_in: boolean;
        edit: boolean;
        pay: boolean;
        cancel: boolean;
        no_show: boolean;
    };
    paymentMethods: string[];
    noShowRefund: number;
};

type Stay = {
    stay_id: number;
    checked_in_at: string;
    checked_in_by: string;
    expected_check_out_at: string;
    checked_out_at: string | null;
    rooms: { room: string; pax: number }[];
    guests: {
        id: number;
        name: string;
        address: string | null;
        contact_number: string | null;
        room: string;
    }[];
    id: {
        type: string;
        number: string;
        status: string;
        received_by: string;
        photo_url: string | null;
    } | null;
};

export default function ReservationPage({
    reservation,
    rooms,
    payments,
    refunds,
    stay,
    can,
    paymentMethods,
    noShowRefund,
}: Props) {
    const [dialog, setDialog] = useState<'cancel' | 'no_show' | 'pay' | null>(
        null,
    );
    const close = () => setDialog(null);
    const active = reservation.status === 'active';
    const paid = Number(reservation.paid);

    return (
        <>
            <Head title={`Reservation #${reservation.id}`} />
            <Page className="max-w-5xl">
                <PageHeader
                    title={
                        <span className="flex flex-wrap items-center gap-3">
                            {reservation.contact_name}
                            <ReservationStatusBadge
                                status={reservation.status}
                                label={reservation.status_label}
                            />
                        </span>
                    }
                    description={`Reservation #${reservation.id}${reservation.company ? ` · ${reservation.company}` : ''}`}
                    actions={
                        active && (
                            <>
                                {can.no_show ? (
                                    <Button
                                        variant="outline"
                                        onClick={() => setDialog('no_show')}
                                    >
                                        <UserX />
                                        Mark no-show
                                    </Button>
                                ) : (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span tabIndex={0}>
                                                <Button
                                                    variant="outline"
                                                    disabled
                                                >
                                                    <UserX />
                                                    Mark no-show
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            The room is held until{' '}
                                            {formatDayTime(
                                                reservation.no_show_from,
                                            )}{' '}
                                            (grace period)
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                                {can.edit && (
                                    <Button variant="outline" asChild>
                                        <Link
                                            href={ReservationController.edit(
                                                reservation.id,
                                            )}
                                        >
                                            <Pencil />
                                            Edit
                                        </Link>
                                    </Button>
                                )}
                                {can.cancel && (
                                    <Button
                                        variant="outline"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => setDialog('cancel')}
                                    >
                                        <Ban />
                                        Cancel reservation
                                    </Button>
                                )}
                                {can.check_in && (
                                    <Button asChild>
                                        <Link
                                            href={CheckInController.create(
                                                reservation.id,
                                            )}
                                        >
                                            <LogIn />
                                            Check in
                                        </Link>
                                    </Button>
                                )}
                            </>
                        )
                    }
                />

                {stay && <StayCard stay={stay} />}

                {reservation.status === 'cancelled' && (
                    <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                        Cancelled by {reservation.cancelled_by} on{' '}
                        {reservation.cancelled_at &&
                            formatDateTime(reservation.cancelled_at)}
                        : “{reservation.cancellation_reason}”
                    </p>
                )}

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Stay</CardTitle>
                                <CardDescription>
                                    {formatDateTime(reservation.starts_at)} to{' '}
                                    {formatDateTime(reservation.ends_at)} ·{' '}
                                    {plural(reservation.pax, 'guest')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul className="divide-y rounded-lg border">
                                    {rooms.map((room) => (
                                        <li
                                            key={room.id}
                                            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium">
                                                    {room.room}{' '}
                                                    <span className="font-normal text-muted-foreground">
                                                        · {room.location}
                                                    </span>
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {plural(room.pax, 'guest')}{' '}
                                                    (room takes{' '}
                                                    {room.pax_capacity})
                                                    {room.rate &&
                                                        ` · ${room.rate}`}
                                                </p>
                                            </div>
                                            <span className="tabular-nums">
                                                {formatPeso(room.price)}
                                            </span>
                                        </li>
                                    ))}
                                    <li className="flex justify-between px-4 py-3 font-medium">
                                        <span>Total</span>
                                        <span className="tabular-nums">
                                            {formatPeso(reservation.total)}
                                        </span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1.5">
                                    <CardTitle className="flex items-center gap-2">
                                        Payments
                                        <PaymentStatusBadge
                                            status={reservation.payment_status}
                                        />
                                    </CardTitle>
                                    <CardDescription>
                                        Paid {formatPeso(paid)} of{' '}
                                        {formatPeso(reservation.total)}
                                        {Number(reservation.balance) > 0 &&
                                            ` · balance ${formatPeso(reservation.balance)}`}
                                    </CardDescription>
                                </div>
                                {can.pay && (
                                    <Button
                                        size="sm"
                                        onClick={() => setDialog('pay')}
                                    >
                                        <Plus />
                                        Record payment
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent>
                                {payments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No payments yet.
                                    </p>
                                ) : (
                                    <ul className="divide-y rounded-lg border">
                                        {payments.map((payment) => (
                                            <li
                                                key={payment.id}
                                                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium">
                                                        {payment.type} ·{' '}
                                                        {payment.method}
                                                    </p>
                                                    <p className="text-muted-foreground">
                                                        Paid by{' '}
                                                        {payment.paid_by.toLowerCase()}
                                                        ,{' '}
                                                        {formatDateTime(
                                                            payment.paid_at,
                                                        )}
                                                        , received by{' '}
                                                        {payment.received_by}
                                                        {payment.receipt_number &&
                                                            ` · receipt ${payment.receipt_number}`}
                                                    </p>
                                                </div>
                                                <span className="font-medium tabular-nums">
                                                    {formatPeso(payment.amount)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>

                        {refunds.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Refunds</CardTitle>
                                    <CardDescription>
                                        Processed on the Refunds page.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ul className="divide-y rounded-lg border">
                                        {refunds.map((refund) => (
                                            <li
                                                key={refund.id}
                                                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                                            >
                                                <span className="min-w-0 flex-1">
                                                    {refund.reason}
                                                </span>
                                                <RefundStatusBadge
                                                    status={refund.status}
                                                    label={refund.status_label}
                                                />
                                                <span className="font-medium tabular-nums">
                                                    {formatPeso(refund.amount)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Contact person</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="grid gap-3 text-sm">
                                    <Detail label="Name">
                                        {reservation.contact_name}
                                    </Detail>
                                    <Detail label="Contact number">
                                        <a
                                            href={`tel:${reservation.contact_number}`}
                                            className="underline-offset-4 hover:underline"
                                        >
                                            {reservation.contact_number}
                                        </a>
                                    </Detail>
                                    {reservation.email && (
                                        <Detail label="Email">
                                            {reservation.email}
                                        </Detail>
                                    )}
                                    <Detail label="Guest type">
                                        {reservation.guest_type}
                                    </Detail>
                                    <Detail label="Company">
                                        {reservation.company ?? '—'}
                                    </Detail>
                                    <Detail label="Purpose of stay">
                                        {reservation.purpose ?? '—'}
                                    </Detail>
                                </dl>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Booking</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="grid gap-3 text-sm">
                                    <Detail label="Booked">
                                        {formatDateTime(reservation.booked_at)}{' '}
                                        by {reservation.booked_by}
                                    </Detail>
                                    <Detail label="Made">
                                        {reservation.booked_via}
                                    </Detail>
                                </dl>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </Page>

            <Dialog
                open={dialog === 'cancel'}
                onOpenChange={(open) => !open && close()}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel this reservation?</DialogTitle>
                        <DialogDescription>
                            The rooms become free again.
                            {paid > 0 &&
                                ` A refund of ${formatPeso(paid)} will be requested for the payments made.`}
                        </DialogDescription>
                    </DialogHeader>
                    <Form
                        {...ReservationController.cancel.form(reservation.id)}
                        options={{ preserveScroll: true }}
                        onSuccess={close}
                        className="space-y-4"
                    >
                        {({ errors, processing }) => (
                            <>
                                <FormField
                                    label="Reason"
                                    htmlFor="cancel_reason"
                                    error={errors.reason}
                                >
                                    <Textarea
                                        id="cancel_reason"
                                        name="reason"
                                        rows={3}
                                        placeholder="e.g. Guest called to cancel; project moved to next month"
                                        required
                                    />
                                </FormField>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline">
                                            Keep it
                                        </Button>
                                    </DialogClose>
                                    <Button
                                        type="submit"
                                        variant="destructive"
                                        disabled={processing}
                                    >
                                        {processing && <Spinner />}
                                        Cancel reservation
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>

            <ConfirmAction
                open={dialog === 'no_show'}
                onOpenChange={(open) => !open && close()}
                title="Mark as a no-show?"
                description={
                    paid > 0
                        ? noShowRefund > 0
                            ? `The rooms become free again. Under the current policy, ${noShowRefund}% of the ${formatPeso(paid)} paid will be refunded.`
                            : `The rooms become free again. Under the current policy, the ${formatPeso(paid)} paid is not refunded.`
                        : 'The rooms become free again.'
                }
                url={ReservationController.markNoShow.url(reservation.id)}
                method="patch"
                confirmLabel="Mark no-show"
                destructive
            />

            <Dialog
                open={dialog === 'pay'}
                onOpenChange={(open) => !open && close()}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Record a payment</DialogTitle>
                        <DialogDescription>
                            Balance {formatPeso(reservation.balance)}.
                        </DialogDescription>
                    </DialogHeader>
                    <Form
                        {...ReservationPaymentController.store.form(
                            reservation.id,
                        )}
                        options={{ preserveScroll: true }}
                        onSuccess={close}
                        className="space-y-4"
                    >
                        {({ errors, processing }) => (
                            <>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <FormField
                                        label="Amount"
                                        htmlFor="pay_amount"
                                        error={errors.amount}
                                    >
                                        <div className="relative">
                                            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                                                ₱
                                            </span>
                                            <Input
                                                id="pay_amount"
                                                name="amount"
                                                type="number"
                                                inputMode="decimal"
                                                min={0.01}
                                                max={reservation.balance}
                                                step="0.01"
                                                defaultValue={
                                                    reservation.balance
                                                }
                                                className="pl-7"
                                                required
                                            />
                                        </div>
                                    </FormField>
                                    <FormField
                                        label="Paid with"
                                        htmlFor="pay_method"
                                        error={errors.method}
                                    >
                                        <Select name="method" required>
                                            <SelectTrigger
                                                id="pay_method"
                                                className="w-full"
                                            >
                                                <SelectValue placeholder="Choose" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {paymentMethods.map(
                                                    (method) => (
                                                        <SelectItem
                                                            key={method}
                                                            value={method}
                                                        >
                                                            {method}
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </FormField>
                                    <FormField
                                        label="Paid by"
                                        htmlFor="pay_paid_by"
                                        error={errors.paid_by}
                                    >
                                        <Select
                                            name="paid_by"
                                            defaultValue="guest"
                                        >
                                            <SelectTrigger
                                                id="pay_paid_by"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="guest">
                                                    Guest
                                                </SelectItem>
                                                <SelectItem value="company">
                                                    Company
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormField>
                                    <FormField
                                        label="Receipt number"
                                        htmlFor="pay_receipt"
                                        optional
                                        error={errors.receipt_number}
                                    >
                                        <Input
                                            id="pay_receipt"
                                            name="receipt_number"
                                        />
                                    </FormField>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={processing}>
                                        {processing && <Spinner />}
                                        Record payment
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

/** Who checked in, where, until when, and the ID being held. */
function StayCard({ stay }: { stay: Stay }) {
    return (
        <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                    <CardTitle>
                        {stay.checked_out_at ? 'Checked out' : 'Checked in'}
                    </CardTitle>
                    <CardDescription>
                        In {formatDateTime(stay.checked_in_at)} by{' '}
                        {stay.checked_in_by} ·{' '}
                        {stay.checked_out_at
                            ? `out ${formatDateTime(stay.checked_out_at)}`
                            : `expected out ${formatDateTime(stay.expected_check_out_at)}`}{' '}
                        ·{' '}
                        {stay.rooms
                            .map((room) => `${room.room} (${room.pax})`)
                            .join(', ')}
                    </CardDescription>
                </div>
                <Button size="sm" asChild>
                    <Link href={staysShow(stay.stay_id)}>
                        Open
                        <ArrowRight />
                    </Link>
                </Button>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="pl-4">Guest</TableHead>
                                <TableHead>Address</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead className="pr-4">Room</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stay.guests.map((guest) => (
                                <TableRow key={guest.id}>
                                    <TableCell className="pl-4 font-medium">
                                        {guest.name}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {guest.address ?? '—'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {guest.contact_number ?? '—'}
                                    </TableCell>
                                    <TableCell className="pr-4">
                                        {guest.room}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {stay.id && (
                    <div className="space-y-3 rounded-lg border p-4">
                        <p className="flex items-center gap-2 font-medium">
                            <IdCard className="size-4 text-muted-foreground" />
                            ID held
                        </p>
                        <dl className="grid gap-3 text-sm">
                            <Detail label="Type">{stay.id.type}</Detail>
                            <Detail label="Number">{stay.id.number}</Detail>
                            <Detail label="Status">{stay.id.status}</Detail>
                            <Detail label="Received by">
                                {stay.id.received_by}
                            </Detail>
                        </dl>
                        {stay.id.photo_url ? (
                            <IdPhotoButton
                                url={stay.id.photo_url}
                                guest="the contact person"
                            />
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                No photo (recorded before photos were required).
                            </p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid gap-0.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium break-words">{children}</dd>
        </div>
    );
}

ReservationPage.layout = (props: { reservation: Reservation }) => ({
    breadcrumbs: [
        { title: 'Reservations', href: reservationsIndex() },
        {
            title: `#${props.reservation.id} ${props.reservation.contact_name}`,
            href: reservationsShow(props.reservation.id),
        },
    ],
});
