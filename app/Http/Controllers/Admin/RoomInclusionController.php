<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\RoomInclusion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RoomInclusionController extends Controller
{
    public function store(Request $request, Room $room): RedirectResponse
    {
        $validated = $request->validate([
            'item' => ['required', 'string', 'max:150'],
            'quantity' => ['required', 'integer', 'min:1', 'max:999'],
        ]);

        $alreadyListed = $room->inclusions->contains(
            fn (RoomInclusion $inclusion) => Str::lower($inclusion->item) === Str::lower(trim($validated['item'])),
        );

        if ($alreadyListed) {
            throw ValidationException::withMessages([
                'item' => __('Already listed. Change its quantity instead.'),
            ]);
        }

        $room->inclusions()->create($validated);

        return to_route('admin.rooms.show', $room);
    }

    public function update(Request $request, Room $room, RoomInclusion $inclusion): RedirectResponse
    {
        $inclusion->update($request->validate([
            'quantity' => ['required', 'integer', 'min:1', 'max:999'],
        ]));

        return to_route('admin.rooms.show', $room);
    }

    public function destroy(Room $room, RoomInclusion $inclusion): RedirectResponse
    {
        $inclusion->delete();

        return to_route('admin.rooms.show', $room);
    }
}
