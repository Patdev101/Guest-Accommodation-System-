export type RoomStatus =
    | 'available'
    | 'occupied'
    | 'check_out'
    | 'inspection'
    | 'cleaning'
    | 'under_maintenance'
    | 'out_of_service';

export type RoomStatusGroup =
    | 'available'
    | 'in_use'
    | 'turnover'
    | 'unavailable';

export type StatusGroupOption = {
    value: RoomStatusGroup;
    label: string;
    description: string;
};

export type RoomSummary = {
    id: number;
    name: string;
    location_id: number;
    location: string | null;
    pax_capacity: number;
    status: RoomStatus;
    status_label: string;
    group: RoomStatusGroup;
    cover_url: string | null;
};

/** Who is in a room now, and who should arrive in it by the end of today. */
export type RoomOccupancy = {
    stay: {
        id: number;
        guest: string;
        pax: number;
        due_out_at: string;
        overdue: boolean;
        not_extending: boolean;
    } | null;
    arrival: {
        reservation_id: number;
        guest: string;
        pax: number;
        starts_at: string;
        /** Past the grace period and still not checked in. */
        late: boolean;
    } | null;
};

export type BoardRoomSummary = RoomSummary & Partial<RoomOccupancy>;

export type LocationOption = {
    id: number;
    name: string;
};

export type RateUnitOption = {
    id: number;
    name: string;
};

export type RoomRate = {
    id: number;
    name: string;
    price: string;
    rate_unit_id: number;
    unit: string;
    is_extension_rate: boolean;
};

export type RoomInclusion = {
    id: number;
    item: string;
    quantity: number;
};

export type MaintenanceRecord = {
    id: number;
    performed_on: string;
    issue: string;
    action_taken: string | null;
    done_by: string | null;
    recorded_by: string | null;
};
