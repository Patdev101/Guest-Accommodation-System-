<?php

namespace App\Enums;

enum PaymentType: string
{
    case Downpayment = 'downpayment';
    case Full = 'full';
    case Balance = 'balance';
    case Damages = 'damages';
}
