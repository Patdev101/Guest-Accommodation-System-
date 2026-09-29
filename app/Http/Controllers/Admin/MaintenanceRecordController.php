<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\MaintenanceRecordRequest;
use App\Models\MaintenanceRecord;
use App\Models\Room;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class MaintenanceRecordController extends Controller
{
    public function store(MaintenanceRecordRequest $request, Room $room): RedirectResponse
    {
        $room->maintenanceRecords()->create([
            ...$request->validated(),
            'recorded_by' => $request->user()->id,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Maintenance record added.')]);

        return to_route('admin.rooms.show', $room);
    }

    public function update(MaintenanceRecordRequest $request, Room $room, MaintenanceRecord $maintenanceRecord): RedirectResponse
    {
        $maintenanceRecord->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Maintenance record updated.')]);

        return to_route('admin.rooms.show', $room);
    }

    public function destroy(Room $room, MaintenanceRecord $maintenanceRecord): RedirectResponse
    {
        $maintenanceRecord->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Maintenance record deleted.')]);

        return to_route('admin.rooms.show', $room);
    }
}
