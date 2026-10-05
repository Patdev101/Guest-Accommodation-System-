<?php

namespace Tests\Feature\Reception;

use App\Enums\PaymentType;
use App\Enums\RefundStatus;
use App\Enums\ReservationStatus;
use App\Models\ActivityLog;
use App\Models\Guest;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\Setting;
use App\Models\User;
use App\Services\Availability;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesBookings;
use Tests\TestCase;

class ReservationTest extends TestCase
{
    use CreatesBookings, RefreshDatabase;

    private User $desk;

    private Room $a;

    private Room $b;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::parse('2026-10-01 09:00'));
        $this->desk = User::factory()->reception()->create(['name' => 'Rosa']);
        $this->a = $this->roomWithRate('A-101', pax: 4, price: 800);
        $this->b = $this->roomWithRate('A-102', pax: 4, price: 800);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function booking(array $overrides = []): array
    {
        return [
            'contact_name' => 'Engr. Dela Cruz',
            'contact_number' => '0917 555 1234',
            'email' => 'delacruz@seatech.test',
            'company' => 'Seatech Welding',
            'purpose' => 'Hull repair',
            'guest_type' => 'contractor',
            'starts_at' => '2026-10-02T14:00',
            'ends_at' => '2026-10-04T12:00',
            'rooms' => [
                ['room_id' => $this->a->id, 'room_rate_id' => $this->a->rates()->value('id'), 'pax' => 4, 'price' => '1600'],
                ['room_id' => $this->b->id, 'room_rate_id' => $this->b->rates()->value('id'), 'pax' => 2, 'price' => '1600'],
            ],
            'payment_amount' => '1000',
            'payment_method' => 'GCash',
            'paid_by' => 'company',
            'receipt_number' => 'OR-1001',
            ...$overrides,
        ];
    }

    public function test_the_booking_page_shows_which_rooms_are_free_and_the_earliest_slot()
    {
        $this->reserve([$this->b], Carbon::parse('2026-10-02 14:00'), Carbon::parse('2026-10-03 12:00'));

        $this->actingAs($this->desk)
            ->get(route('reception.reservations.create', ['starts_at' => '2026-10-02T14:00', 'ends_at' => '2026-10-03T12:00', 'pax' => 6]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('reception/reservations/create')
                ->where('window.pax', 6)
                ->where('rooms.0.name', 'A-101')
                ->where('rooms.0.blocked_reason', null)
                ->where('rooms.1.blocked_reason', fn (string $reason) => str_contains($reason, 'Reserved for Maria Reyes'))
                ->where('freeCapacity', 4)
                ->where('earliest.starts_at', '2026-10-03T12:00')
                ->where('earliest.rooms', 2));
    }

    public function test_reception_books_several_rooms_for_a_company_with_a_downpayment()
    {
        $response = $this->actingAs($this->desk)->post(route('reception.reservations.store'), $this->booking());

        $reservation = Reservation::query()->sole();
        $response->assertRedirect(route('reception.reservations.show', $reservation));

        $this->assertSame(ReservationStatus::Active, $reservation->status);
        $this->assertSame('3200.00', $reservation->total);
        $this->assertSame('Seatech Welding', $reservation->company);
        $this->assertSame('Hull repair', $reservation->purpose);
        $this->assertSame([4, 2], $reservation->rooms()->orderBy('id')->pluck('pax')->all());
        $this->assertSame('Engr. Dela Cruz', $reservation->guest->name);
        $this->assertSame('delacruz@seatech.test', $reservation->guest->email);

        $payment = $reservation->payments()->sole();
        $this->assertSame(PaymentType::Downpayment, $payment->payment_type);
        $this->assertSame('1000.00', $payment->amount);
        $this->assertSame($this->desk->id, $payment->received_by);
        $this->assertSame('partial', $reservation->paymentStatus()->value);

        $this->assertTrue(ActivityLog::query()->where('subject_type', 'Reservation')->where('user_id', $this->desk->id)->exists());
    }

    public function test_a_returning_contact_person_is_reused()
    {
        $guest = Guest::create(['name' => 'Engr. Dela Cruz', 'contact_number' => '0917 555 1234']);

        $this->actingAs($this->desk)->post(route('reception.reservations.store'), $this->booking());

        $this->assertSame(1, Guest::query()->count());
        $this->assertSame('Seatech Welding', $guest->refresh()->company);
    }

    public function test_a_room_that_is_taken_cannot_be_booked()
    {
        $this->reserve([$this->b], Carbon::parse('2026-10-03 14:00'), Carbon::parse('2026-10-05 12:00'));

        $this->actingAs($this->desk)
            ->post(route('reception.reservations.store'), $this->booking())
            ->assertSessionHasErrors('rooms.1.room_id');

        $this->assertSame(1, Reservation::query()->count());
    }

    public function test_booking_details_are_checked()
    {
        $other = $this->roomWithRate('Villa 1');
        $booking = $this->booking();
        $booking['rooms'][0]['pax'] = 5;
        $booking['rooms'][1]['room_rate_id'] = $other->rates()->value('id');

        $this->actingAs($this->desk)
            ->post(route('reception.reservations.store'), [...$booking, 'payment_amount' => '5000'])
            ->assertSessionHasErrors(['rooms.0.pax', 'rooms.1.room_rate_id', 'payment_amount']);

        $this->actingAs($this->desk)
            ->post(route('reception.reservations.store'), $this->booking(['payment_method' => '', 'ends_at' => '2026-10-02T13:00', 'rooms' => [], 'company' => '']))
            ->assertSessionHasErrors(['payment_method', 'ends_at', 'rooms', 'company']);

        $this->assertSame(0, Reservation::query()->count());
    }

    public function test_a_booking_that_leaves_guests_without_a_room_is_refused()
    {
        // 10 guests, but the two rooms take 4 + 2.
        $this->actingAs($this->desk)
            ->post(route('reception.reservations.store'), $this->booking(['guests' => 10]))
            ->assertSessionHasErrors(['rooms' => 'The rooms have places for 6, but the booking is for 10 guests: 4 guests have no room. Add another room.']);
        $this->assertSame(0, Reservation::query()->count());

        // Everyone placed: accepted.
        $this->actingAs($this->desk)
            ->post(route('reception.reservations.store'), $this->booking(['guests' => 6]))
            ->assertSessionHasNoErrors();
        $this->assertSame(1, Reservation::query()->count());
    }

    public function test_reception_edits_an_active_reservation()
    {
        $this->actingAs($this->desk)->post(route('reception.reservations.store'), $this->booking());
        $reservation = Reservation::query()->sole();
        $c = $this->roomWithRate('A-103', pax: 6, price: 900);

        // The page opens filled in, and the booking's own rooms count as free.
        $this->actingAs($this->desk)
            ->get(route('reception.reservations.edit', $reservation))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('reception/reservations/create')
                ->where('editing.id', $reservation->id)
                ->where('editing.contact_name', 'Engr. Dela Cruz')
                ->where('editing.paid', '1000.00')
                ->has('editing.rooms', 2)
                ->where('window.starts_at', '2026-10-02T14:00')
                ->where('window.pax', 6)
                ->where('rooms.0.blocked_reason', null)
                ->where('rooms.1.blocked_reason', null));

        // Move a day later, keep A-101, swap A-102 for A-103, new contact number.
        $changes = $this->booking([
            'contact_number' => '0918 000 1111',
            'purpose' => 'Hull repair, phase 2',
            'starts_at' => '2026-10-03T14:00',
            'ends_at' => '2026-10-05T12:00',
            'guests' => 9,
            'rooms' => [
                ['room_id' => $this->a->id, 'room_rate_id' => $this->a->rates()->value('id'), 'pax' => 4, 'price' => '1600'],
                ['room_id' => $c->id, 'room_rate_id' => $c->rates()->value('id'), 'pax' => 5, 'price' => '1800'],
            ],
            'payment_amount' => '',
            'payment_method' => '',
        ]);

        $this->actingAs($this->desk)
            ->put(route('reception.reservations.update', $reservation), $changes)
            ->assertRedirect(route('reception.reservations.show', $reservation));

        $reservation->refresh();
        $this->assertSame('2026-10-03 14:00', $reservation->starts_at->format('Y-m-d H:i'));
        $this->assertSame('3400.00', $reservation->total);
        $this->assertSame('Hull repair, phase 2', $reservation->purpose);
        $this->assertSame('0918 000 1111', $reservation->guest->contact_number);
        $this->assertSame(['A-101', 'A-103'], $reservation->rooms()->with('room')->get()->map(fn ($line) => $line->room->name)->sort()->values()->all());
        $this->assertSame(1, Reservation::query()->count());
        // The payment stays; A-102 is free again.
        $this->assertSame('1000.00', $reservation->payments()->sole()->amount);
        $this->assertNull(app(Availability::class)->blockedReason($this->b, Carbon::parse('2026-10-03 14:00'), Carbon::parse('2026-10-05 12:00')));

        // Refused: a room taken by someone else, a total below what was paid, guests without a room.
        $this->reserve([$this->b], Carbon::parse('2026-10-04 14:00'), Carbon::parse('2026-10-05 12:00'));
        $taken = $changes;
        $taken['rooms'][1] = ['room_id' => $this->b->id, 'room_rate_id' => $this->b->rates()->value('id'), 'pax' => 4, 'price' => '1600'];
        $this->actingAs($this->desk)->put(route('reception.reservations.update', $reservation), [...$taken, 'guests' => 8])
            ->assertSessionHasErrors('rooms.1.room_id');

        $cheap = $changes;
        $cheap['rooms'] = [['room_id' => $this->a->id, 'room_rate_id' => $this->a->rates()->value('id'), 'pax' => 4, 'price' => '500']];
        $this->actingAs($this->desk)->put(route('reception.reservations.update', $reservation), [...$cheap, 'guests' => 4])
            ->assertSessionHasErrors('rooms');

        $this->actingAs($this->desk)->put(route('reception.reservations.update', $reservation), [...$changes, 'guests' => 12])
            ->assertSessionHasErrors('rooms');

        $this->assertSame('3400.00', $reservation->refresh()->total);

        // A cancelled reservation cannot be edited.
        $this->actingAs($this->desk)->patch(route('reception.reservations.cancel', $reservation), ['reason' => 'Trip moved']);
        $this->actingAs($this->desk)->get(route('reception.reservations.edit', $reservation))
            ->assertRedirect(route('reception.reservations.show', $reservation));
        $this->actingAs($this->desk)->put(route('reception.reservations.update', $reservation), $changes)
            ->assertRedirect(route('reception.reservations.show', $reservation));
        $this->assertSame(ReservationStatus::Cancelled, $reservation->refresh()->status);
    }

    public function test_guests_cannot_use_the_front_desk_but_admins_can()
    {
        $this->actingAs(User::factory()->create())
            ->get(route('reception.reservations.index'))
            ->assertForbidden();

        $this->actingAs(User::factory()->admin()->create())
            ->get(route('reception.reservations.index'))
            ->assertOk();
    }

    public function test_the_list_filters_and_searches_reservations()
    {
        $this->reserve([$this->a], Carbon::parse('2026-10-02 14:00'), Carbon::parse('2026-10-03 12:00'));
        $this->reserve([$this->b], Carbon::parse('2026-10-02 14:00'), Carbon::parse('2026-10-03 12:00'), ReservationStatus::Cancelled);

        $this->actingAs($this->desk)
            ->get(route('reception.reservations.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('reception/reservations/index')
                ->has('reservations.data', 1)
                ->where('reservations.data.0.rooms', ['A-101'])
                ->where('reservations.data.0.company', 'Seatech Welding'));

        $this->actingAs($this->desk)
            ->get(route('reception.reservations.index', ['show' => 'cancelled']))
            ->assertInertia(fn (Assert $page) => $page->has('reservations.data', 1)->where('reservations.data.0.rooms', ['A-102']));

        $this->actingAs($this->desk)
            ->get(route('reception.reservations.index', ['show' => 'all', 'search' => 'A-102']))
            ->assertInertia(fn (Assert $page) => $page->has('reservations.data', 1));
    }

    public function test_payments_are_recorded_up_to_the_balance()
    {
        $reservation = $this->reserve([$this->a], Carbon::parse('2026-10-02 14:00'), Carbon::parse('2026-10-03 12:00'), total: 800);
        $pay = fn (string $amount) => $this->actingAs($this->desk)->post(route('reception.reservations.payments.store', $reservation), [
            'amount' => $amount,
            'method' => 'Cash',
            'paid_by' => 'guest',
        ]);

        $pay('300')->assertSessionHasNoErrors();
        $pay('600')->assertSessionHasErrors('amount');
        $pay('500')->assertSessionHasNoErrors();

        $types = $reservation->payments()->orderBy('id')->get()->map(fn ($payment) => $payment->payment_type)->all();
        $this->assertSame([PaymentType::Downpayment, PaymentType::Balance], $types);
        $this->assertSame('paid', $reservation->paymentStatus()->value);
    }

    public function test_cancelling_frees_the_rooms_and_requests_refunds()
    {
        $reservation = $this->reserve([$this->a], Carbon::parse('2026-10-02 14:00'), Carbon::parse('2026-10-03 12:00'));
        $reservation->payments()->create(['amount' => 500, 'payment_type' => 'downpayment', 'paid_by' => 'guest', 'method' => 'Cash', 'received_by' => $this->desk->id, 'paid_at' => now()]);

        $this->actingAs($this->desk)
            ->patch(route('reception.reservations.cancel', $reservation), ['reason' => ''])
            ->assertSessionHasErrors('reason');

        $this->actingAs($this->desk)
            ->patch(route('reception.reservations.cancel', $reservation), ['reason' => 'Project moved'])
            ->assertRedirect(route('reception.reservations.show', $reservation));

        $reservation->refresh();
        $this->assertSame(ReservationStatus::Cancelled, $reservation->status);
        $this->assertSame($this->desk->id, $reservation->cancelled_by);
        $refund = $reservation->refunds()->sole();
        $this->assertSame('500.00', $refund->amount);
        $this->assertSame(RefundStatus::Requested, $refund->status);
        $this->assertSame('Cancelled: Project moved', $refund->reason);

        $this->assertTrue(app(Availability::class)->isFree($this->a, Carbon::parse('2026-10-02 14:00'), Carbon::parse('2026-10-03 12:00')));

        // A second cancel changes nothing.
        $this->actingAs($this->desk)->patch(route('reception.reservations.cancel', $reservation), ['reason' => 'Again']);
        $this->assertSame(1, $reservation->refunds()->count());
    }

    public function test_a_no_show_is_allowed_only_after_the_grace_period_and_refunds_per_the_policy()
    {
        Setting::set('no_show_refund', 'partial');
        Setting::set('no_show_refund_percent', '50');
        $reservation = $this->reserve([$this->a], Carbon::parse('2026-10-01 10:00'), Carbon::parse('2026-10-02 12:00'));
        $reservation->payments()->create(['amount' => 800, 'payment_type' => 'full', 'paid_by' => 'guest', 'method' => 'Cash', 'received_by' => $this->desk->id, 'paid_at' => now()]);

        $this->travelTo(Carbon::parse('2026-10-01 10:30'));
        $this->actingAs($this->desk)->patch(route('reception.reservations.no-show', $reservation));
        $this->assertSame(ReservationStatus::Active, $reservation->refresh()->status);

        $this->travelTo(Carbon::parse('2026-10-01 11:00'));
        $this->actingAs($this->desk)->patch(route('reception.reservations.no-show', $reservation));

        $this->assertSame(ReservationStatus::NoShow, $reservation->refresh()->status);
        $this->assertSame('400.00', $reservation->refunds()->sole()->amount);
        $this->assertDatabaseHas('activity_logs', ['description' => "Marked reservation #{$reservation->id} (Maria Reyes) as a no-show"]);
    }

    public function test_the_reservation_page_shows_rooms_payments_and_what_can_be_done()
    {
        $reservation = $this->reserve([$this->a, $this->b], Carbon::parse('2026-10-02 14:00'), Carbon::parse('2026-10-03 12:00'), total: 1600);

        $this->actingAs($this->desk)
            ->get(route('reception.reservations.show', $reservation))
            ->assertInertia(fn (Assert $page) => $page
                ->component('reception/reservations/show')
                ->has('rooms', 2)
                ->where('reservation.balance', '1600.00')
                ->where('can', ['check_in' => true, 'edit' => true, 'pay' => true, 'cancel' => true, 'no_show' => false])
                ->where('stay', null));
    }
}
