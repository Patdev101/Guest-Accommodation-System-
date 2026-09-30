<?php

namespace App\Enums;

enum ReminderResult: string
{
    case Extend = 'extend';
    case CheckOut = 'check_out';
    case NoAnswer = 'no_answer';

    public function label(): string
    {
        return match ($this) {
            self::Extend => 'Wants to extend',
            self::CheckOut => 'Checking out, not extending',
            self::NoAnswer => 'No answer',
        };
    }
}
