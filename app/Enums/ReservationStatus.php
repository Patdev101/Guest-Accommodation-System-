<?php

namespace App\Enums;

enum ReservationStatus: string
{
    case Active = 'active';
    case CheckedIn = 'checked_in';
    case Cancelled = 'cancelled';
    case NoShow = 'no_show';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Active',
            self::CheckedIn => 'Checked-in',
            self::Cancelled => 'Cancelled',
            self::NoShow => 'No-show',
        };
    }
}
