<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Who changed what, and when, newest first.
 */
class ActivityLogController extends Controller
{
    /** Readable names for the record types that are logged. */
    private const TYPES = [
        'Reservation' => 'Reservations',
        'Payment' => 'Payments',
        'Refund' => 'Refunds',
        'Room' => 'Rooms',
        'RoomRate' => 'Rates',
        'RoomInclusion' => 'Inclusions',
        'RoomPhoto' => 'Photos',
        'MaintenanceRecord' => 'Maintenance',
        'Location' => 'Locations',
        'RateUnit' => 'Rate units',
        'IdType' => 'ID types',
        'Setting' => 'Settings',
        'User' => 'Accounts',
    ];

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'user' => ['nullable', 'integer'],
            'type' => ['nullable', 'string', 'in:'.implode(',', array_keys(self::TYPES))],
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $entries = ActivityLog::query()
            ->with('user:id,name')
            ->when($filters['user'] ?? null, fn ($query, $user) => $query->where('user_id', $user))
            ->when($filters['type'] ?? null, fn ($query, $type) => $query->where('subject_type', $type))
            ->when($filters['search'] ?? null, fn ($query, $search) => $query->where('description', 'like', '%'.$search.'%'))
            ->when($filters['from'] ?? null, fn ($query, $from) => $query->where('created_at', '>=', $from.' 00:00:00'))
            ->when($filters['to'] ?? null, fn ($query, $to) => $query->where('created_at', '<=', $to.' 23:59:59'))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (ActivityLog $entry) => [
                'id' => $entry->id,
                'when' => $entry->created_at->format('Y-m-d H:i'),
                'who' => $entry->user?->name,
                'action' => $entry->action,
                'type' => self::TYPES[$entry->subject_type] ?? $entry->subject_type,
                'description' => $entry->description,
                'changes' => $entry->changes,
                'ip_address' => $entry->ip_address,
            ]);

        return Inertia::render('admin/activity', [
            'entries' => $entries,
            'filters' => [
                'user' => $filters['user'] ?? null,
                'type' => $filters['type'] ?? null,
                'search' => $filters['search'] ?? '',
                'from' => $filters['from'] ?? '',
                'to' => $filters['to'] ?? '',
            ],
            'users' => User::query()
                ->whereIn('id', ActivityLog::query()->select('user_id')->whereNotNull('user_id'))
                ->orderBy('name')
                ->get(['id', 'name']),
            'types' => collect(self::TYPES)->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])->values(),
        ]);
    }
}
