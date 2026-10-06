<?php

namespace App\Enums;

enum BookingRequestStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Declined = 'declined';
    case Cancelled = 'cancelled';
    case Expired = 'expired';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Waiting for approval',
            self::Approved => 'Approved',
            self::Declined => 'Declined',
            self::Cancelled => 'Cancelled by the guest',
            self::Expired => 'Expired',
        };
    }
}
