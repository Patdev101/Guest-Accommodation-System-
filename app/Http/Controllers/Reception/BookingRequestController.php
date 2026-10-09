<?php

namespace App\Http\Controllers\Reception;

use App\Enums\BookingRequestStatus;
use App\Http\Controllers\Controller;
use App\Models\BookingRequest;
use App\Models\BookingRequestRoom;
use App\Services\Availability;
use App\Services\BookingRequests;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Booking requests guests sent online. Reception approves one (it becomes a
 * reservation) or declines it with a reason the guest sees.
 */
class BookingRequestController extends Controller
{
    public const FILTERS = [
        'waiting' => 'Waiting',
        'answered' => 'Answered',
        'all' => 'All',
    ];

    public function index(Request $request, BookingRequests $requests, Availability $availability): Response
    {
        $show = $request->validate(['show' => ['nullable', Rule::in(array_keys(self::FILTERS))]])['show'] ?? 'waiting';

        // Anything past its hold is expired before the list is shown.
        $requests->expire();

        $list = BookingRequest::query()
            ->with(['rooms.room:id,name,location_id,status,pax_capacity', 'rooms.room.location:id,name', 'rooms.rate:id,name', 'decider:id,name', 'reservation:id,status'])
            ->when($show === 'waiting', fn (Builder $query) => $query->where('status', BookingRequestStatus::Pending)->orderBy('created_at'))
            ->when($show === 'answered', fn (Builder $query) => $query->where('status', '!=', BookingRequestStatus::Pending)->orderByDesc('updated_at'))
            ->when($show === 'all', fn (Builder $query) => $query->orderByDesc('created_at'))
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('reception/requests', [
            'requests' => $list->through(function (BookingRequest $item) use ($availability) {
                // Is the room still free, leaving out this request's own hold?
                $problem = null;

                if ($item->isPending()) {
                    foreach ($item->rooms as $line) {
                        $periods = $availability->busyPeriods([$line->room_id], ignoreRequestId: $item->id)[$line->room_id];
                        $problem ??= $availability->blockedReason($line->room, $item->starts_at, $item->ends_at, $periods);
                    }
                }

                return [
                    'id' => $item->id,
                    'contact_name' => $item->contact_name,
                    'contact_number' => $item->contact_number,
                    'email' => $item->email,
                    'company' => $item->company,
                    'purpose' => $item->purpose,
                    'guest_type' => $item->guest_type->label(),
                    'guests' => $item->guests,
                    'rooms' => $item->rooms->map(fn (BookingRequestRoom $line) => $line->room->name.' ('.$line->room->location->name.')')->implode(', '),
                    'rate' => $item->rooms->map(fn (BookingRequestRoom $line) => $line->rate?->name)->filter()->unique()->implode(', '),
                    'starts_at' => $item->starts_at->toIso8601String(),
                    'ends_at' => $item->ends_at->toIso8601String(),
                    'total' => $item->total,
                    'message' => $item->message,
                    'status' => $item->shownStatus()['status'],
                    'status_label' => $item->shownStatus()['label'],
                    'waiting' => $item->isPending(),
                    'sent_at' => $item->created_at->toIso8601String(),
                    'hold_expires_at' => $item->hold_expires_at?->toIso8601String(),
                    'decided_by' => $item->decider?->name,
                    'decided_at' => $item->decided_at?->toIso8601String(),
                    'decline_reason' => $item->decline_reason,
                    'reservation_id' => $item->reservation_id,
                    'problem' => $problem,
                ];
            }),
            'show' => $show,
            'filterOptions' => collect(self::FILTERS)->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])->values(),
            'waiting' => BookingRequest::query()->where('status', BookingRequestStatus::Pending)->count(),
        ]);
    }

    public function approve(Request $request, BookingRequest $bookingRequest, BookingRequests $requests): RedirectResponse
    {
        $reservation = $requests->approve($bookingRequest, $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Approved. Reservation #:id was made for :name, who was told by email.', ['id' => $reservation->id, 'name' => $bookingRequest->contact_name])]);

        return to_route('reception.reservations.show', $reservation);
    }

    public function decline(Request $request, BookingRequest $bookingRequest, BookingRequests $requests): RedirectResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'max:255']], [
            'reason.required' => __('Say why, so the guest knows.'),
        ]);

        $requests->decline($bookingRequest, $request->user(), $validated['reason']);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Declined. :name was told by email; the room is free again.', ['name' => $bookingRequest->contact_name])]);

        return back(fallback: route('reception.requests.index'));
    }
}
