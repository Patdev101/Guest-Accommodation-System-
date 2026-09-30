<?php

namespace App\Services;

use App\Enums\ChargeType;
use App\Enums\ConsentStatus;
use App\Enums\ExtensionStatus;
use App\Enums\ReservationStatus;
use App\Models\Extension;
use App\Models\ReservationRoom;
use App\Models\Room;
use App\Models\Stay;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Extending a stay (rules 20 and 21). Extra time is free unless a room is
 * reserved next for someone else (Guest B). Then Guest B must agree to move
 * to another room that fits them; otherwise the extension is denied.
 */
class StayExtension
{
    public function __construct(private Availability $availability) {}

    /**
     * Guest B's booked rooms that the extra time would run into.
     *
     * @return Collection<int, ReservationRoom>
     */
    public function conflicts(Stay $stay, CarbonImmutable $newCheckOut): Collection
    {
        $buffer = $this->availability->bufferMinutes();
        $from = $stay->expected_check_out_at->subMinutes($buffer);
        $until = $newCheckOut->addMinutes($buffer);

        return ReservationRoom::query()
            ->whereIn('room_id', $stay->rooms()->pluck('room_id'))
            ->whereHas('reservation', fn ($query) => $query
                ->where('status', ReservationStatus::Active)
                ->where('starts_at', '<', $until)
                ->where('ends_at', '>', $from))
            ->with(['reservation.guest:id,name,contact_number', 'room:id,name'])
            ->orderBy('id')
            ->get();
    }

    /**
     * Rooms Guest B could move to: big enough, bookable, and free for their dates.
     *
     * @return Collection<int, Room>
     */
    public function alternatives(ReservationRoom $line, Stay $stay): Collection
    {
        $reservation = $line->reservation;
        $taken = [
            ...$stay->rooms()->pluck('room_id')->all(),
            ...$reservation->rooms()->pluck('room_id')->all(),
        ];

        $rooms = Room::query()
            ->with('location:id,name')
            ->where('pax_capacity', '>=', $line->pax)
            ->whereNotIn('status', Availability::UNBOOKABLE)
            ->whereNotIn('id', $taken)
            ->orderBy('pax_capacity')
            ->orderBy('name')
            ->get();

        $periods = $this->availability->busyPeriods(Availability::ids($rooms), $reservation->id);

        return $rooms->filter(fn (Room $room) => $this->availability->blockedReason(
            $room, $reservation->starts_at, $reservation->ends_at, $periods[$room->id],
        ) === null)->values();
    }

    /**
     * Move Guest B's rooms (all agreed), give the stay its new check-out and bill the extra time.
     */
    public function approve(Extension $extension, Stay $stay, User $by): void
    {
        DB::transaction(function () use ($extension, $stay, $by) {
            foreach ($extension->moves()->with('reservationRoom.reservation')->get() as $move) {
                $line = $move->reservationRoom;
                $target = Room::query()->whereKey($move->to_room_id)->lockForUpdate()->firstOrFail();

                if (! $this->alternatives($line, $stay)->contains('id', $target->id)) {
                    throw ValidationException::withMessages([
                        'extension' => __(':room is no longer free for :guest. Choose another room.', ['room' => $target->name, 'guest' => $line->reservation->guest->name]),
                    ]);
                }

                $line->update(['room_id' => $target->id]);
            }

            $stay->update([
                'expected_check_out_at' => $extension->new_check_out_at,
                // Rule 13 applies again to the new check-out time.
                'not_extending_confirmed_at' => null,
            ]);

            if ((float) $extension->price > 0) {
                $stay->charges()->create([
                    'reservation_id' => $stay->reservation_id,
                    'type' => ChargeType::Extension,
                    'description' => __('Extension to :time', ['time' => $extension->new_check_out_at->format('j M Y g:i A')]),
                    'amount' => $extension->price,
                    'billed_to' => $stay->defaultBilledTo(),
                    'created_by' => $by->id,
                ]);
            }

            $extension->update(['status' => ExtensionStatus::Approved, 'decided_by' => $by->id, 'decided_at' => now()]);
        });
    }

    public function deny(Extension $extension, User $by, string $reason): void
    {
        $extension->update([
            'status' => ExtensionStatus::Denied,
            'decided_by' => $by->id,
            'decided_at' => now(),
            'denial_reason' => $reason,
        ]);
    }

    /**
     * Approve, deny or keep waiting, from Guest B's answers (rule 20).
     */
    public function settle(Extension $extension, Stay $stay, User $by): ExtensionStatus
    {
        $moves = $extension->moves()->get();

        if ($moves->contains(fn ($move) => $move->to_room_id === null)) {
            $this->deny($extension, $by, __('No other room can take the next guest, so the stay cannot be extended.'));
        } elseif ($moves->contains('consent_status', ConsentStatus::Declined)) {
            $this->deny($extension, $by, __('The next guest declined to move to another room.'));
        } elseif ($moves->contains('consent_status', ConsentStatus::Pending)) {
            $extension->update(['status' => ExtensionStatus::PendingConsent]);
        } else {
            $this->approve($extension, $stay, $by);
        }

        return $extension->refresh()->status;
    }
}
