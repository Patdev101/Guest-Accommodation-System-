<?php

namespace App\Http\Controllers\Guest;

use App\Enums\ReservationStatus;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationRoom;
use App\Services\FrontDeskAlerts;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A guest's own confirmed booking: what was booked, what was paid, and a way
 * to cancel it (rule 16: a guest can cancel their own booking at any time;
 * money already paid goes back through the front desk's refund process).
 */
class ReservationController extends Controller
{
    public function show(Request $request, Reservation $reservation): Response
    {
        $this->mustBeTheirs($request, $reservation);

        $reservation->load(['rooms.room:id,name,location_id', 'rooms.room.location:id,name', 'rooms.rate:id,name', 'canceller:id,role', 'refunds']);
        $payments = $reservation->payments()->orderBy('paid_at')->get();
        $paid = (float) $payments->sum('amount');

        return Inertia::render('guest/reservation', [
            'reservation' => [
                'id' => $reservation->id,
                'company' => $reservation->company,
                'purpose' => $reservation->purpose,
                'starts_at' => $reservation->starts_at->toIso8601String(),
                'ends_at' => $reservation->ends_at->toIso8601String(),
                'guests' => (int) $reservation->rooms->sum('pax'),
                'total' => $reservation->total,
                'paid' => number_format($paid, 2, '.', ''),
                'balance' => number_format($reservation->balance(), 2, '.', ''),
                'payment_status' => $reservation->paymentStatus()->value,
                'status' => $reservation->status->value,
                'status_label' => $reservation->isActive() ? 'Confirmed' : $reservation->status->label(),
                'note' => $reservation->noteForGuest(),
                'can_cancel' => $reservation->isActive(),
                'refunds' => (float) $reservation->refunds->sum('amount'),
            ],
            'rooms' => $reservation->rooms->map(fn (ReservationRoom $line) => [
                'id' => $line->id,
                'name' => $line->room->name,
                'location' => $line->room->location->name,
                'rate' => $line->rate?->name,
                'guests' => $line->pax,
                'price' => $line->price,
            ])->values(),
            'payments' => $payments->map(fn (Payment $payment) => [
                'id' => $payment->id,
                'amount' => $payment->amount,
                'method' => $payment->method,
                'paid_at' => $payment->paid_at->toIso8601String(),
            ])->values(),
        ]);
    }

    public function cancel(Request $request, Reservation $reservation, FrontDeskAlerts $alerts): RedirectResponse
    {
        $this->mustBeTheirs($request, $reservation);

        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:200']]);

        if (! $reservation->isActive()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('This booking can no longer be cancelled here. Please ask the front desk.')]);

            return to_route('guest.reservations.show', $reservation);
        }

        $reason = filled($validated['reason'] ?? null) ? $validated['reason'] : __('No reason given');

        $refunds = DB::transaction(function () use ($request, $reservation, $reason) {
            $reservation->update([
                'status' => ReservationStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => $request->user()->id,
                'cancellation_reason' => $reason,
            ]);

            return $reservation->requestRefunds(100, __('Cancelled by the guest: :reason', ['reason' => $reason]), $request->user());
        });

        // Reception is told, and sees any refund on its Refunds page.
        $alerts->cancelled($reservation, false, $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => $refunds > 0
            ? __('Booking cancelled. Your payment will be refunded by the front desk.')
            : __('Booking cancelled.')]);

        return to_route('guest.home');
    }

    /** A guest only ever sees their own bookings; anything else does not exist for them. */
    private function mustBeTheirs(Request $request, Reservation $reservation): void
    {
        abort_unless($reservation->guest()->where('user_id', $request->user()->id)->exists(), 404);
    }
}
