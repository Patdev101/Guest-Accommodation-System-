<?php

namespace App\Http\Controllers\Admin;

use App\Enums\NoShowRefund;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SettingsRequest;
use App\Models\IdType;
use App\Models\RateUnit;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

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
                'standard_check_in_time' => $values['standard_check_in_time'],
                'standard_check_out_time' => $values['standard_check_out_time'],
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
            'idTypes' => IdType::query()
                ->withCount('custodyRecords')
                ->orderBy('id')
                ->get()
                ->map(fn (IdType $type) => [
                    'id' => $type->id,
                    'name' => $type->name,
                    'is_active' => $type->is_active,
                    'used_count' => $type->custody_records_count,
                ]),
            'lastSaved' => Setting::query()->find(self::REVIEWED_KEY)?->value,
            'mail' => [
                'mailer' => config('mail.default'),
                'host' => config('mail.mailers.smtp.host'),
                'port' => config('mail.mailers.smtp.port'),
                'from' => config('mail.from.address'),
            ],
        ]);
    }

    /** Send a test email to the Admin, to check the mail settings in .env. */
    public function testEmail(Request $request): RedirectResponse
    {
        $user = $request->user();

        try {
            Mail::raw(
                __("This is a test email from :app.\n\nIf you can read this, password reset emails will be delivered too.", ['app' => config('app.name')]),
                fn ($message) => $message->to($user->email, $user->name)->subject(__('Test email from :app', ['app' => config('app.name')])),
            );
        } catch (Throwable $exception) {
            report($exception);

            Inertia::flash('toast', ['type' => 'error', 'message' => __('The email could not be sent: :reason', ['reason' => Str::limit($exception->getMessage(), 140)])]);

            return to_route('admin.settings.edit');
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Test email sent to :email.', ['email' => $user->email])]);

        return to_route('admin.settings.edit');
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
