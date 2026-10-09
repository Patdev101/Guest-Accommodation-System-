<?php

namespace App\Services;

use Carbon\CarbonInterface;

/**
 * The price of one room for a stay: the rate's price times how many of its
 * units the stay covers. The same sums as `resources/js/lib/pricing.ts`, which
 * suggests prices at the front desk; here the server works it out itself, so
 * an online request never trusts a price sent by the browser.
 */
class Pricing
{
    public static function total(float $price, string $unit, CarbonInterface $start, CarbonInterface $end): float
    {
        return round($price * self::quantity($unit, $start, $end), 2);
    }

    /** How many of the rate's units the stay covers; at least 1. */
    public static function quantity(string $unit, CarbonInterface $start, CarbonInterface $end): int
    {
        $minutes = $start->diffInMinutes($end);
        $days = (int) $start->copy()->startOfDay()->diffInDays($end->copy()->startOfDay());
        $name = strtolower($unit);

        $quantity = match (true) {
            str_contains($name, 'hour') => (int) ceil($minutes / 60),
            str_contains($name, 'night') => $days,
            str_contains($name, 'week') => (int) ceil($days / 7),
            str_contains($name, 'day') => $days + 1,
            default => 1,
        };

        return max(1, $quantity);
    }
}
