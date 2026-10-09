<?php

namespace App\Notifications;

use App\Enums\BookingRequestStatus;
use App\Models\BookingRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Tells the guest by email what happened to their booking request: approved,
 * declined (with the reason) or expired.
 */
class BookingRequestAnswered extends Notification
{
    use Queueable;

    public function __construct(public BookingRequest $request) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    /**
     * The same news under the guest's bell.
     *
     * @return array{title: string, body: string, url: string}
     */
    public function toArray(object $notifiable): array
    {
        $dates = $this->request->starts_at->format('j M').' to '.$this->request->ends_at->format('j M Y');

        return match ($this->request->status) {
            BookingRequestStatus::Approved => ['title' => 'Your booking is confirmed', 'body' => "Your request for {$dates} was approved.", 'url' => route('guest.home')],
            BookingRequestStatus::Declined => ['title' => 'Your request was declined', 'body' => "For {$dates}. Reason: {$this->request->decline_reason}", 'url' => route('guest.home')],
            default => ['title' => 'Your request has expired', 'body' => "For {$dates}. It was not answered in time, so the room is no longer held.", 'url' => route('guest.home')],
        };
    }

    public function toMail(object $notifiable): MailMessage
    {
        $dates = $this->request->starts_at->format('j M Y').' to '.$this->request->ends_at->format('j M Y');
        $mail = (new MailMessage)->greeting(__('Hello :name,', ['name' => $this->request->contact_name]));

        return match ($this->request->status) {
            BookingRequestStatus::Approved => $mail
                ->subject(__('Your booking is confirmed'))
                ->line(__('Good news: your booking request for :dates is approved and your room is reserved.', ['dates' => $dates]))
                ->line(__('Please bring one valid ID when you arrive.'))
                ->action(__('See my bookings'), route('guest.home')),
            BookingRequestStatus::Declined => $mail
                ->subject(__('About your booking request'))
                ->line(__('We are sorry: we could not approve your booking request for :dates.', ['dates' => $dates]))
                ->line(__('Reason: :reason', ['reason' => (string) $this->request->decline_reason]))
                ->action(__('Look for another room'), route('rooms.index')),
            default => $mail
                ->subject(__('Your booking request has expired'))
                ->line(__('Your booking request for :dates was not answered in time, so the room is no longer held.', ['dates' => $dates]))
                ->action(__('Send a new request'), route('rooms.index')),
        };
    }
}
