<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Accounts guests made for themselves, kept apart from the staff accounts on
 * the Users page. The Admin only helps here: deactivate or reactivate an
 * account, or email its owner a password link (the actions are in UserController).
 */
class GuestAccountController extends Controller
{
    public const FILTERS = [
        'all' => 'All',
        'active' => 'Active',
        'deactivated' => 'Deactivated',
    ];

    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'show' => ['nullable', Rule::in(array_keys(self::FILTERS))],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        $show = $validated['show'] ?? 'all';
        $search = trim($validated['search'] ?? '');
        $guests = fn (): Builder => User::query()->where('role', Role::Guest);

        return Inertia::render('admin/guest-accounts', [
            'accounts' => $guests()
                ->when($show === 'active', fn (Builder $query) => $query->whereNull('deactivated_at'))
                ->when($show === 'deactivated', fn (Builder $query) => $query->whereNotNull('deactivated_at'))
                ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('contact_number', 'like', "%{$search}%")))
                ->orderBy('name')
                ->orderBy('id')
                ->paginate(25)
                ->withQueryString()
                ->through(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'contact_number' => $user->contact_number,
                    'is_active' => $user->isActive(),
                    'awaits_password' => $user->awaitsPassword(),
                    'registered_at' => $user->created_at?->toIso8601String(),
                    'deactivated_at' => $user->deactivated_at?->toIso8601String(),
                ]),
            'show' => $show,
            'search' => $search,
            'filterOptions' => collect(self::FILTERS)->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])->values(),
            'totals' => [
                'all' => $guests()->count(),
                'deactivated' => $guests()->whereNotNull('deactivated_at')->count(),
            ],
        ]);
    }
}
