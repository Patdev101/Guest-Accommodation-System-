<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\IdType;
use App\Models\RateUnit;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeding_creates_defaults_and_the_first_admin_and_can_run_twice()
    {
        $this->seed();
        $this->seed();

        $this->assertSame(RateUnit::DEFAULTS, RateUnit::orderBy('id')->pluck('name')->all());
        $this->assertSame(IdType::DEFAULTS, IdType::orderBy('id')->pluck('name')->all());
        $this->assertSame(1, User::where('role', Role::Admin)->count());

        $this->assertSame('0', Setting::get('cleaning_buffer_minutes'));
        $this->assertSame('full', Setting::get('no_show_refund'));
        $this->assertSame('60', Setting::get('no_show_grace_minutes'));
    }

    public function test_settings_fall_back_to_defaults_before_seeding()
    {
        $this->assertSame('0', Setting::get('cleaning_buffer_minutes'));

        Setting::set('cleaning_buffer_minutes', '45');

        $this->assertSame('45', Setting::get('cleaning_buffer_minutes'));
    }
}
