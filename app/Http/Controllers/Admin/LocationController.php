<?php

namespace App\Http\Controllers\Admin;

use App\Enums\RoomStatusGroup;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\LocationRequest;
use App\Models\Location;
use App\Models\Room;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class LocationController extends Controller
{
    public function index(): Response
    {
        $locations = Location::query()
            ->with('rooms:id,location_id,status,pax_capacity')
            ->orderBy('name')
            ->get()
            ->map(fn (Location $location) => [
                'id' => $location->id,
                'name' => $location->name,
                'description' => $location->description,
                'rooms_count' => $location->rooms->count(),
                'capacity' => (int) $location->rooms->sum('pax_capacity'),
                'groups' => RoomStatusGroup::tally($location->rooms->map(fn (Room $room) => $room->status)),
            ]);

        return Inertia::render('admin/locations/index', [
            'locations' => $locations,
            'statusGroups' => RoomStatusGroup::options(),
        ]);
    }

    public function store(LocationRequest $request): RedirectResponse
    {
        $location = Location::create($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __(':name added.', ['name' => $location->name])]);

        return to_route('admin.locations.index');
    }

    public function update(LocationRequest $request, Location $location): RedirectResponse
    {
        $location->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Location updated.')]);

        return to_route('admin.locations.index');
    }

    public function destroy(Location $location): RedirectResponse
    {
        if ($location->rooms()->exists()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('Move or delete the rooms in :name first.', ['name' => $location->name])]);

            return to_route('admin.locations.index');
        }

        $location->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __(':name deleted.', ['name' => $location->name])]);

        return to_route('admin.locations.index');
    }
}
