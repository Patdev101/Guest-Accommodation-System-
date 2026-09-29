<?php

namespace App\Enums;

/**
 * How much of a no-show's payments is refunded. Full is the default until
 * the business decides the final policy (requirements section 10).
 */
enum NoShowRefund: string
{
    case Full = 'full';
    case Partial = 'partial';
    case None = 'none';
}
