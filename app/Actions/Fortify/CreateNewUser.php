<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Enums\GuestType;
use App\Enums\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules, ProfileValidationRules;

    /**
     * Validate and create a newly registered user. Self-registration always
     * creates a Guest account; Reception and Admin accounts are made by an Admin.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            ...$this->profileRules(),
            'contact_number' => $this->contactNumberRules(),
            'password' => $this->passwordRules(),
        ])->validate();

        return DB::transaction(function () use ($input) {
            $user = User::create([
                'name' => $input['name'],
                'email' => $input['email'],
                'contact_number' => $input['contact_number'],
                'password' => $input['password'],
                'role' => Role::Guest,
            ]);

            $user->guest()->create([
                'name' => $user->name,
                'type' => GuestType::Visitor,
                'contact_number' => $user->contact_number,
            ]);

            return $user;
        });
    }
}
