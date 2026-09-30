<?php

namespace App\Http\Controllers\Reception;

use App\Enums\BilledTo;
use App\Enums\ChargeType;
use App\Enums\IdCustodyStatus;
use App\Http\Controllers\Controller;
use App\Models\Charge;
use App\Models\Stay;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Lines on a stay's bill: extras and damages added by reception, and who
 * pays each line (company by default, rule 23).
 */
class ChargeController extends Controller
{
    public function store(Request $request, Stay $stay): RedirectResponse
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in([ChargeType::Extra->value, ChargeType::Damage->value])],
            'description' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:9999999999.99'],
            'billed_to' => ['required', Rule::enum(BilledTo::class)],
        ]);

        if ($this->settled($stay)) {
            return $this->locked($stay);
        }

        $stay->charges()->create([
            ...$validated,
            'reservation_id' => $stay->reservation_id,
            'created_by' => $request->user()->id,
        ]);
        $stay->refreshIdCustody();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Charge added to the bill.')]);

        return to_route('reception.stays.show', $stay);
    }

    /** Switch who pays a line: company or guest. */
    public function update(Request $request, Charge $charge): RedirectResponse
    {
        $validated = $request->validate([
            'billed_to' => ['required', Rule::enum(BilledTo::class)],
        ]);
        $stay = $charge->stay()->firstOrFail();

        if ($this->settled($stay)) {
            return $this->locked($stay);
        }

        $charge->update($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('":line" is now billed to the :who.', [
            'line' => $charge->description,
            'who' => strtolower($charge->billed_to->label()),
        ])]);

        return to_route('reception.stays.show', $stay);
    }

    public function destroy(Charge $charge): RedirectResponse
    {
        $stay = $charge->stay()->firstOrFail();

        if ($this->settled($stay)) {
            return $this->locked($stay);
        }

        if ($charge->type === ChargeType::Room) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('Room charges come from the reservation and cannot be removed. Add a discount as a note on the payment instead.')]);

            return to_route('reception.stays.show', $stay);
        }

        $charge->delete();
        $stay->refreshIdCustody();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Charge removed.')]);

        return to_route('reception.stays.show', $stay);
    }

    /** Once the ID is back with the guest, the bill is closed. */
    private function settled(Stay $stay): bool
    {
        return $stay->idCustody()->where('status', IdCustodyStatus::Returned)->exists();
    }

    private function locked(Stay $stay): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'error', 'message' => __('This stay is settled; its bill can no longer change.')]);

        return to_route('reception.stays.show', $stay);
    }
}
