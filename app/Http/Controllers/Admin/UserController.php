<?php

namespace App\Http\Controllers\Admin;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin-managed accounts. Guests can self-register; Reception and Admin
 * accounts can only be created here.
 */
class UserController extends Controller
{
    use PasswordValidationRules, ProfileValidationRules;

    public function index(): Response
    {
        return Inertia::render('admin/users', [
            'users' => User::query()
                ->orderByRaw("case role when 'admin' then 0 when 'reception' then 1 else 2 end")
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'role', 'contact_number', 'created_at']),
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
        if ($user->is($request->user()) && $validated['role'] !== Role::Admin->value) {
            throw ValidationException::withMessages([
                'role' => __('You cannot change your own role.'),
            ]);
        }

        $user->update($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Role updated.')]);

        return to_route('admin.users.index');
    }
}
