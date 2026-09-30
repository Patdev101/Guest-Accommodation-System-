<?php

namespace Tests\Feature\Admin;

use App\Models\Room;
use App\Models\RoomPhoto;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RoomPhotoTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        $this->admin = User::factory()->admin()->create();
    }

    public function test_admin_uploads_photos_and_the_first_becomes_the_cover()
    {
        $room = Room::factory()->create();

        $this->actingAs($this->admin)
            ->post(route('admin.rooms.photos.store', $room), [
                'photos' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->image('b.png')],
            ])
            ->assertRedirect(route('admin.rooms.show', $room));

        $photos = $room->photos()->get();
        $this->assertCount(2, $photos);
        $this->assertTrue($photos[0]->is_cover);
        $this->assertFalse($photos[1]->is_cover);
        Storage::disk('public')->assertExists($photos[0]->path);
    }

    public function test_only_images_up_to_5_mb_are_accepted()
    {
        $room = Room::factory()->create();

        $this->actingAs($this->admin)
            ->post(route('admin.rooms.photos.store', $room), [
                'photos' => [UploadedFile::fake()->create('menu.pdf', 100, 'application/pdf')],
            ])
            ->assertSessionHasErrors('photos.0');

        $this->actingAs($this->admin)
            ->post(route('admin.rooms.photos.store', $room), [
                'photos' => [UploadedFile::fake()->image('big.jpg')->size(6000)],
            ])
            ->assertSessionHasErrors('photos.0');

        $this->assertSame(0, $room->photos()->count());
    }

    public function test_a_room_can_have_at_most_ten_photos()
    {
        $room = Room::factory()->create();
        foreach (range(1, RoomPhoto::MAX_PER_ROOM) as $i) {
            $room->photos()->create(['path' => "rooms/{$room->id}/{$i}.jpg", 'sort_order' => $i]);
        }

        $this->actingAs($this->admin)
            ->post(route('admin.rooms.photos.store', $room), ['photos' => [UploadedFile::fake()->image('x.jpg')]])
            ->assertSessionHasErrors('photos');
    }

    public function test_admin_changes_the_cover_and_deleting_the_cover_promotes_the_next()
    {
        $room = Room::factory()->create();
        $first = $room->photos()->create(['path' => 'rooms/1/a.jpg', 'sort_order' => 1, 'is_cover' => true]);
        $second = $room->photos()->create(['path' => 'rooms/1/b.jpg', 'sort_order' => 2]);
        Storage::disk('public')->put('rooms/1/a.jpg', 'x');

        $this->actingAs($this->admin)->patch(route('admin.rooms.photos.update', [$room, $second]), ['is_cover' => 1]);
        $this->assertTrue($second->refresh()->is_cover);
        $this->assertFalse($first->refresh()->is_cover);

        $this->actingAs($this->admin)->patch(route('admin.rooms.photos.update', [$room, $first]), ['is_cover' => 1]);
        $this->actingAs($this->admin)->delete(route('admin.rooms.photos.destroy', [$room, $first]));

        $this->assertModelMissing($first);
        $this->assertTrue($second->refresh()->is_cover);
        Storage::disk('public')->assertMissing('rooms/1/a.jpg');
    }

    public function test_admin_reorders_photos_and_adds_captions()
    {
        $room = Room::factory()->create();
        $a = $room->photos()->create(['path' => 'rooms/1/a.jpg', 'sort_order' => 1]);
        $b = $room->photos()->create(['path' => 'rooms/1/b.jpg', 'sort_order' => 2]);
        $c = $room->photos()->create(['path' => 'rooms/1/c.jpg', 'sort_order' => 3]);

        $this->actingAs($this->admin)
            ->put(route('admin.rooms.photos.reorder', $room), ['photos' => [$c->id, $a->id, $b->id]])
            ->assertRedirect(route('admin.rooms.show', $room));

        $this->assertSame([$c->id, $a->id, $b->id], $room->photos()->pluck('id')->all());

        $this->actingAs($this->admin)
            ->patch(route('admin.rooms.photos.update', [$room, $a]), ['caption' => 'View from the window']);
        $this->assertSame('View from the window', $a->refresh()->caption);
    }

    public function test_reordering_needs_every_photo_of_the_room_exactly_once()
    {
        $room = Room::factory()->create();
        $a = $room->photos()->create(['path' => 'rooms/1/a.jpg', 'sort_order' => 1]);
        $b = $room->photos()->create(['path' => 'rooms/1/b.jpg', 'sort_order' => 2]);
        $other = Room::factory()->create()->photos()->create(['path' => 'rooms/2/x.jpg', 'sort_order' => 1]);

        foreach ([[$a->id], [$a->id, $a->id], [$a->id, $other->id]] as $order) {
            $this->actingAs($this->admin)
                ->put(route('admin.rooms.photos.reorder', $room), ['photos' => $order])
                ->assertSessionHasErrors();
        }

        $this->assertSame([$a->id, $b->id], $room->photos()->pluck('id')->all());
    }

    public function test_only_admins_manage_photos()
    {
        $room = Room::factory()->create();

        $this->actingAs(User::factory()->reception()->create())
            ->post(route('admin.rooms.photos.store', $room), ['photos' => [UploadedFile::fake()->image('a.jpg')]])
            ->assertForbidden();
    }
}
