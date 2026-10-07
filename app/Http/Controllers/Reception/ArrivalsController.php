<?php

namespace App\Http\Controllers\Reception;

use App\Enums\ReservationStatus;
use App\Http\Controllers\Controller;
use App\Models\Reservation;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Check-in page: every booking still waiting for its guests, so reception
 * can start a check-in, or take a walk-in who has no booking.
 */
class ArrivalsController extends Controller
{
    /** How many later arrivals the page lists. */
    public const LATER = 50;

    public function __invoke(Request $request): Response
    {
        $waiting = Reservation::query()
            ->where('status', ReservationStatus::Active)
            ->with(['guest:id,name,contact_number', 'rooms.room:id,name,location_id', 'rooms.room.location:id,name'])
            ->withSum('payments', 'amount')
            ->orderBy('starts_at')
            ->orderBy('id')
            ->get()
            ->map(fn (Reservation $reservation) => ReservationController::row($reservation));

        $endOfToday = today()->endOfDay()->toIso8601String();
        // Past the grace period (rule 17): the guest has not arrived.
        $late = $waiting->where('overdue', true)->values();
        $today = $waiting->where('overdue', false)->filter(fn (array $row) => $row['starts_at'] <= $endOfToday)->values();
        $later = $waiting->where('overdue', false)->filter(fn (array $row) => $row['starts_at'] > $endOfToday)->values();

        return Inertia::render('reception/arrivals', [
            'late' => $late,
            'today' => $today,
            'later' => $later->take(self::LATER)->values(),
            'laterTotal' => $later->count(),
        ]);
    }
}
