<?php

namespace App\Enums;

enum ChargeType: string
{
    case Room = 'room';
    case Extension = 'extension';
    case Damage = 'damage';
    case Extra = 'extra';
}
