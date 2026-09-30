<?php

namespace App\Enums;

enum ReservationStatus: string
{
    case Active = 'active';
    case CheckedIn = 'checked_in';
    case CheckedOut = 'checked_out';
    case Cancelled = 'cancelled';
    case NoShow = 'no_show';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Active',
            self::CheckedIn => 'Checked-in',
            self::CheckedOut => 'Checked out',
            self::Cancelled => 'Cancelled',
            self::NoShow => 'No-show',
        };
    }
}
