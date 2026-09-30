<?php

namespace App\Enums;

enum RefundStatus: string
{
    case Requested = 'requested';
    case Processing = 'processing';
    case Refunded = 'refunded';

    public function label(): string
    {
        return match ($this) {
            self::Requested => 'Requested',
            self::Processing => 'Processing',
            self::Refunded => 'Refunded',
        };
    }

    /** Refunds move one step at a time: Requested → Processing → Refunded. */
    public function next(): ?self
    {
        return match ($this) {
            self::Requested => self::Processing,
            self::Processing => self::Refunded,
            self::Refunded => null,
        };
    }
}
