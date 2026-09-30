<?php

namespace Tests\Feature\Reception;

use App\Enums\ReminderType;
use App\Enums\RoomStatus;
use App\Models\User;
use App\Services\FrontDeskAlerts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Tests\Concerns\CreatesBookings;
use Tests\TestCase;

class AlertTest extends TestCase
{
    use CreatesBookings, RefreshDatabase;

    private User $desk;

    private User $colleague;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::parse('2026-10-01 11:10'));
        $this->desk = User::factory()->reception()->create();
        $this->colleague = User::factory()->reception()->create();
        $this->admin = User::factory()->admin()->create();
    }

    /**
     * @return list<string>
     */
    private function titles(User $user, ?bool $read = null): array
    {
        return $user->notifications()
            ->reorder('created_at')
            ->when($read !== null, fn ($query) => $read ? $query->whereNotNull('read_at') : $query->whereNull('read_at'))
            ->get()
            ->map(fn ($notification) => $notification->data['title'])
            ->all();
    }

    public function test_timed_alerts_go_to_reception_once_and_not_to_the_admin()
    {
        $room = $this->roomWithRate('A-101');
        // Due out at noon: the 60-minute reminder window has started.
        $stay = $this->stayIn($room, Carbon::parse('2026-09-30 14:00'), Carbon::parse('2026-10-01 12:00'));
        // Arriving at 11:45: within the hour.
        $this->reserve([$this->roomWithRate('A-102')], Carbon::parse('2026-10-01 11:45'), Carbon::parse('2026-10-02 12:00'));
        // Reserved for 9:00, grace 60 minutes: late.
        $this->reserve([$this->roomWithRate('A-103')], Carbon::parse('2026-10-01 09:00'), Carbon::parse('2026-10-02 12:00'));
        $inactive = User::factory()->reception()->create(['deactivated_at' => now()]);
        $guest = User::factory()->create();

        $this->assertSame(3, app(FrontDeskAlerts::class)->run());
        $this->assertSame(0, app(FrontDeskAlerts::class)->run());

        $titles = $this->titles($this->desk, read: false);
        $this->assertCount(3, $titles);
        $this->assertContains('Call Jose Bautista before check-out', $titles);
        $this->assertContains('Maria Reyes arrives at 11:45 AM', $titles);
        $this->assertContains('Maria Reyes has not arrived', $titles);
        $this->assertCount(3, $this->titles($this->colleague));
        $this->assertSame([], $this->titles($this->admin));
        $this->assertSame([], $this->titles($inactive));
        $this->assertSame([], $this->titles($guest));

        // Rule 21: the automatic reminder is logged on the stay.
        $this->assertSame(ReminderType::InApp, $stay->reminderLogs()->sole()->type);
    }

    public function test_without_a_reception_account_the_admin_gets_the_desk_alerts()
    {
        $this->stayIn($this->roomWithRate('A-101'), Carbon::parse('2026-09-30 14:00'), Carbon::parse('2026-10-01 12:00'));
        User::query()->where('role', 'reception')->update(['deactivated_at' => now()]);

        app(FrontDeskAlerts::class)->run();

        $this->assertSame(['Call Jose Bautista before check-out'], $this->titles($this->admin));
    }

    public function test_no_call_alert_once_the_guest_confirmed_they_are_not_extending()
    {
        $stay = $this->stayIn($this->roomWithRate('A-101'), Carbon::parse('2026-09-30 14:00'), Carbon::parse('2026-10-01 12:00'), confirmedNotExtending: true);

        app(FrontDeskAlerts::class)->run();

        $this->assertCount(0, $this->titles($this->desk));
        $this->assertSame(0, $stay->reminderLogs()->count());
    }

    public function test_the_scheduled_command_sends_due_alerts()
    {
        $this->stayIn($this->roomWithRate('A-101'), Carbon::parse('2026-09-30 14:00'), Carbon::parse('2026-10-01 12:00'));

        $this->artisan('front-desk:alerts')->expectsOutput('Sent 1 alert(s).')->assertSuccessful();
    }

    public function test_room_ready_reaches_reception_and_is_already_read_for_whoever_marked_it()
    {
        $room = $this->roomWithRate('A-101', status: RoomStatus::Cleaning);

        $this->actingAs($this->desk)
            ->from(route('dashboard'))
            ->patch(route('reception.rooms.status.update', $room), ['status' => 'available']);

        $this->assertSame(['A-101 is ready'], $this->titles($this->colleague, read: false));
        $this->assertSame(['A-101 is ready'], $this->titles($this->desk, read: true));
        $this->assertSame([], $this->titles($this->admin));
    }

    public function test_the_admin_is_told_when_a_room_needs_repair()
    {
        $room = $this->roomWithRate('A-101');

        $this->actingAs($this->desk)
            ->from(route('dashboard'))
            ->patch(route('reception.rooms.status.update', $room), ['status' => 'under_maintenance', 'issue' => 'Aircon leaking']);

        $this->assertSame(['A-101 needs repair'], $this->titles($this->admin, read: false));
        $this->assertStringContainsString('Aircon leaking', $this->admin->notifications()->sole()->data['body']);
        $this->assertSame([], $this->titles($this->colleague));
    }

    public function test_bookings_cancellations_and_waiting_extensions_reach_the_desk()
    {
        $room = $this->roomWithRate('A-101');
        $reservation = $this->reserve([$this->roomWithRate('A-102')], Carbon::parse('2026-10-05 14:00'), Carbon::parse('2026-10-06 12:00'));

        app(FrontDeskAlerts::class)->booked($reservation, $this->desk);
        $this->actingAs($this->desk)->patch(route('reception.reservations.cancel', $reservation), ['reason' => 'Trip moved']);

        $this->assertSame(['New booking: Maria Reyes', 'Booking cancelled: Maria Reyes'], $this->titles($this->colleague, read: false));
        $this->assertSame(['New booking: Maria Reyes', 'Booking cancelled: Maria Reyes'], $this->titles($this->desk, read: true));

        // The room is booked next; the next guest has not answered yet.
        $stay = $this->stayIn($room, Carbon::parse('2026-09-30 14:00'), Carbon::parse('2026-10-02 12:00'));
        $next = $this->reserve([$room], Carbon::parse('2026-10-02 14:00'), Carbon::parse('2026-10-03 12:00'));
        $spare = $this->roomWithRate('A-103');

        $this->actingAs($this->desk)->post(route('reception.stays.extensions.store', $stay), [
            'new_check_out_at' => '2026-10-02T18:00',
            'price' => '300',
            'moves' => [['reservation_room_id' => $next->rooms()->value('id'), 'to_room_id' => $spare->id, 'consent' => 'pending']],
        ])->assertSessionHasNoErrors();

        $this->assertSame('Call Maria Reyes about a room move', $this->titles($this->colleague, read: false)[2]);
        $this->assertSame([], $this->titles($this->admin));
    }

    public function test_the_bell_lists_alerts_and_marks_them_read()
    {
        $this->stayIn($this->roomWithRate('A-101'), Carbon::parse('2026-09-30 14:00'), Carbon::parse('2026-10-01 12:00'));
        Cache::flush();

        // Asking the bell also runs the due-alert check (no scheduler needed).
        $response = $this->actingAs($this->desk)->getJson(route('reception.alerts.index'))
            ->assertOk()
            ->assertJsonPath('unread', 1)
            ->assertJsonPath('items.0.kind', 'checkout_call')
            ->assertJsonPath('items.0.read', false);

        $this->actingAs($this->desk)->postJson(route('reception.alerts.read', $response->json('items.0.id')))
            ->assertJsonPath('unread', 0)
            ->assertJsonPath('items.0.read', true);

        $this->actingAs($this->colleague)->postJson(route('reception.alerts.read-all'))->assertJsonPath('unread', 0);
        $this->actingAs($this->admin)->getJson(route('reception.alerts.index'))->assertJsonPath('unread', 0)->assertJsonCount(0, 'items');

        $this->actingAs(User::factory()->create())->getJson(route('reception.alerts.index'))->assertForbidden();
    }
}
