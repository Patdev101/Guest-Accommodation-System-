<?php

namespace App\Enums;

enum GuestType: string
{
    case Visitor = 'visitor';
    case Contractor = 'contractor';

    public function label(): string
    {
        return match ($this) {
            self::Visitor => 'Visitor/Guest',
            self::Contractor => 'Contractor',
        };
    }
}
