<?php

namespace App\Enums;

enum ConsentStatus: string
{
    case Pending = 'pending';
    case Agreed = 'agreed';
    case Declined = 'declined';
}
