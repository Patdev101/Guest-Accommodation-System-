<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ReservationStatus;
use App\Enums\RoomStatus;
use App\Enums\RoomStatusGroup;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RoomRequest;
use App\Models\Location;
use App\Models\MaintenanceRecord;
use App\Models\RateUnit;
use App\Models\Room;
use App\Models\RoomInclusion;
use App\Models\RoomRate;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class RoomController extends Controller
{
    public function index(): Response
    {
        $rooms = Room::query()
            ->with(['location:id,name', 'rates.unit'])
            ->withCount('inclusions')
            ->get()
            ->sortBy(fn (Room $room) => $room->location->name."\0".$room->name, SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->map(function (Room $room) {
                $standardRates = $room->rates->where('is_extension_rate', false);
                $cheapest = $standardRates->sortBy(fn (RoomRate $rate) => (float) $rate->price)->first();

                return [
                    ...$room->summary(),
                    'rates_count' => $standardRates->count(),
                    'has_extension_rate' => $room->rates->contains('is_extension_rate', true),
                    'from_price' => $cheapest?->price,
                    'from_unit' => $cheapest?->unit->name,
                    'inclusions_count' => $room->inclusions_count,
                ];
            });

        return Inertia::render('admin/rooms/index', [
            'rooms' => $rooms,
            'locations' => Location::query()->orderBy('name')->get(['id', 'name']),
            'statuses' => $this->statusOptions(),
            'statusGroups' => RoomStatusGroup::options(),
        ]);
    }

    public function store(RoomRequest $request): RedirectResponse
    {
        $room = Room::create([...$request->validated(), 'status' => RoomStatus::Available]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __(':name added. Set its rates and inclusions next.', ['name' => $room->name])]);

        return to_route('admin.rooms.show', $room);
    }

    public function show(Room $room): Response
    {
        $room->load(['location', 'inclusions', 'rates.unit', 'maintenanceRecords.recorder']);

        return Inertia::render('admin/rooms/show', [
            'room' => [
                ...$room->summary(),
                'description' => $room->description,
                'status_description' => $room->status->description(),
                'created_at' => $room->created_at?->toDateString(),
            ],
            'transitions' => array_map(fn (RoomStatus $status) => [
                'value' => $status->value,
                'label' => $status->label(),
                'description' => $status->description(),
                'group' => $status->group()->value,
            ], $room->status->manualTransitions()),
            'inclusions' => $room->inclusions
                ->sortBy('item', SORT_NATURAL | SORT_FLAG_CASE)
                ->values()
                ->map(fn (RoomInclusion $inclusion) => $inclusion->only(['id', 'item', 'quantity'])),
            'rates' => $room->rates
                ->sort(fn (RoomRate $a, RoomRate $b) => [$a->is_extension_rate, (float) $a->price] <=> [$b->is_extension_rate, (float) $b->price])
                ->values()
                ->map(fn (RoomRate $rate) => [
                    'id' => $rate->id,
                    'name' => $rate->name,
                    'price' => $rate->price,
                    'rate_unit_id' => $rate->rate_unit_id,
                    'unit' => $rate->unit->name,
                    'is_extension_rate' => $rate->is_extension_rate,
                ]),
            'maintenance' => $room->maintenanceRecords
                ->sortBy([['performed_on', 'desc'], ['id', 'desc']])
                ->values()
                ->map(fn (MaintenanceRecord $record) => [
                    'id' => $record->id,
                    'performed_on' => $record->performed_on->toDateString(),
                    'issue' => $record->issue,
                    'action_taken' => $record->action_taken,
                    'done_by' => $record->done_by,
                    'recorded_by' => $record->recorder?->name,
                ]),
            'upcomingReservations' => $room->reservations()
                ->where('status', ReservationStatus::Active)
                ->where('ends_at', '>=', now())
                ->count(),
            'locations' => Location::query()->orderBy('name')->get(['id', 'name']),
            'rateUnits' => RateUnit::query()->orderBy('id')->get(['id', 'name']),
        ]);
    }

    public function update(RoomRequest $request, Room $room): RedirectResponse
    {
        $room->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Room details saved.')]);

        return to_route('admin.rooms.show', $room);
    }

    public function destroy(Room $room): RedirectResponse
    {
        if ($room->reservations()->exists() || $room->stays()->exists()) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => __(':name has reservations or stays on record. Set it to Out of service instead.', ['name' => $room->name]),
            ]);

            return to_route('admin.rooms.show', $room);
        }

        $room->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __(':name deleted.', ['name' => $room->name])]);

        return to_route('admin.rooms.index');
    }

    /**
     * @return list<array{value: string, label: string, group: string}>
     */
    private function statusOptions(): array
    {
        return array_map(fn (RoomStatus $status) => [
            'value' => $status->value,
            'label' => $status->label(),
            'group' => $status->group()->value,
        ], RoomStatus::cases());
    }
}
