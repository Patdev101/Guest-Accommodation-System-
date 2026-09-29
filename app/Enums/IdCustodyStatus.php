<?php

namespace App\Enums;

enum IdCustodyStatus: string
{
    case Held = 'held';
    case HeldPendingPayment = 'held_pending_payment';
    case Returned = 'returned';

    public function label(): string
    {
        return match ($this) {
            self::Held => 'Held',
            self::HeldPendingPayment => 'Held – pending payment',
            self::Returned => 'Returned',
        };
    }
}
