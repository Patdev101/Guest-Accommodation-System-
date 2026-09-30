<?php

namespace Tests\Feature\Reception;

use App\Enums\BilledTo;
use App\Enums\ChargeType;
use App\Enums\ExtensionStatus;
use App\Enums\IdCustodyStatus;
use App\Enums\ReservationStatus;
use App\Enums\RoomStatus;
use App\Models\IdType;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\Stay;
use App\Models\User;
use App\Services\Availability;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesBookings;
use Tests\TestCase;

class CheckOutTest extends TestCase
{
    use CreatesBookings, RefreshDatabase;

    private User $desk;

    private Room $a;

    private Room $b;

    private Stay $stay;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        $this->travelTo(Carbon::parse('2026-10-01 14:00'));
        $this->desk = User::factory()->reception()->create();
        $this->a = $this->roomWithRate('A-101', pax: 4, price: 800);
        $this->b = $this->roomWithRate('A-102', pax: 4, price: 800);
        $this->a->rates()->create(['name' => 'Extension', 'price' => 50, 'rate_unit_id' => $this->a->rates()->value('rate_unit_id'), 'is_extension_rate' => true]);

        // A company crew in two rooms, 1 600 booked, 500 paid before arrival.
        $reservation = $this->reserve([$this->a, $this->b], Carbon::parse('2026-10-01 14:00'), Carbon::parse('2026-10-03 12:00'), total: 1600);
        $reservation->payments()->create(['amount' => 500, 'payment_type' => 'downpayment', 'paid_by' => 'company', 'method' => 'Cash', 'received_by' => $this->desk->id, 'paid_at' => now()]);

        $this->actingAs($this->desk)->post(route('reception.reservations.check-in.store', $reservation), [
            'verification' => 'passed',
            'contact_name' => 'Maria Reyes',
            'contact_number' => '0917 123 4567',
            'company' => 'Seatech Welding',
            'expected_check_out_at' => '2026-10-03T12:00',
            'guests' => [
                ['name' => 'Maria Reyes', 'address' => 'Calapan', 'contact_number' => '', 'room_id' => $this->a->id],
                ['name' => 'Jose Bautista', 'address' => 'Naujan', 'contact_number' => '', 'room_id' => $this->b->id],
            ],
            'id_type_id' => IdType::create(['name' => 'Passport'])->id,
            'id_number' => 'P1234567A',
            'id_photo' => UploadedFile::fake()->image('id.jpg'),
            'id_collected' => '1',
        ])->assertSessionHasNoErrors();

        $this->stay = Stay::query()->sole();
    }

    private function as(): static
    {
        return $this->actingAs($this->desk);
    }

    private function inspect(Room $room, array $data = []): TestResponse
    {
        $line = $this->stay->rooms()->where('room_id', $room->id)->firstOrFail();

        return $this->as()->post(route('reception.stays.inspections.store', [$this->stay, $line]), ['outcome' => 'cleaning', ...$data]);
    }

    public function test_check_in_bills_each_room_to_the_company_at_its_booked_price()
    {
        $charges = $this->stay->charges()->orderBy('id')->get();

        $this->assertSame([ChargeType::Room, ChargeType::Room], $charges->map->type->all());
        $this->assertSame(['800.00', '800.00'], $charges->pluck('amount')->all());
        $this->assertTrue($charges->every(fn ($charge) => $charge->billed_to === BilledTo::Company));
        // 1 600 charged − 500 downpayment.
        $this->assertSame(1100.0, $this->stay->balance());
    }

    public function test_check_out_frees_the_guests_and_sends_the_rooms_to_inspection()
    {
        $this->as()->post(route('reception.stays.check-out', $this->stay))
            ->assertRedirect(route('reception.stays.show', $this->stay));

        $this->stay->refresh();
        $this->assertNotNull($this->stay->checked_out_at);
        $this->assertSame($this->desk->id, $this->stay->checked_out_by);
        $this->assertSame(RoomStatus::Inspection, $this->a->refresh()->status);
        $this->assertSame(ReservationStatus::CheckedOut, $this->stay->reservation->status);
        $this->assertSame(IdCustodyStatus::HeldPendingPayment, $this->stay->idCustody->status);
        $this->assertTrue(app(Availability::class)->isFree($this->a->refresh(), Carbon::parse('2026-10-05 14:00'), Carbon::parse('2026-10-06 12:00')));
    }

    public function test_inspection_charges_damages_then_sends_the_room_on()
    {
        // Not before check-out.
        $this->inspect($this->a)->assertRedirect(route('reception.stays.show', $this->stay));
        $this->assertNull($this->stay->rooms()->where('room_id', $this->a->id)->value('inspected_at'));

        $this->as()->post(route('reception.stays.check-out', $this->stay));

        $this->inspect($this->a, ['damages' => [['description' => 'Broken lamp', 'amount' => '350', 'billed_to' => 'guest']]])
            ->assertSessionHasNoErrors();
        $this->assertSame(RoomStatus::Cleaning, $this->a->refresh()->status);
        $this->assertDatabaseHas('charges', ['type' => 'damage', 'description' => 'A-101: Broken lamp', 'amount' => 350, 'billed_to' => 'guest']);

        $this->inspect($this->b, ['outcome' => 'maintenance'])->assertSessionHasErrors('issue');
        $this->inspect($this->b, ['outcome' => 'maintenance', 'issue' => 'Aircon not cooling'])->assertSessionHasNoErrors();
        $this->assertSame(RoomStatus::UnderMaintenance, $this->b->refresh()->status);
        $this->assertSame('Aircon not cooling', $this->b->maintenanceRecords()->value('issue'));

        // A room is inspected once.
        $this->inspect($this->a, ['damages' => [['description' => 'Again', 'amount' => '1', 'billed_to' => 'guest']]]);
        $this->assertSame(1, $this->stay->charges()->where('type', 'damage')->count());
    }

    public function test_the_id_goes_back_only_when_everything_is_inspected_and_paid()
    {
        $returnId = fn () => $this->as()->post(route('reception.stays.return-id', $this->stay));

        $returnId();
        $this->assertSame(IdCustodyStatus::Held, $this->stay->idCustody->refresh()->status);

        $this->as()->post(route('reception.stays.check-out', $this->stay));
        $this->inspect($this->a);
        $this->inspect($this->b, ['damages' => [['description' => 'Stained sheets', 'amount' => '200', 'billed_to' => 'guest']]]);

        $returnId();
        $this->assertSame(IdCustodyStatus::HeldPendingPayment, $this->stay->idCustody->refresh()->status);

        $pay = fn (string $amount, string $by) => $this->as()->post(route('reception.stays.payments.store', $this->stay), [
            'amount' => $amount, 'method' => 'GCash', 'paid_by' => $by,
        ]);
        $pay('2000', 'company')->assertSessionHasErrors('amount');
        $pay('1100', 'company')->assertSessionHasNoErrors();
        $pay('200', 'guest')->assertSessionHasNoErrors();
        $this->assertSame(0.0, $this->stay->balance());
        $this->assertSame(IdCustodyStatus::Held, $this->stay->idCustody->refresh()->status);

        $returnId()->assertRedirect(route('reception.stays.show', $this->stay));
        $custody = $this->stay->idCustody->refresh();
        $this->assertSame(IdCustodyStatus::Returned, $custody->status);
        $this->assertSame($this->desk->id, $custody->returned_by);

        // Settled: the bill is closed.
        $this->as()->post(route('reception.stays.charges.store', $this->stay), ['type' => 'extra', 'description' => 'Late', 'amount' => '10', 'billed_to' => 'guest']);
        $this->assertSame(0, $this->stay->charges()->where('type', 'extra')->count());
    }

    public function test_reception_adds_extras_switches_who_pays_and_removes_extras()
    {
        $this->as()->post(route('reception.stays.charges.store', $this->stay), [
            'type' => 'extra', 'description' => 'Laundry', 'amount' => '120', 'billed_to' => 'company',
        ])->assertSessionHasNoErrors();
        $extra = $this->stay->charges()->where('type', 'extra')->sole();

        $this->as()->patch(route('reception.charges.update', $extra), ['billed_to' => 'guest']);
        $this->assertSame(BilledTo::Guest, $extra->refresh()->billed_to);

        $room = $this->stay->charges()->where('type', 'room')->first();
        $this->as()->delete(route('reception.charges.destroy', $room));
        $this->assertModelExists($room);

        $this->as()->delete(route('reception.charges.destroy', $extra));
        $this->assertModelMissing($extra);
    }

    public function test_the_stay_page_and_lists_show_the_bill()
    {
        $this->as()->get(route('reception.stays.show', $this->stay))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('reception/stays/show')
                ->where('bill.charged', '1600.00')
                ->where('bill.paid', '500.00')
                ->where('bill.balance', '1100.00')
                ->where('bill.company_charged', '1600.00')
                ->where('can.check_out', true)
                ->where('can.return_id_blocker', 'Check the guests out first.')
                ->has('guests', 2)
                ->where('extensionCheck', null));

        $this->as()->get(route('reception.stays.index'))
            ->assertInertia(fn (Assert $page) => $page->has('stays.data', 1)->where('stays.data.0.state', 'in_house'));

        $this->as()->post(route('reception.stays.check-out', $this->stay));

        $this->as()->get(route('reception.stays.index', ['show' => 'to_settle']))
            ->assertInertia(fn (Assert $page) => $page->has('stays.data', 1)->where('stays.data.0.state', 'to_settle'));
        $this->as()->get(route('reception.stays.index'))
            ->assertInertia(fn (Assert $page) => $page->has('stays.data', 0));
    }

    public function test_a_call_or_not_extending_releases_the_rooms_after_check_out()
    {
        $later = [Carbon::parse('2026-10-04 14:00'), Carbon::parse('2026-10-05 12:00')];
        $this->assertFalse(app(Availability::class)->isFree($this->a, ...$later));

        $this->as()->post(route('reception.stays.reminders.store', $this->stay), ['result' => 'no_answer']);
        $this->assertNull($this->stay->refresh()->not_extending_confirmed_at);

        $this->as()->post(route('reception.stays.reminders.store', $this->stay), ['result' => 'check_out', 'notes' => 'Leaving at noon']);
        $this->assertNotNull($this->stay->refresh()->not_extending_confirmed_at);
        $this->assertSame(2, $this->stay->reminderLogs()->count());
        $this->assertTrue(app(Availability::class)->isFree($this->a, ...$later));
    }

    public function test_an_extension_with_free_rooms_is_approved_and_billed()
    {
        $this->as()->patch(route('reception.stays.not-extending', $this->stay));

        $this->as()->post(route('reception.stays.extensions.store', $this->stay), [
            'new_check_out_at' => '2026-10-03T18:00',
            'price' => '300',
        ])->assertSessionHasNoErrors();

        $this->stay->refresh();
        $this->assertSame('2026-10-03 18:00', $this->stay->expected_check_out_at->format('Y-m-d H:i'));
        $this->assertNull($this->stay->not_extending_confirmed_at);
        $this->assertSame(ExtensionStatus::Approved, $this->stay->extensions()->sole()->status);
        $this->assertSame('300.00', $this->stay->charges()->where('type', 'extension')->value('amount'));

        $this->as()->post(route('reception.stays.extensions.store', $this->stay), ['new_check_out_at' => '2026-10-03T17:00', 'price' => '0'])
            ->assertSessionHasErrors('new_check_out_at');
    }

    public function test_guest_b_must_agree_to_move_before_the_stay_is_extended()
    {
        $nextGuest = $this->reserve([$this->a], Carbon::parse('2026-10-03 14:00'), Carbon::parse('2026-10-04 12:00'));
        $line = $nextGuest->rooms()->sole();
        $spare = $this->roomWithRate('A-103', pax: 2);
        $extend = fn (array $moves) => $this->as()->post(route('reception.stays.extensions.store', $this->stay), [
            'new_check_out_at' => '2026-10-03T18:00',
            'price' => '300',
            'moves' => $moves,
        ]);

        $this->as()->get(route('reception.stays.show', [$this->stay, 'extend_to' => '2026-10-03T18:00']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('extensionCheck.conflicts.0.guest', 'Maria Reyes')
                ->where('extensionCheck.conflicts.0.room', 'A-101')
                ->where('extensionCheck.conflicts.0.alternatives.0.name', 'A-103'));

        // Declined: denied, nothing moves.
        $extend([['reservation_room_id' => $line->id, 'to_room_id' => $spare->id, 'consent' => 'declined']]);
        $this->assertSame(ExtensionStatus::Denied, $this->stay->extensions()->latest('id')->first()->status);
        $this->assertSame($this->a->id, $line->refresh()->room_id);
        $this->assertSame('2026-10-03 12:00', $this->stay->refresh()->expected_check_out_at->format('Y-m-d H:i'));

        // Not reached yet: waits, then the answer arrives.
        $extend([['reservation_room_id' => $line->id, 'to_room_id' => $spare->id, 'consent' => 'pending']]);
        $waiting = $this->stay->extensions()->latest('id')->first();
        $this->assertSame(ExtensionStatus::PendingConsent, $waiting->status);

        $this->as()->patch(route('reception.extensions.decide', $waiting), ['answers' => [$waiting->moves()->value('id') => 'agreed']])
            ->assertSessionHasNoErrors();

        $this->assertSame(ExtensionStatus::Approved, $waiting->refresh()->status);
        $this->assertSame($spare->id, $line->refresh()->room_id);
        $this->assertSame('2026-10-03 18:00', $this->stay->refresh()->expected_check_out_at->format('Y-m-d H:i'));
        $this->assertSame(ReservationStatus::Active, $nextGuest->refresh()->status);
    }

    public function test_no_room_for_guest_b_means_no_extension()
    {
        $nextGuest = $this->reserve([$this->a], Carbon::parse('2026-10-03 14:00'), Carbon::parse('2026-10-04 12:00'));

        $this->as()->post(route('reception.stays.extensions.store', $this->stay), [
            'new_check_out_at' => '2026-10-03T18:00',
            'price' => '300',
            'moves' => [['reservation_room_id' => $nextGuest->rooms()->value('id'), 'to_room_id' => null, 'consent' => 'agreed']],
        ]);

        $extension = $this->stay->extensions()->sole();
        $this->assertSame(ExtensionStatus::Denied, $extension->status);
        $this->assertStringContainsString('No other room', (string) $extension->denial_reason);
        $this->assertSame(0, $this->stay->charges()->where('type', 'extension')->count());
    }

    public function test_the_dashboard_lists_calls_to_make_and_rooms_to_inspect()
    {
        $this->travelTo(Carbon::parse('2026-10-03 11:30'));

        $this->as()->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('dueSoon', 1)
                ->where('dueSoon.0.last_call', null)
                ->has('toInspect', 0)
                ->where('stats.inHouse', 2));

        $this->as()->post(route('reception.stays.check-out', $this->stay));

        $this->as()->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page->has('dueSoon', 0)->has('toInspect', 2));
    }

    public function test_only_staff_can_use_stays()
    {
        $this->actingAs(User::factory()->create())
            ->get(route('reception.stays.show', $this->stay))
            ->assertForbidden();

        $this->assertInstanceOf(Reservation::class, $this->stay->reservation);
    }
}
