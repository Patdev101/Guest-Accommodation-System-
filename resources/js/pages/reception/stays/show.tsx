import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeftRight,
    CalendarPlus,
    CheckCircle2,
    IdCard,
    ImageIcon,
    LogOut,
    Phone,
    Plus,
    SearchCheck,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import ChargeController from '@/actions/App/Http/Controllers/Reception/ChargeController';
import StayController from '@/actions/App/Http/Controllers/Reception/StayController';
import { ConfirmAction, ConfirmDelete } from '@/components/confirm-dialog';
import { IconButton } from '@/components/icon-button';
import { Page, PageHeader } from '@/components/page';
import { StayStateBadge } from '@/components/reception/badges';
import { CallDialog } from '@/components/reception/call-dialog';
import {
    ChargeDialog,
    DecideDialog,
    ExtendDialog,
    InspectDialog,
    StayPaymentDialog,
} from '@/components/reception/stay-dialogs';
import type {
    BilledTo,
    Conflict,
    ExtensionItem,
    StayRoomItem,
} from '@/components/reception/stay-dialogs';
import { RoomStatusBadge } from '@/components/room-status-badge';
import { Badge } from '@/components/ui/badge';
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
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDateTime, formatPeso, plural } from '@/lib/format';
import { show as reservationsShow } from '@/routes/reception/reservations';
import {
    index as staysIndex,
    show as staysShow,
} from '@/routes/reception/stays';
import type { StayRow } from '@/types';

type Props = {
    stay: StayRow & {
        purpose: string | null;
        email: string | null;
        checked_in_by: string;
        checked_out_by: string | null;
        not_extending_confirmed_at: string | null;
        default_billed_to: BilledTo;
    };
    rooms: StayRoomItem[];
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
        status: 'held' | 'held_pending_payment' | 'returned';
        status_label: string;
        received_by: string;
        returned_at: string | null;
        returned_by: string | null;
        photo_url: string | null;
    } | null;
    charges: {
        id: number;
        type: 'room' | 'extension' | 'damage' | 'extra';
        type_label: string;
        description: string;
        amount: string;
        billed_to: BilledTo;
    }[];
    payments: {
        id: number;
        amount: string;
        type: string;
        paid_by: BilledTo;
        method: string;
        receipt_number: string | null;
        received_by: string;
        paid_at: string;
        before_check_in: boolean;
    }[];
    bill: {
        charged: string;
        paid: string;
        balance: string;
        company_charged: string;
        company_paid: string;
        guest_charged: string;
        guest_paid: string;
    };
    extensions: ExtensionItem[];
    reminders: {
        id: number;
        sent_at: string;
        result: string | null;
        notes: string | null;
        logged_by: string | null;
    }[];
    can: {
        check_out: boolean;
        extend: boolean;
        confirm_not_extending: boolean;
        change_bill: boolean;
        return_id: boolean;
        return_id_blocker: string | null;
    };
    paymentMethods: string[];
    extensionCheck: { new_check_out_at: string; conflicts: Conflict[] } | null;
};

type Dialog =
    | 'check_out'
    | 'not_extending'
    | 'extend'
    | 'call'
    | 'charge'
    | 'pay'
    | 'return_id'
    | null;

const partyLabel: Record<BilledTo, string> = {
    company: 'Company',
    guest: 'Guest',
};

export default function StayPage(props: Props) {
    const {
        stay,
        rooms,
        guests,
        id,
        charges,
        payments,
        bill,
        extensions,
        reminders,
        can,
    } = props;
    const [dialog, setDialog] = useState<Dialog>(null);
    const [inspecting, setInspecting] = useState<StayRoomItem | null>(null);
    const [deciding, setDeciding] = useState<ExtensionItem | null>(null);
    const [removing, setRemoving] = useState<Props['charges'][number] | null>(
        null,
    );
    const close = () => setDialog(null);
    const balance = Number(bill.balance);
    const pending = extensions.filter(
        (item) => item.status === 'pending_consent',
    );

    return (
        <>
            <Head title={`Stay: ${stay.contact_name}`} />
            <Page className="max-w-6xl">
                <PageHeader
                    title={
                        <span className="flex flex-wrap items-center gap-3">
                            {stay.contact_name}
                            <StayStateBadge state={stay.state} />
                        </span>
                    }
                    description={
                        <>
                            {stay.reservation_id && (
                                <Link
                                    href={reservationsShow(stay.reservation_id)}
                                    className="underline-offset-4 hover:underline"
                                >
                                    Reservation #{stay.reservation_id}
                                </Link>
                            )}
                            {stay.company && ` · ${stay.company}`} ·{' '}
                            {stay.rooms.join(', ')} ·{' '}
                            {plural(stay.pax, 'guest')}
                        </>
                    }
                    actions={
                        can.check_out && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setDialog('call')}
                                >
                                    <Phone />
                                    Log call
                                </Button>
                                {can.confirm_not_extending && (
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            setDialog('not_extending')
                                        }
                                    >
                                        <CheckCircle2 />
                                        Not extending
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    onClick={() => setDialog('extend')}
                                >
                                    <CalendarPlus />
                                    Extend stay
                                </Button>
                                <Button onClick={() => setDialog('check_out')}>
                                    <LogOut />
                                    Check out
                                </Button>
                            </>
                        )
                    }
                />

                {stay.overdue && (
                    <Notice>
                        The expected check-out (
                        {formatDateTime(stay.expected_check_out_at)}) has
                        passed. Check the guests out, or extend the stay.
                    </Notice>
                )}

                {pending.map((extension) => (
                    <Notice key={extension.id}>
                        <span className="flex flex-wrap items-center justify-between gap-3">
                            <span>
                                Extension to{' '}
                                {formatDateTime(extension.new_check_out_at)} is
                                waiting for the next guest’s answer.
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeciding(extension)}
                            >
                                Record answer
                            </Button>
                        </span>
                    </Notice>
                ))}

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Rooms</CardTitle>
                                <CardDescription>
                                    {stay.checked_out_at
                                        ? 'Inspect each room: charge any damage, then send it to cleaning or for repair.'
                                        : 'The rooms go to inspection when the guests check out.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul className="divide-y rounded-lg border">
                                    {rooms.map((room) => (
                                        <li
                                            key={room.id}
                                            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium">
                                                    {room.name}{' '}
                                                    <span className="font-normal text-muted-foreground">
                                                        · {room.location} ·{' '}
                                                        {plural(
                                                            room.pax,
                                                            'guest',
                                                        )}
                                                    </span>
                                                </p>
                                                {room.inspected_at && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Inspected by{' '}
                                                        {room.inspected_by},{' '}
                                                        {formatDateTime(
                                                            room.inspected_at,
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                            <RoomStatusBadge
                                                group={room.group}
                                                label={room.status_label}
                                            />
                                            {stay.checked_out_at &&
                                                !room.inspected_at && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() =>
                                                            setInspecting(room)
                                                        }
                                                    >
                                                        <SearchCheck />
                                                        Inspect
                                                    </Button>
                                                )}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1.5">
                                    <CardTitle>Bill</CardTitle>
                                    <CardDescription>
                                        Room charges, extensions, damages and
                                        extras, less payments (including the
                                        reservation’s downpayment).
                                    </CardDescription>
                                </div>
                                {can.change_bill && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setDialog('charge')}
                                    >
                                        <Plus />
                                        Add charge
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {charges.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No charges yet.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto rounded-lg border">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="pl-4">
                                                        Item
                                                    </TableHead>
                                                    <TableHead>
                                                        Billed to
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Amount
                                                    </TableHead>
                                                    <TableHead className="w-20 pr-4">
                                                        <span className="sr-only">
                                                            Actions
                                                        </span>
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {charges.map((charge) => {
                                                    const other: BilledTo =
                                                        charge.billed_to ===
                                                        'company'
                                                            ? 'guest'
                                                            : 'company';

                                                    return (
                                                        <TableRow
                                                            key={charge.id}
                                                        >
                                                            <TableCell className="pl-4">
                                                                <span className="font-medium">
                                                                    {
                                                                        charge.description
                                                                    }
                                                                </span>
                                                                <span className="block text-xs text-muted-foreground">
                                                                    {
                                                                        charge.type_label
                                                                    }
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline">
                                                                    {
                                                                        partyLabel[
                                                                            charge
                                                                                .billed_to
                                                                        ]
                                                                    }
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                                {formatPeso(
                                                                    charge.amount,
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="pr-4">
                                                                {can.change_bill && (
                                                                    <span className="flex justify-end gap-1">
                                                                        <IconButton
                                                                            label={`Bill to the ${other} instead`}
                                                                            onClick={() =>
                                                                                router.patch(
                                                                                    ChargeController.update.url(
                                                                                        charge.id,
                                                                                    ),
                                                                                    {
                                                                                        billed_to:
                                                                                            other,
                                                                                    },
                                                                                    {
                                                                                        preserveScroll: true,
                                                                                    },
                                                                                )
                                                                            }
                                                                        >
                                                                            <ArrowLeftRight />
                                                                        </IconButton>
                                                                        <IconButton
                                                                            label={`Remove ${charge.description}`}
                                                                            className="text-muted-foreground hover:text-destructive"
                                                                            disabled={
                                                                                charge.type ===
                                                                                'room'
                                                                            }
                                                                            disabledReason="Room charges come from the reservation"
                                                                            onClick={() =>
                                                                                setRemoving(
                                                                                    charge,
                                                                                )
                                                                            }
                                                                        >
                                                                            <Trash2 />
                                                                        </IconButton>
                                                                    </span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}

                                <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[1fr_auto]">
                                    <dt className="text-muted-foreground">
                                        Charged
                                    </dt>
                                    <dd className="tabular-nums sm:text-right">
                                        {formatPeso(bill.charged)}
                                    </dd>
                                    <dt className="text-muted-foreground">
                                        Paid
                                    </dt>
                                    <dd className="tabular-nums sm:text-right">
                                        {formatPeso(bill.paid)}
                                    </dd>
                                    <dt className="font-medium">
                                        {balance >= 0 ? 'Balance' : 'Overpaid'}
                                    </dt>
                                    <dd className="font-semibold tabular-nums sm:text-right">
                                        {formatPeso(Math.abs(balance))}
                                    </dd>
                                </dl>
                                <p className="text-xs text-muted-foreground">
                                    Company: charged{' '}
                                    {formatPeso(bill.company_charged)}, paid{' '}
                                    {formatPeso(bill.company_paid)} · Guest:
                                    charged {formatPeso(bill.guest_charged)},
                                    paid {formatPeso(bill.guest_paid)}
                                </p>

                                <div className="space-y-3 border-t pt-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <p className="text-sm font-medium">
                                            Payments
                                        </p>
                                        {can.change_bill && balance > 0 && (
                                            <Button
                                                size="sm"
                                                onClick={() => setDialog('pay')}
                                            >
                                                <Plus />
                                                Record payment
                                            </Button>
                                        )}
                                    </div>
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
                                                            {payment.method} ·
                                                            by the{' '}
                                                            {payment.paid_by}
                                                        </p>
                                                        <p className="text-muted-foreground">
                                                            {formatDateTime(
                                                                payment.paid_at,
                                                            )}
                                                            , received by{' '}
                                                            {
                                                                payment.received_by
                                                            }
                                                            {payment.receipt_number &&
                                                                ` · receipt ${payment.receipt_number}`}
                                                            {payment.before_check_in &&
                                                                ' · on the reservation'}
                                                        </p>
                                                    </div>
                                                    <span className="font-medium tabular-nums">
                                                        {formatPeso(
                                                            payment.amount,
                                                        )}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Guest list</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto rounded-lg border">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="pl-4">
                                                    Name
                                                </TableHead>
                                                <TableHead>Address</TableHead>
                                                <TableHead>Contact</TableHead>
                                                <TableHead className="pr-4">
                                                    Room
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {guests.map((guest) => (
                                                <TableRow key={guest.id}>
                                                    <TableCell className="pl-4 font-medium">
                                                        {guest.name}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {guest.address ?? '—'}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {guest.contact_number ??
                                                            '—'}
                                                    </TableCell>
                                                    <TableCell className="pr-4">
                                                        {guest.room}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        {(extensions.length > 0 || reminders.length > 0) && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Calls and extensions</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-3 text-sm">
                                        {extensions.map((extension) => (
                                            <li
                                                key={`e${extension.id}`}
                                                className="rounded-lg border px-4 py-3"
                                            >
                                                <p className="font-medium">
                                                    Extension to{' '}
                                                    {formatDateTime(
                                                        extension.new_check_out_at,
                                                    )}
                                                    :{' '}
                                                    {extension.status_label.toLowerCase()}
                                                    {extension.price &&
                                                        Number(
                                                            extension.price,
                                                        ) > 0 &&
                                                        ` · ${formatPeso(extension.price)}`}
                                                </p>
                                                <p className="text-muted-foreground">
                                                    Asked by{' '}
                                                    {extension.requested_by};
                                                    was due out{' '}
                                                    {formatDateTime(
                                                        extension.old_check_out_at,
                                                    )}
                                                    {extension.denial_reason &&
                                                        `. ${extension.denial_reason}`}
                                                </p>
                                                {extension.moves.map((move) => (
                                                    <p
                                                        key={move.id}
                                                        className="text-muted-foreground"
                                                    >
                                                        {move.guest}:{' '}
                                                        {move.from} →{' '}
                                                        {move.to ?? 'no room'} ·{' '}
                                                        {move.consent}
                                                    </p>
                                                ))}
                                            </li>
                                        ))}
                                        {reminders.map((reminder) => (
                                            <li
                                                key={`r${reminder.id}`}
                                                className="rounded-lg border px-4 py-3"
                                            >
                                                <p className="font-medium">
                                                    Call:{' '}
                                                    {reminder.result ??
                                                        'no result'}
                                                </p>
                                                <p className="text-muted-foreground">
                                                    {formatDateTime(
                                                        reminder.sent_at,
                                                    )}
                                                    {reminder.logged_by &&
                                                        ` by ${reminder.logged_by}`}
                                                    {reminder.notes &&
                                                        `: “${reminder.notes}”`}
                                                </p>
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
                                <CardTitle>Stay</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="grid gap-3 text-sm">
                                    <Detail label="Checked in">
                                        {formatDateTime(stay.checked_in_at)} by{' '}
                                        {stay.checked_in_by}
                                    </Detail>
                                    <Detail label="Expected check-out">
                                        {formatDateTime(
                                            stay.expected_check_out_at,
                                        )}
                                        {stay.not_extending_confirmed_at && (
                                            <span className="block text-xs font-normal text-muted-foreground">
                                                Not extending (confirmed{' '}
                                                {formatDateTime(
                                                    stay.not_extending_confirmed_at,
                                                )}
                                                )
                                            </span>
                                        )}
                                    </Detail>
                                    {stay.checked_out_at && (
                                        <Detail label="Checked out">
                                            {formatDateTime(
                                                stay.checked_out_at,
                                            )}{' '}
                                            by {stay.checked_out_by}
                                        </Detail>
                                    )}
                                    <Detail label="Contact number">
                                        <a
                                            href={`tel:${stay.contact_number}`}
                                            className="underline-offset-4 hover:underline"
                                        >
                                            {stay.contact_number}
                                        </a>
                                    </Detail>
                                    {stay.purpose && (
                                        <Detail label="Purpose">
                                            {stay.purpose}
                                        </Detail>
                                    )}
                                </dl>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                                <CardTitle className="flex items-center gap-2">
                                    <IdCard className="size-4 text-muted-foreground" />
                                    ID
                                </CardTitle>
                                {can.return_id &&
                                    (can.return_id_blocker ? (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span tabIndex={0}>
                                                    <Button size="sm" disabled>
                                                        Return ID
                                                    </Button>
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                {can.return_id_blocker}
                                            </TooltipContent>
                                        </Tooltip>
                                    ) : (
                                        <Button
                                            size="sm"
                                            onClick={() =>
                                                setDialog('return_id')
                                            }
                                        >
                                            Return ID
                                        </Button>
                                    ))}
                            </CardHeader>
                            <CardContent>
                                {id === null ? (
                                    <p className="text-sm text-muted-foreground">
                                        No ID on record.
                                    </p>
                                ) : (
                                    <dl className="grid gap-3 text-sm">
                                        <Detail label="Type">{id.type}</Detail>
                                        <Detail label="Number">
                                            {id.number}
                                        </Detail>
                                        <Detail label="Status">
                                            {id.status_label}
                                        </Detail>
                                        <Detail label="Received by">
                                            {id.received_by}
                                        </Detail>
                                        {id.returned_at && (
                                            <Detail label="Returned">
                                                {formatDateTime(id.returned_at)}{' '}
                                                by {id.returned_by}
                                            </Detail>
                                        )}
                                        {id.photo_url && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                asChild
                                                className="w-fit"
                                            >
                                                <a
                                                    href={id.photo_url}
                                                    target="_blank"
                                                    rel="noopener"
                                                >
                                                    <ImageIcon />
                                                    View ID photo
                                                </a>
                                            </Button>
                                        )}
                                        {can.return_id &&
                                            can.return_id_blocker && (
                                                <p className="text-xs text-muted-foreground">
                                                    Return it when:{' '}
                                                    {can.return_id_blocker}
                                                </p>
                                            )}
                                    </dl>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </Page>

            <ConfirmAction
                open={dialog === 'check_out'}
                onOpenChange={(open) => !open && close()}
                title={`Check out ${stay.contact_name}?`}
                description={`Confirm it is their booking (${stay.rooms.join(', ')}). The guests may leave now; the rooms go to inspection, and the bill and ID are settled after that.`}
                url={StayController.checkOut.url(stay.id)}
                method="post"
                confirmLabel="Check out"
            />
            <ConfirmAction
                open={dialog === 'not_extending'}
                onOpenChange={(open) => !open && close()}
                title="Not extending?"
                description={`The guests confirmed they leave by ${formatDateTime(stay.expected_check_out_at)}. Their rooms can then be booked from that time.`}
                url={StayController.notExtending.url(stay.id)}
                method="patch"
                confirmLabel="Confirm"
            />
            <ConfirmAction
                open={dialog === 'return_id'}
                onOpenChange={(open) => !open && close()}
                title={`Return the ${id?.type ?? 'ID'} to ${stay.contact_name}?`}
                description="Everything is paid and every room is inspected. This settles the stay; its bill can no longer change."
                url={StayController.returnId.url(stay.id)}
                method="post"
                confirmLabel="Return ID"
            />
            {removing && (
                <ConfirmDelete
                    open
                    onOpenChange={(open) => !open && setRemoving(null)}
                    title={`Remove “${removing.description}”?`}
                    description={`${formatPeso(removing.amount)} comes off the bill.`}
                    url={ChargeController.destroy.url(removing.id)}
                    confirmLabel="Remove"
                />
            )}
            <CallDialog
                stay={dialog === 'call' ? stay : null}
                onClose={close}
            />
            <ExtendDialog
                key={stay.expected_check_out_at}
                stayId={stay.id}
                open={dialog === 'extend'}
                expectedCheckOut={stay.expected_check_out_at}
                rooms={rooms}
                check={props.extensionCheck}
                onClose={close}
            />
            <DecideDialog
                extension={deciding}
                onClose={() => setDeciding(null)}
            />
            <InspectDialog
                stayId={stay.id}
                room={inspecting}
                defaultBilledTo={stay.default_billed_to}
                onClose={() => setInspecting(null)}
            />
            <ChargeDialog
                stayId={stay.id}
                open={dialog === 'charge'}
                defaultBilledTo={stay.default_billed_to}
                onClose={close}
            />
            <StayPaymentDialog
                stayId={stay.id}
                open={dialog === 'pay'}
                balance={bill.balance}
                defaultPaidBy={stay.default_billed_to}
                paymentMethods={props.paymentMethods}
                onClose={close}
            />
        </>
    );
}

function Notice({ children }: { children: ReactNode }) {
    return (
        <div
            role="status"
            className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40"
        >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <div className="min-w-0 flex-1">{children}</div>
        </div>
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

StayPage.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'In house', href: staysIndex() },
        { title: props.stay.contact_name, href: staysShow(props.stay.id) },
    ],
});
