<?php

namespace Tests\Feature\Admin;

use App\Enums\BookingChannel;
use App\Enums\ReservationStatus;
use App\Enums\RoomStatus;
use App\Models\Guest;
use App\Models\Location;
use App\Models\RateUnit;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomRate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RoomManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
    }

    public function test_only_admins_can_see_rooms()
    {
        $room = Room::factory()->create();

        $this->actingAs(User::factory()->reception()->create())
            ->get(route('admin.rooms.show', $room))
            ->assertForbidden();
    }

    public function test_index_lists_rooms_with_their_cheapest_standard_rate()
    {
        $unit = RateUnit::create(['name' => 'Overnight']);
        $villa = Location::factory()->create(['name' => 'Villa']);
        $room = Room::factory()->for($villa)->create(['name' => 'Villa 2']);
        Room::factory()->for($villa)->create(['name' => 'Villa 10']);
        $room->rates()->createMany([
            ['name' => 'Overnight', 'price' => 1500, 'rate_unit_id' => $unit->id],
            ['name' => 'Promo', 'price' => 1200, 'rate_unit_id' => $unit->id],
            ['name' => 'Extension', 'price' => 100, 'rate_unit_id' => $unit->id, 'is_extension_rate' => true],
        ]);

        $this->actingAs($this->admin)
            ->get(route('admin.rooms.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/rooms/index')
                ->has('rooms', 2)
                ->where('rooms.0.name', 'Villa 2')
                ->where('rooms.0.rates_count', 2)
                ->where('rooms.0.from_price', '1200.00')
                ->where('rooms.0.has_extension_rate', true)
                ->where('rooms.1.name', 'Villa 10')
                ->where('rooms.1.from_price', null)
                ->has('statuses', 7));
    }

    public function test_admin_can_add_a_room_and_is_taken_to_it()
    {
        $location = Location::factory()->create();

        $response = $this->actingAs($this->admin)->post(route('admin.rooms.store'), [
            'location_id' => $location->id,
            'name' => 'Villa 1',
            'pax_capacity' => 4,
        ]);

        $room = Room::where('name', 'Villa 1')->firstOrFail();
        $response->assertRedirect(route('admin.rooms.show', $room));
        $this->assertSame(RoomStatus::Available, $room->status);
    }

    public function test_room_names_are_unique_within_a_location_only()
    {
        $villa = Location::factory()->create();
        $barracks = Location::factory()->create();
        Room::factory()->for($villa)->create(['name' => 'Room 1']);

        $this->actingAs($this->admin)
            ->post(route('admin.rooms.store'), ['location_id' => $villa->id, 'name' => 'Room 1', 'pax_capacity' => 2])
            ->assertSessionHasErrors('name');

        $this->actingAs($this->admin)
            ->post(route('admin.rooms.store'), ['location_id' => $barracks->id, 'name' => 'Room 1', 'pax_capacity' => 2])
            ->assertSessionHasNoErrors();
    }

    public function test_pax_capacity_must_be_at_least_one()
    {
        $this->actingAs($this->admin)
            ->post(route('admin.rooms.store'), ['location_id' => Location::factory()->create()->id, 'name' => 'X', 'pax_capacity' => 0])
            ->assertSessionHasErrors('pax_capacity');
    }

    public function test_room_page_offers_only_manual_status_changes()
    {
        $room = Room::factory()->create();

        $this->actingAs($this->admin)
            ->get(route('admin.rooms.show', $room))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/rooms/show')
                ->where('room.status', 'available')
                ->where('transitions.0.value', 'under_maintenance')
                ->where('transitions.1.value', 'out_of_service')
                ->has('transitions', 2));

        $occupied = Room::factory()->status(RoomStatus::Occupied)->create();

        $this->actingAs($this->admin)
            ->get(route('admin.rooms.show', $occupied))
            ->assertInertia(fn (Assert $page) => $page->has('transitions', 0));
    }

    public function test_admin_can_edit_a_room()
    {
        $room = Room::factory()->create();
        $other = Location::factory()->create();

        $this->actingAs($this->admin)
            ->put(route('admin.rooms.update', $room), [
                'location_id' => $other->id,
                'name' => 'Renamed',
                'pax_capacity' => 6,
                'description' => 'Sea view',
            ])
            ->assertRedirect(route('admin.rooms.show', $room));

        $room->refresh();
        $this->assertSame([$other->id, 'Renamed', 6, 'Sea view'], [$room->location_id, $room->name, $room->pax_capacity, $room->description]);
    }

    public function test_a_room_with_reservations_cannot_be_deleted()
    {
        $room = Room::factory()->create();
        $this->reserve($room);

        $this->actingAs($this->admin)
            ->delete(route('admin.rooms.destroy', $room))
            ->assertRedirect(route('admin.rooms.show', $room));

        $this->assertModelExists($room);
    }

    public function test_deleting_a_room_removes_its_rates_and_inclusions()
    {
        $room = Room::factory()->create();
        $room->inclusions()->create(['item' => 'Fridge', 'quantity' => 1]);
        $room->rates()->create(['name' => 'Night', 'price' => 500, 'rate_unit_id' => RateUnit::create(['name' => 'Overnight'])->id]);

        $this->actingAs($this->admin)
            ->delete(route('admin.rooms.destroy', $room))
            ->assertRedirect(route('admin.rooms.index'));

        $this->assertModelMissing($room);
        $this->assertDatabaseCount('room_inclusions', 0);
        $this->assertDatabaseCount('room_rates', 0);
    }

    public function test_setting_a_room_under_maintenance_logs_the_issue()
    {
        $room = Room::factory()->create();

        $this->actingAs($this->admin)
            ->patch(route('admin.rooms.status.update', $room), ['status' => 'under_maintenance'])
            ->assertSessionHasErrors('issue');

        $this->actingAs($this->admin)
            ->patch(route('admin.rooms.status.update', $room), [
                'status' => 'under_maintenance',
                'issue' => 'Aircon not cooling',
            ])
            ->assertRedirect(route('admin.rooms.show', $room));

        $this->assertSame(RoomStatus::UnderMaintenance, $room->refresh()->status);
        $this->assertDatabaseHas('maintenance_records', [
            'room_id' => $room->id,
            'issue' => 'Aircon not cooling',
            'action_taken' => null,
            'recorded_by' => $this->admin->id,
        ]);
    }

    public function test_finishing_a_repair_completes_the_open_record()
    {
        $room = Room::factory()->status(RoomStatus::UnderMaintenance)->create();
        $record = $room->maintenanceRecords()->create(['performed_on' => today(), 'issue' => 'Leak']);

        $this->actingAs($this->admin)->patch(route('admin.rooms.status.update', $room), [
            'status' => 'available',
            'action_taken' => 'Replaced pipe',
            'done_by' => 'Maintenance crew',
        ]);

        $this->assertSame(RoomStatus::Available, $room->refresh()->status);
        $this->assertSame('Replaced pipe', $record->refresh()->action_taken);
        $this->assertSame('Maintenance crew', $record->done_by);
    }

    public function test_status_changes_follow_the_room_status_flow()
    {
        $available = Room::factory()->create();
        $occupied = Room::factory()->status(RoomStatus::Occupied)->create();

        $this->actingAs($this->admin)
            ->patch(route('admin.rooms.status.update', $available), ['status' => 'cleaning'])
            ->assertSessionHasErrors('status');

        $this->actingAs($this->admin)
            ->patch(route('admin.rooms.status.update', $occupied), ['status' => 'available'])
            ->assertSessionHasErrors('status');

        $this->assertSame(RoomStatus::Available, $available->refresh()->status);
        $this->assertSame(RoomStatus::Occupied, $occupied->refresh()->status);
    }

    public function test_admin_manages_rates()
    {
        $room = Room::factory()->create();
        $unit = RateUnit::create(['name' => 'Per hour']);

        $this->actingAs($this->admin)
            ->post(route('admin.rooms.rates.store', $room), [
                'name' => 'Extension',
                'rate_unit_id' => $unit->id,
                'price' => '150.50',
                'is_extension_rate' => '1',
            ])
            ->assertRedirect(route('admin.rooms.show', $room));

        $rate = $room->rates()->firstOrFail();
        $this->assertTrue($rate->is_extension_rate);
        $this->assertSame('150.50', $rate->price);

        // An unchecked checkbox sends nothing.
        $this->actingAs($this->admin)->put(route('admin.rooms.rates.update', [$room, $rate]), [
            'name' => 'Hourly',
            'rate_unit_id' => $unit->id,
            'price' => 200,
        ]);
        $this->assertFalse($rate->refresh()->is_extension_rate);

        $this->actingAs($this->admin)->delete(route('admin.rooms.rates.destroy', [$room, $rate]));
        $this->assertModelMissing($rate);
    }

    public function test_rate_prices_are_validated()
    {
        $room = Room::factory()->create();
        $unit = RateUnit::create(['name' => 'Overnight']);

        $this->actingAs($this->admin)
            ->post(route('admin.rooms.rates.store', $room), ['name' => 'Night', 'rate_unit_id' => $unit->id, 'price' => '-1'])
            ->assertSessionHasErrors('price');

        $this->actingAs($this->admin)
            ->post(route('admin.rooms.rates.store', $room), ['name' => 'Night', 'rate_unit_id' => $unit->id, 'price' => '1.999'])
            ->assertSessionHasErrors('price');
    }

    public function test_a_rate_used_by_a_reservation_cannot_be_deleted()
    {
        $room = Room::factory()->create();
        $rate = $room->rates()->create(['name' => 'Night', 'price' => 500, 'rate_unit_id' => RateUnit::create(['name' => 'Overnight'])->id]);
        $this->reserve($room, $rate);

        $this->actingAs($this->admin)->delete(route('admin.rooms.rates.destroy', [$room, $rate]));

        $this->assertModelExists($rate);
    }

    public function test_a_rate_can_only_be_changed_through_its_own_room()
    {
        $room = Room::factory()->create();
        $otherRoom = Room::factory()->create();
        $rate = $otherRoom->rates()->create(['name' => 'Night', 'price' => 500, 'rate_unit_id' => RateUnit::create(['name' => 'Overnight'])->id]);

        $this->actingAs($this->admin)
            ->delete(route('admin.rooms.rates.destroy', [$room, $rate]))
            ->assertNotFound();
    }

    public function test_admin_manages_inclusions()
    {
        $room = Room::factory()->create();

        $this->actingAs($this->admin)->post(route('admin.rooms.inclusions.store', $room), ['item' => 'Double deck', 'quantity' => 2]);
        $inclusion = $room->inclusions()->firstOrFail();

        $this->actingAs($this->admin)
            ->post(route('admin.rooms.inclusions.store', $room), ['item' => 'double DECK', 'quantity' => 1])
            ->assertSessionHasErrors('item');

        $this->actingAs($this->admin)->patch(route('admin.rooms.inclusions.update', [$room, $inclusion]), ['quantity' => 3]);
        $this->assertSame(3, $inclusion->refresh()->quantity);

        $this->actingAs($this->admin)->delete(route('admin.rooms.inclusions.destroy', [$room, $inclusion]));
        $this->assertModelMissing($inclusion);
    }

    public function test_admin_manages_maintenance_records()
    {
        $room = Room::factory()->create();

        $this->actingAs($this->admin)->post(route('admin.rooms.maintenance.store', $room), [
            'performed_on' => '2026-09-20',
            'issue' => 'Broken chair',
        ]);
        $record = $room->maintenanceRecords()->firstOrFail();
        $this->assertSame($this->admin->id, $record->recorded_by);

        $this->actingAs($this->admin)->put(route('admin.rooms.maintenance.update', [$room, $record]), [
            'performed_on' => '2026-09-20',
            'issue' => 'Broken chair',
            'action_taken' => 'Replaced',
        ]);
        $this->assertSame('Replaced', $record->refresh()->action_taken);

        $this->actingAs($this->admin)->delete(route('admin.rooms.maintenance.destroy', [$room, $record]));
        $this->assertModelMissing($record);
    }

    private function reserve(Room $room, ?RoomRate $rate = null): Reservation
    {
        $guest = Guest::create(['name' => 'Juan', 'contact_number' => '09170000000']);

        return Reservation::create([
            'guest_id' => $guest->id,
            'room_id' => $room->id,
            'room_rate_id' => $rate?->id,
            'pax' => 1,
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addDays(2),
            'status' => ReservationStatus::Active,
            'booked_via' => BookingChannel::Reception,
            'booked_by' => $this->admin->id,
        ]);
    }
}
