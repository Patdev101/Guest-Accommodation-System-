<?php

namespace App\Http\Controllers\Reception;

use App\Enums\BilledTo;
use App\Enums\PaymentType;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Stay;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Money received against a stay's bill, from the company or the guest (rule 25).
 */
class StayPaymentController extends Controller
{
    public function store(Request $request, Stay $stay): RedirectResponse
    {
        $balance = $stay->balance();

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:'.max(0.01, $balance)],
            'method' => ['required', Rule::in(Payment::methods())],
            'paid_by' => ['required', Rule::enum(BilledTo::class)],
            'receipt_number' => ['nullable', 'string', 'max:100'],
        ], ['amount.max' => __('The balance is only ₱:amount.', ['amount' => number_format(max(0, $balance), 2)])]);

        if ($balance <= 0) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('Nothing is owed on this stay.')]);

            return to_route('reception.stays.show', $stay);
        }

        $amount = round((float) $validated['amount'], 2);
        $charged = (float) $stay->charges()->sum('amount');

        $stay->payments()->create([
            'amount' => $amount,
            'payment_type' => PaymentType::forBooking($charged, $charged - $balance, $amount),
            'paid_by' => $validated['paid_by'],
            'method' => $validated['method'],
            'receipt_number' => $validated['receipt_number'] ?? null,
            'received_by' => $request->user()->id,
            'paid_at' => now(),
        ]);
        $stay->refreshIdCustody();

        Inertia::flash('toast', ['type' => 'success', 'message' => $amount >= $balance
            ? __('Payment recorded. The bill is fully paid.')
            : __('Payment recorded. ₱:amount still to pay.', ['amount' => number_format($balance - $amount, 2)])]);

        return to_route('reception.stays.show', $stay);
    }
}
