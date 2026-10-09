<?php

namespace Tests\Feature;

use App\Enums\RoomStatus;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesBookings;
use Tests\TestCase;

class PublicRoomsTest extends TestCase
{
    use CreatesBookings, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::parse('2026-10-09 09:00'));
    }

    public function test_visitors_browse_only_the_rooms_that_can_be_booked()
    {
        $this->roomWithRate('A-101', pax: 4, price: 800);
        $this->roomWithRate('A-102', pax: 2, price: 500);
        $this->roomWithRate('A-103', status: RoomStatus::UnderMaintenance);
        $this->roomWithRate('A-104', status: RoomStatus::OutOfService);
        // No price yet: cannot be booked, so it is not offered.
        Room::factory()->create(['name' => 'A-105']);

        $this->get(route('rooms.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('public/rooms')
                ->has('rooms', 2)
                ->where('rooms.0.name', 'A-101')
                ->where('rooms.0.pax_capacity', 4)
                ->where('rooms.0.from_price', '800.00')
                ->where('rooms.0.free', null)
                ->where('filters.from', null)
                ->where('today', '2026-10-09'));
    }

    public function test_chosen_dates_show_which_rooms_are_free_without_naming_anyone()
    {
        $a = $this->roomWithRate('A-101');
        $this->roomWithRate('A-102');
        $this->reserve([$a], Carbon::parse('2026-10-12 14:00'), Carbon::parse('2026-10-13 12:00'));

        $response = $this->get(route('rooms.index', ['from' => '2026-10-12', 'to' => '2026-10-13', 'guests' => 2]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.from', '2026-10-12')
                ->where('filters.guests', 2)
                ->where('rooms.0.free', false)
                ->where('rooms.1.free', true));
        $response->assertDontSee('Maria Reyes');

        // Dates in the past, or the wrong way round, are ignored.
        $this->get(route('rooms.index', ['from' => '2026-10-01', 'to' => '2026-10-02']))
            ->assertInertia(fn (Assert $page) => $page->where('filters.from', null)->where('rooms.0.free', null));

        $this->get(route('rooms.show', [$a, 'from' => '2026-10-12', 'to' => '2026-10-13']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('public/room')
                ->where('room.name', 'A-101')
                ->has('room.rates', 1)
                ->where('free', false)
                ->where('blockedBy', 'booked')
                ->has('busy', 1)
                ->where('busy.0.from', Carbon::parse('2026-10-12 14:00')->toIso8601String())
                ->missing('busy.0.reason'))
            ->assertDontSee('Maria Reyes');

        $this->get(route('rooms.show', [$a, 'from' => '2026-10-20', 'to' => '2026-10-21']))
            ->assertInertia(fn (Assert $page) => $page->where('free', true)->where('blockedBy', null));

        // A guest in the room who has not confirmed their check-out blocks every later date (rule 13).
        $b = $this->roomWithRate('A-103');
        $this->stayIn($b, Carbon::parse('2026-10-08 14:00'), Carbon::parse('2026-10-09 12:00'));
        $this->get(route('rooms.show', [$b, 'from' => '2026-10-20', 'to' => '2026-10-29']))
            ->assertInertia(fn (Assert $page) => $page->where('free', false)->where('blockedBy', 'occupied'));
    }

    public function test_rooms_not_offered_to_the_public_cannot_be_opened()
    {
        $this->get(route('rooms.show', $this->roomWithRate('A-103', status: RoomStatus::UnderMaintenance)))->assertNotFound();
        $this->get(route('rooms.show', Room::factory()->create(['name' => 'A-105'])))->assertNotFound();

        // Staff can look at the public pages too.
        $this->actingAs(User::factory()->reception()->create())->get(route('rooms.index'))->assertOk();
    }
}
