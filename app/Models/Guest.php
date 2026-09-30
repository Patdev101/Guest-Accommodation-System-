<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use App\Enums\GuestType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int|null $user_id
 * @property string $name
 * @property GuestType $type
 * @property string|null $company
 * @property string $contact_number
 * @property string|null $email
 */
#[Fillable(['user_id', 'name', 'type', 'company', 'contact_number', 'email'])]
class Guest extends Model
{
    use CastsKeysToIntegers;

    protected function casts(): array
    {
        return ['type' => GuestType::class];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<Reservation, $this> */
    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    /** @return HasMany<Stay, $this> */
    public function stays(): HasMany
    {
        return $this->hasMany(Stay::class);
    }

    /** @return HasMany<VerificationAttempt, $this> */
    public function verificationAttempts(): HasMany
    {
        return $this->hasMany(VerificationAttempt::class);
    }
}
