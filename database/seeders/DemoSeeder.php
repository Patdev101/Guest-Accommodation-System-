<?php

namespace Database\Seeders;

use App\Enums\GuestType;
use App\Enums\IdCustodyStatus;
use App\Enums\Role;
use App\Enums\RoomStatus;
use App\Enums\VerificationResult;
use App\Models\Guest;
use App\Models\Location;
use App\Models\RateUnit;
use App\Models\Room;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Sample locations, rooms, rates and a few guests for trying the admin
 * screens. Opt-in only: php artisan db:seed --class=DemoSeeder
 * Never run it against real data.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (Location::query()->exists()) {
            $this->command->warn('Locations already exist, so no demo data was added.');

            return;
        }

        $this->call(DatabaseSeeder::class);

        $admin = User::query()->where('role', Role::Admin)->firstOrFail();
        $unit = fn (string $name) => RateUnit::query()->where('name', $name)->value('id');

        DB::transaction(function () use ($admin, $unit) {
            $villa = Location::create([
                'name' => 'Guest Villa',
                'description' => 'Air-conditioned villas near the clubhouse for visitors and guests.',
            ]);
            $barracks = Location::create([
                'name' => 'Barracks',
                'description' => 'Rooms for contractors and work crews, next to the shipyard gate.',
            ]);

            $villas = [
                ['Villa 1', 2, RoomStatus::Available],
                ['Villa 2', 4, RoomStatus::Occupied],
                ['Villa 3', 4, RoomStatus::Cleaning],
                ['Villa 4', 2, RoomStatus::Available],
                ['Villa 5', 6, RoomStatus::Available],
            ];

            foreach ($villas as [$name, $pax, $status]) {
                $room = $villa->rooms()->create([
                    'name' => $name,
                    'pax_capacity' => $pax,
                    'status' => $status,
                ]);
                $large = $room->pax_capacity >= 4;

                $room->update([
                    'description' => $large ? 'Two bedrooms with a small sitting area.' : 'One bedroom with a queen bed.',
                ]);

                $room->inclusions()->createMany([
                    ['item' => $large ? 'Queen beds' : 'Queen bed', 'quantity' => $large ? 2 : 1],
                    ['item' => 'Air conditioner', 'quantity' => 1],
                    ['item' => 'Refrigerator', 'quantity' => 1],
                    ['item' => 'Smart TV', 'quantity' => 1],
                ]);

                $room->rates()->createMany([
                    ['name' => 'Overnight', 'price' => $large ? 2200 : 1500, 'rate_unit_id' => $unit('Overnight')],
                    ['name' => 'Day tour', 'price' => $large ? 1200 : 800, 'rate_unit_id' => $unit('Day tour')],
                ]);

                if ($name !== 'Villa 5') {
                    $room->rates()->create([
                        'name' => 'Extension',
                        'price' => 150,
                        'rate_unit_id' => $unit('Per hour'),
                        'is_extension_rate' => true,
                    ]);
                }
            }

            $barracksRooms = [
                ['A-101', 8, RoomStatus::Available],
                ['A-102', 8, RoomStatus::Occupied],
                ['A-103', 6, RoomStatus::Inspection],
                ['A-104', 6, RoomStatus::UnderMaintenance],
                ['A-105', 4, RoomStatus::Available],
                ['A-106', 4, RoomStatus::OutOfService],
                ['A-107', 4, RoomStatus::Available],
            ];

            foreach ($barracksRooms as [$name, $pax, $status]) {
                $room = $barracks->rooms()->create([
                    'name' => $name,
                    'pax_capacity' => $pax,
                    'status' => $status,
                    'description' => 'Bunk room with a shared bathroom down the hall.',
                ]);

                $room->inclusions()->createMany([
                    ['item' => 'Double decks', 'quantity' => intdiv($pax, 2)],
                    ['item' => 'Electric fan', 'quantity' => 2],
                    ['item' => 'Lockers', 'quantity' => $pax],
                    ['item' => 'Table and chairs', 'quantity' => 1],
                ]);

                if ($name !== 'A-107') {
                    $room->rates()->createMany([
                        ['name' => 'Overnight', 'price' => 100 * $pax, 'rate_unit_id' => $unit('Overnight')],
                        ['name' => 'Extension', 'price' => 50, 'rate_unit_id' => $unit('Per hour'), 'is_extension_rate' => true],
                    ]);
                }
            }

            $this->maintenance($barracks->rooms()->where('name', 'A-104')->firstOrFail(), $admin, [
                ['Aircon not cooling', null, null, 0],
                ['Broken locker hinge', 'Replaced hinge', 'Maintenance crew', 12],
            ]);
            $this->maintenance($villa->rooms()->where('name', 'Villa 3')->firstOrFail(), $admin, [
                ['Leaking faucet in the bathroom', 'Replaced washer', 'R. Santos', 5],
            ]);
            $this->maintenance($barracks->rooms()->where('name', 'A-106')->firstOrFail(), $admin, [
                ['Ceiling water damage after the storm', null, null, 3],
            ]);

            $this->stay($villa->rooms()->where('name', 'Villa 2')->firstOrFail(), $admin, 'Maria Reyes', GuestType::Visitor, null, 3);
            $this->stay($barracks->rooms()->where('name', 'A-102')->firstOrFail(), $admin, 'Jose Bautista', GuestType::Contractor, 'Seatech Welding Services', 6);
        });

        $this->command->info('Demo locations, rooms, rates and guests added.');
    }

    /**
     * @param  list<array{0: string, 1: string|null, 2: string|null, 3: int}>  $records
     */
    private function maintenance(Room $room, User $admin, array $records): void
    {
        foreach ($records as [$issue, $action, $doneBy, $daysAgo]) {
            $room->maintenanceRecords()->create([
                'performed_on' => today()->subDays($daysAgo),
                'issue' => $issue,
                'action_taken' => $action,
                'done_by' => $doneBy,
                'recorded_by' => $admin->id,
            ]);
        }
    }

    private function stay(Room $room, User $admin, string $name, GuestType $type, ?string $company, int $pax): void
    {
        $guest = Guest::create([
            'name' => $name,
            'type' => $type,
            'company' => $company,
            'contact_number' => '0917'.random_int(1000000, 9999999),
        ]);

        $attempt = $guest->verificationAttempts()->create([
            'result' => VerificationResult::Passed,
            'verified_by' => $admin->id,
            'attempted_at' => now()->subHours(3),
        ]);

        $stay = $room->stays()->create([
            'guest_id' => $guest->id,
            'verification_attempt_id' => $attempt->id,
            'pax' => min($pax, $room->pax_capacity),
            'checked_in_at' => now()->subHours(3),
            'expected_check_out_at' => now()->addDay()->setTime(12, 0),
            'checked_in_by' => $admin->id,
        ]);

        $stay->idCustody()->create([
            'id_type' => 'Driver’s license',
            'id_number' => 'N01-'.random_int(10, 99).'-'.random_int(100000, 999999),
            'status' => IdCustodyStatus::Held,
            'received_by' => $admin->id,
        ]);
    }
}
