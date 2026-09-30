<?php

namespace App\Enums;

enum BilledTo: string
{
    case Company = 'company';
    case Guest = 'guest';

    public function label(): string
    {
        return match ($this) {
            self::Company => 'Company',
            self::Guest => 'Guest',
        };
    }
}
