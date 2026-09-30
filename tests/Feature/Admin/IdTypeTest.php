<?php

namespace Tests\Feature\Admin;

use App\Enums\IdCustodyStatus;
use App\Enums\VerificationResult;
use App\Models\ActivityLog;
use App\Models\Guest;
use App\Models\IdType;
use App\Models\Room;
use App\Models\Stay;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class IdTypeTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
    }

    public function test_the_settings_page_lists_id_types_with_how_often_they_are_used()
    {
        $passport = IdType::create(['name' => 'Passport']);
        IdType::create(['name' => 'Postal ID', 'is_active' => false]);
        $this->holdId($passport);

        $this->actingAs($this->admin)
            ->get(route('admin.settings.edit'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('idTypes', 2)
                ->where('idTypes.0', ['id' => $passport->id, 'name' => 'Passport', 'is_active' => true, 'used_count' => 1])
                ->where('idTypes.1.is_active', false));
    }

    public function test_admin_adds_and_renames_id_types()
    {
        $this->actingAs($this->admin)
            ->post(route('admin.id-types.store'), ['name' => 'Postal ID'])
            ->assertRedirect(route('admin.settings.edit'));

        $type = IdType::query()->where('name', 'Postal ID')->sole();
        $this->assertTrue($type->is_active);

        $this->actingAs($this->admin)
            ->post(route('admin.id-types.store'), ['name' => 'Postal ID'])
            ->assertSessionHasErrors('name');

        $this->actingAs($this->admin)
            ->patch(route('admin.id-types.update', $type), ['name' => 'PhilPost ID'])
            ->assertSessionHasNoErrors();

        $this->assertSame('PhilPost ID', $type->refresh()->name);
    }

    public function test_admin_turns_an_id_type_off_and_on_again()
    {
        $type = IdType::create(['name' => 'Postal ID']);

        $this->actingAs($this->admin)
            ->patch(route('admin.id-types.update', $type), ['is_active' => false])
            ->assertSessionHasNoErrors();

        $this->assertFalse($type->refresh()->is_active);
        $this->assertSame('Postal ID', $type->name);
        $this->assertSame([], IdType::active()->pluck('name')->all());
        $this->assertDatabaseHas('activity_logs', ['description' => 'Stopped accepting ID type "Postal ID"']);

        $this->actingAs($this->admin)->patch(route('admin.id-types.update', $type), ['is_active' => true]);

        $this->assertTrue($type->refresh()->is_active);
        $this->assertDatabaseHas('activity_logs', ['description' => 'Started accepting ID type "Postal ID"']);
    }

    public function test_an_unused_id_type_can_be_deleted_but_a_used_one_cannot()
    {
        $unused = IdType::create(['name' => 'Postal ID']);
        $used = IdType::create(['name' => 'Passport']);
        $this->holdId($used);

        $this->actingAs($this->admin)->delete(route('admin.id-types.destroy', $unused));
        $this->assertModelMissing($unused);

        $this->actingAs($this->admin)->delete(route('admin.id-types.destroy', $used));
        $this->assertModelExists($used);
        $this->assertSame(1, ActivityLog::query()->where('action', 'deleted')->count());
    }

    public function test_only_admins_manage_id_types()
    {
        $this->actingAs(User::factory()->reception()->create())
            ->post(route('admin.id-types.store'), ['name' => 'Postal ID'])
            ->assertForbidden();
    }

    private function holdId(IdType $type): void
    {
        $guest = Guest::create(['name' => 'Maria Reyes', 'contact_number' => '09171234567']);
        $attempt = $guest->verificationAttempts()->create([
            'result' => VerificationResult::Passed,
            'verified_by' => $this->admin->id,
            'attempted_at' => now(),
        ]);
        $stay = Stay::create([
            'guest_id' => $guest->id,
            'verification_attempt_id' => $attempt->id,
            'checked_in_at' => now(),
            'expected_check_out_at' => now()->addDay(),
            'checked_in_by' => $this->admin->id,
        ]);
        $stay->rooms()->create(['room_id' => Room::factory()->create()->id, 'pax' => 1]);
        $stay->idCustody()->create([
            'id_type_id' => $type->id,
            'id_number' => 'P1234567',
            'status' => IdCustodyStatus::Held,
            'received_by' => $this->admin->id,
        ]);
    }
}
