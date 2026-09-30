<?php

namespace Tests\Feature\Reception;

use App\Enums\ReservationStatus;
use App\Enums\RoomStatus;
use App\Models\Setting;
use App\Services\Availability;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\CreatesBookings;
use Tests\TestCase;

class AvailabilityTest extends TestCase
{
    use CreatesBookings, RefreshDatabase;

    private Availability $availability;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::parse('2026-10-01 09:00'));
        $this->availability = new Availability;
    }

    private function at(string $time): Carbon
    {
        return Carbon::parse($time);
    }

    public function test_a_reservation_blocks_its_rooms_for_its_dates_only()
    {
        $room = $this->roomWithRate('A-101');
        $this->reserve([$room], $this->at('2026-10-02 14:00'), $this->at('2026-10-03 12:00'));

        $this->assertFalse($this->availability->isFree($room, $this->at('2026-10-02 20:00'), $this->at('2026-10-04 12:00')));
        $this->assertStringContainsString('Reserved for Maria Reyes', (string) $this->availability->blockedReason($room, $this->at('2026-10-02 20:00'), $this->at('2026-10-04 12:00')));

        // Back to back is fine while the cleaning buffer is 0.
        $this->assertTrue($this->availability->isFree($room, $this->at('2026-10-01 14:00'), $this->at('2026-10-02 14:00')));
        $this->assertTrue($this->availability->isFree($room, $this->at('2026-10-03 12:00'), $this->at('2026-10-04 12:00')));
    }

    public function test_the_cleaning_buffer_is_kept_between_guests()
    {
        Setting::set('cleaning_buffer_minutes', '60');
        $room = $this->roomWithRate('A-101');
        $this->reserve([$room], $this->at('2026-10-02 14:00'), $this->at('2026-10-03 12:00'));

        $this->assertFalse($this->availability->isFree($room, $this->at('2026-10-03 12:30'), $this->at('2026-10-04 12:00')));
        $this->assertTrue($this->availability->isFree($room, $this->at('2026-10-03 13:00'), $this->at('2026-10-04 12:00')));
        // A new booking before an existing one must also leave time to clean.
        $this->assertFalse($this->availability->isFree($room, $this->at('2026-10-01 14:00'), $this->at('2026-10-02 13:30')));
    }

    public function test_cancelled_and_no_show_reservations_do_not_block()
    {
        $room = $this->roomWithRate('A-101');
        $this->reserve([$room], $this->at('2026-10-02 14:00'), $this->at('2026-10-03 12:00'), ReservationStatus::Cancelled);
        $this->reserve([$room], $this->at('2026-10-02 14:00'), $this->at('2026-10-03 12:00'), ReservationStatus::NoShow);

        $this->assertTrue($this->availability->isFree($room, $this->at('2026-10-02 14:00'), $this->at('2026-10-03 12:00')));
    }

    public function test_an_occupied_room_stays_busy_until_the_guest_confirms_they_are_not_extending()
    {
        $room = $this->roomWithRate('A-101');
        $stay = $this->stayIn($room, $this->at('2026-09-30 14:00'), $this->at('2026-10-02 12:00'));

        // Rule 13: no end until confirmed, so even next week is not bookable.
        $this->assertFalse($this->availability->isFree($room, $this->at('2026-10-08 14:00'), $this->at('2026-10-09 12:00')));

        $stay->update(['not_extending_confirmed_at' => now()]);

        $this->assertFalse($this->availability->isFree($room, $this->at('2026-10-01 14:00'), $this->at('2026-10-02 12:00')));
        $this->assertTrue($this->availability->isFree($room, $this->at('2026-10-02 14:00'), $this->at('2026-10-03 12:00')));
    }

    public function test_rooms_under_maintenance_or_out_of_service_cannot_be_booked()
    {
        $room = $this->roomWithRate('A-104', status: RoomStatus::UnderMaintenance);

        $this->assertStringStartsWith('Under maintenance', (string) $this->availability->blockedReason($room, $this->at('2026-10-05 14:00'), $this->at('2026-10-06 12:00')));
    }

    public function test_the_earliest_slot_is_when_enough_rooms_are_free_for_the_whole_group()
    {
        $this->roomWithRate('A-101', pax: 4);
        $b = $this->roomWithRate('A-102', pax: 4);
        $this->roomWithRate('A-104', pax: 8, status: RoomStatus::OutOfService);
        $this->reserve([$b], $this->at('2026-10-01 14:00'), $this->at('2026-10-03 12:00'));

        // 6 guests need both rooms; A-102 is free from 3 Oct 12:00.
        $slot = $this->availability->earliestSlot(6, 22 * 60, null, $this->at('2026-10-01 14:00'));

        $this->assertNotNull($slot);
        $this->assertSame('2026-10-03 12:00', $slot['starts_at']->format('Y-m-d H:i'));
        $this->assertSame(2, $slot['rooms']);
        $this->assertSame(8, $slot['capacity']);

        // 4 guests fit in A-101 straight away.
        $this->assertTrue($this->availability->earliestSlot(4, 22 * 60, null, $this->at('2026-10-01 14:00'))['starts_at']->eq($this->at('2026-10-01 14:00')));

        // Nobody can take 9 guests: the 8-pax room is out of service.
        $this->assertNull($this->availability->earliestSlot(9, 60));
    }
}
