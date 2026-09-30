<?php

namespace App\Http\Controllers\Reception;

use App\Enums\BilledTo;
use App\Enums\PaymentType;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Reservation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Money received on a reservation before check-in: a downpayment, the full
 * amount, or the rest of the balance (rule 15).
 */
class ReservationPaymentController extends Controller
{
    public function store(Request $request, Reservation $reservation): RedirectResponse
    {
        $balance = $reservation->balance();

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:'.$balance],
            'method' => ['required', Rule::in(Payment::METHODS)],
            'paid_by' => ['required', Rule::enum(BilledTo::class)],
            'receipt_number' => ['nullable', 'string', 'max:100'],
        ], ['amount.max' => __('The balance is only :amount.', ['amount' => number_format($balance, 2)])]);

        if (! $reservation->isActive()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('Payments can only be added to active reservations.')]);

            return to_route('reception.reservations.show', $reservation);
        }

        $amount = round((float) $validated['amount'], 2);

        $reservation->payments()->create([
            'amount' => $amount,
            'payment_type' => PaymentType::forBooking((float) $reservation->total, $reservation->amountPaid(), $amount),
            'paid_by' => $validated['paid_by'],
            'method' => $validated['method'],
            'receipt_number' => $validated['receipt_number'] ?? null,
            'received_by' => $request->user()->id,
            'paid_at' => now(),
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Payment recorded.')]);

        return to_route('reception.reservations.show', $reservation);
    }
}
