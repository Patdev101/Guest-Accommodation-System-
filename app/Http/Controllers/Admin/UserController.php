<?php

namespace App\Http\Controllers\Admin;

use App\Concerns\ProfileValidationRules;
use App\Enums\Role;
use App\Http\Controllers\Auth\SetPasswordController;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Admin-managed accounts. Guests can self-register; Reception and Admin
 * accounts can only be created here. Accounts are deactivated, never deleted.
 * The Admin never sets a password: owners choose their own from an emailed link.
 */
class UserController extends Controller
{
    use ProfileValidationRules;

    public function index(Request $request): Response
    {
        return Inertia::render('admin/users', [
            'users' => User::query()
                ->orderByRaw('case when deactivated_at is null then 0 else 1 end')
                ->orderByRaw("case role when 'admin' then 0 when 'reception' then 1 else 2 end")
                ->orderBy('name')
                ->get()
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role->value,
                    'contact_number' => $user->contact_number,
                    'is_active' => $user->isActive(),
                    'awaits_password' => $user->awaitsPassword(),
                    'is_self' => $user->is($request->user()),
                    'is_last_admin' => $user->isLastActiveAdmin(),
                ]),
            'roles' => array_map(
                fn (Role $role) => ['value' => $role->value, 'label' => $role->label()],
                Role::cases(),
            ),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            ...$this->profileRules(),
            'contact_number' => ['nullable', ...array_slice($this->contactNumberRules(), 1)],
            // Guests register themselves; only staff accounts are created here.
            'role' => ['required', Rule::enum(Role::class)->only([Role::Reception, Role::Admin])],
        ]);

        // The Admin never chooses or sees the password: the account starts with a
        // random one nobody knows, and its owner sets their own from the emailed link.
        $user = User::create([...$validated, 'password' => Str::random(40), 'password_set_at' => null]);

        if ($user->role === Role::Guest) {
            $user->guest()->create([
                'name' => $user->name,
                'contact_number' => $user->contact_number ?? '',
            ]);
        }

        $sent = $this->emailSetupLink($user);

        Inertia::flash('toast', $sent
            ? ['type' => 'success', 'message' => __('Account created. A link to set the password was emailed to :email.', ['email' => $user->email])]
            : ['type' => 'error', 'message' => __('Account created, but the email could not be sent. Use the key button to send the link again.')]);

        return to_route('admin.users.index');
    }

    /** Send the "set up your password" email; false when the mail server refuses. */
    private function emailSetupLink(User $user): bool
    {
        try {
            return SetPasswordController::sendLink($user) === Password::RESET_LINK_SENT;
        } catch (Throwable $exception) {
            report($exception);

            return false;
        }
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            // An account cannot be turned into a guest account from here.
            'role' => ['required', Rule::enum(Role::class)->except($user->role === Role::Guest ? [] : [Role::Guest])],
        ]);

        // Never let an Admin remove their own access; another Admin must do it.
        if ($validated['role'] !== Role::Admin->value && ($user->is($request->user()) || $user->isLastActiveAdmin())) {
            throw ValidationException::withMessages([
                'role' => $user->is($request->user())
                    ? __('You cannot change your own role.')
                    : __(':name is the only administrator.', ['name' => $user->name]),
            ]);
        }

        $user->update($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => __(':name is now :role.', ['name' => $user->name, 'role' => $user->role->label()])]);

        return to_route('admin.users.index');
    }

    /**
     * Email the person a link to choose their own password. Two separate emails:
     * "set up your password" for an account that never had one, and the normal
     * "reset password" for someone who forgot theirs. The Admin never sets it.
     */
    public function sendResetLink(User $user): RedirectResponse
    {
        if ($user->awaitsPassword()) {
            $status = SetPasswordController::sendLink($user);
            $message = __('Setup link emailed to :email.', ['email' => $user->email]);
        } else {
            $status = Password::sendResetLink(['email' => $user->email]);
            $message = __('Password reset link emailed to :email.', ['email' => $user->email]);
        }

        Inertia::flash('toast', $status === Password::RESET_LINK_SENT
            ? ['type' => 'success', 'message' => $message]
            : ['type' => 'error', 'message' => __($status)]);

        return to_route('admin.users.index');
    }

    public function deactivate(Request $request, User $user): RedirectResponse
    {
        if ($user->is($request->user())) {
            throw ValidationException::withMessages(['account' => __('You cannot deactivate your own account.')]);
        }

        if ($user->isLastActiveAdmin()) {
            throw ValidationException::withMessages(['account' => __(':name is the only administrator.', ['name' => $user->name])]);
        }

        $user->update(['deactivated_at' => now()]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __(':name can no longer log in.', ['name' => $user->name])]);

        return to_route('admin.users.index');
    }

    public function activate(User $user): RedirectResponse
    {
        $user->update(['deactivated_at' => null]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __(':name can log in again.', ['name' => $user->name])]);

        return to_route('admin.users.index');
    }
}
