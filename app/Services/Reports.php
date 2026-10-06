<?php

namespace App\Services;

use App\Enums\IdCustodyStatus;
use App\Enums\RefundStatus;
use App\Enums\ReservationStatus;
use App\Models\Charge;
use App\Models\IdCustody;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\Stay;
use App\Models\StayRoom;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Figures for the Admin's reports and the dashboard trends. Grouping is done
 * in PHP so the same code gives the same answer on SQL Server and in the tests.
 */
class Reports
{
    /**
     * Everyone who stayed during the period.
     *
     * @return list<array<string, mixed>>
     */
    public function guestLog(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return array_values(Stay::query()
            ->with(['guest:id,name,company,contact_number', 'reservation:id,company', 'rooms.room:id,name', 'idCustody.idType:id,name'])
            ->where('checked_in_at', '<=', $to)
            ->where(fn ($query) => $query->whereNull('checked_out_at')->orWhere('checked_out_at', '>=', $from))
            ->orderBy('checked_in_at')
            ->get()
            ->map(fn (Stay $stay) => [
                'guest' => $stay->guest->name,
                'company' => $stay->reservation->company ?? $stay->guest->company,
                'contact_number' => $stay->guest->contact_number,
                'rooms' => $stay->rooms->map(fn (StayRoom $line) => $line->room->name)->implode(', '),
                'pax' => (int) $stay->rooms->sum('pax'),
                'checked_in_at' => $stay->checked_in_at->toIso8601String(),
                'checked_out_at' => $stay->checked_out_at?->toIso8601String(),
                'expected_check_out_at' => $stay->expected_check_out_at->toIso8601String(),
                'id_type' => $stay->idCustody?->idType->name,
                'id_status' => $stay->idCustody?->status->label(),
                'stay_id' => $stay->id,
            ])
            ->all());
    }

    /**
     * IDs reception still holds.
     *
     * @return list<array<string, mixed>>
     */
    public function idsHeld(): array
    {
        return array_values(IdCustody::query()
            ->where('status', '!=', IdCustodyStatus::Returned)
            ->with(['idType:id,name', 'stay.guest:id,name,company', 'stay.reservation:id,company', 'stay.rooms.room:id,name', 'receiver:id,name'])
            ->orderBy('id')
            ->get()
            ->map(fn (IdCustody $custody) => [
                'stay_id' => $custody->stay_id,
                'guest' => $custody->stay->guest->name,
                'company' => $custody->stay->reservation->company ?? $custody->stay->guest->company,
                'rooms' => $custody->stay->rooms->map(fn (StayRoom $line) => $line->room->name)->implode(', '),
                'id_type' => $custody->idType->name,
                'status' => $custody->status->label(),
                'received_by' => $custody->receiver->name,
                'since' => $custody->stay->checked_in_at->toIso8601String(),
                'checked_out' => $custody->stay->checked_out_at !== null,
            ])
            ->all());
    }

    /**
     * Stays that still owe money, grouped by company (all dates).
     *
     * @return list<array{company: string, stays: int, balance: float, oldest: string}>
     */
    public function unpaid(): array
    {
        $owing = Stay::query()
            ->with(['guest:id,name,company', 'reservation:id,company'])
            ->whereHas('charges')
            ->get()
            ->map(fn (Stay $stay) => ['stay' => $stay, 'balance' => $stay->balance()])
            ->filter(fn (array $row) => $row['balance'] > 0);

        return array_values($owing
            ->groupBy(fn (array $row) => $row['stay']->reservation->company ?? $row['stay']->guest->company ?? __('No company (:name)', ['name' => $row['stay']->guest->name]))
            ->map(fn (Collection $rows, string $company) => [
                'company' => $company,
                'stays' => $rows->count(),
                'balance' => round((float) $rows->sum('balance'), 2),
                'oldest' => $rows->min(fn (array $row) => $row['stay']->checked_in_at)->toIso8601String(),
                'stay_ids' => $rows->map(fn (array $row) => $row['stay']->id)->values()->all(),
            ])
            ->sortByDesc('balance')
            ->values()
            ->all());
    }

    /**
     * Share of room-nights used in the period, per location and overall.
     *
     * @return array{rooms: int, nights_available: float, nights_used: float, percent: int, locations: list<array<string, mixed>>}
     */
    public function occupancy(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $days = max(1, $from->diffInMinutes($to) / 1440);
        $rooms = Room::query()->with('location:id,name')->get();
        $used = $this->nightsUsed($from, $to);

        $locations = $rooms->groupBy(fn (Room $room) => $room->location->name)->map(function (Collection $list, string $name) use ($days, $used) {
            $nights = (float) $list->sum(fn (Room $room) => $used[$room->id] ?? 0);

            return [
                'location' => $name,
                'rooms' => $list->count(),
                'nights_used' => round($nights, 1),
                'percent' => (int) round($nights / ($list->count() * $days) * 100),
            ];
        })->sortKeys()->all();

        $total = array_sum($used);

        return [
            'rooms' => $rooms->count(),
            'nights_available' => round($rooms->count() * $days, 1),
            'nights_used' => round($total, 1),
            'percent' => $rooms->isEmpty() ? 0 : (int) round($total / ($rooms->count() * $days) * 100),
            'locations' => array_values($locations),
        ];
    }

    /**
     * Money in and out during the period.
     *
     * @return array<string, mixed>
     */
    public function income(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $payments = Payment::query()->whereBetween('paid_at', [$from, $to])->get(['amount', 'method', 'paid_by']);
        $refunds = Refund::query()->where('status', RefundStatus::Refunded)->whereBetween('refunded_at', [$from, $to])->get(['amount']);
        $charges = Charge::query()->whereBetween('created_at', [$from, $to])->get(['amount', 'type']);

        return [
            'received' => round((float) $payments->sum('amount'), 2),
            'refunded' => round((float) $refunds->sum('amount'), 2),
            'net' => round((float) $payments->sum('amount') - (float) $refunds->sum('amount'), 2),
            'payments' => $payments->count(),
            'by_method' => $payments->groupBy('method')->map(fn (Collection $list, string $method) => [
                'method' => $method,
                'count' => $list->count(),
                'amount' => round((float) $list->sum('amount'), 2),
            ])->sortByDesc('amount')->values()->all(),
            'charged' => round((float) $charges->sum('amount'), 2),
            'by_type' => $charges->groupBy(fn (Charge $charge) => $charge->type->label())->map(fn (Collection $list, string $type) => [
                'type' => $type,
                'amount' => round((float) $list->sum('amount'), 2),
            ])->sortByDesc('amount')->values()->all(),
        ];
    }

    /**
     * The last six months for the Admin dashboard: income, occupancy,
     * cancellations and no-shows per month, and the companies billed most.
     *
     * @return array{months: list<array<string, mixed>>, companies: list<array{company: string, amount: float}>}
     */
    public function trends(int $months = 6): array
    {
        $start = CarbonImmutable::now()->startOfMonth()->subMonths($months - 1);
        $payments = Payment::query()->where('paid_at', '>=', $start)->get(['amount', 'paid_at']);
        $refunds = Refund::query()->where('status', RefundStatus::Refunded)->where('refunded_at', '>=', $start)->get(['amount', 'refunded_at']);
        $ended = Reservation::query()
            ->whereIn('status', [ReservationStatus::Cancelled, ReservationStatus::NoShow])
            ->where('starts_at', '>=', $start)
            ->get(['status', 'starts_at']);
        $rooms = Room::query()->count();

        $rows = [];

        for ($i = 0; $i < $months; $i++) {
            $from = $start->addMonths($i);
            $to = $from->endOfMonth()->min(CarbonImmutable::now());
            $key = $from->format('Y-m');
            $days = max(1, $from->diffInMinutes($to) / 1440);
            $inMonth = fn ($date) => $date->format('Y-m') === $key;

            $rows[] = [
                'month' => $from->format('M Y'),
                'income' => round((float) $payments->filter(fn (Payment $payment) => $inMonth($payment->paid_at))->sum('amount')
                    - (float) $refunds->filter(fn (Refund $refund) => $refund->refunded_at !== null && $inMonth($refund->refunded_at))->sum('amount'), 2),
                'occupancy' => $rooms === 0 ? 0 : (int) round(array_sum($this->nightsUsed($from, $to)) / ($rooms * $days) * 100),
                'cancelled' => $ended->filter(fn (Reservation $r) => $r->status === ReservationStatus::Cancelled && $inMonth($r->starts_at))->count(),
                'no_shows' => $ended->filter(fn (Reservation $r) => $r->status === ReservationStatus::NoShow && $inMonth($r->starts_at))->count(),
            ];
        }

        $companies = Charge::query()
            ->where('created_at', '>=', $start)
            ->whereNotNull('stay_id')
            ->with(['stay.reservation:id,company', 'stay.guest:id,company'])
            ->get()
            ->groupBy(fn (Charge $charge) => $charge->stay->reservation->company ?? $charge->stay->guest->company ?? __('No company'))
            ->map(fn (Collection $list, string $company) => ['company' => $company, 'amount' => round((float) $list->sum('amount'), 2)])
            ->sortByDesc('amount')
            ->take(5)
            ->values()
            ->all();

        return ['months' => $rows, 'companies' => array_values($companies)];
    }

    /**
     * Nights each room was occupied inside the period (a part of a day counts as a part).
     *
     * @return array<int, float> room id => nights
     */
    private function nightsUsed(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $now = CarbonImmutable::now();
        $used = [];

        $lines = StayRoom::query()
            ->whereHas('stay', fn ($query) => $query
                ->where('checked_in_at', '<', $to)
                ->where(fn ($query) => $query->whereNull('checked_out_at')->orWhere('checked_out_at', '>', $from)))
            ->with('stay:id,checked_in_at,checked_out_at')
            ->get();

        foreach ($lines as $line) {
            $start = $line->stay->checked_in_at->max($from);
            $end = ($line->stay->checked_out_at ?? $now)->min($to);

            if ($end->gt($start)) {
                $used[$line->room_id] = ($used[$line->room_id] ?? 0) + $start->diffInMinutes($end) / 1440;
            }
        }

        return $used;
    }
}
