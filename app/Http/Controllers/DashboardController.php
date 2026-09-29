<?php

namespace App\Http\Controllers;

use App\Enums\IdCustodyStatus;
use App\Enums\ReservationStatus;
use App\Enums\Role;
use App\Enums\RoomStatus;
use App\Enums\RoomStatusGroup;
use App\Http\Controllers\Admin\SettingsController;
use App\Models\IdCustody;
use App\Models\Location;
use App\Models\MaintenanceRecord;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\Setting;
use App\Models\Stay;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();

        return match ($user->role) {
            Role::Admin => Inertia::render('admin/dashboard', $this->forAdmin()),
            Role::Reception => Inertia::render('dashboard', $this->forReception()),
            Role::Guest => Inertia::render('dashboard', $this->forGuest($user)),
        };
    }

    /** @return array<string, mixed> */
    private function forAdmin(): array
    {
        $rooms = Room::query()
            ->with(['location:id,name', 'rates:id,room_id,is_extension_rate'])
            ->get()
            ->sortBy(fn (Room $room) => $room->location->name."\0".$room->name, SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $groupCounts = RoomStatusGroup::tally($rooms->map(fn (Room $room) => $room->status));
        $withoutRates = $rooms->filter(fn (Room $room) => ! $room->rates->contains('is_extension_rate', false));

        return [
            'stats' => [
                'rooms' => $rooms->count(),
                'capacity' => (int) $rooms->sum('pax_capacity'),
                'locations' => Location::count(),
            ],
            'groups' => array_map(fn (array $group) => [
                ...$group,
                'count' => $groupCounts[$group['value']],
            ], RoomStatusGroup::options()),
            'breakdown' => array_map(fn (RoomStatus $status) => [
                'value' => $status->value,
                'label' => $status->label(),
                'group' => $status->group()->value,
                'count' => $rooms->filter(fn (Room $room) => $room->status === $status)->count(),
            ], RoomStatus::cases()),
            'board' => Location::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Location $location) => [
                    'id' => $location->id,
                    'name' => $location->name,
                    'rooms' => $rooms
                        ->where('location_id', $location->id)
                        ->values()
                        ->map(fn (Room $room) => $room->summary()),
                ]),
            'checklist' => [
                'locations' => Location::count(),
                'rooms' => $rooms->count(),
                'roomsWithoutRates' => $withoutRates->take(5)->values()->map(fn (Room $room) => $room->summary()),
                'roomsWithoutRatesCount' => $withoutRates->count(),
                'roomsWithoutExtensionRate' => $rooms
                    ->filter(fn (Room $room) => ! $room->rates->contains('is_extension_rate', true))
                    ->count(),
                'settingsReviewed' => Setting::query()->whereKey(SettingsController::REVIEWED_KEY)->exists(),
            ],
            'recentMaintenance' => MaintenanceRecord::query()
                ->with('room.location')
                ->orderByDesc('performed_on')
                ->orderByDesc('id')
                ->limit(5)
                ->get()
                ->map(fn (MaintenanceRecord $record) => [
                    'id' => $record->id,
                    'room_id' => $record->room_id,
                    'room' => $record->room->name,
                    'location' => $record->room->location->name,
                    'performed_on' => $record->performed_on->toDateString(),
                    'issue' => $record->issue,
                    'resolved' => $record->action_taken !== null,
                ]),
        ];
    }

    /** @return array<string, mixed> */
    private function forReception(): array
    {
        return [
            'stats' => [
                'arrivalsToday' => Reservation::where('status', ReservationStatus::Active)
                    ->whereBetween('starts_at', [now()->startOfDay(), now()->endOfDay()])
                    ->count(),
                'inHouse' => Stay::whereNull('checked_out_at')->count(),
                'checkoutsToday' => Stay::whereNull('checked_out_at')
                    ->whereBetween('expected_check_out_at', [now()->startOfDay(), now()->endOfDay()])
                    ->count(),
                'idsPendingPayment' => IdCustody::where('status', IdCustodyStatus::HeldPendingPayment)->count(),
            ],
            'roomStatuses' => $this->roomStatusCounts(),
        ];
    }

    /** @return array<string, mixed> */
    private function forGuest(User $user): array
    {
        $reservations = Reservation::query()
            ->whereHas('guest', fn ($query) => $query->where('user_id', $user->id))
            ->where('status', ReservationStatus::Active)
            ->with('room.location')
            ->orderBy('starts_at')
            ->get()
            ->map(fn (Reservation $reservation) => [
                'id' => $reservation->id,
                'room' => $reservation->room->name,
                'location' => $reservation->room->location->name,
                'starts_at' => $reservation->starts_at->toIso8601String(),
                'ends_at' => $reservation->ends_at->toIso8601String(),
                'pax' => $reservation->pax,
                'payment_status' => $reservation->paymentStatus()->value,
            ]);

        return ['reservations' => $reservations];
    }

    /** @return list<array{status: string, label: string, group: string, count: int}> */
    private function roomStatusCounts(): array
    {
        $counts = Room::query()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return array_map(fn (RoomStatus $status) => [
            'status' => $status->value,
            'label' => $status->label(),
            'group' => $status->group()->value,
            'count' => (int) ($counts[$status->value] ?? 0),
        ], RoomStatus::cases());
    }
}
