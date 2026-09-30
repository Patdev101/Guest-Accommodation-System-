<?php

namespace Tests\Feature\Admin;

use App\Models\ActivityLog;
use App\Models\RateUnit;
use App\Models\Room;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_changes_record_who_what_and_old_and_new_values()
    {
        $admin = User::factory()->admin()->create(['name' => 'Ana']);
        $room = Room::factory()->create(['name' => 'A-104']);
        $rate = $room->rates()->create(['name' => 'Overnight', 'price' => 600, 'rate_unit_id' => RateUnit::create(['name' => 'Overnight'])->id]);
        ActivityLog::query()->delete();

        $this->actingAs($admin)->put(route('admin.rooms.rates.update', [$room, $rate]), [
            'name' => 'Overnight',
            'rate_unit_id' => $rate->rate_unit_id,
            'price' => '750',
        ]);

        $entry = ActivityLog::query()->sole();
        $this->assertSame($admin->id, $entry->user_id);
        $this->assertSame('updated', $entry->action);
        $this->assertSame('RoomRate', $entry->subject_type);
        $this->assertSame('Updated rate "Overnight" on room A-104', $entry->description);
        $this->assertSame(['price' => ['600.00', '750.00']], $entry->changes);
    }

    public function test_room_status_changes_are_described_in_words()
    {
        $room = Room::factory()->create(['name' => 'A-104']);

        $this->actingAs(User::factory()->admin()->create())->patch(route('admin.rooms.status.update', $room), [
            'status' => 'out_of_service',
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'subject_type' => 'Room',
            'description' => 'Changed room A-104 ('.$room->location->name.') to Out of service',
        ]);
    }

    public function test_settings_are_logged_only_when_they_change()
    {
        $this->actingAs(User::factory()->admin()->create());

        Setting::set('cleaning_buffer_minutes', '45');
        Setting::set('cleaning_buffer_minutes', '45');
        Setting::set('settings_reviewed_at', now()->toIso8601String());

        $entry = ActivityLog::query()->where('subject_type', 'Setting')->sole();
        $this->assertSame('Changed setting: Cleaning buffer (minutes)', $entry->description);
        $this->assertSame(['cleaning_buffer_minutes' => ['0', '45']], $entry->changes);
    }

    public function test_passwords_never_appear_in_the_log()
    {
        $desk = User::factory()->reception()->create();

        $this->actingAs(User::factory()->admin()->create())->put(route('admin.users.password', $desk), [
            'password' => 'new-secret-123',
            'password_confirmation' => 'new-secret-123',
        ]);

        $entry = ActivityLog::query()->where('subject_type', 'User')->where('action', 'updated')->sole();
        $this->assertSame(['password' => ['(hidden)', '(changed)']], $entry->changes);
        $this->assertStringNotContainsString('new-secret', (string) json_encode($entry->changes));
    }

    public function test_admin_filters_the_activity_log()
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin);
        Room::factory()->create(['name' => 'A-104']);
        Setting::set('cleaning_buffer_minutes', '30');

        $this->get(route('admin.activity.index', ['type' => 'Setting']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/activity')
                ->has('entries.data', 1)
                ->where('entries.data.0.type', 'Settings'));

        $this->get(route('admin.activity.index', ['search' => 'A-104']))
            ->assertInertia(fn (Assert $page) => $page->has('entries.data', 1));
    }

    public function test_only_admins_see_the_activity_log()
    {
        $this->actingAs(User::factory()->reception()->create())
            ->get(route('admin.activity.index'))
            ->assertForbidden();
    }

    public function test_admin_sends_a_test_email()
    {
        Event::fake([MessageSent::class]);

        $this->actingAs(User::factory()->admin()->create(['email' => 'boss@example.com']))
            ->post(route('admin.settings.test-email'))
            ->assertRedirect(route('admin.settings.edit'));

        Event::assertDispatched(MessageSent::class, fn (MessageSent $event) => $event->message->getTo()[0]->getAddress() === 'boss@example.com');
    }
}
