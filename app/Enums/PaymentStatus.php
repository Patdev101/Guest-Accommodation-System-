<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Unpaid = 'unpaid';
    case Partial = 'partial';
    case Paid = 'paid';

    public function label(): string
    {
        return match ($this) {
            self::Unpaid => 'Unpaid',
            self::Partial => 'Partially paid',
            self::Paid => 'Paid',
        };
    }

    public static function for(float $total, float $paid): self
    {
        return match (true) {
            $paid <= 0 && $total > 0 => self::Unpaid,
            $paid < $total => self::Partial,
            default => self::Paid,
        };
    }
}
