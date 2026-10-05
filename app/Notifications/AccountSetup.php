<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent when an Admin creates an account: the person sets their own password
 * from the link. Separate from the "forgot password" email.
 */
class AccountSetup extends Notification
{
    public function __construct(public string $token) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        $days = (int) (config('auth.passwords.invites.expire') / 1440);

        return (new MailMessage)
            ->subject(__('Set up your :app account', ['app' => config('app.name')]))
            ->greeting(__('Hello :name,', ['name' => $notifiable->name]))
            ->line(__('An administrator created a :role account for you.', ['role' => $notifiable->role->label()]))
            ->line(__('Choose your own password to start using it.'))
            ->action(__('Set up my password'), route('password.setup', [
                'token' => $this->token,
                'email' => $notifiable->email,
            ]))
            ->line(trans_choice('{1} This link works for 1 day.|[2,*] This link works for :count days.', $days))
            ->line(__('If you were not expecting this, you can ignore this email.'));
    }
}
