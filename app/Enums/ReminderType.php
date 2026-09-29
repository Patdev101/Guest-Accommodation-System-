<?php

namespace App\Enums;

enum ReminderType: string
{
    case InApp = 'in_app';
    case Call = 'call';
}
