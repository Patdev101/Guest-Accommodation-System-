<?php

namespace App\Enums;

enum ConsentStatus: string
{
    case Pending = 'pending';
    case Agreed = 'agreed';
    case Declined = 'declined';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Not answered yet',
            self::Agreed => 'Agreed to move',
            self::Declined => 'Declined to move',
        };
    }
}
