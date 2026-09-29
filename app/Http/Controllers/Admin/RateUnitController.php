<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\RateUnit;
use App\Models\RoomRate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Rate units (Per hour, Overnight, Day tour, and any the Admin adds).
 */
class RateUnitController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        RateUnit::create($request->validate([
            'name' => ['required', 'string', 'max:50', Rule::unique(RateUnit::class)],
        ], ['name.unique' => __('This unit already exists.')]));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Unit added.')]);

        return to_route('admin.settings.edit');
    }

    public function update(Request $request, RateUnit $rateUnit): RedirectResponse
    {
        $rateUnit->update($request->validate([
            'name' => ['required', 'string', 'max:50', Rule::unique(RateUnit::class)->ignore($rateUnit)],
        ], ['name.unique' => __('This unit already exists.')]));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Unit renamed.')]);

        return to_route('admin.settings.edit');
    }

    public function destroy(RateUnit $rateUnit): RedirectResponse
    {
        if (RoomRate::query()->where('rate_unit_id', $rateUnit->id)->exists()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('Rates use ":name", so it cannot be deleted.', ['name' => $rateUnit->name])]);

            return to_route('admin.settings.edit');
        }

        $rateUnit->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Unit deleted.')]);

        return to_route('admin.settings.edit');
    }
}
