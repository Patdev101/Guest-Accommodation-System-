<?php

namespace App\Http\Controllers\Guest;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reception\StoreReservationRequest;
use App\Models\Stay;
use App\Services\FrontDeskAlerts;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Inertia\Inertia;

/**
 * Things a guest does from their own screen during a stay: ask to stay
 * longer, and mark their notices as read.
 */
class StayController extends Controller
{
    /**
     * Ask the front desk to extend the stay. Nothing changes here: Reception
     * checks the room, sets the price and approves it on the stay page (rules 18 to 20).
     */
    public function askExtension(Request $request, FrontDeskAlerts $alerts): RedirectResponse
    {
        $stay = Stay::query()
            ->whereHas('guest', fn ($guest) => $guest->where('user_id', $request->user()->id))
            ->whereNull('checked_out_at')
            ->latest('checked_in_at')
            ->first();

        abort_if($stay === null, 404);

        $validated = $request->validate([
            'until' => ['required', 'date_format:'.StoreReservationRequest::DATE_FORMAT, 'after:'.$stay->expected_check_out_at->format('Y-m-d H:i')],
            'message' => ['nullable', 'string', 'max:300'],
        ], [
            'until.after' => __('Choose a time after your current check-out (:time).', ['time' => $stay->expected_check_out_at->format('j M g:i A')]),
        ], ['until' => 'new check-out']);

        $until = CarbonImmutable::createFromFormat(StoreReservationRequest::DATE_FORMAT, $validated['until']);

        $alerts->guestAsksToExtend($stay, $until, $validated['message'] ?? null);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sent. The front desk will check the room and tell you the answer.')]);

        return to_route('guest.home');
    }

    /** Everything under the bell is now read. */
    public function readNotices(Request $request): RedirectResponse
    {
        DatabaseNotification::query()
            ->where('notifiable_type', $request->user()->getMorphClass())
            ->where('notifiable_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return back();
    }
}
