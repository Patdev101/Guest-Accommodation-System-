<?php

namespace App\Enums;

enum Role: string
{
    case Guest = 'guest';
    case Reception = 'reception';
    case Admin = 'admin';

    public function label(): string
    {
        return match ($this) {
            self::Guest => 'Guest',
            self::Reception => 'Reception',
            self::Admin => 'Admin',
        };
    }
}
