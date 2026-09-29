<?php

namespace App\Http\Controllers;

use App\Enums\IdCustodyStatus;
use App\Enums\ReservationStatus;
use App\Enums\Role;
use App\Enums\RoomStatus;
use App\Models\IdCustody;
use App\Models\Location;
use App\Models\Reservation;
use App\Models\Room;
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

        return Inertia::render('dashboard', match ($user->role) {
            Role::Admin => $this->forAdmin(),
            Role::Reception => $this->forReception(),
            Role::Guest => $this->forGuest($user),
        });
    }

    /** @return array<string, mixed> */
    private function forAdmin(): array
    {
        return [
            'stats' => [
                'locations' => Location::count(),
                'rooms' => Room::count(),
                'reception' => User::where('role', Role::Reception)->count(),
                'guests' => User::where('role', Role::Guest)->count(),
            ],
            'roomStatuses' => $this->roomStatusCounts(),
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

    /** @return list<array{status: string, label: string, count: int}> */
    private function roomStatusCounts(): array
    {
        $counts = Room::query()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return array_map(fn (RoomStatus $status) => [
            'status' => $status->value,
            'label' => $status->label(),
            'count' => (int) ($counts[$status->value] ?? 0),
        ], RoomStatus::cases());
    }
}
