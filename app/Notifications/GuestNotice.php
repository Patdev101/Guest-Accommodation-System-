<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Throwable;

/**
 * A short message for a guest, shown under the bell on their screens (rule 27):
 * a booking answered or cancelled, a check-out coming up, a stay extended.
 */
class GuestNotice extends Notification
{
    use Queueable;

    public function __construct(public string $title, public string $body, public string $url) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array{title: string, body: string, url: string} */
    public function toArray(object $notifiable): array
    {
        return ['title' => $this->title, 'body' => $this->body, 'url' => $this->url];
    }

    /**
     * Tell the guest, when the booking belongs to an account. Bookings made at
     * the front desk for someone without an account have nobody to tell.
     */
    public static function tell(?User $user, string $title, string $body, ?string $url = null): void
    {
        if ($user === null) {
            return;
        }

        try {
            $user->notify(new self($title, $body, $url ?? route('guest.home')));
        } catch (Throwable $exception) {
            // A notice must never stop the front desk's work.
            report($exception);
        }
    }
}
