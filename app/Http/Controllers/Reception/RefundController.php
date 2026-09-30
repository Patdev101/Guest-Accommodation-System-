<?php

namespace App\Http\Controllers\Reception;

use App\Enums\RefundStatus;
use App\Http\Controllers\Controller;
use App\Models\Refund;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Money owed back to guests after cancellations and no-shows (rule 26):
 * Requested → Processing → Refunded, recording who did each step and when.
 */
class RefundController extends Controller
{
    public function index(Request $request): Response
    {
        $show = $request->validate([
            'show' => ['nullable', Rule::in(['open', 'refunded', 'all'])],
        ])['show'] ?? 'open';

        $open = [RefundStatus::Requested, RefundStatus::Processing];

        return Inertia::render('reception/refunds', [
            'refunds' => Refund::query()
                ->with(['reservation.guest:id,name,contact_number', 'requester:id,name', 'processor:id,name', 'refunder:id,name'])
                ->when($show === 'open', fn ($query) => $query->whereIn('status', $open)->orderBy('requested_at'))
                ->when($show === 'refunded', fn ($query) => $query->where('status', RefundStatus::Refunded)->orderByDesc('refunded_at'))
                ->when($show === 'all', fn ($query) => $query->orderByDesc('requested_at'))
                ->orderBy('id')
                ->paginate(25)
                ->withQueryString()
                ->through(fn (Refund $refund) => [
                    'id' => $refund->id,
                    'reservation_id' => $refund->reservation_id,
                    'guest' => $refund->reservation?->guest->name,
                    'contact_number' => $refund->reservation?->guest->contact_number,
                    'amount' => $refund->amount,
                    'reason' => $refund->reason,
                    'status' => $refund->status->value,
                    'status_label' => $refund->status->label(),
                    'next_label' => $refund->status->next()?->label(),
                    'requested_by' => $refund->requester->name,
                    'requested_at' => $refund->requested_at->toIso8601String(),
                    'processed_by' => $refund->processor?->name,
                    'processing_at' => $refund->processing_at?->toIso8601String(),
                    'refunded_by' => $refund->refunder?->name,
                    'refunded_at' => $refund->refunded_at?->toIso8601String(),
                ]),
            'show' => $show,
            'openTotal' => number_format((float) Refund::query()->whereIn('status', $open)->sum('amount'), 2, '.', ''),
            'openCount' => Refund::query()->whereIn('status', $open)->count(),
        ]);
    }

    /** Move a refund one step forward. */
    public function advance(Request $request, Refund $refund): RedirectResponse
    {
        $next = $refund->status->next();

        if ($next === null) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('This refund is already complete.')]);

            return back();
        }

        $refund->update(match ($next) {
            RefundStatus::Processing => ['status' => $next, 'processed_by' => $request->user()->id, 'processing_at' => now()],
            default => ['status' => $next, 'refunded_by' => $request->user()->id, 'refunded_at' => now()],
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => $next === RefundStatus::Refunded
            ? __('Refund of ₱:amount marked as refunded.', ['amount' => number_format((float) $refund->amount, 2)])
            : __('Refund of ₱:amount is now being processed.', ['amount' => number_format((float) $refund->amount, 2)])]);

        return back();
    }
}
