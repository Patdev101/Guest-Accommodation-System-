<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RoomRateRequest;
use App\Models\ReservationRoom;
use App\Models\Room;
use App\Models\RoomRate;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class RoomRateController extends Controller
{
    public function store(RoomRateRequest $request, Room $room): RedirectResponse
    {
        $room->rates()->create($request->rate());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Rate added.')]);

        return to_route('admin.rooms.show', $room);
    }

    public function update(RoomRateRequest $request, Room $room, RoomRate $rate): RedirectResponse
    {
        $rate->update($request->rate());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Rate updated.')]);

        return to_route('admin.rooms.show', $room);
    }

    public function destroy(Room $room, RoomRate $rate): RedirectResponse
    {
        if (ReservationRoom::query()->where('room_rate_id', $rate->id)->exists()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('Reservations use this rate, so it cannot be deleted. Change its price instead.')]);

            return to_route('admin.rooms.show', $room);
        }

        $rate->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Rate deleted.')]);

        return to_route('admin.rooms.show', $room);
    }
}
