<?php

namespace App\Enums;

enum ChargeType: string
{
    case Room = 'room';
    case Extension = 'extension';
    case Damage = 'damage';
    case Extra = 'extra';

    public function label(): string
    {
        return match ($this) {
            self::Room => 'Room',
            self::Extension => 'Extension',
            self::Damage => 'Damage',
            self::Extra => 'Extra',
        };
    }
}
