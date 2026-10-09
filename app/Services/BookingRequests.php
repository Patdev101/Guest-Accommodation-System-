<?php

namespace App\Services;

use App\Enums\BookingChannel;
use App\Enums\BookingRequestStatus;
use App\Enums\ReservationStatus;
use App\Models\BookingRequest;
use App\Models\BookingRequestRoom;
use App\Models\Guest;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomRate;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\BookingRequestAnswered;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Online booking requests (owner decision 6 Oct 2026): a guest asks, the room
 * is held, and Reception approves (it becomes a normal reservation) or
 * declines. A request nobody answers lets go of the room when its hold ends.
 */
class BookingRequests
{
    /** Requests one guest may have waiting at the same time. */
    public const MAX_PENDING = 3;

    public function __construct(private Availability $availability, private FrontDeskAlerts $alerts) {}

    /**
     * One request for one or more rooms (a group takes several, like a booking at the front desk).
     *
     * @param  list<array{room: Room, rate: RoomRate, pax: int}>  $lines
     * @param  array{contact_name: string, contact_number: string, company: string, purpose: string|null, guest_type: string, message: string|null}  $details
     */
    public function submit(User $user, array $lines, CarbonImmutable $start, CarbonImmutable $end, array $details): BookingRequest
    {
        $request = DB::transaction(function () use ($user, $lines, $start, $end, $details) {
            // Lock the rooms so two guests cannot take the same dates at once.
            Room::query()->whereKey(array_map(fn (array $line) => $line['room']->id, $lines))->lockForUpdate()->get();

            if ($this->pendingCount($user) >= self::MAX_PENDING) {
                throw ValidationException::withMessages(['rooms' => __('You already have :count requests waiting. Please wait for our answer, or cancel one.', ['count' => self::MAX_PENDING])]);
            }

            foreach ($lines as $line) {
                if ($this->availability->blockedReason($line['room'], $start, $end) !== null) {
                    throw ValidationException::withMessages(['from' => __(':room is not free for these dates any more. Please choose other dates or another room.', ['room' => $line['room']->name])]);
                }
            }

            // The server works the prices out; nothing the browser sent is trusted.
            $priced = array_map(fn (array $line) => [
                'room_id' => $line['room']->id,
                'room_rate_id' => $line['rate']->id,
                'pax' => $line['pax'],
                'price' => Pricing::total((float) $line['rate']->price, $line['rate']->unit->name, $start, $end),
            ], $lines);

            $request = BookingRequest::create([
                'user_id' => $user->id,
                'email' => $user->email,
                ...$details,
                'guests' => array_sum(array_column($priced, 'pax')),
                'starts_at' => $start,
                'ends_at' => $end,
                'total' => round(array_sum(array_column($priced, 'price')), 2),
                'status' => BookingRequestStatus::Pending,
                'hold_expires_at' => now()->addHours(max(1, (int) Setting::get('booking_request_hold_hours'))),
            ]);

            $request->rooms()->createMany($priced);

            // The company is remembered for next time; the guest can change it on any request.
            Guest::query()->updateOrCreate(['user_id' => $user->id], [
                'name' => $user->name,
                'contact_number' => (string) ($user->contact_number ?? $details['contact_number']),
                'company' => $details['company'],
            ]);

            return $request;
        });

        $this->alerts->requested($request);

        return $request;
    }

    /** Reception says yes: the request becomes a reservation, made the same way as at the front desk. */
    public function approve(BookingRequest $request, User $by): Reservation
    {
        $reservation = DB::transaction(function () use ($request, $by) {
            $request = BookingRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();
            $this->mustBePending($request);

            $lines = $request->rooms()->get();
            $rooms = Room::query()->whereKey($lines->pluck('room_id')->all())->lockForUpdate()->get()->keyBy('id');
            // The request's own hold does not stand in its way.
            $periods = $this->availability->busyPeriods(Availability::ids($rooms), ignoreRequestId: $request->id);

            foreach ($lines as $line) {
                $room = $rooms[$line->room_id];
                $reason = $this->availability->blockedReason($room, $request->starts_at, $request->ends_at, $periods[$room->id]);

                if ($reason !== null) {
                    throw ValidationException::withMessages(['request' => __(':room is not free for these dates: :reason', ['room' => $room->name, 'reason' => $reason])]);
                }
            }

            $reservation = Reservation::create([
                'guest_id' => $this->guestFor($request)->id,
                'company' => $request->company,
                'purpose' => $request->purpose,
                'starts_at' => $request->starts_at,
                'ends_at' => $request->ends_at,
                'total' => $request->total,
                'status' => ReservationStatus::Active,
                'booked_via' => BookingChannel::Guest,
                'booked_by' => $request->user_id,
            ]);

            $reservation->rooms()->createMany($lines->map(fn (BookingRequestRoom $line) => [
                'room_id' => $line->room_id,
                'room_rate_id' => $line->room_rate_id,
                'pax' => $line->pax,
                'price' => $line->price,
            ])->all());

            $request->update([
                'status' => BookingRequestStatus::Approved,
                'decided_by' => $by->id,
                'decided_at' => now(),
                'reservation_id' => $reservation->id,
                'hold_expires_at' => null,
            ]);

            return $reservation;
        });

        $this->alerts->booked($reservation, $by);
        $this->tellGuest($request->refresh());

        return $reservation;
    }

    public function decline(BookingRequest $request, User $by, string $reason): void
    {
        $this->mustBePending($request);

        $request->update([
            'status' => BookingRequestStatus::Declined,
            'decided_by' => $by->id,
            'decided_at' => now(),
            'decline_reason' => $reason,
            'hold_expires_at' => null,
        ]);

        $this->tellGuest($request);
    }

    /** The guest changed their mind before Reception answered. */
    public function cancel(BookingRequest $request): void
    {
        $this->mustBePending($request);

        $request->update(['status' => BookingRequestStatus::Cancelled, 'hold_expires_at' => null]);
    }

    /** Requests nobody answered before their hold ran out. @return int How many expired. */
    public function expire(): int
    {
        $due = BookingRequest::query()
            ->where('status', BookingRequestStatus::Pending)
            ->whereNotNull('hold_expires_at')
            ->where('hold_expires_at', '<=', now())
            ->get();

        foreach ($due as $request) {
            $request->update(['status' => BookingRequestStatus::Expired]);
            $this->tellGuest($request);
        }

        return $due->count();
    }

    public function pendingCount(User $user): int
    {
        return BookingRequest::query()->where('user_id', $user->id)->holding()->count();
    }

    private function mustBePending(BookingRequest $request): void
    {
        if (! $request->isPending()) {
            throw ValidationException::withMessages(['request' => __('This request was already answered (:status).', ['status' => $request->status->label()])]);
        }
    }

    /** The account's own guest profile, updated with what the request said. */
    private function guestFor(BookingRequest $request): Guest
    {
        $details = [
            'name' => $request->contact_name,
            'contact_number' => $request->contact_number,
            'type' => $request->guest_type,
            'company' => $request->company,
            'email' => $request->email,
        ];

        $guest = Guest::query()->where('user_id', $request->user_id)->first();

        if ($guest === null) {
            return Guest::create(['user_id' => $request->user_id, ...$details]);
        }

        $guest->update($details);

        return $guest;
    }

    /** Email the answer. A mail problem must never undo Reception's decision. */
    private function tellGuest(BookingRequest $request): void
    {
        try {
            $request->user->notify(new BookingRequestAnswered($request));
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
