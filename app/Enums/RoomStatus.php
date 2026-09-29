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
}
