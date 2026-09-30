<?php

namespace App\Http\Controllers\Admin;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin-managed accounts. Guests can self-register; Reception and Admin
 * accounts can only be created here. Accounts are deactivated, never deleted.
 */
class UserController extends Controller
{
    use PasswordValidationRules, ProfileValidationRules;

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
            'role' => ['required', Rule::enum(Role::class)],
            'password' => $this->passwordRules(),
        ]);

        $user = User::create($validated);

        if ($user->role === Role::Guest) {
            $user->guest()->create([
                'name' => $user->name,
                'contact_number' => $user->contact_number ?? '',
            ]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Account created.')]);

        return to_route('admin.users.index');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'role' => ['required', Rule::enum(Role::class)],
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

    /** The Admin types a new password for someone, e.g. a new receptionist. */
    public function password(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'password' => $this->passwordRules(),
        ]);

        $user->update(['password' => $validated['password']]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('New password set for :name.', ['name' => $user->name])]);

        return to_route('admin.users.index');
    }

    /** Email the person a link to choose their own new password. */
    public function sendResetLink(User $user): RedirectResponse
    {
        $status = Password::sendResetLink(['email' => $user->email]);

        Inertia::flash('toast', $status === Password::RESET_LINK_SENT
            ? ['type' => 'success', 'message' => __('Password reset link emailed to :email.', ['email' => $user->email])]
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
