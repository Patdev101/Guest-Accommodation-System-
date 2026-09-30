export type ReservationStatus =
    | 'active'
    | 'checked_in'
    | 'cancelled'
    | 'no_show';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export type RefundStatus = 'requested' | 'processing' | 'refunded';

/** One reservation as every front-desk list shows it. */
export type ReservationRow = {
    id: number;
    contact_name: string;
    contact_number: string;
    company: string | null;
    rooms: string[];
    location: string;
    pax: number;
    starts_at: string;
    ends_at: string;
    total: string;
    paid: string;
    payment_status: PaymentStatus;
    status: ReservationStatus;
    status_label: string;
    overdue: boolean;
};

/** One checked-in booking as the stay lists show it. */
export type StayRow = {
    id: number;
    reservation_id: number | null;
    contact_name: string;
    contact_number: string;
    company: string | null;
    rooms: string[];
    pax: number;
    checked_in_at: string;
    expected_check_out_at: string;
    checked_out_at: string | null;
    balance: string;
    id_status: string | null;
    state: 'in_house' | 'to_settle' | 'settled';
    overdue: boolean;
};

export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};
