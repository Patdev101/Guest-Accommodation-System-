<?php

namespace App\Http\Controllers\Reception;

use App\Enums\IdCustodyStatus;
use App\Http\Controllers\Controller;
use App\Models\Stay;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * One list of what is still open: stays that owe money and IDs still held
 * (rule 24: the ID goes back only when the bill is fully paid).
 */
class PendingController extends Controller
{
    public const FILTERS = [
        'checked_out' => 'Checked out',
        'all' => 'Everyone, with guests in house',
    ];

    public function __invoke(Request $request): Response
    {
        $show = $request->validate([
            'show' => ['nullable', Rule::in(array_keys(self::FILTERS))],
        ])['show'] ?? 'checked_out';

        $rows = Stay::query()
            ->with(['guest:id,name,contact_number,company', 'reservation:id,company', 'rooms.room:id,name', 'idCustody.idType:id,name'])
            ->when($show === 'checked_out', fn (Builder $query) => $query->whereNotNull('checked_out_at'))
            ->where(fn (Builder $query) => $query
                ->whereHas('charges')
                ->orWhereHas('idCustody', fn (Builder $custody) => $custody->where('status', '!=', IdCustodyStatus::Returned)))
            ->orderBy('checked_in_at')
            ->get()
            ->map(function (Stay $stay) {
                $custody = $stay->idCustody;
                $held = $custody !== null && $custody->status !== IdCustodyStatus::Returned;

                return [
                    ...StayController::row($stay),
                    'owes' => max(0, $stay->balance()),
                    'id_held' => $held,
                    'id_type' => $held ? $custody->idType->name : null,
                    'id_number' => $held ? $custody->id_number : null,
                    'photo_url' => $held && $custody->photo_path ? route('reception.id-photos.show', $custody) : null,
                ];
            })
            ->filter(fn (array $row) => $row['owes'] > 0 || $row['id_held'])
            ->values();

        return Inertia::render('reception/pending', [
            'rows' => $rows,
            'show' => $show,
            'filterOptions' => collect(self::FILTERS)->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])->values(),
            'totals' => [
                'owed' => round((float) $rows->sum('owes'), 2),
                'unpaid' => $rows->where('owes', '>', 0)->count(),
                'ids_held' => $rows->where('id_held', true)->count(),
            ],
        ]);
    }
}
