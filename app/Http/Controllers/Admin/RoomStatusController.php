<?php

namespace App\Http\Controllers\Admin;

use App\Enums\RoomStatus;
use App\Http\Controllers\Controller;
use App\Models\Room;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Manual status changes from the room page: maintenance, out of service and
 * finishing turnover. Check-in and check-out move rooms through the rest.
 */
class RoomStatusController extends Controller
{
    public function __invoke(Request $request, Room $room): RedirectResponse
    {
        $from = $room->status;
        $allowed = array_map(fn (RoomStatus $status) => $status->value, $from->manualTransitions());

        $validated = $request->validate([
            'status' => ['required', Rule::in($allowed)],
            'issue' => [
                Rule::requiredIf($request->input('status') === RoomStatus::UnderMaintenance->value),
                'nullable', 'string', 'max:2000',
            ],
            'action_taken' => ['nullable', 'string', 'max:2000'],
            'done_by' => ['nullable', 'string', 'max:150'],
        ], [
            'status.in' => __('A room that is :status cannot be changed to that status here.', ['status' => strtolower($from->label())]),
            'issue.required' => __('Describe what needs fixing.'),
        ]);

        $to = RoomStatus::from($validated['status']);

        DB::transaction(function () use ($room, $from, $to, $validated, $request) {
            if ($to === RoomStatus::UnderMaintenance) {
                $room->maintenanceRecords()->create([
                    'performed_on' => today(),
                    'issue' => $validated['issue'],
                    'recorded_by' => $request->user()->id,
                ]);
            }

            // Closing a repair fills in the most recent open maintenance record.
            if ($from === RoomStatus::UnderMaintenance && ($validated['action_taken'] ?? $validated['done_by'] ?? null) !== null) {
                $room->maintenanceRecords()
                    ->whereNull('action_taken')
                    ->orderByDesc('performed_on')
                    ->orderByDesc('id')
                    ->first()
                    ?->update([
                        'action_taken' => $validated['action_taken'] ?? null,
                        'done_by' => $validated['done_by'] ?? null,
                    ]);
            }

            $room->update(['status' => $to]);
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __(':name is now :status.', ['name' => $room->name, 'status' => strtolower($to->label())]),
        ]);

        return to_route('admin.rooms.show', $room);
    }
}
