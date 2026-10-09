<?php

namespace App\Http\Controllers\Guest;

use App\Enums\BookingRequestStatus;
use App\Enums\ReservationStatus;
use App\Http\Controllers\Controller;
use App\Models\BookingRequest;
use App\Models\BookingRequestRoom;
use App\Models\Reservation;
use App\Models\ReservationRoom;
use App\Models\Stay;
use App\Models\StayRoom;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The guest's own screen after logging in: the stay they are in, their booking
 * requests and their reservations. A guest only ever sees what belongs to
 * their own account.
 */
class HomeController extends Controller
{
    /** How many finished or cancelled bookings the page lists. */
    public const PAST = 10;

    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $mine = fn (Builder $query) => $query->whereHas('guest', fn (Builder $guest) => $guest->where('user_id', $user->id));

        $reservations = Reservation::query()
            ->tap($mine)
            ->with(['rooms.room:id,name,location_id', 'rooms.room.location:id,name', 'canceller:id,role'])
            ->withSum('payments', 'amount')
            ->orderBy('starts_at')
            ->get();

        $upcoming = $reservations->where('status', ReservationStatus::Active)->values();
        $past = $reservations->where('status', '!=', ReservationStatus::Active)
            ->where('status', '!=', ReservationStatus::CheckedIn)
            ->sortByDesc('starts_at')
            ->take(self::PAST)
            ->values();

        $stay = Stay::query()
            ->tap($mine)
            ->whereNull('checked_out_at')
            ->with('rooms.room:id,name')
            ->latest('checked_in_at')
            ->first();

        $requests = BookingRequest::query()
            ->where('user_id', $user->id)
            ->with(['rooms.room:id,name', 'reservation.canceller:id,role'])
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        return Inertia::render('guest/home', [
            'profile' => [
                'name' => $user->name,
                'email' => $user->email,
                'contact_number' => $user->contact_number,
                'member_since' => $user->created_at?->toDateString(),
            ],
            'stay' => $stay === null ? null : [
                'rooms' => $stay->rooms->map(fn (StayRoom $line) => $line->room->name)->implode(', '),
                'checked_in_at' => $stay->checked_in_at->toIso8601String(),
                'due_out_at' => $stay->expected_check_out_at->toIso8601String(),
                'overdue' => $stay->expected_check_out_at->isPast(),
                'balance' => max(0, $stay->balance()),
            ],
            'requests' => $requests->map(fn (BookingRequest $item) => [
                'id' => $item->id,
                'rooms' => $item->rooms->map(fn (BookingRequestRoom $line) => $line->room->name)->implode(', '),
                'guests' => $item->guests,
                'starts_at' => $item->starts_at->toIso8601String(),
                'ends_at' => $item->ends_at->toIso8601String(),
                'total' => $item->total,
                'status' => $item->shownStatus()['status'],
                'status_label' => $item->shownStatus()['label'],
                'decline_reason' => $item->decline_reason,
                // What happened to the reservation after approval, e.g. cancelled by the front desk.
                'note' => $item->reservation?->noteForGuest(),
                'sent_at' => $item->created_at->toIso8601String(),
                // While it waits, the room is held until this time.
                'held_until' => $item->isPending() ? $item->hold_expires_at?->toIso8601String() : null,
            ])->values(),
            'upcoming' => $upcoming->map(fn (Reservation $reservation) => $this->row($reservation))->values(),
            'past' => $past->map(fn (Reservation $reservation) => $this->row($reservation))->values(),
            'counts' => [
                'upcoming' => $upcoming->count(),
                'waiting' => $requests->where('status', BookingRequestStatus::Pending)->count(),
                'stays' => $reservations->where('status', ReservationStatus::CheckedOut)->count(),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function row(Reservation $reservation): array
    {
        $paid = (float) $reservation->payments_sum_amount;

        return [
            'id' => $reservation->id,
            'rooms' => $reservation->rooms->map(fn (ReservationRoom $line) => $line->room->name)->implode(', '),
            'location' => $reservation->rooms->map(fn (ReservationRoom $line) => $line->room->location->name)->unique()->implode(', '),
            'guests' => (int) $reservation->rooms->sum('pax'),
            'starts_at' => $reservation->starts_at->toIso8601String(),
            'ends_at' => $reservation->ends_at->toIso8601String(),
            'total' => $reservation->total,
            'paid' => number_format($paid, 2, '.', ''),
            'payment_status' => $reservation->paymentStatus()->value,
            'note' => $reservation->noteForGuest(),
            'status' => $reservation->status->value,
            'status_label' => $reservation->status === ReservationStatus::Active ? 'Confirmed' : $reservation->status->label(),
        ];
    }
}
