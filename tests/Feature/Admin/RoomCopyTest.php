<?php

namespace Tests\Feature\Admin;

use App\Enums\RoomStatus;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\RateUnit;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RoomCopyTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        $this->admin = User::factory()->admin()->create();

        $this->room = Room::factory()
            ->for(Location::factory()->create(['name' => 'Barracks']))
            ->status(RoomStatus::UnderMaintenance)
            ->create(['name' => 'A-101', 'pax_capacity' => 8, 'description' => 'Bunk room']);
        $unit = RateUnit::create(['name' => 'Overnight']);
        $this->room->rates()->create(['name' => 'Overnight', 'price' => 800, 'rate_unit_id' => $unit->id]);
        $this->room->inclusions()->create(['item' => 'Double decks', 'quantity' => 4]);
        Storage::disk('public')->put("rooms/{$this->room->id}/a.jpg", 'image');
        $this->room->photos()->create(['path' => "rooms/{$this->room->id}/a.jpg", 'caption' => 'Bunks', 'is_cover' => true]);
        $this->room->maintenanceRecords()->create(['performed_on' => today(), 'issue' => 'Leak']);
        ActivityLog::query()->delete();
    }

    public function test_admin_copies_a_room_into_several_new_rooms()
    {
        $this->actingAs($this->admin)
            ->post(route('admin.rooms.copies.store', $this->room), [
                'location_id' => $this->room->location_id,
                'names' => "A-102\nA-103\n\n A-104 ",
            ])
            ->assertRedirect(route('admin.rooms.index', ['location' => $this->room->location_id]));

        $copies = Room::query()->whereIn('name', ['A-102', 'A-103', 'A-104'])->get();
        $this->assertCount(3, $copies);

        $copy = $copies->firstWhere('name', 'A-103');
        $this->assertSame(RoomStatus::Available, $copy->status);
        $this->assertSame(8, $copy->pax_capacity);
        $this->assertSame('Bunk room', $copy->description);
        $this->assertSame(1, $copy->rates()->count());
        $this->assertSame(4, $copy->inclusions()->first()->quantity);
        $this->assertSame(0, $copy->maintenanceRecords()->count());

        $photo = $copy->photos()->first();
        $this->assertTrue($photo->is_cover);
        $this->assertSame('Bunks', $photo->caption);
        Storage::disk('public')->assertExists($photo->path);
        $this->assertStringStartsWith("rooms/{$copy->id}/", $photo->path);

        // One tidy log entry per copy, not one per rate, inclusion and photo.
        $this->assertSame(3, ActivityLog::query()->count());
    }

    public function test_one_copy_opens_the_new_room()
    {
        $response = $this->actingAs($this->admin)->post(route('admin.rooms.copies.store', $this->room), [
            'location_id' => $this->room->location_id,
            'names' => 'A-102',
        ]);

        $response->assertRedirect(route('admin.rooms.show', Room::query()->where('name', 'A-102')->firstOrFail()));
    }

    public function test_names_must_be_new_and_different()
    {
        $this->actingAs($this->admin)
            ->post(route('admin.rooms.copies.store', $this->room), [
                'location_id' => $this->room->location_id,
                'names' => "A-101\nA-102",
            ])
            ->assertSessionHasErrors('names');

        $this->actingAs($this->admin)
            ->post(route('admin.rooms.copies.store', $this->room), [
                'location_id' => $this->room->location_id,
                'names' => "A-102\na-102",
            ])
            ->assertSessionHasErrors('names');

        $this->assertSame(1, Room::query()->count());
    }

    public function test_a_copy_can_go_to_another_location_with_the_same_name()
    {
        $villa = Location::factory()->create();

        $this->actingAs($this->admin)
            ->post(route('admin.rooms.copies.store', $this->room), ['location_id' => $villa->id, 'names' => 'A-101'])
            ->assertSessionHasNoErrors();

        $this->assertSame(1, $villa->rooms()->count());
    }

    public function test_only_admins_copy_rooms()
    {
        $this->actingAs(User::factory()->reception()->create())
            ->post(route('admin.rooms.copies.store', $this->room), ['location_id' => $this->room->location_id, 'names' => 'X'])
            ->assertForbidden();
    }
}
