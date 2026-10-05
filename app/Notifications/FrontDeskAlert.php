<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * An in-app alert (rule 27), shown under the bell in the header.
 */
class FrontDeskAlert extends Notification
{
    use Queueable;

    /** Alerts for reception. */
    public const DESK_KINDS = ['checkout_call', 'not_arrived', 'arriving', 'booked', 'changed', 'cancelled', 'room_ready', 'extension_waiting', 'extension'];

    /** Alerts for the Admin. */
    public const ADMIN_KINDS = ['repair'];

    public function __construct(
        public string $kind,
        public string $title,
        public string $body,
        public string $url,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array{kind: string, title: string, body: string, url: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->kind,
            'title' => $this->title,
            'body' => $this->body,
            'url' => $this->url,
        ];
    }
}
