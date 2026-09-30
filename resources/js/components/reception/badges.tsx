import { Badge } from '@/components/ui/badge';
import type {
    PaymentStatus,
    RefundStatus,
    ReservationStatus,
    StayRow,
} from '@/types';

const reservationVariant: Record<
    ReservationStatus,
    'default' | 'secondary' | 'outline'
> = {
    active: 'default',
    checked_in: 'secondary',
    cancelled: 'outline',
    no_show: 'outline',
};

/** Active, Checked-in, Cancelled or No-show. The words carry the meaning. */
export function ReservationStatusBadge({
    status,
    label,
}: {
    status: ReservationStatus;
    label: string;
}) {
    return <Badge variant={reservationVariant[status]}>{label}</Badge>;
}

const paymentLabel: Record<PaymentStatus, string> = {
    unpaid: 'Unpaid',
    partial: 'Partially paid',
    paid: 'Paid',
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
    return (
        <Badge variant={status === 'paid' ? 'secondary' : 'outline'}>
            {paymentLabel[status]}
        </Badge>
    );
}

const stayState: Record<
    StayRow['state'],
    { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
    in_house: { label: 'In house', variant: 'default' },
    to_settle: { label: 'Checked out, to settle', variant: 'outline' },
    settled: { label: 'Settled', variant: 'secondary' },
};

/** In house, checked out but not settled, or settled. */
export function StayStateBadge({ state }: { state: StayRow['state'] }) {
    return (
        <Badge variant={stayState[state].variant}>
            {stayState[state].label}
        </Badge>
    );
}

export function RefundStatusBadge({
    status,
    label,
}: {
    status: RefundStatus;
    label: string;
}) {
    return (
        <Badge variant={status === 'refunded' ? 'secondary' : 'outline'}>
            {label}
        </Badge>
    );
}
