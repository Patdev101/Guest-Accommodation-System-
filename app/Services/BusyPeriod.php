<?php

namespace App\Services;

use Carbon\CarbonInterface;

/**
 * A time a room is taken: a reservation or a stay, with the cleaning buffer
 * already added to its end. A null end means "no end yet" (business rule 13).
 */
final readonly class BusyPeriod
{
    public function __construct(
        public CarbonInterface $start,
        public ?CarbonInterface $end,
        public string $reason,
        public ?int $reservationId = null,
    ) {}

    /** Whether [start, end) touches this period. */
    public function overlaps(CarbonInterface $start, CarbonInterface $end): bool
    {
        return $this->start->lt($end) && ($this->end === null || $this->end->gt($start));
    }
}
