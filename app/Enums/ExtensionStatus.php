<?php

namespace App\Enums;

enum ExtensionStatus: string
{
    /** Guest B has been asked to move and has not answered yet. */
    case PendingConsent = 'pending_consent';
    case Approved = 'approved';
    case Denied = 'denied';
}
