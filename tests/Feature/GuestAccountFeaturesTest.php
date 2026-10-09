<?php

namespace Tests\Feature;

use App\Enums\RefundStatus;
use App\Enums\ReservationStatus;
use App\Enums\RoomStatus;
use App\Models\Refund;
use App\Models\Setting;
use App\Models\User;
use App\Services\Availability;
use App\Services\FrontDeskAlerts;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesBookings;
use Tests\TestCase;

class GuestAccountFeaturesTest extends TestCase
{
    use CreatesBookings, RefreshDatabase;

    private User $guest;

    private User $desk;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::parse('2026-10-09 09:00'));
        $this->guest = User::factory()->create(['name' => 'Ana Cruz']);
        $this->desk = User::factory()->reception()->create();
    }

    public function test_a_guest_opens_and_cancels_their_own_confirmed_booking()
    {
        $room = $this->roomWithRate('A-101');
        $reservation = $this->reserve([$room], Carbon::parse('2026-10-12 14:00'), Carbon::parse('2026-10-13 12:00'));
        $reservation->guest->update(['user_id' => $this->guest->id]);
        $reservation->payments()->create(['amount' => 400, 'payment_type' => 'downpayment', 'paid_by' => 'guest', 'method' => 'Cash', 'received_by' => $this->desk->id, 'paid_at' => now()]);

        $this->actingAs($this->guest)
            ->get(route('guest.reservations.show', $reservation))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('guest/reservation')
                ->where('reservation.status_label', 'Confirmed')
                ->where('reservation.paid', '400.00')
                ->where('reservation.balance', '600.00')
                ->where('reservation.can_cancel', true)
                ->where('rooms.0.name', 'A-101')
                ->has('payments', 1));

        // Somebody else's booking does not exist for another guest.
        $other = User::factory()->create();
        $this->actingAs($other)->get(route('guest.reservations.show', $reservation))->assertNotFound();
        $this->actingAs($other)->patch(route('guest.reservations.cancel', $reservation))->assertNotFound();
        $this->assertSame(ReservationStatus::Active, $reservation->refresh()->status);

        $this->actingAs($this->guest)
            ->patch(route('guest.reservations.cancel', $reservation), ['reason' => 'Trip moved'])
            ->assertRedirect(route('guest.home'));

        $reservation->refresh();
        $this->assertSame(ReservationStatus::Cancelled, $reservation->status);
        $this->assertSame($this->guest->id, $reservation->cancelled_by);
        $this->assertSame('Trip moved', $reservation->cancellation_reason);
        $this->assertSame('Cancelled by you on 9 Oct 2026. Reason: Trip moved', $reservation->noteForGuest());
        // The payment goes back through the front desk's refund process.
        $refund = Refund::query()->sole();
        $this->assertSame('400.00', $refund->amount);
        $this->assertSame(RefundStatus::Requested, $refund->status);
        // The room is free again, and reception is told.
        $this->assertTrue(app(Availability::class)->isFree($room, Carbon::parse('2026-10-12 14:00'), Carbon::parse('2026-10-13 12:00')));
        $this->assertSame('Booking cancelled: Maria Reyes', $this->desk->notifications()->first()->data['title']);
        // The guest cancelled it themselves, so they get no notice about it.
        $this->assertSame(0, $this->guest->notifications()->count());
    }

    public function test_the_guest_gets_notices_under_their_bell()
    {
        $room = $this->roomWithRate('A-101', status: RoomStatus::Occupied);
        $reservation = $this->reserve([$this->roomWithRate('A-102')], Carbon::parse('2026-10-12 14:00'), Carbon::parse('2026-10-13 12:00'));
        $reservation->guest->update(['user_id' => $this->guest->id]);

        // Reception cancels the booking.
        $this->actingAs($this->desk)->patch(route('reception.reservations.cancel', $reservation), ['reason' => 'Room under repair']);

        // The check-out reminder reaches the guest as well as the desk.
        $this->travel(1)->minutes();
        $stay = $this->stayIn($room, Carbon::parse('2026-10-08 14:00'), Carbon::parse('2026-10-09 09:30'));
        $stay->guest->update(['user_id' => $this->guest->id]);
        app(FrontDeskAlerts::class)->run();

        $this->actingAs($this->guest)
            ->get(route('guest.home'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('notices.unread', 2)
                ->has('notices.items', 2)
                ->where('notices.items.0.title', 'Your check-out is coming up')
                ->where('notices.items.1.title', 'Your booking was cancelled')
                ->where('notices.items.1.read', false));

        $this->actingAs($this->guest)->post(route('guest.notices.read'));
        $this->assertSame(0, $this->guest->unreadNotifications()->count());

        // Staff have their own bell; they get no guest notices.
        $this->actingAs($this->desk)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page->where('notices', null));
    }

    public function test_a_checked_in_guest_asks_to_stay_longer()
    {
        $ask = fn (array $data) => $this->actingAs($this->guest)->post(route('guest.stay.extension'), $data);

        // Not checked in: nothing to extend.
        $ask(['until' => '2026-10-11T12:00'])->assertNotFound();

        $stay = $this->stayIn($this->roomWithRate('A-101', status: RoomStatus::Occupied), Carbon::parse('2026-10-08 14:00'), Carbon::parse('2026-10-10 12:00'));
        $stay->guest->update(['user_id' => $this->guest->id]);

        $ask(['until' => '2026-10-10T08:00'])->assertSessionHasErrors('until');
        $ask(['until' => '2026-10-11T12:00', 'message' => 'Work runs late'])->assertSessionHasNoErrors()->assertRedirect(route('guest.home'));

        $alert = $this->desk->notifications()->sole();
        $this->assertSame('Jose Bautista asks to stay longer', $alert->data['title']);
        $this->assertStringContainsString('Work runs late', $alert->data['body']);
        $this->assertStringContainsString('extend_to=2026-10-11T12', $alert->data['url']);
        // Asking changes nothing: reception decides.
        $this->assertSame('2026-10-10 12:00', $stay->refresh()->expected_check_out_at->format('Y-m-d H:i'));
    }

    public function test_a_new_guest_must_confirm_their_email_first()
    {
        Notification::fake();

        $this->post(route('register.store'), [
            'name' => 'New Guest', 'email' => 'new@example.com', 'contact_number' => '0917 222 3333',
            'password' => 'Str0ng-Passw0rd!', 'password_confirmation' => 'Str0ng-Passw0rd!',
        ]);

        $user = User::query()->where('email', 'new@example.com')->firstOrFail();
        $this->assertNull($user->email_verified_at);
        Notification::assertSentTo($user, VerifyEmail::class);

        // Until then: they can browse, but not use their account pages.
        $this->actingAs($user)->get(route('rooms.index'))->assertOk();
        $this->actingAs($user)->get(route('guest.home'))->assertRedirect(route('verification.notice'));
        $this->actingAs($user)->get(route('guest.requests.create', $this->roomWithRate('A-101')))->assertRedirect(route('verification.notice'));
        $this->actingAs($user)->get(route('verification.notice'))
            ->assertInertia(fn (Assert $page) => $page->component('auth/verify-email')->where('email', 'new@example.com'));

        $user->markEmailAsVerified();
        $this->actingAs($user)->get(route('guest.home'))->assertOk();
    }

    public function test_the_company_is_kept_on_the_profile_and_can_be_changed()
    {
        $save = fn (?string $company) => $this->actingAs($this->guest)->patch(route('profile.update'), [
            'name' => 'Ana Cruz', 'email' => $this->guest->email, 'contact_number' => '0917 111 2222', 'company' => $company,
        ]);

        $save('Seatech Welding')->assertSessionHasNoErrors();
        $this->assertSame('Seatech Welding', $this->guest->guest()->value('company'));

        // A new employer: just type the new one.
        $save('Oceanic Repairs')->assertSessionHasNoErrors();
        $this->assertSame('Oceanic Repairs', $this->guest->guest()->value('company'));
        $this->assertSame(1, $this->guest->guest()->count());

        $this->actingAs($this->guest)->get(route('profile.edit'))
            ->assertInertia(fn (Assert $page) => $page->where('company', 'Oceanic Repairs'));
        $this->actingAs($this->guest)->get(route('guest.requests.create', $this->roomWithRate('A-101')))
            ->assertInertia(fn (Assert $page) => $page->where('defaults.company', 'Oceanic Repairs'));
    }

    public function test_the_admin_sets_the_contact_details_visitors_see()
    {
        $admin = User::factory()->admin()->create();
        $details = ['contact_phone' => '0917 555 0000', 'contact_email' => 'desk@example.com', 'contact_address' => 'Calapan City', 'booking_request_hold_hours' => 12];

        $this->get(route('home'))->assertInertia(fn (Assert $page) => $page->where('site.phone', null)->where('site.hold_hours', 24));

        $this->actingAs($this->desk)->put(route('admin.options.site'), $details)->assertForbidden();
        $this->actingAs($admin)->put(route('admin.options.site'), [...$details, 'contact_email' => 'not-an-email'])->assertSessionHasErrors('contact_email');
        $this->actingAs($admin)->put(route('admin.options.site'), $details)->assertRedirect(route('admin.options.edit'));

        $this->assertSame('12', Setting::get('booking_request_hold_hours'));
        $this->post(route('logout'));
        $this->get(route('home'))->assertInertia(fn (Assert $page) => $page
            ->where('site.phone', '0917 555 0000')
            ->where('site.email', 'desk@example.com')
            ->where('site.address', 'Calapan City')
            ->where('site.hold_hours', 12));
    }
}
