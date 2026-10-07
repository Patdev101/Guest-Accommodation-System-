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

    public function test_the_month_shows_arrivals_and_check_outs_on_their_days()
    {
        $this->travelTo(Carbon::parse('2026-10-01 09:00'));
        $a = $this->roomWithRate('A-101');
        $b = $this->roomWithRate('A-102');
        $this->reserve([$a], Carbon::parse('2026-10-02 14:00'), Carbon::parse('2026-10-03 12:00'));
        // Checked in last month, leaves this month: only the check-out shows.
        $this->stayIn($b, Carbon::parse('2026-09-30 14:00'), Carbon::parse('2026-10-02 12:00'));
        $this->reserve([$a], Carbon::parse('2026-11-20 14:00'), Carbon::parse('2026-11-21 12:00'));
        $cancelled = $this->reserve([$b], Carbon::parse('2026-10-10 14:00'), Carbon::parse('2026-10-11 12:00'));
        $cancelled->update(['status' => 'cancelled']);

        $desk = User::factory()->reception()->create();

        $this->actingAs($desk)
            ->get(route('reception.calendar'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('reception/calendar')
                ->where('ranged', false)
                ->where('from', '2026-10-01')
                ->where('to', '2026-10-31')
                ->where('title', 'October 2026')
                ->where('previous', '2026-09')
                ->where('next', '2026-11')
                ->where('arrivals', 1)
                ->where('departures', 2)
                ->has('events.2026-10-02', 2)
                ->where('events.2026-10-02.0.type', 'departure')
                ->where('events.2026-10-02.0.label', 'Expected check-out')
                ->where('events.2026-10-02.0.rooms', 'A-102')
                ->where('events.2026-10-02.0.status', 'In house')
                ->where('events.2026-10-02.1.type', 'arrival')
                ->where('events.2026-10-02.1.label', 'Reservation')
                ->where('events.2026-10-02.1.status', 'Reserved')
                ->has('events.2026-10-03', 1)
                ->missing('events.2026-10-10'));

        $this->actingAs($desk)
            ->get(route('reception.calendar', ['month' => '2026-11']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('title', 'November 2026')
                ->where('arrivals', 1)
                ->has('events.2026-11-20', 1));

        // Any range of dates, across months.
        $this->actingAs($desk)
            ->get(route('reception.calendar', ['from' => '2026-10-03', 'to' => '2026-11-20']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('ranged', true)
                ->where('from', '2026-10-03')
                ->where('to', '2026-11-20')
                ->where('title', 'Oct 3 to Nov 20, 2026')
                ->where('previous', '2026-09')
                ->where('arrivals', 1)
                ->where('departures', 1)
                ->missing('events.2026-10-02')
                ->has('events.2026-10-03', 1));

        // A range that ends before it starts falls back to the month.
        $this->actingAs($desk)
            ->get(route('reception.calendar', ['from' => '2026-10-20', 'to' => '2026-10-03']))
            ->assertInertia(fn (Assert $page) => $page->where('ranged', false)->where('title', 'October 2026'));
    }

    public function test_a_walk_in_starts_from_check_in()
    {
        $this->actingAs(User::factory()->reception()->create())
            ->get(route('reception.walk-in'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('reception/reservations/create')
                ->where('walkIn', true)
                ->where('editing', null));
    }

    public function test_the_check_in_page_lists_bookings_waiting_for_their_guests()
    {
        $this->travelTo(Carbon::parse('2026-10-01 09:00'));
        // Expected at 7:00; the 60-minute grace period is over by 9:00.
        $this->reserve([$this->roomWithRate('A-101')], Carbon::parse('2026-10-01 07:00'), Carbon::parse('2026-10-02 12:00'));
        $this->reserve([$this->roomWithRate('A-102')], Carbon::parse('2026-10-01 14:00'), Carbon::parse('2026-10-02 12:00'));
        $this->reserve([$this->roomWithRate('A-103')], Carbon::parse('2026-10-05 14:00'), Carbon::parse('2026-10-06 12:00'));
        $this->reserve([$this->roomWithRate('A-104')], Carbon::parse('2026-10-01 15:00'), Carbon::parse('2026-10-02 12:00'))
            ->update(['status' => 'cancelled']);
        $this->stayIn($this->roomWithRate('A-105'), Carbon::parse('2026-09-30 14:00'), Carbon::parse('2026-10-01 08:00'));
        $this->stayIn($this->roomWithRate('A-106'), Carbon::parse('2026-09-30 14:00'), Carbon::parse('2026-10-01 12:00'));

        $desk = User::factory()->reception()->create();

        $this->actingAs($desk)
            ->get(route('reception.check-in'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('reception/arrivals')
                ->has('late', 1)
                ->where('late.0.rooms.0', 'A-101')
                ->has('today', 1)
                ->where('today.0.rooms.0', 'A-102')
                ->has('later', 1)
                ->where('laterTotal', 1));

        // The Check-out page counts guests in house by when they are due to leave.
        $this->actingAs($desk)
            ->get(route('reception.stays.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.overdue', 1)
                ->where('stats.due_today', 1)
                ->where('stats.upcoming', 0));

        $this->actingAs(User::factory()->create())->get(route('reception.check-in'))->assertForbidden();
    }

    public function test_guests_cannot_see_the_calendar()
    {
        $this->actingAs(User::factory()->create())
            ->get(route('reception.calendar'))
            ->assertForbidden();
    }
}
