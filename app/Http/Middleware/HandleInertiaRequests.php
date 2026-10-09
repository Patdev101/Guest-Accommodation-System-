<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            // What the public and guest screens show everywhere: how to reach the
            // front desk, the house rules' numbers, and the guest's own notices.
            'site' => fn () => $this->site(),
            'notices' => fn () => $this->notices($request),
        ];
    }

    /** @return array<string, mixed> */
    private function site(): array
    {
        $settings = Setting::values();

        return [
            'phone' => $settings['contact_phone'] ?: null,
            'email' => $settings['contact_email'] ?: null,
            'address' => $settings['contact_address'] ?: null,
            'check_in' => (string) $settings['standard_check_in_time'],
            'check_out' => (string) $settings['standard_check_out_time'],
            'grace_minutes' => (int) $settings['no_show_grace_minutes'],
            'hold_hours' => max(1, (int) $settings['booking_request_hold_hours']),
        ];
    }

    /**
     * The newest notices of a signed-in guest (staff have their own bell).
     *
     * @return array{unread: int, items: list<array<string, mixed>>}|null
     */
    private function notices(Request $request): ?array
    {
        $user = $request->user();

        if ($user === null || $user->role !== Role::Guest) {
            return null;
        }

        return [
            'unread' => $user->unreadNotifications()->count(),
            // No latest(): SQL Server rejects a column repeated in ORDER BY.
            'items' => array_values($user->notifications()->limit(8)->get()->map(fn (DatabaseNotification $notice) => [
                'id' => $notice->id,
                'title' => (string) ($notice->data['title'] ?? ''),
                'body' => (string) ($notice->data['body'] ?? ''),
                'url' => (string) ($notice->data['url'] ?? ''),
                'at' => $notice->created_at?->toIso8601String(),
                'read' => $notice->read_at !== null,
            ])->all()),
        ];
    }
}
