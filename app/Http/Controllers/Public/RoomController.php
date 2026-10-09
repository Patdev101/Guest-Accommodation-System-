<?php

namespace App\Http\Controllers\Public;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\RoomInclusion;
use App\Models\RoomPhoto;
use App\Models\RoomRate;
use App\Models\Setting;
use App\Services\Availability;
use App\Services\BusyPeriod;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The public side (rule 10): anyone can browse the rooms, their photos, prices
 * and free dates without logging in. Only public facts leave this controller:
 * never a guest's name or a booking's details, only when a room is taken.
 */
class RoomController extends Controller
{
    /** The address "/": staff go to their dashboard, everyone else sees the rooms. */
    public function home(Request $request, Availability $availability): Response|RedirectResponse
    {
        $role = $request->user()?->role;

        return $role === Role::Admin || $role === Role::Reception
            ? to_route('dashboard')
            : $this->index($request, $availability);
    }

    public function index(Request $request, Availability $availability): Response
    {
        $filters = $this->filters($request);
        [$start, $end] = $this->window($filters);

        $rooms = $this->listed()
            ->with(['location:id,name', 'coverPhoto', 'inclusions', 'rates' => fn ($rates) => $rates->where('is_extension_rate', false)->with('unit:id,name')->orderBy('price')])
            ->get()
            ->sortBy(fn (Room $room) => $room->location->name."\0".$room->name, SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $periods = $start ? $availability->busyPeriods(Availability::ids($rooms)) : [];

        $cards = $rooms->map(function (Room $room) use ($availability, $start, $end, $periods) {
            /** @var RoomRate $cheapest */
            $cheapest = $room->rates->first();

            return [
                'id' => $room->id,
                'name' => $room->name,
                'location_id' => $room->location_id,
                'location' => $room->location->name,
                'pax_capacity' => $room->pax_capacity,
                'cover_url' => $room->coverPhoto?->url(),
                'description' => $room->description,
                'inclusions' => $room->inclusions->map(fn (RoomInclusion $inclusion) => $inclusion->quantity > 1 ? $inclusion->quantity.' '.$inclusion->item : $inclusion->item)->values(),
                'from_price' => $cheapest->price,
                'from_unit' => $cheapest->unit->name,
                // Null until the visitor chooses dates.
                'free' => $start && $end ? $availability->blockedReason($room, $start, $end, $periods[$room->id]) === null : null,
            ];
        });

        return Inertia::render('public/rooms', [
            'rooms' => $cards->values(),
            'filters' => $filters,
            'locations' => $rooms->map(fn (Room $room) => ['id' => $room->location_id, 'name' => $room->location->name])->unique('id')->values(),
            'today' => CarbonImmutable::today()->toDateString(),
            'standardTimes' => $this->standardTimes(),
        ]);
    }

    public function show(Request $request, Room $room, Availability $availability): Response
    {
        // A room that is not offered to the public does not exist for visitors.
        abort_unless($this->listed()->whereKey($room->id)->exists(), 404);

        $filters = $this->filters($request);
        [$start, $end] = $this->window($filters);
        $room->load(['location:id,name', 'photos', 'inclusions', 'rates' => fn ($rates) => $rates->where('is_extension_rate', false)->with('unit:id,name')->orderBy('price')]);
        $periods = $availability->busyPeriods([$room->id])[$room->id];

        return Inertia::render('public/room', [
            'room' => [
                'id' => $room->id,
                'name' => $room->name,
                'location' => $room->location->name,
                'pax_capacity' => $room->pax_capacity,
                'description' => $room->description,
                'photos' => $room->photos->map(fn (RoomPhoto $photo) => ['id' => $photo->id, 'url' => $photo->url(), 'caption' => $photo->caption])->values(),
                'inclusions' => $room->inclusions->map(fn (RoomInclusion $inclusion) => ['id' => $inclusion->id, 'item' => $inclusion->item, 'quantity' => $inclusion->quantity])->values(),
                'rates' => $room->rates->map(fn (RoomRate $rate) => ['id' => $rate->id, 'name' => $rate->name, 'unit' => $rate->unit->name, 'price' => $rate->price])->values(),
            ],
            // When the room is taken: times only, never who.
            'busy' => array_map(fn (BusyPeriod $period) => [
                'from' => $period->start->toIso8601String(),
                'to' => $period->end?->toIso8601String(),
            ], $periods),
            'free' => $start && $end ? $availability->blockedReason($room, $start, $end, $periods) === null : null,
            // Why the dates are not free: "occupied" = the guest staying now has not
            // confirmed their check-out, so later dates cannot be promised (rule 13).
            'blockedBy' => $start && $end ? $this->blockedBy($periods, $start, $end, $availability->bufferMinutes()) : null,
            'filters' => $filters,
            'today' => CarbonImmutable::today()->toDateString(),
            'standardTimes' => $this->standardTimes(),
        ]);
    }

    /**
     * What stands in the way of the dates, without saying who: "occupied"
     * (a stay with no confirmed end), "booked" (another booking), or null.
     *
     * @param  list<BusyPeriod>  $periods
     */
    private function blockedBy(array $periods, CarbonImmutable $start, CarbonImmutable $end, int $buffer): ?string
    {
        foreach ($periods as $period) {
            if ($period->overlaps($start, $end->addMinutes($buffer))) {
                return $period->end === null ? 'occupied' : 'booked';
            }
        }

        return null;
    }

    /**
     * Rooms the public may see: not under maintenance or out of service, and with a price.
     *
     * @return Builder<Room>
     */
    private function listed(): Builder
    {
        return Room::query()
            ->whereNotIn('status', Availability::UNBOOKABLE)
            ->whereHas('rates', fn (Builder $rates) => $rates->where('is_extension_rate', false));
    }

    /**
     * What the visitor searched for; anything invalid is dropped.
     *
     * @return array{location: int|null, from: string|null, to: string|null, guests: int|null}
     */
    private function filters(Request $request): array
    {
        $query = Validator::make($request->query(), [
            'location' => ['integer'],
            'from' => ['date_format:Y-m-d', 'after_or_equal:today'],
            'to' => ['date_format:Y-m-d', 'after:from'],
            'guests' => ['integer', 'min:1', 'max:1000'],
        ])->valid();

        // Dates only count as a pair.
        $dated = isset($query['from'], $query['to']);

        return [
            'location' => isset($query['location']) ? (int) $query['location'] : null,
            'from' => $dated ? $query['from'] : null,
            'to' => $dated ? $query['to'] : null,
            'guests' => isset($query['guests']) ? (int) $query['guests'] : null,
        ];
    }

    /**
     * The stay asked for, from the standard check-in time to the standard check-out time.
     *
     * @param  array{location: int|null, from: string|null, to: string|null, guests: int|null}  $filters
     * @return array{0: CarbonImmutable|null, 1: CarbonImmutable|null}
     */
    private function window(array $filters): array
    {
        if ($filters['from'] === null || $filters['to'] === null) {
            return [null, null];
        }

        $times = $this->standardTimes();

        return [
            CarbonImmutable::parse($filters['from'].' '.$times['check_in']),
            CarbonImmutable::parse($filters['to'].' '.$times['check_out']),
        ];
    }

    /** @return array{check_in: string, check_out: string} */
    private function standardTimes(): array
    {
        return [
            'check_in' => (string) Setting::get('standard_check_in_time'),
            'check_out' => (string) Setting::get('standard_check_out_time'),
        ];
    }
}
