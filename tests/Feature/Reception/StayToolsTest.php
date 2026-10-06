<?php

namespace Tests\Feature\Reception;

use App\Enums\RefundStatus;
use App\Enums\RoomStatus;
use App\Models\Refund;
use App\Models\Room;
use App\Models\Setting;
use App\Models\Stay;
use App\Models\User;
use App\Notifications\FrontDeskAlert;
use App\Services\FrontDeskAlerts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\CreatesBookings;
use Tests\TestCase;

class StayToolsTest extends TestCase
{
    use CreatesBookings, RefreshDatabase;

    private User $desk;

    private Room $a;

    private Room $b;

    private Stay $stay;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::parse('2026-10-01 09:00'));
        $this->desk = User::factory()->reception()->create();
        $this->a = $this->roomWithRate('A-101', status: RoomStatus::Occupied);
        $this->b = $this->roomWithRate('A-102');
        $this->stay = $this->stayIn($this->a, Carbon::parse('2026-09-30 14:00'), Carbon::parse('2026-10-01 12:00'));
    }

    private function charge(float $amount): void
    {
        $this->stay->charges()->create([
            'type' => 'room', 'description' => 'Room A-101', 'amount' => $amount, 'billed_to' => 'company', 'created_by' => $this->desk->id,
        ]);
    }

    private function pay(float $amount): void
    {
        $this->stay->payments()->create([
            'amount' => $amount, 'payment_type' => 'full', 'paid_by' => 'company', 'method' => 'Cash',
            'received_by' => $this->desk->id, 'paid_at' => now(),
        ]);
    }

    public function test_the_bill_can_be_printed()
    {
        $this->charge(1000);
        $this->pay(400);

        $this->actingAs($this->desk)
            ->get(route('reception.stays.bill', $this->stay))
            ->assertOk()
            ->assertSee('Jose Bautista')
            ->assertSee('Room A-101')
            ->assertSee('Balance due')
            ->assertSee('600.00');

        $this->actingAs(User::factory()->create())->get(route('reception.stays.bill', $this->stay))->assertForbidden();
    }

    public function test_guests_can_be_moved_to_another_room_during_the_stay()
    {
        $admin = User::factory()->admin()->create();
        $line = $this->stay->rooms()->sole();
        $small = $this->roomWithRate('A-103', pax: 1);
        $line->update(['pax' => 2]);
        $move = fn (Room $to, string $oldRoom = 'maintenance') => $this->actingAs($this->desk)
            ->post(route('reception.stays.rooms.move', [$this->stay, $line]), ['to_room_id' => $to->id, 'reason' => 'Aircon not cooling', 'old_room' => $oldRoom]);

        // Too small, or not available: refused.
        $move($small)->assertSessionHasErrors('to_room_id');
        $this->b->update(['status' => RoomStatus::Cleaning]);
        $move($this->b)->assertSessionHasErrors('to_room_id');
        $this->assertSame($this->a->id, $line->refresh()->room_id);

        $this->b->update(['status' => RoomStatus::Available]);
        $move($this->b)->assertSessionHasNoErrors()->assertRedirect(route('reception.stays.show', $this->stay));

        $this->assertSame($this->b->id, $line->refresh()->room_id);
        $this->assertSame(RoomStatus::Occupied, $this->b->refresh()->status);
        $this->assertSame(RoomStatus::UnderMaintenance, $this->a->refresh()->status);
        $this->assertSame('Aircon not cooling', $this->a->maintenanceRecords()->sole()->issue);
        $this->assertSame('A-101 needs repair', $admin->notifications()->sole()->data['title']);
    }

    public function test_a_late_check_out_fee_is_added_without_extending_the_stay()
    {
        // Not late yet (due at 12:00, now 09:00).
        $this->actingAs($this->desk)
            ->post(route('reception.stays.late-fee', $this->stay), ['amount' => '300', 'billed_to' => 'guest']);
        $this->assertSame(0, $this->stay->charges()->count());

        $this->travelTo(Carbon::parse('2026-10-01 14:00'));

        $this->actingAs($this->desk)
            ->post(route('reception.stays.late-fee', $this->stay), ['amount' => '300', 'billed_to' => 'guest'])
            ->assertRedirect(route('reception.stays.show', $this->stay));

        $charge = $this->stay->charges()->sole();
        $this->assertSame('Late check-out fee (2 hours late)', $charge->description);
        $this->assertSame('300.00', $charge->amount);
        $this->assertSame('2026-10-01 12:00', $this->stay->refresh()->expected_check_out_at->format('Y-m-d H:i'));
    }

    public function test_an_overpayment_is_refunded_and_the_refund_records_how_it_was_paid_back()
    {
        $this->charge(1000);
        $this->pay(1500);

        // Not checked out yet: charges may still be added.
        $this->actingAs($this->desk)->post(route('reception.stays.refund-overpayment', $this->stay));
        $this->assertSame(0, Refund::query()->count());

        $this->stay->update(['checked_out_at' => now(), 'checked_out_by' => $this->desk->id]);
        $this->stay->rooms()->update(['inspected_at' => now(), 'inspected_by' => $this->desk->id]);
        $this->assertSame(500.0, $this->stay->overpaid());

        $this->actingAs($this->desk)->post(route('reception.stays.refund-overpayment', $this->stay));
        $refund = Refund::query()->sole();
        $this->assertSame($this->stay->id, $refund->stay_id);
        $this->assertSame('500.00', $refund->amount);
        $this->assertSame(RefundStatus::Requested, $refund->status);
        $this->assertSame(0.0, $this->stay->balance());

        // Asking again does nothing.
        $this->actingAs($this->desk)->post(route('reception.stays.refund-overpayment', $this->stay));
        $this->assertSame(1, Refund::query()->count());

        // Processing needs nothing; giving the money back needs the method.
        $this->actingAs($this->desk)->patch(route('reception.refunds.advance', $refund));
        $this->actingAs($this->desk)->patch(route('reception.refunds.advance', $refund))->assertSessionHasErrors('method');
        $this->assertSame(RefundStatus::Processing, $refund->refresh()->status);

        $this->actingAs($this->desk)
            ->patch(route('reception.refunds.advance', $refund), ['method' => 'GCash', 'reference' => 'GC-778'])
            ->assertSessionHasNoErrors();
        $refund->refresh();
        $this->assertSame(RefundStatus::Refunded, $refund->status);
        $this->assertSame('GCash', $refund->method);
        $this->assertSame('GC-778', $refund->reference);
    }

    public function test_reception_is_warned_when_a_room_is_still_occupied_and_the_next_guest_is_due()
    {
        $this->reserve([$this->a], Carbon::parse('2026-10-01 09:30'), Carbon::parse('2026-10-02 12:00'));

        app(FrontDeskAlerts::class)->run();

        $titles = $this->desk->notifications()->get()->map(fn ($notification) => $notification->data['title']);
        $this->assertContains('A-101 still occupied, next guest due', $titles);
    }

    public function test_urgent_alerts_are_also_emailed_when_switched_on()
    {
        $this->travelTo(Carbon::parse('2026-10-01 11:30'));
        Notification::fake();

        app(FrontDeskAlerts::class)->run();
        Notification::assertSentToTimes($this->desk, FrontDeskAlert::class, 1);

        Setting::set('alert_emails', '1');
        $this->travelTo(Carbon::parse('2026-10-01 11:31'));
        $this->stay->update(['expected_check_out_at' => Carbon::parse('2026-10-01 12:05')]);

        app(FrontDeskAlerts::class)->run();
        Notification::assertSentTo($this->desk, FrontDeskAlert::class, fn (FrontDeskAlert $alert, array $channels) => $channels === ['mail']
            && $alert->toMail($this->desk)->subject === 'Call Jose Bautista before check-out');
    }

    public function test_the_stay_page_offers_the_tools()
    {
        $this->travelTo(Carbon::parse('2026-10-01 13:30'));

        $this->actingAs($this->desk)
            ->get(route('reception.stays.show', $this->stay))
            ->assertInertia(fn ($page) => $page
                ->where('tools.minutes_late', 90)
                ->where('tools.late_text', '1 h 30 min')
                ->where('tools.can_refund_overpayment', false)
                ->where('tools.move_rooms.0.name', 'A-102')
                ->where('bill.refunded', '0.00'));
    }
}
