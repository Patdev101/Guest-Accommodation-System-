<?php

namespace App\Enums;

enum BilledTo: string
{
    case Company = 'company';
    case Guest = 'guest';
}
