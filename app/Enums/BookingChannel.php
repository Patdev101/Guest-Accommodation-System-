<?php

namespace App\Enums;

enum BookingChannel: string
{
    case Guest = 'guest';
    case Reception = 'reception';

    public function label(): string
    {
        return match ($this) {
            self::Guest => 'Online, by the guest',
            self::Reception => 'At reception',
        };
    }
}
