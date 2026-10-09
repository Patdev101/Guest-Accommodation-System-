<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * An in-app alert (rule 27), shown under the bell in the header.
 */
class FrontDeskAlert extends Notification
{
    use Queueable;

    /** Alerts for reception. */
    public const DESK_KINDS = ['checkout_call', 'not_arrived', 'arriving', 'room_clash', 'booked', 'changed', 'cancelled', 'room_ready', 'extension_waiting', 'extension', 'request'];

    /** Alerts that need action now; these can also be emailed (setting alert_emails). */
    public const URGENT_KINDS = ['checkout_call', 'not_arrived', 'room_clash', 'extension_waiting', 'request'];

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
        return $this->mail ? ['mail'] : ['database'];
    }

    /** True for a copy that is emailed instead of shown under the bell. */
    private bool $mail = false;

    public function isUrgent(): bool
    {
        return in_array($this->kind, self::URGENT_KINDS, true);
    }

    /** The same alert as an email. */
    public function byMail(): static
    {
        $copy = clone $this;
        $copy->mail = true;

        return $copy;
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject($this->title)
            ->line($this->body)
            ->action(__('Open in the system'), $this->url)
            ->line(__('You get this email because urgent front-desk alerts are switched on.'));
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
