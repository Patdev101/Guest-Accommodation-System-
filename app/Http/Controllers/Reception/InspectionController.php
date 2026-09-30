<?php

namespace App\Http\Controllers\Reception;

use App\Enums\BilledTo;
use App\Enums\ChargeType;
use App\Enums\RoomStatus;
use App\Http\Controllers\Controller;
use App\Models\Stay;
use App\Models\StayRoom;
use App\Services\FrontDeskAlerts;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Checks a room after the guests leave (rule 22): damages become charges,
 * then the room goes to cleaning, or under maintenance when it needs repair.
 */
class InspectionController extends Controller
{
    public function store(Request $request, Stay $stay, StayRoom $stayRoom, FrontDeskAlerts $alerts): RedirectResponse
    {
        // is() compares the keys as numbers, whatever type the driver returns.
        abort_unless($stayRoom->stay()->is($stay), 404);

        $validated = $request->validate([
            'damages' => ['nullable', 'array', 'max:20'],
            'damages.*.description' => ['required', 'string', 'max:255'],
            'damages.*.amount' => ['required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:9999999999.99'],
            'damages.*.billed_to' => ['required', Rule::enum(BilledTo::class)],
            'outcome' => ['required', Rule::in(['cleaning', 'maintenance'])],
            'issue' => ['nullable', 'required_if:outcome,maintenance', 'string', 'max:2000'],
        ], [
            'issue.required_if' => __('Describe what needs repair.'),
        ], [
            'damages.*.description' => 'damage',
            'damages.*.amount' => 'amount',
        ]);

        $room = $stayRoom->room;

        if (! $stay->isCheckedOut() || $stayRoom->inspected_at !== null) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $stayRoom->inspected_at !== null
                ? __(':room was already inspected.', ['room' => $room->name])
                : __('Check the guests out before inspecting the rooms.')]);

            return to_route('reception.stays.show', $stay);
        }

        DB::transaction(function () use ($request, $stay, $stayRoom, $room, $validated) {
            foreach ($validated['damages'] ?? [] as $damage) {
                $stay->charges()->create([
                    'reservation_id' => $stay->reservation_id,
                    'type' => ChargeType::Damage,
                    'description' => "{$room->name}: {$damage['description']}",
                    'amount' => round((float) $damage['amount'], 2),
                    'billed_to' => $damage['billed_to'],
                    'created_by' => $request->user()->id,
                ]);
            }

            $stayRoom->update(['inspected_at' => now(), 'inspected_by' => $request->user()->id]);

            if (in_array($room->status, [RoomStatus::Inspection, RoomStatus::CheckOut, RoomStatus::Occupied], true)) {
                if ($validated['outcome'] === 'maintenance') {
                    $room->maintenanceRecords()->create([
                        'performed_on' => today(),
                        'issue' => $validated['issue'],
                        'recorded_by' => $request->user()->id,
                    ]);
                }

                $room->update(['status' => $validated['outcome'] === 'maintenance' ? RoomStatus::UnderMaintenance : RoomStatus::Cleaning]);
            }

            $stay->refreshIdCustody();
        });

        if ($validated['outcome'] === 'maintenance' && $room->refresh()->status === RoomStatus::UnderMaintenance) {
            $alerts->roomOutOfUse($room, RoomStatus::UnderMaintenance, $validated['issue'], $request->user());
        }

        $damages = count($validated['damages'] ?? []);

        Inertia::flash('toast', ['type' => 'success', 'message' => $validated['outcome'] === 'maintenance'
            ? __(':room inspected and sent for repair.', ['room' => $room->name])
            : ($damages > 0
                ? trans_choice('{1} :room inspected: 1 damage charged. It is now being cleaned.|[2,*] :room inspected: :count damages charged. It is now being cleaned.', $damages, ['room' => $room->name])
                : __(':room inspected, no damage. It is now being cleaned.', ['room' => $room->name]))]);

        return to_route('reception.stays.show', $stay);
    }
}
