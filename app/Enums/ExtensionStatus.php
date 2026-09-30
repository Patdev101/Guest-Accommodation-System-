<?php

namespace App\Enums;

enum ExtensionStatus: string
{
    case PendingConsent = 'pending_consent';
    case Approved = 'approved';
    case Denied = 'denied';

    public function label(): string
    {
        return match ($this) {
            self::PendingConsent => 'Waiting for Guest B',
            self::Approved => 'Approved',
            self::Denied => 'Denied',
        };
    }
}
