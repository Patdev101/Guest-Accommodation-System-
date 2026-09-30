<?php

namespace App\Services;

use App\Enums\ReservationStatus;
use App\Enums\RoomStatus;
use App\Models\ReservationRoom;
use App\Models\Room;
use App\Models\Setting;
use App\Models\StayRoom;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;

/**
 * When rooms can be booked (business rules 12 to 14).
 *
 * A room is busy during every active reservation that includes it and during
 * the current stay, each followed by the cleaning buffer. A stay whose guest
 * has not yet confirmed they are not extending keeps the room busy with no
 * end (rule 13). Rooms under maintenance or out of service cannot be booked
 * (open question 4).
 */
class Availability
{
    /** Room states that cannot take bookings. */
    public const UNBOOKABLE = [RoomStatus::UnderMaintenance, RoomStatus::OutOfService];

    public function bufferMinutes(): int
    {
        return (int) Setting::get('cleaning_buffer_minutes');
    }

    /**
     * Current and future busy periods per room, sorted by start.
     *
     * @param  list<int>  $roomIds
     * @return array<int, list<BusyPeriod>>
     */
    public function busyPeriods(array $roomIds, ?int $ignoreReservationId = null): array
    {
        $buffer = $this->bufferMinutes();
        $periods = array_fill_keys($roomIds, []);

        $lines = ReservationRoom::query()
            ->whereIn('room_id', $roomIds)
            ->whereHas('reservation', fn ($query) => $query
                ->where('status', ReservationStatus::Active)
                ->where('ends_at', '>', now()->subMinutes($buffer))
                ->when($ignoreReservationId, fn ($query) => $query->whereKeyNot($ignoreReservationId)))
            ->with('reservation.guest:id,name')
            ->get();

        foreach ($lines as $line) {
            $reservation = $line->reservation;
            $periods[$line->room_id][] = new BusyPeriod(
                $reservation->starts_at,
                $reservation->ends_at->copy()->addMinutes($buffer),
                __('Reserved for :name, :from – :to', [
                    'name' => $reservation->guest->name,
                    'from' => $this->format($reservation->starts_at),
                    'to' => $this->format($reservation->ends_at),
                ]),
                $reservation->id,
            );
        }

        $occupied = StayRoom::query()
            ->whereIn('room_id', $roomIds)
            ->whereHas('stay', fn ($query) => $query->whereNull('checked_out_at'))
            ->with('stay')
            ->get();

        foreach ($occupied as $line) {
            $stay = $line->stay;
            $periods[$line->room_id][] = $stay->not_extending_confirmed_at === null
                ? new BusyPeriod($stay->checked_in_at, null, __('Occupied, due out :time. Bookable after that only once the guest confirms they are not extending.', ['time' => $this->format($stay->expected_check_out_at)]))
                : new BusyPeriod($stay->checked_in_at, $stay->expected_check_out_at->copy()->addMinutes($buffer), __('Occupied until :time', ['time' => $this->format($stay->expected_check_out_at)]));
        }

        foreach ($periods as &$list) {
            usort($list, fn (BusyPeriod $a, BusyPeriod $b) => $a->start <=> $b->start);
        }

        return $periods;
    }

    /**
     * Why the room cannot be booked for [start, end), or null when it can.
     *
     * @param  list<BusyPeriod>|null  $periods  Pre-loaded periods for this room, to save a query.
     */
    public function blockedReason(Room $room, CarbonInterface $start, CarbonInterface $end, ?array $periods = null, ?int $ignoreReservationId = null): ?string
    {
        if (in_array($room->status, self::UNBOOKABLE, true)) {
            return __(':status. It cannot be booked until it is available again.', ['status' => $room->status->label()]);
        }

        $periods ??= $this->busyPeriods([$room->id], $ignoreReservationId)[$room->id];
        $needed = $end->copy()->addMinutes($this->bufferMinutes());

        foreach ($periods as $period) {
            if ($period->overlaps($start, $needed)) {
                return $period->reason;
            }
        }

        return null;
    }

    public function isFree(Room $room, CarbonInterface $start, CarbonInterface $end, ?int $ignoreReservationId = null): bool
    {
        return $this->blockedReason($room, $start, $end, null, $ignoreReservationId) === null;
    }

    /**
     * The earliest time, at or after $from, when enough rooms are free for
     * $minutes to hold $pax guests between them (rule 11).
     *
     * @return array{starts_at: CarbonInterface, rooms: int, capacity: int}|null
     */
    public function earliestSlot(int $pax, int $minutes, ?int $locationId = null, ?CarbonInterface $from = null): ?array
    {
        $from ??= CarbonImmutable::now();

        /** @var Collection<int, Room> $rooms */
        $rooms = Room::query()
            ->whereNotIn('status', self::UNBOOKABLE)
            ->when($locationId, fn ($query) => $query->where('location_id', $locationId))
            ->get(['id', 'pax_capacity', 'status']);

        if ($rooms->sum('pax_capacity') < $pax) {
            return null;
        }

        $periods = $this->busyPeriods(self::ids($rooms));
        $length = $minutes + $this->bufferMinutes();

        // A slot can only open at the requested time or when some busy period ends.
        $candidates = collect($periods)
            ->flatten(1)
            ->map(fn (BusyPeriod $period) => $period->end)
            ->filter(fn (?CarbonInterface $end) => $end !== null && $end->gt($from))
            ->push($from->copy())
            ->sort()
            ->values();

        foreach ($candidates as $start) {
            $end = $start->copy()->addMinutes($length);
            $free = $rooms->filter(fn (Room $room) => ! collect($periods[$room->id])
                ->contains(fn (BusyPeriod $period) => $period->overlaps($start, $end)));

            if ($free->sum('pax_capacity') >= $pax) {
                return ['starts_at' => $start, 'rooms' => $free->count(), 'capacity' => (int) $free->sum('pax_capacity')];
            }
        }

        return null;
    }

    /**
     * @param  Collection<int, Room>  $rooms
     * @return list<int>
     */
    public static function ids(Collection $rooms): array
    {
        return array_values($rooms->map(fn (Room $room) => $room->id)->all());
    }

    private function format(CarbonInterface $time): string
    {
        return $time->format('j M g:i A');
    }
}
