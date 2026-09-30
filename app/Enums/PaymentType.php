<?php

namespace App\Enums;

enum PaymentType: string
{
    case Downpayment = 'downpayment';
    case Full = 'full';
    case Balance = 'balance';
    case Damages = 'damages';

    public function label(): string
    {
        return match ($this) {
            self::Downpayment => 'Downpayment',
            self::Full => 'Full payment',
            self::Balance => 'Balance',
            self::Damages => 'Damages',
        };
    }

    /** The first payment is a downpayment unless it covers everything; later ones pay the balance. */
    public static function forBooking(float $total, float $alreadyPaid, float $amount): self
    {
        return match (true) {
            $alreadyPaid > 0 => self::Balance,
            $amount >= $total => self::Full,
            default => self::Downpayment,
        };
    }
}
