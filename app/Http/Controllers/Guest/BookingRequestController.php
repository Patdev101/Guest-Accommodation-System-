<?php

namespace App\Http\Controllers\Guest;

use App\Concerns\ProfileValidationRules;
use App\Enums\GuestType;
use App\Http\Controllers\Controller;
use App\Models\BookingRequest;
use App\Models\Room;
use App\Models\RoomRate;
use App\Models\Setting;
use App\Services\Availability;
use App\Services\BookingRequests;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A guest asks for one or more rooms online. Nothing is confirmed here:
 * Reception approves or declines every request.
 */
class BookingRequestController extends Controller
{
    use ProfileValidationRules;

    public function create(Request $request, Room $room, BookingRequests $requests, Availability $availability): Response
    {
        abort_unless($this->offered()->whereKey($room->id)->exists(), 404);

        $query = validator($request->query(), [
            'from' => ['date_format:Y-m-d', 'after_or_equal:today'],
            'to' => ['date_format:Y-m-d', 'after:from'],
            'guests' => ['integer', 'min:1', 'max:1000'],
        ])->valid();
        $dated = isset($query['from'], $query['to']);
        $user = $request->user();
        $times = $this->standardTimes();

        $rooms = $this->offered()
            ->with(['location:id,name', 'coverPhoto', 'rates' => fn ($rates) => $rates->where('is_extension_rate', false)->with('unit:id,name')->orderBy('price')])
            ->get()
            ->sortBy(fn (Room $item) => $item->location->name."\0".$item->name, SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        // With dates chosen, say which rooms are free, so a group can add more rooms.
        $start = $dated ? CarbonImmutable::parse($query['from'].' '.$times['check_in']) : null;
        $end = $dated ? CarbonImmutable::parse($query['to'].' '.$times['check_out']) : null;
        $periods = $start ? $availability->busyPeriods(Availability::ids($rooms)) : [];

        return Inertia::render('guest/book', [
            'roomId' => $room->id,
            'rooms' => $rooms->map(fn (Room $item) => [
                'id' => $item->id,
                'name' => $item->name,
                'location' => $item->location->name,
                'pax_capacity' => $item->pax_capacity,
                'cover_url' => $item->coverPhoto?->url(),
                'rates' => $item->rates->map(fn (RoomRate $rate) => ['id' => $rate->id, 'name' => $rate->name, 'unit' => $rate->unit->name, 'price' => $rate->price])->values(),
                // Null until dates are chosen.
                'free' => $start && $end ? $availability->blockedReason($item, $start, $end, $periods[$item->id]) === null : null,
            ])->values(),
            'defaults' => [
                'from' => $dated ? $query['from'] : null,
                'to' => $dated ? $query['to'] : null,
                'guests' => (int) ($query['guests'] ?? 1),
                'contact_name' => $user->name,
                'contact_number' => $user->contact_number,
                'company' => $user->guest?->company,
            ],
            'guestTypes' => array_map(fn (GuestType $type) => ['value' => $type->value, 'label' => $type->label()], GuestType::cases()),
            'today' => CarbonImmutable::today()->toDateString(),
            'standardTimes' => $times,
            'pending' => $requests->pendingCount($user),
            'maxPending' => BookingRequests::MAX_PENDING,
            'holdHours' => max(1, (int) Setting::get('booking_request_hold_hours')),
        ]);
    }

    public function store(Request $request, Room $room, BookingRequests $requests): RedirectResponse
    {
        $validated = $request->validate([
            'from' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'to' => ['required', 'date_format:Y-m-d', 'after:from'],
            'rooms' => ['required', 'array', 'min:1', 'max:10'],
            'rooms.*.room_id' => ['required', 'integer', 'distinct'],
            'rooms.*.room_rate_id' => ['required', 'integer'],
            'rooms.*.pax' => ['required', 'integer', 'min:1', 'max:1000'],
            'contact_name' => $this->nameRules(),
            'contact_number' => $this->contactNumberRules(),
            // The same rule as at the front desk: every booking is for a company.
            'company' => ['required', 'string', 'max:255'],
            'purpose' => ['nullable', 'string', 'max:255'],
            'guest_type' => ['required', Rule::enum(GuestType::class)],
            'message' => ['nullable', 'string', 'max:1000'],
        ], [
            'rooms.required' => __('Choose at least one room.'),
            'rooms.*.room_id.distinct' => __('Each room can be added once.'),
            'from.after_or_equal' => __('The arrival cannot be before today.'),
            'to.after' => __('The departure must be after the arrival.'),
        ], ['from' => 'arrival', 'to' => 'departure', 'contact_name' => 'name', 'guest_type' => 'guest type', 'rooms.*.pax' => 'guests', 'rooms.*.room_rate_id' => 'price']);

        $offered = $this->offered()->whereKey(array_column($validated['rooms'], 'room_id'))->get()->keyBy('id');
        $lines = [];

        foreach ($validated['rooms'] as $index => $line) {
            $chosen = $offered->get((int) $line['room_id']);

            // Only rooms the public may see can be requested.
            if ($chosen === null) {
                throw ValidationException::withMessages(["rooms.{$index}.room_id" => __('This room cannot be requested.')]);
            }

            if ((int) $line['pax'] > $chosen->pax_capacity) {
                throw ValidationException::withMessages(["rooms.{$index}.pax" => __(':room takes at most :count guests. Add another room for the rest.', ['room' => $chosen->name, 'count' => $chosen->pax_capacity])]);
            }

            $rate = RoomRate::query()->with('unit:id,name')
                ->whereKey($line['room_rate_id'])->where('room_id', $chosen->id)->where('is_extension_rate', false)
                ->first();

            if ($rate === null) {
                throw ValidationException::withMessages(["rooms.{$index}.room_rate_id" => __('Choose one of this room\'s prices.')]);
            }

            $lines[] = ['room' => $chosen, 'rate' => $rate, 'pax' => (int) $line['pax']];
        }

        $times = $this->standardTimes();

        $requests->submit(
            $request->user(),
            $lines,
            CarbonImmutable::parse($validated['from'].' '.$times['check_in']),
            CarbonImmutable::parse($validated['to'].' '.$times['check_out']),
            [
                'contact_name' => $validated['contact_name'],
                'contact_number' => $validated['contact_number'],
                'company' => $validated['company'],
                'purpose' => $validated['purpose'] ?? null,
                'guest_type' => $validated['guest_type'],
                'message' => $validated['message'] ?? null,
            ],
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Request sent. Our front desk will answer soon; the rooms are held for you meanwhile.')]);

        return to_route('guest.home');
    }

    public function cancel(Request $request, BookingRequest $bookingRequest, BookingRequests $requests): RedirectResponse
    {
        // A guest only ever touches their own requests.
        abort_unless($bookingRequest->user_id === $request->user()->id, 404);

        $requests->cancel($bookingRequest);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Request cancelled. The rooms are no longer held.')]);

        return to_route('guest.home');
    }

    /**
     * Rooms the public may see: not under maintenance or out of service, and with a price.
     *
     * @return Builder<Room>
     */
    private function offered(): Builder
    {
        return Room::query()
            ->whereNotIn('status', Availability::UNBOOKABLE)
            ->whereHas('rates', fn (Builder $rates) => $rates->where('is_extension_rate', false));
    }

    /** @return array{check_in: string, check_out: string} */
    private function standardTimes(): array
    {
        return [
            'check_in' => (string) Setting::get('standard_check_in_time'),
            'check_out' => (string) Setting::get('standard_check_out_time'),
        ];
    }
}
