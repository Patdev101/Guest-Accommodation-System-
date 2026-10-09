<?php

namespace Tests\Feature;

use App\Enums\GuestType;
use App\Models\BookingRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesBookings;
use Tests\TestCase;

class GuestHomeTest extends TestCase
{
    use CreatesBookings, RefreshDatabase;

    public function test_a_guest_sees_only_their_own_stay_requests_and_reservations()
    {
        $this->travelTo(Carbon::parse('2026-10-09 09:00'));
        $user = User::factory()->create(['name' => 'Ana Cruz']);
        $a = $this->roomWithRate('A-101');
        $b = $this->roomWithRate('A-102');
        $c = $this->roomWithRate('A-103');

        // Hers: one confirmed booking, one stay in house, one request waiting.
        $mine = $this->reserve([$a], Carbon::parse('2026-10-12 14:00'), Carbon::parse('2026-10-13 12:00'));
        $mine->guest->update(['user_id' => $user->id]);
        $stay = $this->stayIn($b, Carbon::parse('2026-10-08 14:00'), Carbon::parse('2026-10-10 12:00'));
        $stay->guest->update(['user_id' => $user->id]);
        BookingRequest::create([
            'user_id' => $user->id, 'contact_name' => 'Ana Cruz', 'contact_number' => '0917 000 0000', 'guest_type' => GuestType::Visitor,
            'guests' => 2, 'starts_at' => '2026-10-20 14:00', 'ends_at' => '2026-10-21 12:00', 'total' => 1000,
        ])->rooms()->create(['room_id' => $c->id, 'pax' => 2, 'price' => 1000]);

        // Someone else's booking must not appear.
        $this->reserve([$c], Carbon::parse('2026-10-15 14:00'), Carbon::parse('2026-10-16 12:00'));

        $this->actingAs($user)
            ->get(route('guest.home'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('guest/home')
                ->where('profile.name', 'Ana Cruz')
                ->has('upcoming', 1)
                ->where('upcoming.0.rooms', 'A-101')
                ->where('upcoming.0.status_label', 'Confirmed')
                ->where('stay.rooms', 'A-102')
                ->where('stay.overdue', false)
                ->has('requests', 1)
                ->where('requests.0.rooms', 'A-103')
                ->where('requests.0.status', 'pending')
                ->where('counts.upcoming', 1)
                ->where('counts.waiting', 1)
                ->has('past', 0));
    }

    public function test_a_new_guest_sees_an_empty_screen_and_staff_cannot_open_it()
    {
        $this->get(route('guest.home'))->assertRedirect(route('login'));

        $this->actingAs(User::factory()->create())
            ->get(route('guest.home'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('stay', null)
                ->has('upcoming', 0)
                ->has('requests', 0)
                ->where('counts.stays', 0));

        $this->actingAs(User::factory()->reception()->create())->get(route('guest.home'))->assertForbidden();
    }
}
