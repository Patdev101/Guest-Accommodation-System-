<?php

namespace App\Http\Controllers\Reception;

use App\Enums\IdCustodyStatus;
use App\Enums\ReservationStatus;
use App\Enums\RoomStatus;
use App\Enums\VerificationResult;
use App\Http\Controllers\Controller;
use App\Http\Requests\Reception\CheckInRequest;
use App\Http\Requests\Reception\StoreReservationRequest;
use App\Models\IdCustody;
use App\Models\IdType;
use App\Models\Reservation;
use App\Models\ReservationRoom;
use App\Models\Room;
use App\Models\Setting;
use App\Models\Stay;
use App\Services\Availability;
use App\Services\BusyPeriod;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Checks a booking in with the owner's form (rules 6 to 9): details, dates,
 * guest list with rooms, verification, then one valid ID with its photo.
 */
class CheckInController extends Controller
{
    public function create(Reservation $reservation, Availability $availability): Response|RedirectResponse
    {
        if (! $reservation->isActive()) {
            return $this->notActive($reservation);
        }

        $reservation->load(['guest', 'rooms.room.location:id,name']);
        $now = CarbonImmutable::now();
        $checkOut = $reservation->ends_at->gt($now) ? $reservation->ends_at : $now->addDay()->startOfHour();
        $roomIds = array_values($reservation->rooms->map(fn (ReservationRoom $line) => $line->room_id)->all());
        $periods = $availability->busyPeriods($roomIds, $reservation->id);

        return Inertia::render('reception/check-in', [
            'reservation' => [
                'id' => $reservation->id,
                'contact_name' => $reservation->guest->name,
                'contact_number' => $reservation->guest->contact_number,
                'email' => $reservation->guest->email,
                'company' => $reservation->company,
                'purpose' => $reservation->purpose,
                'starts_at' => $reservation->starts_at->toIso8601String(),
                'ends_at' => $reservation->ends_at->toIso8601String(),
            ],
            'rooms' => $reservation->rooms->map(fn (ReservationRoom $line) => [
                'id' => $line->room_id,
                'name' => $line->room->name,
                'location' => $line->room->location->name,
                'pax' => $line->pax,
                'pax_capacity' => $line->room->pax_capacity,
                'status_label' => $line->room->status->label(),
                'group' => $line->room->status->group()->value,
                'problem' => $this->problem($line->room, $now, $checkOut, $periods[$line->room_id] ?? [], $availability),
                'next_booking' => $this->nextBooking($periods[$line->room_id] ?? [], $now, $availability->bufferMinutes()),
            ]),
            'idTypes' => IdType::query()->active()->orderBy('id')->get(['id', 'name']),
            'checkOut' => $checkOut->format(StoreReservationRequest::DATE_FORMAT),
            'maxPhotoMb' => CheckInRequest::MAX_PHOTO_KB / 1024,
            'reminderMinutes' => (int) Setting::get('checkout_reminder_minutes'),
        ]);
    }

    /**
     * The room's next booking after now, and the latest check-out that still
     * leaves the cleaning buffer before it.
     *
     * @param  list<BusyPeriod>  $periods
     * @return array{starts_at: string, latest_check_out: string, label: string}|null
     */
    private function nextBooking(array $periods, CarbonImmutable $now, int $buffer): ?array
    {
        $next = collect($periods)
            ->filter(fn (BusyPeriod $period) => $period->start->gt($now))
            ->sortBy(fn (BusyPeriod $period) => $period->start->getTimestamp())
            ->first();

        return $next === null ? null : [
            'starts_at' => $next->start->toIso8601String(),
            'latest_check_out' => CarbonImmutable::instance($next->start)->subMinutes($buffer)->toIso8601String(),
            'label' => $next->reason,
        ];
    }

    public function store(CheckInRequest $request, Reservation $reservation, Availability $availability): RedirectResponse
    {
        if (! $reservation->isActive()) {
            return $this->notActive($reservation);
        }

        if (! $request->passed()) {
            $reservation->guest->verificationAttempts()->create([
                'result' => VerificationResult::Failed,
                'notes' => $request->validated('verification_notes'),
                'verified_by' => $request->user()->id,
                'attempted_at' => now(),
            ]);

            Inertia::flash('toast', ['type' => 'error', 'message' => __('Verification failed and was recorded. The guests were not checked in.')]);

            return to_route('reception.reservations.show', $reservation);
        }

        $now = CarbonImmutable::now();
        $checkOut = $request->expectedCheckOut();
        $guests = $request->guestList();
        $perRoom = array_count_values(array_column($guests, 'room_id'));
        $photoPath = null;

        try {
            $stay = DB::transaction(function () use ($request, $reservation, $availability, $now, $checkOut, $guests, $perRoom, &$photoPath) {
                // Lock the rooms so nobody books or checks into them meanwhile.
                $rooms = Room::query()->whereKey(array_keys($perRoom))->lockForUpdate()->get()->keyBy('id');
                $periods = $availability->busyPeriods(array_keys($perRoom), $reservation->id);

                foreach ($rooms as $room) {
                    $problem = $this->problem($room, $now, $checkOut, $periods[$room->id], $availability);

                    if ($problem !== null) {
                        throw ValidationException::withMessages(['guests' => $problem]);
                    }
                }

                $reservation->guest->update([
                    'name' => $request->validated('contact_name'),
                    'contact_number' => $request->validated('contact_number'),
                    'email' => $request->validated('email'),
                    'company' => $request->validated('company') ?? $reservation->guest->company,
                ]);

                $attempt = $reservation->guest->verificationAttempts()->create([
                    'result' => VerificationResult::Passed,
                    'notes' => $request->validated('verification_notes'),
                    'verified_by' => $request->user()->id,
                    'attempted_at' => $now,
                ]);

                $stay = Stay::create([
                    'reservation_id' => $reservation->id,
                    'guest_id' => $reservation->guest_id,
                    'verification_attempt_id' => $attempt->id,
                    'checked_in_at' => $now,
                    'expected_check_out_at' => $checkOut,
                    'checked_in_by' => $request->user()->id,
                ]);

                foreach ($perRoom as $roomId => $pax) {
                    $stay->rooms()->create(['room_id' => $roomId, 'pax' => $pax]);
                }

                $stay->guests()->createMany($guests);
                $stay->addRoomCharges($request->user());

                $photoPath = $request->file('id_photo')?->store("id-photos/{$stay->id}", IdCustody::DISK);

                $stay->idCustody()->create([
                    'id_type_id' => $request->integer('id_type_id'),
                    'id_number' => $request->validated('id_number'),
                    'photo_path' => $photoPath ?: null,
                    'status' => IdCustodyStatus::Held,
                    'received_by' => $request->user()->id,
                ]);

                foreach ($rooms as $room) {
                    $room->update(['status' => RoomStatus::Occupied]);
                }

                $reservation->update([
                    'status' => ReservationStatus::CheckedIn,
                    'company' => $request->validated('company'),
                    'purpose' => $request->validated('purpose'),
                ]);

                return $stay;
            });
        } catch (Throwable $exception) {
            // Nothing was saved, so do not keep the photo either.
            if (is_string($photoPath)) {
                Storage::disk(IdCustody::DISK)->delete($photoPath);
            }

            throw $exception;
        }

        $roomNames = Room::query()->whereKey(array_keys($perRoom))->orderBy('name')->pluck('name')->implode(', ');

        Inertia::flash('toast', ['type' => 'success', 'message' => trans_choice(
            '{1} Checked in: 1 guest in :rooms. The ID is held.|[2,*] Checked in: :count guests in :rooms. The ID is held.',
            count($guests),
            ['rooms' => $roomNames],
        )]);

        return to_route('reception.reservations.show', $stay->reservation_id);
    }

    /**
     * Why guests cannot move into the room now, or null when they can.
     *
     * @param  list<BusyPeriod>  $periods
     */
    private function problem(Room $room, CarbonImmutable $now, CarbonImmutable $checkOut, array $periods, Availability $availability): ?string
    {
        if ($room->status !== RoomStatus::Available) {
            return __(':room is :status. It must be Available before guests move in (mark it on the dashboard once it is ready).', [
                'room' => $room->name,
                'status' => strtolower($room->status->label()),
            ]);
        }

        $reason = $availability->blockedReason($room, $now, $checkOut, $periods);

        if ($reason === null) {
            return null;
        }

        return __(':room is not free until the check-out. :reason.', ['room' => $room->name, 'reason' => rtrim($reason, '.')]);
    }

    private function notActive(Reservation $reservation): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'error', 'message' => __('Only active reservations can be checked in. This one is :status.', ['status' => strtolower($reservation->status->label())])]);

        return to_route('reception.reservations.show', $reservation);
    }
}
