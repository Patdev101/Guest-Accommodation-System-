<?php

namespace App\Enums;

enum ReminderResult: string
{
    case Extend = 'extend';
    case CheckOut = 'check_out';
    case NoAnswer = 'no_answer';
}
