<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\RateUnit;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds only what the system needs to start: the default rate units, the
 * default settings and the first Admin. Locations, rooms and rates are
 * entered by the Admin (requirements section 2). Safe to run more than once.
 */
class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        foreach (RateUnit::DEFAULTS as $name) {
            RateUnit::firstOrCreate(['name' => $name]);
        }

        foreach (Setting::DEFAULTS as $key => $value) {
            Setting::firstOrCreate(['key' => $key], ['value' => $value]);
        }

        $email = config('app.admin.email');

        if (User::where('email', $email)->doesntExist()) {
            $password = config('app.admin.password') ?: Str::password(16, symbols: false);

            User::create([
                'name' => 'Administrator',
                'email' => $email,
                'password' => $password,
                'role' => Role::Admin,
                'email_verified_at' => now(),
            ]);

            $this->command->warn("Admin account: {$email} / {$password} (change this password after logging in)");
        }
    }
}
