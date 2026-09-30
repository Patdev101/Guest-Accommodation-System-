<?php

namespace Tests\Feature\Reception;

use App\Enums\RoomStatus;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesBookings;
use Tests\TestCase;

class FrontDeskDashboardTest extends TestCase
{
    use CreatesBookings, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::parse('2026-10-01 10:00'));
    }

    public function test_room_cards_show_who_is_in_each_room_and_who_arrives_next()
    {
        $occupied = $this->roomWithRate('A-101', status: RoomStatus::Occupied);
        $stay = $this->stayIn($occupied, Carbon::parse('2026-09-30 14:00'), Carbon::parse('2026-10-01 09:00'));
        $arriving = $this->roomWithRate('A-102');
        $late = $this->roomWithRate('A-103');
        $reservation = $this->reserve([$arriving], Carbon::parse('2026-10-01 14:00'), Carbon::parse('2026-10-02 12:00'));
        $this->reserve([$late], Carbon::parse('2026-10-01 08:00'), Carbon::parse('2026-10-02 12:00'));
        // Tomorrow's booking is not today's arrival.
        $this->reserve([$this->roomWithRate('A-104')], Carbon::parse('2026-10-02 14:00'), Carbon::parse('2026-10-03 12:00'));

        $this->actingAs(User::factory()->reception()->create())
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('board.0.rooms.0.name', 'A-101')
                ->where('board.0.rooms.0.stay.id', $stay->id)
                ->where('board.0.rooms.0.stay.guest', 'Jose Bautista')
                ->where('board.0.rooms.0.stay.pax', 1)
                ->where('board.0.rooms.0.stay.overdue', true)
                ->where('board.0.rooms.0.arrival', null)
                ->where('board.0.rooms.1.stay', null)
                ->where('board.0.rooms.1.arrival.reservation_id', $reservation->id)
                ->where('board.0.rooms.1.arrival.late', false)
                ->where('board.0.rooms.2.arrival.late', true)
                ->where('board.0.rooms.3.arrival', null)
                ->where('stats.rooms', 4)
                ->where('stats.occupied', 1)
                ->where('stats.available', 3)
                ->where('stats.inHouse', 1)
                ->where('stats.capacity', 16)
                ->where('rules.checkOut', '12:00')
                ->where('rules.grace', 60)
                ->where('rules.reminder', 60));
    }

    public function test_the_admin_board_shows_occupancy_too()
    {
        $room = $this->roomWithRate('A-101', status: RoomStatus::Occupied);
        $this->stayIn($room, Carbon::parse('2026-09-30 14:00'), Carbon::parse('2026-10-01 12:00'));

        $this->actingAs(User::factory()->admin()->create())
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/dashboard')
                ->where('board.0.rooms.0.stay.guest', 'Jose Bautista')
                ->where('board.0.rooms.0.stay.overdue', false));
    }

    public function test_the_check_in_page_shows_each_rooms_next_booking()
    {
        Setting::set('cleaning_buffer_minutes', '60');
        $room = $this->roomWithRate('A-101');
        $free = $this->roomWithRate('A-102');
        $reservation = $this->reserve([$room, $free], Carbon::parse('2026-10-01 10:00'), Carbon::parse('2026-10-02 12:00'));
        $this->reserve([$room], Carbon::parse('2026-10-03 14:00'), Carbon::parse('2026-10-04 12:00'));

        $this->actingAs(User::factory()->reception()->create())
            ->get(route('reception.reservations.check-in.create', $reservation))
            ->assertInertia(fn (Assert $page) => $page
                ->component('reception/check-in')
                ->where('reminderMinutes', 60)
                ->where('rooms.0.next_booking.starts_at', Carbon::parse('2026-10-03 14:00')->toIso8601String())
                ->where('rooms.0.next_booking.latest_check_out', Carbon::parse('2026-10-03 13:00')->toIso8601String())
                ->where('rooms.1.next_booking', null));
    }
}
