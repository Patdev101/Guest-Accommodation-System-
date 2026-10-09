import { Form, Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    Building2,
    CalendarClock,
    Check,
    Hourglass,
    Inbox,
    Mail,
    MessageSquare,
    Phone,
    Users,
    X,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import BookingRequestController from '@/actions/App/Http/Controllers/Reception/BookingRequestController';
import { ConfirmAction } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { FormField } from '@/components/form-field';
import { Page, PageHeader } from '@/components/page';
import { Pager } from '@/components/pager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatDayTime, formatPeso, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { show as reservationsShow } from '@/routes/reception/reservations';
import { index as requestsIndex } from '@/routes/reception/requests';
import type { Paginated } from '@/types';

type BookingRequest = {
    id: number;
    contact_name: string;
    contact_number: string;
    email: string | null;
    company: string | null;
    purpose: string | null;
    guest_type: string;
    guests: number;
    rooms: string;
    rate: string;
    starts_at: string;
    ends_at: string;
    total: string;
    message: string | null;
    status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'expired';
    status_label: string;
    /** Still to be answered (the shown status can follow the reservation). */
    waiting: boolean;
    sent_at: string;
    hold_expires_at: string | null;
    decided_by: string | null;
    decided_at: string | null;
    decline_reason: string | null;
    reservation_id: number | null;
    /** Why the room is no longer free, when it cannot be approved as it is. */
    problem: string | null;
};

type Props = {
    requests: Paginated<BookingRequest>;
    show: string;
    filterOptions: { value: string; label: string }[];
    waiting: number;
};

const statusTone: Record<BookingRequest['status'], string> = {
    pending:
        'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    approved:
        'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    declined:
        'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
    cancelled: 'border-border bg-muted text-muted-foreground',
    expired: 'border-border bg-muted text-muted-foreground',
};

export default function Requests({
    requests,
    show,
    filterOptions,
    waiting,
}: Props) {
    const [approving, setApproving] = useState<BookingRequest | null>(null);
    const [declining, setDeclining] = useState<BookingRequest | null>(null);

    return (
        <>
            <Head title="Booking requests" />
            <Page>
                <PageHeader
                    title="Booking requests"
                    description="Bookings guests asked for online. Approve one to make it a reservation, or decline it with a reason the guest will see."
                    actions={
                        waiting > 0 && (
                            <Badge variant="secondary" className="text-sm">
                                <Hourglass />
                                {waiting} waiting
                            </Badge>
                        )
                    }
                />

                <ToggleGroup
                    type="single"
                    variant="outline"
                    value={show}
                    onValueChange={(value) =>
                        value &&
                        router.get(
                            requestsIndex().url,
                            value === 'waiting' ? {} : { show: value },
                            { preserveState: true, replace: true },
                        )
                    }
                    className="w-fit flex-wrap"
                >
                    {filterOptions.map((option) => (
                        <ToggleGroupItem
                            key={option.value}
                            value={option.value}
                            className="px-4"
                        >
                            {option.label}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>

                {requests.data.length === 0 ? (
                    <EmptyState
                        icon={Inbox}
                        title={
                            show === 'waiting'
                                ? 'No requests are waiting'
                                : 'No requests here'
                        }
                        description="When a guest sends a booking request online, it appears here and under the bell."
                    />
                ) : (
                    <ul className="space-y-4">
                        {requests.data.map((request) => (
                            <li key={request.id}>
                                <Card className="gap-4 p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h2 className="text-lg font-semibold">
                                                {request.contact_name}
                                            </h2>
                                            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Building2 className="size-4" />
                                                    {request.company ?? '—'} ·{' '}
                                                    {request.guest_type}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Phone className="size-4" />
                                                    {request.contact_number}
                                                </span>
                                                {request.email && (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <Mail className="size-4" />
                                                        {request.email}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <span
                                            className={cn(
                                                'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                                                statusTone[request.status],
                                            )}
                                        >
                                            {request.status_label}
                                        </span>
                                    </div>

                                    <dl className="grid gap-4 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                        <Fact label="Room">
                                            {request.rooms}
                                        </Fact>
                                        <Fact label="Dates">
                                            <span className="inline-flex items-start gap-1.5">
                                                <CalendarClock className="mt-0.5 size-4 shrink-0" />
                                                <span>
                                                    {formatDayTime(
                                                        request.starts_at,
                                                    )}
                                                    <br />
                                                    to{' '}
                                                    {formatDayTime(
                                                        request.ends_at,
                                                    )}
                                                </span>
                                            </span>
                                        </Fact>
                                        <Fact label="Guests">
                                            <span className="inline-flex items-center gap-1.5">
                                                <Users className="size-4" />
                                                {plural(
                                                    request.guests,
                                                    'guest',
                                                )}
                                            </span>
                                        </Fact>
                                        <Fact label="Total">
                                            <span className="text-base font-semibold">
                                                {formatPeso(request.total)}
                                            </span>
                                            {request.rate && (
                                                <span className="block text-xs text-muted-foreground">
                                                    {request.rate}
                                                </span>
                                            )}
                                        </Fact>
                                    </dl>

                                    {(request.purpose || request.message) && (
                                        <div className="space-y-1 text-sm">
                                            {request.purpose && (
                                                <p>
                                                    <span className="text-muted-foreground">
                                                        Purpose:{' '}
                                                    </span>
                                                    {request.purpose}
                                                </p>
                                            )}
                                            {request.message && (
                                                <p className="flex items-start gap-1.5">
                                                    <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                                    {request.message}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {request.problem && (
                                        <p
                                            role="alert"
                                            className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-800 dark:bg-amber-950/40"
                                        >
                                            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                            <span>
                                                The room is no longer free for
                                                these dates: {request.problem}{' '}
                                                Decline this request, or free
                                                the room first.
                                            </span>
                                        </p>
                                    )}

                                    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                                        <p className="text-sm text-muted-foreground">
                                            Sent{' '}
                                            {formatDayTime(request.sent_at)}
                                            {request.waiting &&
                                                request.hold_expires_at &&
                                                ` · room held until ${formatDayTime(request.hold_expires_at)}`}
                                            {request.decided_at &&
                                                ` · answered ${formatDayTime(request.decided_at)}${request.decided_by ? ` by ${request.decided_by}` : ''}`}
                                            {request.decline_reason &&
                                                ` · reason: ${request.decline_reason}`}
                                        </p>
                                        {request.waiting ? (
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    variant="outline"
                                                    onClick={() =>
                                                        setDeclining(request)
                                                    }
                                                >
                                                    <X />
                                                    Decline
                                                </Button>
                                                <Button
                                                    disabled={
                                                        request.problem !== null
                                                    }
                                                    onClick={() =>
                                                        setApproving(request)
                                                    }
                                                >
                                                    <Check />
                                                    Approve
                                                </Button>
                                            </div>
                                        ) : (
                                            request.reservation_id && (
                                                <Button
                                                    variant="outline"
                                                    asChild
                                                >
                                                    <Link
                                                        href={reservationsShow(
                                                            request.reservation_id,
                                                        )}
                                                    >
                                                        Open reservation #
                                                        {request.reservation_id}
                                                    </Link>
                                                </Button>
                                            )
                                        )}
                                    </div>
                                </Card>
                            </li>
                        ))}
                    </ul>
                )}

                <Pager page={requests} />
            </Page>

            {approving && (
                <ConfirmAction
                    open
                    onOpenChange={(open) => !open && setApproving(null)}
                    title={`Approve the request from ${approving.contact_name}?`}
                    description={`A reservation is made for ${approving.rooms}, ${formatDayTime(approving.starts_at)} to ${formatDayTime(approving.ends_at)}, total ${formatPeso(approving.total)}. The guest is told by email.`}
                    url={BookingRequestController.approve.url(approving.id)}
                    method="patch"
                    confirmLabel="Approve and reserve"
                />
            )}

            <Dialog
                open={declining !== null}
                onOpenChange={(open) => !open && setDeclining(null)}
            >
                <DialogContent>
                    {declining && (
                        <Form
                            action={BookingRequestController.decline.url(
                                declining.id,
                            )}
                            method="patch"
                            options={{ preserveScroll: true }}
                            onSuccess={() => setDeclining(null)}
                            className="space-y-4"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <DialogHeader>
                                        <DialogTitle>
                                            Decline the request from{' '}
                                            {declining.contact_name}?
                                        </DialogTitle>
                                        <DialogDescription>
                                            The room is freed at once. The guest
                                            sees your reason and gets it by
                                            email.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <FormField
                                        label="Reason"
                                        htmlFor="decline_reason"
                                        error={errors.reason}
                                        hint="For example: the room is under repair on those dates."
                                    >
                                        <Input
                                            id="decline_reason"
                                            name="reason"
                                            maxLength={255}
                                            required
                                        />
                                    </FormField>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                            >
                                                Keep it
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            type="submit"
                                            variant="destructive"
                                            disabled={processing}
                                        >
                                            {processing && <Spinner />}
                                            Decline request
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 font-medium">{children}</dd>
        </div>
    );
}

Requests.layout = {
    breadcrumbs: [{ title: 'Booking requests', href: requestsIndex() }],
};
