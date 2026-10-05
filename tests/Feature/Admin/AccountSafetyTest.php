<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Models\User;
use App\Notifications\AccountSetup;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AccountSafetyTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_new_account_gets_a_setup_link_and_its_owner_sets_the_password()
    {
        Notification::fake();

        // The Admin cannot choose the password, even by sending one.
        $this->actingAs(User::factory()->admin()->create())
            ->post(route('admin.users.store'), [
                'name' => 'Front Desk',
                'email' => 'desk@example.com',
                'role' => 'reception',
                'password' => 'admin-chosen-1',
                'password_confirmation' => 'admin-chosen-1',
            ])
            ->assertRedirect(route('admin.users.index'));

        $desk = User::where('email', 'desk@example.com')->firstOrFail();
        $this->assertTrue($desk->awaitsPassword());
        $this->assertFalse(Hash::check('admin-chosen-1', $desk->password));

        // A setup email, not the "forgot password" one.
        Notification::assertNotSentTo($desk, ResetPassword::class);
        $token = null;
        Notification::assertSentTo($desk, AccountSetup::class, function (AccountSetup $mail) use ($desk, &$token) {
            $token = $mail->token;

            return str_contains((string) $mail->toMail($desk)->actionUrl, '/set-password/'.$mail->token);
        });

        Auth::logout();

        $this->get(route('password.setup', ['token' => $token, 'email' => $desk->email]))->assertOk();

        $this->post(route('password.setup.store'), [
            'token' => 'wrong-token',
            'email' => $desk->email,
            'password' => 'my-own-secret-1',
            'password_confirmation' => 'my-own-secret-1',
        ])->assertSessionHasErrors('email');

        $this->post(route('password.setup.store'), [
            'token' => $token,
            'email' => $desk->email,
            'password' => 'my-own-secret-1',
            'password_confirmation' => 'my-own-secret-1',
        ])->assertRedirect(route('login'));

        $desk->refresh();
        $this->assertFalse($desk->awaitsPassword());
        $this->assertTrue(Hash::check('my-own-secret-1', $desk->password));

        // The link works once.
        $this->post(route('password.setup.store'), [
            'token' => $token,
            'email' => $desk->email,
            'password' => 'another-secret-2',
            'password_confirmation' => 'another-secret-2',
        ])->assertSessionHasErrors('email');
    }

    public function test_the_key_button_sends_the_setup_link_until_a_password_is_set()
    {
        Notification::fake();
        $invited = User::factory()->reception()->create(['password_set_at' => null]);

        $this->actingAs(User::factory()->admin()->create())
            ->post(route('admin.users.reset-link', $invited))
            ->assertRedirect(route('admin.users.index'));

        Notification::assertSentTo($invited, AccountSetup::class);
        Notification::assertNotSentTo($invited, ResetPassword::class);
    }

    public function test_the_admin_can_no_longer_set_someones_password()
    {
        $desk = User::factory()->reception()->create();

        $this->actingAs(User::factory()->admin()->create())
            ->put('/admin/users/'.$desk->id.'/password', [
                'password' => 'new-secret-123',
                'password_confirmation' => 'new-secret-123',
            ])
            ->assertNotFound();

        $this->assertFalse(Hash::check('new-secret-123', $desk->refresh()->password));
    }

    public function test_admin_emails_a_password_reset_link()
    {
        Notification::fake();
        $desk = User::factory()->reception()->create();

        $this->actingAs(User::factory()->admin()->create())
            ->post(route('admin.users.reset-link', $desk))
            ->assertRedirect(route('admin.users.index'));

        Notification::assertSentTo($desk, ResetPassword::class, fn (ResetPassword $notification) => str_contains(
            (string) $notification->toMail($desk)->actionUrl,
            '/reset-password/'.$notification->token,
        ));
    }

    public function test_a_deactivated_account_cannot_log_in()
    {
        $desk = User::factory()->reception()->create();

        $this->actingAs(User::factory()->admin()->create())
            ->patch(route('admin.users.deactivate', $desk))
            ->assertRedirect(route('admin.users.index'));

        $this->assertFalse($desk->refresh()->isActive());

        Auth::logout();

        $this->post(route('login.store'), ['email' => $desk->email, 'password' => 'password'])
            ->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_someone_deactivated_while_logged_in_is_signed_out()
    {
        $desk = User::factory()->reception()->create(['deactivated_at' => now()]);

        $this->actingAs($desk)
            ->get(route('dashboard'))
            ->assertRedirect(route('login'));

        $this->assertGuest();
    }

    public function test_a_reactivated_account_can_log_in_again()
    {
        $desk = User::factory()->reception()->create(['deactivated_at' => now()]);

        $this->actingAs(User::factory()->admin()->create())->patch(route('admin.users.activate', $desk));
        Auth::logout();

        $this->post(route('login.store'), ['email' => $desk->email, 'password' => 'password']);
        $this->assertAuthenticatedAs($desk);
    }

    public function test_admins_cannot_deactivate_themselves()
    {
        $admin = User::factory()->admin()->create();
        User::factory()->admin()->create();

        $this->actingAs($admin)
            ->patch(route('admin.users.deactivate', $admin))
            ->assertSessionHasErrors('account');

        $this->assertTrue($admin->refresh()->isActive());
    }

    public function test_the_last_active_admin_is_protected()
    {
        $admin = User::factory()->admin()->create();
        // A second admin who is deactivated does not count.
        $inactive = User::factory()->admin()->create(['deactivated_at' => now()]);

        $this->assertTrue($admin->isLastActiveAdmin());
        $this->assertFalse($inactive->isLastActiveAdmin());

        // Cannot delete their own account from profile settings.
        $this->actingAs($admin)
            ->delete(route('profile.destroy'), ['password' => 'password'])
            ->assertSessionHasErrors('password');
        $this->assertModelExists($admin);
    }

    public function test_an_admin_can_delete_their_account_when_another_admin_exists()
    {
        $admin = User::factory()->admin()->create();
        User::factory()->admin()->create();

        $this->actingAs($admin)
            ->delete(route('profile.destroy'), ['password' => 'password'])
            ->assertSessionHasNoErrors();

        $this->assertModelMissing($admin);
    }

    public function test_role_changes_are_logged()
    {
        $guest = User::factory()->create();

        $this->actingAs(User::factory()->admin()->create(['name' => 'Ana']))
            ->patch(route('admin.users.update', $guest), ['role' => 'reception']);

        $this->assertSame(Role::Reception, $guest->refresh()->role);
        $this->assertDatabaseHas('activity_logs', [
            'subject_type' => 'User',
            'subject_id' => $guest->id,
            'description' => "Changed role of {$guest->name} to Reception",
        ]);
    }
}
