<?php

namespace Tests\Feature\Admin;

use App\Enums\IdCustodyStatus;
use App\Enums\RoomStatus;
use App\Models\IdCustody;
use App\Models\IdType;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\User;
use App\Services\Housekeeping;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesBookings;
use Tests\TestCase;

class ReportsAndOptionsTest extends TestCase
{
    use CreatesBookings, RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::parse('2026-10-10 09:00'));
        $this->admin = User::factory()->admin()->create();
    }

    public function test_reports_show_the_guest_log_income_occupancy_unpaid_bills_and_held_ids()
    {
        $desk = User::factory()->reception()->create();
        $room = $this->roomWithRate('A-101', status: RoomStatus::Occupied);
        $this->roomWithRate('A-102');
        $stay = $this->stayIn($room, Carbon::parse('2026-10-05 09:00'), Carbon::parse('2026-10-12 12:00'));
        $stay->guest->update(['company' => 'Seatech Welding']);
        $stay->charges()->create(['type' => 'room', 'description' => 'Room A-101', 'amount' => 3000, 'billed_to' => 'company', 'created_by' => $desk->id]);
        $stay->payments()->create(['amount' => 1000, 'payment_type' => 'downpayment', 'paid_by' => 'company', 'method' => 'GCash', 'received_by' => $desk->id, 'paid_at' => Carbon::parse('2026-10-05 10:00')]);
        $stay->idCustody()->create(['id_type_id' => IdType::create(['name' => 'Passport'])->id, 'id_number' => 'P1', 'status' => IdCustodyStatus::Held, 'received_by' => $desk->id]);

        $this->actingAs($this->admin)
            ->get(route('admin.reports.index', ['from' => '2026-10-01', 'to' => '2026-10-10']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/reports')
                ->where('from', '2026-10-01')
                ->has('guestLog', 1)
                ->where('guestLog.0.guest', 'Jose Bautista')
                ->where('guestLog.0.id_type', 'Passport')
                ->where('income.received', 1000)
                ->where('income.net', 1000)
                ->where('income.by_method.0.method', 'GCash')
                ->where('unpaid.0.company', 'Seatech Welding')
                ->where('unpaid.0.balance', 2000)
                ->where('idsHeld.0.guest', 'Jose Bautista')
                ->where('occupancy.rooms', 2)
                // One of two rooms, occupied for 5 of the 9.4 days so far: 5 / 18.75.
                ->where('occupancy.percent', 27));

        $csv = $this->actingAs($this->admin)
            ->get(route('admin.reports.index', ['from' => '2026-10-01', 'to' => '2026-10-10', 'export' => 'guest_log']))
            ->assertOk()
            ->assertDownload('guest-log-20261001-20261010.csv')
            ->streamedContent();
        $this->assertStringContainsString('Jose Bautista', $csv);
        $this->assertStringContainsString('Seatech Welding', $csv);

        $this->actingAs($desk)->get(route('admin.reports.index'))->assertForbidden();
    }

    public function test_the_admin_dashboard_shows_six_months_of_trends()
    {
        $this->roomWithRate('A-101');

        $this->actingAs($this->admin)
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('trends.months', 6)
                ->where('trends.months.5.month', 'Oct 2026')
                ->where('trends.months.5.income', 0)
                ->has('trends.companies', 0));
    }

    public function test_the_admin_manages_payment_methods_and_other_options()
    {
        $options = ['payment_methods' => "Cash\nCheque\n\ncash", 'alert_emails' => '1', 'id_photo_retention_days' => '30', 'backups_to_keep' => '3'];

        $this->actingAs($this->admin)
            ->put(route('admin.options.update'), $options)
            ->assertRedirect(route('admin.options.edit'));

        $this->assertSame(['Cash', 'Cheque'], Payment::methods());
        $this->assertSame('1', Setting::get('alert_emails'));
        $this->assertSame('30', Setting::get('id_photo_retention_days'));

        $this->actingAs($this->admin)
            ->put(route('admin.options.update'), [...$options, 'payment_methods' => " \n "])
            ->assertSessionHasErrors('payment_methods');

        $this->actingAs($this->admin)
            ->get(route('admin.options.edit'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/options')
                ->where('paymentMethods', ['Cash', 'Cheque'])
                ->where('alertEmails', true)
                ->where('retentionDays', 30));

        $this->actingAs(User::factory()->reception()->create())->put(route('admin.options.update'), $options)->assertForbidden();
    }

    public function test_id_photos_are_deleted_after_the_retention_period()
    {
        Storage::fake(IdCustody::DISK);
        $desk = User::factory()->reception()->create();
        $type = IdType::create(['name' => 'Passport']);
        $custody = function (string $room, array $attributes) use ($desk, $type) {
            $stay = $this->stayIn($this->roomWithRate($room), Carbon::parse('2026-08-01 09:00'), Carbon::parse('2026-08-02 12:00'));
            Storage::disk(IdCustody::DISK)->put("id-photos/{$stay->id}/id.jpg", 'photo');

            return $stay->idCustody()->create(['id_type_id' => $type->id, 'id_number' => 'P1', 'photo_path' => "id-photos/{$stay->id}/id.jpg", 'received_by' => $desk->id, ...$attributes]);
        };

        $old = $custody('A-101', ['status' => IdCustodyStatus::Returned, 'returned_at' => now()->subDays(40), 'returned_by' => $desk->id]);
        $recent = $custody('A-102', ['status' => IdCustodyStatus::Returned, 'returned_at' => now()->subDays(5), 'returned_by' => $desk->id]);
        $held = $custody('A-103', ['status' => IdCustodyStatus::Held]);

        // Kept forever until the Admin sets a period.
        $this->artisan('housekeeping:run')->expectsOutput('Deleted 0 ID photo(s).');

        Setting::set('id_photo_retention_days', '30');
        $this->artisan('housekeeping:run')->expectsOutput('Deleted 1 ID photo(s).');

        $this->assertNull($old->refresh()->photo_path);
        $this->assertSame('P1', $old->id_number);
        Storage::disk(IdCustody::DISK)->assertMissing("id-photos/{$old->stay_id}/id.jpg");
        Storage::disk(IdCustody::DISK)->assertExists((string) $recent->refresh()->photo_path);
        Storage::disk(IdCustody::DISK)->assertExists((string) $held->refresh()->photo_path);

        // The Admin's button deletes every photo of a returned ID, never a held one.
        $this->actingAs($this->admin)->post(route('admin.options.id-photos.delete'), ['all' => 1]);
        $this->assertNull($recent->refresh()->photo_path);
        $this->assertNotNull($held->refresh()->photo_path);
    }

    public function test_the_admin_makes_downloads_and_deletes_backups()
    {
        Storage::fake('local');
        Storage::fake('public');
        $this->roomWithRate('A-101');

        $this->actingAs($this->admin)->post(route('admin.options.backups.store'))->assertRedirect(route('admin.options.edit'));

        $backups = app(Housekeeping::class)->backups();
        $this->assertCount(1, $backups);
        $name = $backups[0]['name'];

        $zip = new \ZipArchive;
        $this->assertTrue($zip->open((string) app(Housekeeping::class)->backupPath($name)));
        $this->assertStringContainsString('A-101', (string) $zip->getFromName('data/rooms.json'));
        $this->assertNotFalse($zip->getFromName('data/users.json'));
        $this->assertFalse($zip->getFromName('data/sessions.json'));
        $zip->close();

        $this->actingAs($this->admin)->get(route('admin.options.backups.show', $name))->assertOk()->assertDownload($name);
        $this->actingAs($this->admin)->get(route('admin.options.backups.show', 'nope.zip'))->assertNotFound();
        $this->actingAs(User::factory()->reception()->create())->get(route('admin.options.backups.show', $name))->assertForbidden();

        $this->actingAs($this->admin)->delete(route('admin.options.backups.destroy', $name))->assertRedirect(route('admin.options.edit'));
        $this->assertCount(0, app(Housekeeping::class)->backups());
    }
}
