<?php

namespace Tests\Feature;

use App\Enums\RoomStatus;
use App\Models\Location;
use App\Models\RateUnit;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $response = $this->get(route('dashboard'));
        $response->assertRedirect(route('login'));
    }

    public function test_guest_accounts_see_their_reservations()
    {
        $this->actingAs(User::factory()->create())
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('dashboard')
                ->has('reservations', 0)
                ->missing('stats'));
    }

    public function test_reception_sees_front_desk_stats_and_room_statuses()
    {
        $this->actingAs(User::factory()->reception()->create())
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('dashboard')
                ->has('stats.arrivalsToday')
                ->has('stats.idsPendingPayment')
                ->has('roomStatuses', 7)
                ->missing('reservations'));
    }

    public function test_admin_gets_the_admin_dashboard_with_a_setup_checklist()
    {
        $this->actingAs(User::factory()->admin()->create())
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/dashboard')
                ->where('stats.rooms', 0)
                ->where('checklist.locations', 0)
                ->where('checklist.settingsReviewed', false)
                ->has('groups', 4)
                ->has('breakdown', 7));
    }

    public function test_admin_dashboard_summarises_rooms_by_location_and_status()
    {
        $villa = Location::factory()->create(['name' => 'Villa']);
        Room::factory()->for($villa)->create(['name' => 'Villa 1', 'pax_capacity' => 4]);
        Room::factory()->for($villa)->status(RoomStatus::Cleaning)->create(['name' => 'Villa 2', 'pax_capacity' => 2]);
        $room = Room::factory()->for($villa)->status(RoomStatus::UnderMaintenance)->create(['name' => 'Villa 3']);
        $room->maintenanceRecords()->create(['performed_on' => today(), 'issue' => 'Leak']);
        $room->rates()->create(['name' => 'Night', 'price' => 900, 'rate_unit_id' => RateUnit::create(['name' => 'Overnight'])->id]);

        $this->actingAs(User::factory()->admin()->create())
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.rooms', 3)
                ->where('groups.0.value', 'available')
                ->where('groups.0.count', 1)
                ->where('groups.2.value', 'turnover')
                ->where('groups.2.count', 1)
                ->where('groups.3.count', 1)
                ->where('board.0.name', 'Villa')
                ->has('board.0.rooms', 3)
                ->where('board.0.rooms.1.group', 'turnover')
                ->where('checklist.roomsWithoutRatesCount', 2)
                ->where('checklist.roomsWithoutExtensionRate', 3)
                ->where('recentMaintenance.0.issue', 'Leak')
                ->where('recentMaintenance.0.resolved', false));
    }
}
