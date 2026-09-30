<?php

namespace App\Http\Controllers\Reception;

use App\Http\Controllers\Controller;
use App\Services\FrontDeskAlerts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/**
 * The bell in the header: the latest alerts and the unread count. The bell
 * asks every minute, which also runs the due-alert check when no scheduler
 * is set up.
 */
class AlertController extends Controller
{
    public const SHOWN = 15;

    public function index(Request $request, FrontDeskAlerts $alerts): JsonResponse
    {
        $alerts->runThrottled();

        return response()->json($this->state($request));
    }

    public function read(Request $request, string $alert): JsonResponse
    {
        $request->user()->notifications()->whereKey($alert)->first()?->markAsRead();

        return response()->json($this->state($request));
    }

    public function readAll(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json($this->state($request));
    }

    /**
     * @return array{unread: int, items: list<array<string, mixed>>}
     */
    private function state(Request $request): array
    {
        $user = $request->user();

        return [
            'unread' => $user->unreadNotifications()->count(),
            // notifications() is already newest first; ordering again breaks SQL Server.
            'items' => array_values($user->notifications()
                ->limit(self::SHOWN)
                ->get()
                ->map(fn (DatabaseNotification $notification) => [
                    'id' => $notification->id,
                    'kind' => $notification->data['kind'] ?? 'info',
                    'title' => $notification->data['title'] ?? '',
                    'body' => $notification->data['body'] ?? '',
                    'url' => $notification->data['url'] ?? null,
                    'read' => $notification->read_at !== null,
                    'created_at' => $notification->created_at?->toIso8601String(),
                ])
                ->all()),
        ];
    }
}
