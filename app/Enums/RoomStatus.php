<?php

namespace App\Enums;

/**
 * The physical state of a room. "Reserved" is deliberately not a status:
 * reservations are tracked separately, so an occupied room can still carry
 * a reservation for a later time.
 */
enum RoomStatus: string
{
    case Available = 'available';
    case Occupied = 'occupied';
    case CheckOut = 'check_out';
    case Inspection = 'inspection';
    case Cleaning = 'cleaning';
    case UnderMaintenance = 'under_maintenance';
    case OutOfService = 'out_of_service';

    public function label(): string
    {
        return match ($this) {
            self::Available => 'Available',
            self::Occupied => 'Occupied',
            self::CheckOut => 'Check-out',
            self::Inspection => 'Inspection',
            self::Cleaning => 'Cleaning',
            self::UnderMaintenance => 'Under maintenance',
            self::OutOfService => 'Out of service',
        };
    }

    /**
     * Statuses this status may move to (requirements section 7).
     *
     * @return list<self>
     */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Available => [self::Occupied, self::UnderMaintenance, self::OutOfService],
            self::Occupied => [self::CheckOut],
            self::CheckOut => [self::Inspection],
            self::Inspection => [self::Cleaning, self::UnderMaintenance],
            self::Cleaning, self::UnderMaintenance, self::OutOfService => [self::Available],
        };
    }

    public function canMoveTo(self $to): bool
    {
        return in_array($to, $this->allowedTransitions(), true);
    }

    /**
     * Changes staff can make from the room page. Occupied, Check-out and
     * Inspection are only reached through check-in and check-out.
     *
     * @return list<self>
     */
    public function manualTransitions(): array
    {
        return array_values(array_filter(
            $this->allowedTransitions(),
            fn (self $status) => ! in_array($status, [self::Occupied, self::CheckOut, self::Inspection], true),
        ));
    }

    public function group(): RoomStatusGroup
    {
        return match ($this) {
            self::Available => RoomStatusGroup::Available,
            self::Occupied, self::CheckOut => RoomStatusGroup::InUse,
            self::Inspection, self::Cleaning => RoomStatusGroup::Turnover,
            self::UnderMaintenance, self::OutOfService => RoomStatusGroup::Unavailable,
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::Available => 'Ready for a guest.',
            self::Occupied => 'A guest is in the room.',
            self::CheckOut => 'The guest is checking out.',
            self::Inspection => 'Staff are checking the room for damages.',
            self::Cleaning => 'The room is being cleaned.',
            self::UnderMaintenance => 'Something needs repair. Guests cannot use the room.',
            self::OutOfService => 'Taken out of use for a longer period.',
        };
    }
}
