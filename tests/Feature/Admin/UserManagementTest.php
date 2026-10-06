<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_admins_can_open_user_management()
    {
        $this->actingAs(User::factory()->create())
            ->get(route('admin.users.index'))
            ->assertForbidden();

        $this->actingAs(User::factory()->reception()->create())
            ->get(route('admin.users.index'))
            ->assertForbidden();

        $this->actingAs(User::factory()->admin()->create())
            ->get(route('admin.users.index'))
            ->assertOk();
    }

    public function test_admin_can_create_a_reception_account()
    {
        $this->actingAs(User::factory()->admin()->create())
            ->post(route('admin.users.store'), [
                'name' => 'Front Desk',
                'email' => 'desk@example.com',
                'role' => 'reception',
                'password' => 'password',
                'password_confirmation' => 'password',
            ])
            ->assertRedirect(route('admin.users.index'));

        $user = User::where('email', 'desk@example.com')->firstOrFail();
        $this->assertSame(Role::Reception, $user->role);
        $this->assertNull($user->guest);
    }

    public function test_reception_cannot_create_accounts()
    {
        $this->actingAs(User::factory()->reception()->create())
            ->post(route('admin.users.store'), [
                'name' => 'Another Admin',
                'email' => 'x@example.com',
                'role' => 'admin',
                'password' => 'password',
                'password_confirmation' => 'password',
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('users', ['email' => 'x@example.com']);
    }

    public function test_admin_can_change_another_users_role()
    {
        $guest = User::factory()->create();

        $this->actingAs(User::factory()->admin()->create())
            ->patch(route('admin.users.update', $guest), ['role' => 'reception'])
            ->assertRedirect(route('admin.users.index'));

        $this->assertSame(Role::Reception, $guest->refresh()->role);
    }

    public function test_only_staff_accounts_are_created_or_assigned_here()
    {
        $admin = User::factory()->admin()->create();
        $desk = User::factory()->reception()->create();

        $this->actingAs($admin)
            ->post(route('admin.users.store'), ['name' => 'A Guest', 'email' => 'g@example.com', 'role' => 'guest'])
            ->assertSessionHasErrors('role');
        $this->assertDatabaseMissing('users', ['email' => 'g@example.com']);

        $this->actingAs($admin)
            ->patch(route('admin.users.update', $desk), ['role' => 'guest'])
            ->assertSessionHasErrors('role');
        $this->assertSame(Role::Reception, $desk->refresh()->role);
    }

    public function test_guest_accounts_have_their_own_page_apart_from_staff()
    {
        $admin = User::factory()->admin()->create();
        $desk = User::factory()->reception()->create();
        $guest = User::factory()->create(['name' => 'Ana Guest', 'email' => 'ana@example.com']);
        User::factory()->create(['name' => 'Ben Guest', 'deactivated_at' => now()]);

        // The Users page lists staff only.
        $this->actingAs($admin)->get(route('admin.users.index'))
            ->assertInertia(fn ($page) => $page->has('users', 2)->where('users.0.role', 'admin')->where('users.1.role', 'reception'));

        $this->actingAs($admin)->get(route('admin.guest-accounts.index'))
            ->assertInertia(fn ($page) => $page
                ->component('admin/guest-accounts')
                ->has('accounts.data', 2)
                ->where('accounts.data.0.email', 'ana@example.com')
                ->where('totals.all', 2)
                ->where('totals.deactivated', 1));

        $this->actingAs($admin)->get(route('admin.guest-accounts.index', ['show' => 'deactivated', 'search' => 'ben']))
            ->assertInertia(fn ($page) => $page->has('accounts.data', 1)->where('accounts.data.0.name', 'Ben Guest'));

        // Deactivating and reactivating a guest returns to the guest page.
        $list = route('admin.guest-accounts.index', ['show' => 'active']);
        $this->actingAs($admin)->from($list)->patch(route('admin.users.deactivate', $guest))->assertRedirect($list);
        $this->assertFalse($guest->refresh()->isActive());
        $this->actingAs($admin)->from(route('dashboard'))->patch(route('admin.users.activate', $guest))->assertRedirect(route('dashboard'));
        $this->assertTrue($guest->refresh()->isActive());

        $this->actingAs($desk)->get(route('admin.guest-accounts.index'))->assertForbidden();
    }

    public function test_admin_cannot_remove_their_own_admin_role()
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->patch(route('admin.users.update', $admin), ['role' => 'guest'])
            ->assertSessionHasErrors('role');

        $this->assertSame(Role::Admin, $admin->refresh()->role);
    }
}
