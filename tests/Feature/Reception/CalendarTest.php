<?php

namespace Tests\Feature\Reception;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesBookings;
use Tests\TestCase;

class CalendarTest extends TestCase
{
    use CreatesBookings, RefreshDatabase;

    public function test_the_week_shows_reservations_and_stays_in_their_rooms()
    {
        $this->travelTo(Carbon::parse('2026-10-01 09:00'));
        $a = $this->roomWithRate('A-101');
        $b = $this->roomWithRate('A-102');
        $this->reserve([$a], Carbon::parse('2026-10-02 14:00'), Carbon::parse('2026-10-03 12:00'));
        $this->stayIn($b, Carbon::parse('2026-09-30 14:00'), Carbon::parse('2026-10-02 12:00'));
        $this->reserve([$a], Carbon::parse('2026-10-20 14:00'), Carbon::parse('2026-10-21 12:00'));
        // Expected at 7:00; the 60-minute grace period is over by 9:00.
        $this->reserve([$this->roomWithRate('A-103')], Carbon::parse('2026-10-01 07:00'), Carbon::parse('2026-10-02 12:00'));

        $this->actingAs(User::factory()->reception()->create())
            ->get(route('reception.calendar'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('reception/calendar')
                ->where('start', '2026-10-01')
                ->where('now', Carbon::parse('2026-10-01 09:00')->toIso8601String())
                ->has('days', 7)
                ->where('locations.0.rooms.0.name', 'A-101')
                ->has('locations.0.rooms.0.bookings', 1)
                ->where('locations.0.rooms.0.bookings.0.kind', 'reserved')
                ->where('locations.0.rooms.1.bookings.0.kind', 'in_house')
                ->where('locations.0.rooms.1.bookings.0.open_ended', true)
                ->where('locations.0.rooms.2.bookings.0.kind', 'not_arrived'));

        $this->actingAs(User::factory()->reception()->create())
            ->get(route('reception.calendar', ['start' => '2026-10-19']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('start', '2026-10-19')
                ->has('locations.0.rooms.0.bookings', 1)
                // Still in house and may extend: the room stays blocked (rule 13).
                ->where('locations.0.rooms.1.bookings.0.open_ended', true));
    }

    public function test_guests_cannot_see_the_calendar()
    {
        $this->actingAs(User::factory()->create())
            ->get(route('reception.calendar'))
            ->assertForbidden();
    }
}
