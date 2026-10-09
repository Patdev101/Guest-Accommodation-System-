<?php

namespace Tests\Feature;

use App\Enums\BookingChannel;
use App\Enums\BookingRequestStatus;
use App\Enums\ReservationStatus;
use App\Models\BookingRequest;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\User;
use App\Notifications\BookingRequestAnswered;
use App\Services\Availability;
use App\Services\FrontDeskAlerts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesBookings;
use Tests\TestCase;

class BookingRequestTest extends TestCase
{
    use CreatesBookings, RefreshDatabase;

    private User $guest;

    private User $desk;

    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();

        // The form is limited to a few sends a minute; these tests send more than that.
        $this->withoutMiddleware(ThrottleRequests::class);
        $this->travelTo(Carbon::parse('2026-10-09 09:00'));
        $this->guest = User::factory()->create(['name' => 'Ana Cruz', 'contact_number' => '0917 111 2222']);
        $this->desk = User::factory()->reception()->create();
        $this->room = $this->roomWithRate('A-101', pax: 4, price: 800);
    }

    /** @param  array<string, mixed>  $overrides */
    private function send(array $overrides = [], ?Room $room = null, ?User $as = null): TestResponse
    {
        $room ??= $this->room;

        return $this->actingAs($as ?? $this->guest)->post(route('guest.requests.store', $room), [
            'from' => '2026-10-12',
            'to' => '2026-10-14',
            'rooms' => [['room_id' => $room->id, 'room_rate_id' => $room->rates()->value('id'), 'pax' => 2]],
            'contact_name' => 'Ana Cruz',
            'contact_number' => '0917 111 2222',
            'company' => 'Seatech Welding',
            'guest_type' => 'visitor',
            'message' => 'Arriving late',
            ...$overrides,
        ]);
    }

    public function test_a_guest_sends_a_request_that_holds_the_room_and_alerts_reception()
    {
        $this->actingAs($this->guest)
            ->get(route('guest.requests.create', [$this->room, 'from' => '2026-10-12', 'to' => '2026-10-14', 'guests' => 9]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('guest/book')
                ->where('roomId', $this->room->id)
                ->where('rooms.0.name', 'A-101')
                ->where('rooms.0.free', true)
                ->where('defaults.from', '2026-10-12')
                ->where('defaults.guests', 9)
                ->where('defaults.contact_name', 'Ana Cruz')
                ->where('pending', 0)
                ->where('maxPending', 3));

        $this->send()->assertSessionHasNoErrors()->assertRedirect(route('guest.home'));

        $request = BookingRequest::query()->sole();
        $this->assertSame(BookingRequestStatus::Pending, $request->status);
        $this->assertSame('2026-10-12 14:00', $request->starts_at->format('Y-m-d H:i'));
        $this->assertSame('2026-10-14 12:00', $request->ends_at->format('Y-m-d H:i'));
        // The server works out the price: 2 nights at 800.
        $this->assertSame('1600.00', $request->total);
        $this->assertSame('2026-10-10 09:00', $request->hold_expires_at?->format('Y-m-d H:i'));
        $this->assertSame('A-101', $request->rooms()->sole()->room->name);

        // The room is held: nobody else can take those dates.
        $this->assertFalse(app(Availability::class)->isFree($this->room, Carbon::parse('2026-10-13 14:00'), Carbon::parse('2026-10-14 12:00')));
        $this->get(route('rooms.show', [$this->room, 'from' => '2026-10-13', 'to' => '2026-10-14']))
            ->assertInertia(fn (Assert $page) => $page->where('free', false));

        $this->assertSame('Booking request from Ana Cruz', $this->desk->notifications()->sole()->data['title']);
    }

    public function test_a_request_is_refused_when_it_breaks_the_rules()
    {
        $line = fn (array $change) => ['rooms' => [['room_id' => $this->room->id, 'room_rate_id' => $this->room->rates()->value('id'), 'pax' => 2, ...$change]]];
        $this->send($line(['pax' => 5]))->assertSessionHasErrors('rooms.0.pax');
        $this->send(['rooms' => []])->assertSessionHasErrors('rooms');
        $this->send(['company' => ''])->assertSessionHasErrors('company');
        $this->send(['from' => '2026-10-01'])->assertSessionHasErrors('from');
        $this->send(['to' => '2026-10-12'])->assertSessionHasErrors('to');
        $this->send($line(['room_rate_id' => $this->roomWithRate('A-109')->rates()->value('id')]))->assertSessionHasErrors('rooms.0.room_rate_id');
        // A room that is not offered to the public cannot be slipped in.
        $this->send($line(['room_id' => Room::factory()->create()->id]))->assertSessionHasErrors('rooms.0.room_id');
        $this->assertSame(0, BookingRequest::query()->count());

        // Taken dates.
        $this->reserve([$this->room], Carbon::parse('2026-10-13 14:00'), Carbon::parse('2026-10-14 12:00'));
        $this->send()->assertSessionHasErrors('from');

        // At most three requests waiting at a time.
        foreach (['A-102', 'A-103', 'A-104'] as $name) {
            $this->send(room: $this->roomWithRate($name))->assertSessionHasNoErrors();
        }
        $this->send(room: $this->roomWithRate('A-105'))->assertSessionHasErrors('rooms');
        $this->assertSame(3, BookingRequest::query()->count());

        // Only guest accounts, and only rooms offered to the public.
        $this->send(as: $this->desk)->assertForbidden();
        $this->actingAs($this->guest)->get(route('guest.requests.create', Room::factory()->create()))->assertNotFound();
    }

    public function test_a_group_asks_for_several_rooms_in_one_request()
    {
        $second = $this->roomWithRate('A-102', pax: 6, price: 500);

        $this->send(['rooms' => [
            ['room_id' => $this->room->id, 'room_rate_id' => $this->room->rates()->value('id'), 'pax' => 4],
            ['room_id' => $second->id, 'room_rate_id' => $second->rates()->value('id'), 'pax' => 6],
        ]])->assertSessionHasNoErrors();

        $request = BookingRequest::query()->sole();
        $this->assertSame(10, $request->guests);
        // Two nights: 800 x 2 + 500 x 2.
        $this->assertSame('2600.00', $request->total);
        $this->assertSame(2, $request->rooms()->count());
        // The company is remembered on the guest's profile for next time.
        $this->assertSame('Seatech Welding', $this->guest->guest()->value('company'));

        $this->actingAs($this->desk)->patch(route('reception.requests.approve', $request));
        $reservation = Reservation::query()->sole();
        $this->assertSame(['A-101', 'A-102'], $reservation->rooms()->with('room')->get()->map(fn ($line) => $line->room->name)->sort()->values()->all());
        $this->assertSame(10, (int) $reservation->rooms()->sum('pax'));
    }

    public function test_reception_approves_a_request_into_a_reservation()
    {
        Notification::fake();
        $this->send();
        $request = BookingRequest::query()->sole();

        $this->actingAs($this->desk)
            ->get(route('reception.requests.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('reception/requests')
                ->has('requests.data', 1)
                ->where('requests.data.0.contact_name', 'Ana Cruz')
                ->where('requests.data.0.problem', null)
                ->where('waiting', 1));

        $this->actingAs($this->desk)->patch(route('reception.requests.approve', $request));

        $reservation = Reservation::query()->sole();
        $this->assertSame(ReservationStatus::Active, $reservation->status);
        $this->assertSame(BookingChannel::Guest, $reservation->booked_via);
        $this->assertSame('1600.00', $reservation->total);
        $this->assertSame('Seatech Welding', $reservation->company);
        $this->assertSame($this->guest->id, $reservation->guest->user_id);
        $this->assertSame('A-101', $reservation->rooms()->sole()->room->name);

        $request->refresh();
        $this->assertSame(BookingRequestStatus::Approved, $request->status);
        $this->assertSame($reservation->id, $request->reservation_id);
        $this->assertSame($this->desk->id, $request->decided_by);
        Notification::assertSentTo($this->guest, BookingRequestAnswered::class);

        // Answered once: a second answer changes nothing.
        $this->actingAs($this->desk)->patch(route('reception.requests.approve', $request))->assertSessionHasErrors('request');
        $this->assertSame(1, Reservation::query()->count());

        // The guest sees it as a confirmed booking.
        $this->actingAs($this->guest)->get(route('guest.home'))
            ->assertInertia(fn (Assert $page) => $page->has('upcoming', 1)->where('requests.0.status', 'approved'));

        $this->actingAs($this->guest)->patch(route('reception.requests.approve', $request))->assertForbidden();

        // Cancelled later at the front desk: the request no longer just says "Approved".
        $reservation->update(['status' => ReservationStatus::Cancelled, 'cancelled_at' => now(), 'cancelled_by' => $this->desk->id, 'cancellation_reason' => 'Room needed for repairs']);
        $this->actingAs($this->guest)->get(route('guest.home'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('upcoming', 0)
                ->where('requests.0.status', 'cancelled')
                ->where('requests.0.status_label', 'Approved, then cancelled')
                ->where('requests.0.note', 'Cancelled by the front desk on 9 Oct 2026. Reason: Room needed for repairs')
                ->where('past.0.note', 'Cancelled by the front desk on 9 Oct 2026. Reason: Room needed for repairs'));
    }

    public function test_declining_cancelling_and_expiring_free_the_room()
    {
        Notification::fake();
        $free = fn () => app(Availability::class)->isFree($this->room->refresh(), Carbon::parse('2026-10-12 14:00'), Carbon::parse('2026-10-14 12:00'));

        // Declined, with a reason the guest sees.
        $this->send();
        $request = BookingRequest::query()->sole();
        $this->actingAs($this->desk)->patch(route('reception.requests.decline', $request))->assertSessionHasErrors('reason');
        $this->assertFalse($free());
        $this->actingAs($this->desk)->patch(route('reception.requests.decline', $request), ['reason' => 'Under repair'])->assertSessionHasNoErrors();
        $this->assertSame(BookingRequestStatus::Declined, $request->refresh()->status);
        $this->assertSame('Under repair', $request->decline_reason);
        $this->assertTrue($free());

        // Cancelled by the guest; never somebody else's request.
        $this->send();
        $second = BookingRequest::query()->latest('id')->firstOrFail();
        $this->actingAs(User::factory()->create())->patch(route('guest.requests.cancel', $second))->assertNotFound();
        $this->actingAs($this->guest)->patch(route('guest.requests.cancel', $second))->assertRedirect(route('guest.home'));
        $this->assertSame(BookingRequestStatus::Cancelled, $second->refresh()->status);
        $this->assertTrue($free());

        // Nobody answered within the hold: the scheduler lets go of the room.
        $this->send();
        $third = BookingRequest::query()->latest('id')->firstOrFail();
        $this->travelTo(Carbon::parse('2026-10-10 09:01'));
        app(FrontDeskAlerts::class)->run();
        $this->assertSame(BookingRequestStatus::Expired, $third->refresh()->status);
        $this->assertTrue($free());
        Notification::assertSentToTimes($this->guest, BookingRequestAnswered::class, 2);
    }
}
