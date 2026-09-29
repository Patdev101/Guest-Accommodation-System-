<?php

namespace Tests\Feature\Admin;

use App\Models\RateUnit;
use App\Models\Room;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use RefreshDatabase;

    private function valid(array $overrides = []): array
    {
        return [
            'cleaning_buffer_minutes' => 30,
            'no_show_grace_minutes' => 60,
            'checkout_reminder_minutes' => 60,
            'no_show_refund' => 'full',
            ...$overrides,
        ];
    }

    public function test_settings_page_shows_the_defaults()
    {
        $this->actingAs(User::factory()->admin()->create())
            ->get(route('admin.settings.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/settings')
                ->where('settings.cleaning_buffer_minutes', 0)
                ->where('settings.no_show_refund', 'full')
                ->where('lastSaved', null));
    }

    public function test_only_admins_can_change_settings()
    {
        $this->actingAs(User::factory()->reception()->create())
            ->put(route('admin.settings.update'), $this->valid())
            ->assertForbidden();
    }

    public function test_admin_saves_settings()
    {
        $this->actingAs(User::factory()->admin()->create())
            ->put(route('admin.settings.update'), $this->valid())
            ->assertRedirect(route('admin.settings.edit'));

        $this->assertSame('30', Setting::get('cleaning_buffer_minutes'));
        $this->assertSame('100', Setting::get('no_show_refund_percent'));
        $this->assertNotNull(Setting::get('settings_reviewed_at'));
    }

    public function test_the_page_can_save_full_refund_with_the_hidden_percentage_it_sends()
    {
        // The settings page always posts no_show_refund_percent (100 for a full refund).
        $this->actingAs(User::factory()->admin()->create())
            ->put(route('admin.settings.update'), $this->valid([
                'cleaning_buffer_minutes' => 60,
                'no_show_refund_percent' => 100,
            ]))
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('admin.settings.edit'));

        $this->assertSame('60', Setting::get('cleaning_buffer_minutes'));
        $this->assertSame('100', Setting::get('no_show_refund_percent'));
    }

    public function test_a_partial_refund_needs_a_percentage()
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->put(route('admin.settings.update'), $this->valid(['no_show_refund' => 'partial']))
            ->assertSessionHasErrors('no_show_refund_percent');

        $this->actingAs($admin)
            ->put(route('admin.settings.update'), $this->valid(['no_show_refund' => 'partial', 'no_show_refund_percent' => 50]))
            ->assertSessionHasNoErrors();

        $this->assertSame('partial', Setting::get('no_show_refund'));
        $this->assertSame('50', Setting::get('no_show_refund_percent'));
    }

    public function test_minutes_must_be_whole_numbers_within_a_day()
    {
        $this->actingAs(User::factory()->admin()->create())
            ->put(route('admin.settings.update'), $this->valid(['cleaning_buffer_minutes' => -5, 'no_show_grace_minutes' => 2000]))
            ->assertSessionHasErrors(['cleaning_buffer_minutes', 'no_show_grace_minutes']);
    }

    public function test_admin_manages_rate_units()
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->post(route('admin.rate-units.store'), ['name' => 'Per week']);
        $unit = RateUnit::where('name', 'Per week')->firstOrFail();

        $this->actingAs($admin)
            ->post(route('admin.rate-units.store'), ['name' => 'Per week'])
            ->assertSessionHasErrors('name');

        $this->actingAs($admin)->put(route('admin.rate-units.update', $unit), ['name' => 'Weekly']);
        $this->assertSame('Weekly', $unit->refresh()->name);

        $this->actingAs($admin)->delete(route('admin.rate-units.destroy', $unit));
        $this->assertModelMissing($unit);
    }

    public function test_a_rate_unit_in_use_cannot_be_deleted()
    {
        $unit = RateUnit::create(['name' => 'Overnight']);
        Room::factory()->create()->rates()->create(['name' => 'Night', 'price' => 500, 'rate_unit_id' => $unit->id]);

        $this->actingAs(User::factory()->admin()->create())
            ->delete(route('admin.rate-units.destroy', $unit));

        $this->assertModelExists($unit);
    }
}
