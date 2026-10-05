<?php

namespace App\Http\Controllers\Auth;

use App\Concerns\PasswordValidationRules;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\AccountSetup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * First-time password setup for accounts an Admin created. The person opens
 * the emailed link and chooses a password; the Admin never knows it.
 * "Forgot password" is a different flow (Fortify's reset-password).
 */
class SetPasswordController extends Controller
{
    use PasswordValidationRules;

    /** The broker for setup links: same token table, longer life (config/auth.php). */
    public const BROKER = 'invites';

    /** Email the setup link. Returns the broker's status, e.g. Password::RESET_LINK_SENT. */
    public static function sendLink(User $user): string
    {
        return Password::broker(self::BROKER)->sendResetLink(
            ['email' => $user->email],
            fn (User $user, string $token) => $user->notify(new AccountSetup($token)),
        );
    }

    public function create(Request $request, string $token): Response
    {
        return Inertia::render('auth/set-password', [
            'email' => (string) $request->query('email'),
            'token' => $token,
            'passwordRules' => PasswordRule::defaults()->toPasswordRulesString(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => $this->passwordRules(),
        ]);

        $status = Password::broker(self::BROKER)->reset(
            [...$validated, 'password_confirmation' => $request->input('password_confirmation')],
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => $password,
                    'password_set_at' => now(),
                    'remember_token' => Str::random(60),
                ])->save();
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => __('This link is no longer valid. Ask your administrator to send a new one.'),
            ]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Password saved. You can log in now.')]);

        return to_route('login')->with('status', __('Password saved. You can log in now.'));
    }
}
