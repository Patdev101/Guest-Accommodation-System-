<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Room;
use App\Models\RoomPhoto;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * Photos that showcase a room to guests browsing before they log in.
 * The first photo becomes the cover; deleting the cover promotes the next.
 */
class RoomPhotoController extends Controller
{
    public function store(Request $request, Room $room): RedirectResponse
    {
        $request->validate([
            'photos' => ['required', 'array', 'min:1'],
            'photos.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ], [
            'photos.required' => __('Choose at least one photo.'),
            'photos.*.image' => __('Only JPG, PNG or WebP images can be uploaded.'),
            'photos.*.mimes' => __('Only JPG, PNG or WebP images can be uploaded.'),
            'photos.*.max' => __('Each photo must be 5 MB or smaller.'),
        ]);

        /** @var list<UploadedFile> $files */
        $files = $request->file('photos');
        $existing = $room->photos()->count();

        if ($existing + count($files) > RoomPhoto::MAX_PER_ROOM) {
            throw ValidationException::withMessages([
                'photos' => __('A room can have up to :max photos. It has :count now.', [
                    'max' => RoomPhoto::MAX_PER_ROOM,
                    'count' => $existing,
                ]),
            ]);
        }

        $hasCover = $room->photos()->where('is_cover', true)->exists();
        $order = (int) $room->photos()->max('sort_order');

        foreach ($files as $index => $file) {
            $room->photos()->create([
                'path' => $file->store("rooms/{$room->id}", 'public'),
                'sort_order' => $order + $index + 1,
                'is_cover' => ! $hasCover && $index === 0,
            ]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => trans_choice('{1} Photo added.|[2,*] :count photos added.', count($files))]);

        return to_route('admin.rooms.show', $room);
    }

    public function update(Request $request, Room $room, RoomPhoto $photo): RedirectResponse
    {
        $validated = $request->validate([
            'caption' => ['nullable', 'string', 'max:150'],
            'is_cover' => ['nullable', 'boolean'],
        ]);

        DB::transaction(function () use ($request, $room, $photo, $validated) {
            if ($request->boolean('is_cover')) {
                $room->photos()->update(['is_cover' => false]);
                $photo->is_cover = true;
            }

            if ($request->has('caption')) {
                $photo->caption = $validated['caption'] ?? null;
            }

            $photo->save();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Photo updated.')]);

        return to_route('admin.rooms.show', $room);
    }

    /** Save a new order after the Admin drags photos around. */
    public function reorder(Request $request, Room $room): RedirectResponse
    {
        $ids = $room->photos()->pluck('id')->all();

        $validated = $request->validate([
            'photos' => ['required', 'array', 'size:'.count($ids)],
            'photos.*' => ['integer', 'distinct', Rule::in($ids)],
        ]);

        DB::transaction(fn () => ActivityLog::withoutLogging(function () use ($room, $validated) {
            foreach ($validated['photos'] as $position => $id) {
                $room->photos()->whereKey($id)->update(['sort_order' => $position + 1]);
            }
        }));

        ActivityLog::record('updated', $room, "Reordered the photos of {$room->activityLabel()}");

        return to_route('admin.rooms.show', $room);
    }

    public function destroy(Room $room, RoomPhoto $photo): RedirectResponse
    {
        DB::transaction(function () use ($room, $photo) {
            $wasCover = $photo->is_cover;
            $photo->delete();

            if ($wasCover) {
                $room->photos()->first()?->update(['is_cover' => true]);
            }
        });

        Storage::disk('public')->delete($photo->path);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Photo deleted.')]);

        return to_route('admin.rooms.show', $room);
    }
}
