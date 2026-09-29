<?php

namespace App\Http\Controllers\Admin;

use App\Enums\NoShowRefund;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SettingsRequest;
use App\Models\RateUnit;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Business rules the front desk works by (requirements sections 4, 5, 7 and 10).
 */
class SettingsController extends Controller
{
    /** Set on the first save; the dashboard checklist uses it. */
    public const REVIEWED_KEY = 'settings_reviewed_at';

    public function edit(): Response
    {
        $values = Setting::values();

        return Inertia::render('admin/settings', [
            'settings' => [
                'cleaning_buffer_minutes' => (int) $values['cleaning_buffer_minutes'],
                'no_show_grace_minutes' => (int) $values['no_show_grace_minutes'],
                'checkout_reminder_minutes' => (int) $values['checkout_reminder_minutes'],
                'no_show_refund' => $values['no_show_refund'],
                'no_show_refund_percent' => (int) $values['no_show_refund_percent'],
            ],
            'rateUnits' => RateUnit::query()
                ->withCount('rates')
                ->orderBy('id')
                ->get()
                ->map(fn (RateUnit $unit) => [
                    'id' => $unit->id,
                    'name' => $unit->name,
                    'rates_count' => $unit->rates_count,
                ]),
            'lastSaved' => Setting::query()->find(self::REVIEWED_KEY)?->value,
        ]);
    }

    public function update(SettingsRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        if ($validated['no_show_refund'] !== NoShowRefund::Partial->value) {
            $validated['no_show_refund_percent'] = $validated['no_show_refund'] === NoShowRefund::Full->value ? 100 : 0;
        }

        DB::transaction(function () use ($validated) {
            foreach ($validated as $key => $value) {
                Setting::set($key, (string) $value);
            }

            Setting::set(self::REVIEWED_KEY, now()->toIso8601String());
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Settings saved.')]);

        return to_route('admin.settings.edit');
    }
}
