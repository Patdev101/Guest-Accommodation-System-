<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\IdCustody;
use App\Models\IdType;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * The IDs the front desk accepts (Passport, UMID, …). Types used on past
 * records cannot be deleted; they are turned off instead.
 */
class IdTypeController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        IdType::create($request->validate([
            'name' => ['required', 'string', 'max:50', Rule::unique(IdType::class)],
        ], ['name.unique' => __('This ID type already exists.')]));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('ID type added.')]);

        return to_route('admin.settings.edit');
    }

    public function update(Request $request, IdType $idType): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required_without:is_active', 'string', 'max:50', Rule::unique(IdType::class)->ignore($idType)],
            'is_active' => ['sometimes', 'boolean'],
        ], ['name.unique' => __('This ID type already exists.')]);

        $idType->update($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => match (true) {
            ! array_key_exists('is_active', $validated) => __('ID type renamed.'),
            $idType->is_active => __(':name is accepted again.', ['name' => $idType->name]),
            default => __(':name is no longer offered at check-in.', ['name' => $idType->name]),
        }]);

        return to_route('admin.settings.edit');
    }

    public function destroy(IdType $idType): RedirectResponse
    {
        if (IdCustody::query()->where('id_type_id', $idType->id)->exists()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('":name" is on past ID records, so it cannot be deleted. Turn it off instead.', ['name' => $idType->name])]);

            return to_route('admin.settings.edit');
        }

        $idType->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('ID type deleted.')]);

        return to_route('admin.settings.edit');
    }
}
