<?php

namespace Tests\Feature\Reception;

use App\Enums\IdCustodyStatus;
use App\Enums\ReservationStatus;
use App\Enums\RoomStatus;
use App\Enums\VerificationResult;
use App\Models\IdCustody;
use App\Models\IdType;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\Stay;
use App\Models\User;
use App\Models\VerificationAttempt;
use App\Services\Availability;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesBookings;
use Tests\TestCase;

class CheckInTest extends TestCase
{
    use CreatesBookings, RefreshDatabase;

    private User $desk;

    private Room $a;

    private Room $b;

    private Reservation $reservation;

    private IdType $passport;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        $this->travelTo(Carbon::parse('2026-10-01 14:00'));
        $this->desk = User::factory()->reception()->create();
        $this->a = $this->roomWithRate('A-101', pax: 4);
        $this->b = $this->roomWithRate('A-102', pax: 4);
        $this->reservation = $this->reserve([$this->a, $this->b], Carbon::parse('2026-10-01 14:00'), Carbon::parse('2026-10-03 12:00'));
        $this->passport = IdType::create(['name' => 'Passport']);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function form(array $overrides = []): array
    {
        return [
            'verification' => 'passed',
            'verification_notes' => '',
            'contact_name' => 'Maria Reyes',
            'contact_number' => '0917 123 4567',
            'email' => 'maria@seatech.test',
            'company' => 'Seatech Welding',
            'purpose' => 'Hull repair',
            'expected_check_out_at' => '2026-10-03T12:00',
            'guests' => [
                ['name' => 'Maria Reyes', 'address' => 'Calapan City', 'contact_number' => '0917 123 4567', 'room_id' => $this->a->id],
                ['name' => 'Jose Bautista', 'address' => 'Naujan', 'contact_number' => '', 'room_id' => $this->a->id],
                ['name' => 'Ana Cruz', 'address' => 'Pola', 'contact_number' => '', 'room_id' => $this->b->id],
            ],
            'id_type_id' => $this->passport->id,
            'id_number' => 'P1234567A',
            'id_photo' => UploadedFile::fake()->image('passport.jpg'),
            'id_collected' => '1',
            ...$overrides,
        ];
    }

    private function checkIn(array $overrides = []): TestResponse
    {
        return $this->actingAs($this->desk)->post(route('reception.reservations.check-in.store', $this->reservation), $this->form($overrides));
    }

    public function test_the_check_in_form_is_prefilled_and_shows_rooms_that_are_not_ready()
    {
        $this->b->update(['status' => RoomStatus::Cleaning]);
        IdType::create(['name' => 'Postal ID', 'is_active' => false]);

        $this->actingAs($this->desk)
            ->get(route('reception.reservations.check-in.create', $this->reservation))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('reception/check-in')
                ->where('reservation.contact_name', 'Maria Reyes')
                ->where('rooms.0.problem', null)
                ->where('rooms.1.problem', fn (string $problem) => str_contains($problem, 'A-102 is cleaning'))
                ->has('idTypes', 1)
                ->where('checkOut', '2026-10-03T12:00'));
    }

    public function test_reception_checks_in_a_group_with_a_guest_list_and_an_id_photo()
    {
        $this->checkIn()->assertRedirect(route('reception.reservations.show', $this->reservation));

        $this->assertSame(ReservationStatus::CheckedIn, $this->reservation->refresh()->status);
        $this->assertSame('Hull repair', $this->reservation->purpose);

        $stay = Stay::query()->sole();
        $this->assertSame($this->reservation->id, $stay->reservation_id);
        $this->assertSame('2026-10-03 12:00', $stay->expected_check_out_at->format('Y-m-d H:i'));
        $this->assertSame([$this->a->id => 2, $this->b->id => 1], $stay->rooms()->pluck('pax', 'room_id')->all());
        $this->assertSame(['Maria Reyes', 'Jose Bautista', 'Ana Cruz'], $stay->guests()->orderBy('id')->pluck('name')->all());
        $this->assertNull($stay->guests()->where('name', 'Jose Bautista')->value('contact_number'));

        $custody = $stay->idCustody;
        $this->assertSame(IdCustodyStatus::Held, $custody->status);
        $this->assertSame('P1234567A', $custody->id_number);
        $this->assertSame($this->desk->id, $custody->received_by);
        Storage::disk('local')->assertExists($custody->photo_path);
        $this->assertStringStartsWith("id-photos/{$stay->id}/", $custody->photo_path);

        $this->assertSame(RoomStatus::Occupied, $this->a->refresh()->status);
        $this->assertSame(RoomStatus::Occupied, $this->b->refresh()->status);
        $this->assertSame(VerificationResult::Passed, VerificationAttempt::query()->sole()->result);
        $this->assertSame('maria@seatech.test', $this->reservation->guest->refresh()->email);
        $this->assertDatabaseHas('activity_logs', ['description' => "Checked in reservation #{$this->reservation->id} (Maria Reyes)"]);

        // The rooms stay busy until the guests confirm they are not extending (rule 13).
        $this->assertFalse(app(Availability::class)->isFree($this->a, Carbon::parse('2026-10-05 14:00'), Carbon::parse('2026-10-06 12:00')));
    }

    public function test_a_room_without_guests_is_not_checked_in_and_becomes_free()
    {
        $this->checkIn(['guests' => [
            ['name' => 'Maria Reyes', 'address' => 'Calapan City', 'contact_number' => '', 'room_id' => $this->a->id],
        ]])->assertSessionHasNoErrors();

        $this->assertSame([$this->a->id], Stay::query()->sole()->rooms()->pluck('room_id')->all());
        $this->assertSame(RoomStatus::Available, $this->b->refresh()->status);
        $this->assertTrue(app(Availability::class)->isFree($this->b, Carbon::parse('2026-10-01 15:00'), Carbon::parse('2026-10-02 12:00')));
    }

    public function test_a_failed_verification_is_recorded_and_nobody_is_checked_in()
    {
        $this->actingAs($this->desk)
            ->post(route('reception.reservations.check-in.store', $this->reservation), [
                'verification' => 'failed',
                'verification_notes' => 'Not on the company crew list',
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('reception.reservations.show', $this->reservation));

        $attempt = VerificationAttempt::query()->sole();
        $this->assertSame(VerificationResult::Failed, $attempt->result);
        $this->assertSame('Not on the company crew list', $attempt->notes);
        $this->assertSame(0, Stay::query()->count());
        $this->assertSame(ReservationStatus::Active, $this->reservation->refresh()->status);
        $this->assertSame(RoomStatus::Available, $this->a->refresh()->status);

        $this->actingAs($this->desk)
            ->post(route('reception.reservations.check-in.store', $this->reservation), ['verification' => 'failed'])
            ->assertSessionHasErrors('verification_notes');
    }

    public function test_the_id_photo_and_details_are_required()
    {
        $this->checkIn(['id_photo' => null, 'id_number' => '', 'id_collected' => '0'])
            ->assertSessionHasErrors(['id_photo', 'id_number', 'id_collected']);

        $this->checkIn(['id_photo' => UploadedFile::fake()->create('scan.pdf', 100, 'application/pdf')])
            ->assertSessionHasErrors('id_photo');

        $turnedOff = IdType::create(['name' => 'Postal ID', 'is_active' => false]);
        $this->checkIn(['id_type_id' => $turnedOff->id])->assertSessionHasErrors('id_type_id');

        $this->assertSame(0, Stay::query()->count());
    }

    public function test_the_guest_list_must_fit_the_booked_rooms()
    {
        $other = $this->roomWithRate('Villa 1');
        $five = array_fill(0, 5, ['name' => 'Crew', 'address' => 'Calapan City', 'contact_number' => '', 'room_id' => $this->a->id]);

        $this->checkIn(['guests' => $five])->assertSessionHasErrors('guests');
        $this->checkIn(['guests' => [['name' => 'X', 'address' => 'Y', 'contact_number' => '', 'room_id' => $other->id]]])
            ->assertSessionHasErrors('guests.0.room_id');
        $this->checkIn(['guests' => [['name' => '', 'address' => '', 'contact_number' => '', 'room_id' => $this->a->id]]])
            ->assertSessionHasErrors(['guests.0.name', 'guests.0.address']);

        $this->assertSame(0, Stay::query()->count());
    }

    public function test_guests_cannot_move_into_a_room_that_is_not_ready()
    {
        $this->a->update(['status' => RoomStatus::Cleaning]);

        $this->checkIn()->assertSessionHasErrors('guests');

        $this->assertSame(0, Stay::query()->count());
        Storage::disk('local')->assertDirectoryEmpty('/');
    }

    public function test_a_walk_in_goes_straight_to_check_in()
    {
        $villa = $this->roomWithRate('Villa 1', pax: 2);

        $this->actingAs($this->desk)
            ->post(route('reception.reservations.store'), [
                'company' => 'Mindoro Marine',
                'contact_name' => 'Pedro Santos',
                'contact_number' => '0918 000 1111',
                'guest_type' => 'visitor',
                'starts_at' => '2026-10-01T14:00',
                'ends_at' => '2026-10-02T12:00',
                'rooms' => [['room_id' => $villa->id, 'room_rate_id' => $villa->rates()->value('id'), 'pax' => 2, 'price' => '1000']],
                'check_in_now' => true,
            ])
            ->assertRedirect(route('reception.reservations.check-in.create', Reservation::query()->latest('id')->firstOrFail()));
    }

    public function test_only_staff_can_see_id_photos()
    {
        $this->checkIn();
        $custody = IdCustody::query()->sole();

        $this->actingAs($this->desk)->get(route('reception.id-photos.show', $custody))->assertOk();
        $this->actingAs(User::factory()->create())->get(route('reception.id-photos.show', $custody))->assertForbidden();

        Storage::disk('local')->delete($custody->photo_path);
        $this->actingAs($this->desk)->get(route('reception.id-photos.show', $custody))->assertNotFound();
    }

    public function test_the_reservation_page_shows_the_stay_and_the_id()
    {
        $this->checkIn();

        $this->actingAs($this->desk)
            ->get(route('reception.reservations.show', $this->reservation))
            ->assertInertia(fn (Assert $page) => $page
                ->where('can.check_in', false)
                ->has('stay.guests', 3)
                ->where('stay.id.type', 'Passport')
                ->where('stay.id.photo_url', fn (string $url) => str_contains($url, '/reception/id-photos/')));
    }

    public function test_reception_changes_room_status_from_the_board()
    {
        $this->a->update(['status' => RoomStatus::Cleaning]);

        $this->actingAs($this->desk)
            ->from(route('dashboard'))
            ->patch(route('reception.rooms.status.update', $this->a), ['status' => 'available'])
            ->assertRedirect(route('dashboard'));
        $this->assertSame(RoomStatus::Available, $this->a->refresh()->status);

        // Occupied is only reached through check-in.
        $this->actingAs($this->desk)
            ->patch(route('reception.rooms.status.update', $this->a), ['status' => 'occupied'])
            ->assertSessionHasErrors('status');

        $this->actingAs(User::factory()->create())
            ->patch(route('reception.rooms.status.update', $this->a), ['status' => 'cleaning'])
            ->assertForbidden();
    }
}
