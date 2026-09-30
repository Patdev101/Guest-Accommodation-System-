<?php

namespace App\Http\Controllers\Admin;

use App\Enums\RoomStatus;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\Room;
use App\Models\RoomInclusion;
use App\Models\RoomPhoto;
use App\Models\RoomRate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * Copies a room (pax, description, rates, inclusions and photos) under one or
 * more new names, e.g. Barracks A-101 into A-102 … A-120.
 */
class RoomCopyController extends Controller
{
    public const MAX_COPIES = 50;

    public function __invoke(Request $request, Room $room): RedirectResponse
    {
        $request->validate([
            'location_id' => ['required', 'integer', Rule::exists(Location::class, 'id')],
            'names' => ['required', 'string', 'max:5000'],
        ], ['names.required' => __('Enter at least one room name.')], ['location_id' => 'location']);

        $locationId = $request->integer('location_id');
        $lines = array_map(trim(...), preg_split('/\r\n|\r|\n|,/', $request->string('names')->toString()) ?: []);
        $names = array_values(array_filter($lines, fn (string $name) => $name !== ''));

        $this->validateNames($names, $locationId);

        $room->load(['rates', 'inclusions', 'photos']);

        /** @var list<Room> $copies */
        $copies = DB::transaction(fn () => ActivityLog::withoutLogging(
            fn () => array_map(fn (string $name) => $this->copy($room, $name, $locationId), $names),
        ));

        foreach ($copies as $copy) {
            ActivityLog::record('created', $copy, "Added {$copy->activityLabel()} as a copy of room {$room->name}");
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => trans_choice(
            '{1} :name added as a copy of :source.|[2,*] :count rooms added as copies of :source.',
            count($copies),
            ['name' => $copies[0]->name, 'source' => $room->name],
        )]);

        return count($copies) === 1
            ? to_route('admin.rooms.show', $copies[0])
            : to_route('admin.rooms.index', ['location' => $locationId]);
    }

    /**
     * @param  list<string>  $names
     */
    private function validateNames(array $names, int $locationId): void
    {
        $message = match (true) {
            $names === [] => __('Enter at least one room name.'),
            count($names) > self::MAX_COPIES => __('You can copy up to :max rooms at a time.', ['max' => self::MAX_COPIES]),
            collect($names)->contains(fn (string $name) => Str::length($name) > 100) => __('Room names can be at most 100 characters.'),
            default => null,
        };

        $lower = array_map(fn (string $name) => Str::lower($name), $names);
        $repeated = array_unique(array_diff_assoc($lower, array_unique($lower)));

        if ($message === null && $repeated !== []) {
            $message = __('Each name must be different. Repeated: :names.', ['names' => implode(', ', $repeated)]);
        }

        if ($message === null) {
            $taken = Room::query()
                ->where('location_id', $locationId)
                ->whereIn('name', $names)
                ->pluck('name');

            if ($taken->isNotEmpty()) {
                $message = __('This location already has: :names.', ['names' => $taken->implode(', ')]);
            }
        }

        if ($message !== null) {
            throw ValidationException::withMessages(['names' => $message]);
        }
    }

    private function copy(Room $source, string $name, int $locationId): Room
    {
        $copy = Room::create([
            'location_id' => $locationId,
            'name' => $name,
            'pax_capacity' => $source->pax_capacity,
            'description' => $source->description,
            'status' => RoomStatus::Available,
        ]);

        $copy->rates()->createMany($source->rates->map(fn (RoomRate $rate) => $rate->only([
            'rate_unit_id', 'name', 'price', 'is_extension_rate',
        ]))->all());

        $copy->inclusions()->createMany($source->inclusions->map(fn (RoomInclusion $inclusion) => $inclusion->only([
            'item', 'quantity',
        ]))->all());

        $disk = Storage::disk('public');

        foreach ($source->photos as $photo) {
            /** @var RoomPhoto $photo */
            if (! $disk->exists($photo->path)) {
                continue;
            }

            $path = "rooms/{$copy->id}/".Str::random(20).'.'.pathinfo($photo->path, PATHINFO_EXTENSION);
            $disk->copy($photo->path, $path);

            $copy->photos()->create([
                'path' => $path,
                'caption' => $photo->caption,
                'sort_order' => $photo->sort_order,
                'is_cover' => $photo->is_cover,
            ]);
        }

        return $copy;
    }
}
