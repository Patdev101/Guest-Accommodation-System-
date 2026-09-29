<?php

namespace Tests\Feature\Admin;

use App\Enums\RoomStatus;
use App\Models\Location;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LocationManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_admins_can_manage_locations()
    {
        $this->actingAs(User::factory()->create())
            ->get(route('admin.locations.index'))
            ->assertForbidden();

        $this->actingAs(User::factory()->reception()->create())
            ->post(route('admin.locations.store'), ['name' => 'Villa'])
            ->assertForbidden();

        $this->assertDatabaseCount('locations', 0);
    }

    public function test_index_lists_locations_with_room_counts_and_status_groups()
    {
        $villa = Location::factory()->create(['name' => 'Guest Villa']);
        Room::factory()->for($villa)->create(['pax_capacity' => 4]);
        Room::factory()->for($villa)->status(RoomStatus::UnderMaintenance)->create(['pax_capacity' => 2]);
        Location::factory()->create(['name' => 'Barracks']);

        $this->actingAs(User::factory()->admin()->create())
            ->get(route('admin.locations.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/locations/index')
                ->has('locations', 2)
                ->where('locations.0.name', 'Barracks')
                ->where('locations.1.name', 'Guest Villa')
                ->where('locations.1.rooms_count', 2)
                ->where('locations.1.capacity', 6)
                ->where('locations.1.groups.available', 1)
                ->where('locations.1.groups.unavailable', 1)
                ->has('statusGroups', 4));
    }

    public function test_admin_can_add_and_rename_a_location()
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->post(route('admin.locations.store'), ['name' => 'Guest Villa', 'description' => 'Near the clubhouse'])
            ->assertRedirect(route('admin.locations.index'));

        $location = Location::where('name', 'Guest Villa')->firstOrFail();

        $this->actingAs($admin)
            ->put(route('admin.locations.update', $location), ['name' => 'Guest Villas', 'description' => ''])
            ->assertRedirect(route('admin.locations.index'));

        $this->assertSame('Guest Villas', $location->refresh()->name);
        $this->assertNull($location->description);
    }

    public function test_location_names_must_be_unique()
    {
        Location::factory()->create(['name' => 'Barracks']);

        $this->actingAs(User::factory()->admin()->create())
            ->post(route('admin.locations.store'), ['name' => 'Barracks'])
            ->assertSessionHasErrors('name');
    }

    public function test_a_location_with_rooms_cannot_be_deleted()
    {
        $location = Location::factory()->has(Room::factory())->create();
        $empty = Location::factory()->create();
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->delete(route('admin.locations.destroy', $location));
        $this->assertModelExists($location);

        $this->actingAs($admin)
            ->delete(route('admin.locations.destroy', $empty))
            ->assertRedirect(route('admin.locations.index'));
        $this->assertModelMissing($empty);
    }
}
