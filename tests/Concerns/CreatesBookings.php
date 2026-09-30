<?php

namespace Tests\Concerns;

use App\Enums\BookingChannel;
use App\Enums\ReservationStatus;
use App\Enums\RoomStatus;
use App\Enums\VerificationResult;
use App\Models\Guest;
use App\Models\Location;
use App\Models\RateUnit;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\Stay;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Rooms, reservations and stays for front-desk tests.
 */
trait CreatesBookings
{
    protected function roomWithRate(string $name, int $pax = 4, float $price = 1000, RoomStatus $status = RoomStatus::Available): Room
    {
        $room = Room::factory()
            ->for(Location::query()->firstOrCreate(['name' => 'Barracks']))
            ->status($status)
            ->create(['name' => $name, 'pax_capacity' => $pax]);
        $room->rates()->create([
            'name' => 'Overnight',
            'price' => $price,
            'rate_unit_id' => RateUnit::firstOrCreate(['name' => 'Overnight'])->id,
        ]);

        return $room;
    }

    /**
     * @param  list<Room>  $rooms
     */
    protected function reserve(array $rooms, Carbon $start, Carbon $end, ReservationStatus $status = ReservationStatus::Active, float $total = 1000): Reservation
    {
        $guest = Guest::create(['name' => 'Maria Reyes', 'contact_number' => '09171234567']);

        $reservation = Reservation::create([
            'guest_id' => $guest->id,
            'company' => 'Seatech Welding',
            'starts_at' => $start,
            'ends_at' => $end,
            'total' => $total,
            'status' => $status,
            'booked_via' => BookingChannel::Reception,
            'booked_by' => User::factory()->reception()->create()->id,
        ]);

        foreach ($rooms as $room) {
            $reservation->rooms()->create([
                'room_id' => $room->id,
                'room_rate_id' => $room->rates()->value('id'),
                'pax' => 1,
                'price' => round($total / count($rooms), 2),
            ]);
        }

        return $reservation;
    }

    protected function stayIn(Room $room, Carbon $checkedIn, Carbon $expectedOut, bool $confirmedNotExtending = false): Stay
    {
        $staff = User::factory()->reception()->create();
        $guest = Guest::create(['name' => 'Jose Bautista', 'contact_number' => '09170000000']);
        $attempt = $guest->verificationAttempts()->create([
            'result' => VerificationResult::Passed,
            'verified_by' => $staff->id,
            'attempted_at' => $checkedIn,
        ]);

        $stay = Stay::create([
            'guest_id' => $guest->id,
            'verification_attempt_id' => $attempt->id,
            'checked_in_at' => $checkedIn,
            'expected_check_out_at' => $expectedOut,
            'not_extending_confirmed_at' => $confirmedNotExtending ? $checkedIn : null,
            'checked_in_by' => $staff->id,
        ]);
        $stay->rooms()->create(['room_id' => $room->id, 'pax' => 1]);

        return $stay;
    }
}
